# 구독 결제 테스트 가이드 (PortOne v2)

이 문서는 포트원(PortOne) v2 빌링키 정기결제 연동을 **테스트 모드**에서 검증하는
방법을 정리합니다. 결제 로직은 어댑터(`src/lib/billing/provider.ts`)로 분리되어 있어
PortOne → 토스페이먼츠 직연동으로 교체해도 호출부는 바뀌지 않습니다.

## 1. 아키텍처 한눈에 보기

```
브라우저 SDK(requestIssueBillingKey)         서버
  └─ billingKey 발급 ───────────► subscribeAction
                                    ├─ billing_accounts에 billingKey 저장(서비스롤 전용)
                                    ├─ provider.charge() 첫 회차 즉시 결제
                                    ├─ payments 적재 + workspaces.subscription_status=active
                                    └─ provider.schedule() 다음 달 예약
PortOne ── 웹훅(Standard Webhooks) ──► POST /api/webhooks/portone
                                    ├─ 서명 검증(HMAC-SHA256, replay 방지)
                                    ├─ event_key 유니크로 멱등 처리
                                    ├─ provider.getPayment()로 사실 재확인(본문 불신뢰)
                                    └─ payments/구독 상태 갱신, 성공 시 다음 회차 재예약
```

핵심 파일

- 어댑터 인터페이스: `src/lib/billing/provider.ts`
- PortOne v2 구현: `src/lib/billing/portone.ts`
- 웹훅 서명 검증: `src/lib/billing/webhook.ts` (Standard Webhooks)
- 구독 라이프사이클/멱등 처리: `src/lib/billing/service.ts`
- 서버 액션: `src/lib/billing/actions.ts`
- 플랜/한도/엔타이틀먼트: `src/lib/billing/plans.ts`, `entitlements.ts`, `gating.ts`

## 2. 사전 준비 (테스트 키)

PortOne 콘솔(테스트 모드)에서 발급:

| 환경변수                          | 설명                                               |
| --------------------------------- | -------------------------------------------------- |
| `PORTONE_API_SECRET`              | V2 API Secret (서버 전용)                          |
| `PORTONE_WEBHOOK_SECRET`          | 웹훅 시크릿 `whsec_...`                            |
| `NEXT_PUBLIC_PORTONE_STORE_ID`    | `store-...`                                        |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | **토스페이먼츠 빌링** 채널 키                      |
| `SUPABASE_SERVICE_ROLE_KEY`       | 빌링키 저장(서비스롤 전용 테이블)·웹훅 처리에 필요 |

> 키가 **하나라도 없으면** 결제 UI는 "준비중"으로 비활성화되고, 앱의 나머지 기능은
> 정상 동작합니다(graceful degradation). 즉 내부용/개발용으로 결제 없이 런칭 가능합니다.

`.env.local` 예시는 `.env.example`의 PortOne 섹션을 참고하세요.

## 3. 테스트 결제 흐름

1. **로컬 실행**: `pnpm dev` 후 owner 계정으로 로그인 → `/billing` 진입.
2. **무료체험(선택)**: `구독 없음` 상태에서 **무료체험 시작** → 14일 trial, 결제 없이
   Pro 기능 활성. 만료되면 `/api/cron/billing` 또는 엔타이틀먼트 계산으로 free 강등.
3. **구독 시작**: 플랜(Team/Pro)·시트 수 선택 → **구독 시작** 클릭 → PortOne 결제창에서
   **테스트 카드**로 빌링키 발급.
   - 토스페이먼츠 테스트 카드: 콘솔 → 결제연동 → 테스트 카드 번호 사용
     (예: `4000-0000-0000-0000` 류의 테스트 PAN, 유효기간/CVC 임의값).
4. 발급 성공 시 서버가 첫 회차를 즉시 결제하고 `payments`에 `paid` 적재,
   `구독 중` 배지와 청구 내역이 표시됩니다.
5. **플랜/시트 변경**: 카드가 등록된 상태에서 값 변경 후 **플랜 변경** → 다음 회차부터
   새 금액으로 재예약.
6. **결제수단 변경**: **결제수단 변경** → 새 빌링키 발급 → 이전 키는 best-effort 폐기.
7. **구독 취소/재개**: **구독 취소**는 이용 기간 말 해지(`cancel_at_period_end`),
   **구독 재개**는 예약을 되살립니다.

## 4. 웹훅 테스트

PortOne 콘솔에서 웹훅 URL을 등록합니다.

```
https://<your-host>/api/webhooks/portone
```

로컬에서는 터널(예: `cloudflared tunnel`/`ngrok`)로 외부 노출 후 등록하세요.

검증 포인트

- **서명 검증**: 잘못된 서명 → `401`. (단위 테스트:
  `src/lib/billing/__tests__/webhook.test.ts` — 변조/위조/만료(replay)/회전 키)
- **멱등성**: 동일 `webhook-id` 재전송 → `billing_events.event_key` 유니크 제약으로
  중복 무시(`{ duplicate: true }`). 같은 결제건 재처리해도 `payments`는 upsert로 1건 유지.
- **본문 불신뢰**: 웹훅 수신 시 금액/상태를 본문이 아니라 `provider.getPayment()`로
  재조회해 반영합니다.

수동 호출 예시(서명 없이 — 키 미설정 시 ack):

```bash
curl -X POST http://localhost:3000/api/webhooks/portone \
  -H 'content-type: application/json' \
  -d '{"type":"Transaction.Paid","data":{"paymentId":"pay_<workspaceId>_<epoch>"}}'
```

## 5. 결제 실패 → 그레이스 → 강등

- 정기 결제 실패 웹훅 → `subscription_status=past_due`,
  `grace_until = now + 3일`. 그레이스 기간에는 기존 플랜 유지(상단 배너 안내).
- 그레이스 종료 후 `/api/cron/billing`(매일 1회) 또는 엔타이틀먼트 계산이 free로 강등.
- 체험 만료·해지도 동일하게 `current_period_end`/`trial_ends_at` 기준으로 free 전환.

## 6. 기능 게이팅 확인

- free: 거래처 11건째 등록 시도 → `FORBIDDEN`(한도 안내). 직원 2번째 초대 → 차단.
- team: 거래처·직원 무제한. 카카오 알림톡 채널 선택 시 → Pro 안내로 차단.
- pro: 카카오 알림톡/코드에프 연동 활성.
- 단위 테스트: `src/lib/billing/__tests__/entitlements.test.ts`.

## 7. 자동화 테스트

```bash
pnpm test                 # 결제 로직 단위 테스트(엔타이틀먼트/서명/멱등 id)
pnpm test:rls:local       # billing RLS pgTAP: 영수증 owner 전용·빌링키 비노출·멱등
```

> ⚠️ 빌링키 등 민감정보는 `billing_accounts`(서비스롤 전용 테이블)에만 저장되며
> authenticated 사용자에게는 테이블 권한 자체가 없습니다. 화면에는 카드 브랜드/끝 4자리
> 같은 표시용 정보만 `workspaces`에서 노출합니다.
