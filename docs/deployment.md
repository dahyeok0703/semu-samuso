# 배포 가이드 (Vercel + Supabase)

## 1. 환경변수 (최종)

> 앱은 graceful degradation 으로 설계되어, 선택 통합 키가 없으면 해당 기능만 비활성화됩니다.
> 단 **정식 출시(결제·AI 포함)** 에는 아래 REQUIRED 를 모두 채워야 합니다.

### REQUIRED (정식 출시)

| 변수                              | 설명                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase 프로젝트 URL (공개)                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Supabase anon 키 (공개·publishable)                        |
| `SUPABASE_SERVICE_ROLE_KEY`       | 서비스롤 키 — 감사로그·사용량·웹훅·빌링 시스템 쓰기 (서버) |
| `ANTHROPIC_API_KEY`               | Claude API — 자료 자동 분류 (서버)                         |
| `PORTONE_API_SECRET`              | PortOne V2 API 시크릿 (서버)                               |
| `PORTONE_WEBHOOK_SECRET`          | PortOne 웹훅 서명 시크릿 `whsec_...` (서버)                |
| `NEXT_PUBLIC_PORTONE_STORE_ID`    | PortOne store id (공개 SDK)                                |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | 토스페이먼츠 빌링 채널 키 (공개 SDK)                       |
| `CRON_SECRET`                     | `/api/cron/*` 보호용 시크릿 (프로덕션 필수)                |
| `NEXT_PUBLIC_SITE_URL`            | 공개 도메인(인증 콜백·OG·sitemap) — 강력 권장              |

### OPTIONAL (있으면 활성, 없으면 우아하게 비활성)

| 변수                                                                                                  | 기능                                   |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `SMTP_FROM`                                   | 앱 발신 이메일(독촉·초대). 없으면 로그 |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` · `SOLAPI_SENDER` · `SOLAPI_PFID` · `SOLAPI_KAKAO_TEMPLATE_ID` | 카카오 알림톡·SMS. 없으면 이메일 폴백  |
| `SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN`                                                               | 에러 모니터링. 없으면 no-op + 로그     |
| `SUPERUSER_EMAILS`                                                                                    | 내부 마진 모니터(`/admin`) 접근        |
| `AI_DAILY_CLASSIFY_LIMIT`                                                                             | 일일 분류 한도(기본 500)               |
| `RATE_LIMIT_DISABLED`                                                                                 | 레이트리밋 비활성(로컬 부하테스트)     |
| CODEF (스크래핑 연동)                                                                                 | **미구현/예정** — 키 추가 예정         |

`env.ts` 가 부팅 시 검증하며, 핵심 설정(Supabase URL/anon) 누락 시 부팅을 중단합니다.
비밀을 `NEXT_PUBLIC_`으로 노출하면 부팅 가드가 차단합니다.

## 2. Supabase 프로덕션 준비

```bash
# 1) 프로젝트 연결
supabase link --project-ref <YOUR_PROJECT_REF>

# 2) 마이그레이션 적용 (0001 → 0013 순서대로)
supabase db push

# 3) (선택) 타입 재생성 — 스키마 변경 시
supabase gen types typescript --linked > src/types/database.types.ts
```

- **Storage**: `documents` 버킷은 마이그레이션(0007/0013)으로 생성·하드닝됩니다
  (private + 경로 RLS + 20MB/MIME 제한). 별도 수동 생성 불필요.
- **Auth**: 이메일 확인(Confirm email) 활성 권장. 발신 도메인 SMTP/SPF/DKIM 설정.
  (e2e 테스트 프로젝트는 확인을 끄세요 — playwright.config 주석 참고)
- **RLS**: 모든 정책은 마이그레이션에 포함. 적용 후 `pnpm test:rls:local`(또는
  `supabase test db`)로 격리 검증.

## 3. Vercel 배포

1. Vercel 에서 GitHub 저장소 import → Framework: **Next.js** (자동 감지).
2. Build Command/Output: 기본값(`next build`).
3. **Environment Variables**: 위 표의 값을 Production(및 Preview) 환경에 입력.
4. Deploy.

## 4. Cron 등록

`vercel.json` 에 4개 크론이 정의되어 있습니다(Vercel 가 자동 등록).

| 경로                  | 일정           | 역할                           |
| --------------------- | -------------- | ------------------------------ |
| `/api/cron/reminders` | `0 0 * * *`    | 자료 미제출 독촉 발송          |
| `/api/cron/billing`   | `30 0 * * *`   | 체험/그레이스 만료 → free 강등 |
| `/api/cron/margin`    | `0 1 * * *`    | 마진 계산·플래그·슈퍼유저 알림 |
| `/api/cron/ai-batch`  | `*/30 * * * *` | Batch 분류 결과 하베스트       |

- Vercel Cron 은 호출 시 `Authorization: Bearer $CRON_SECRET` 를 보냅니다 →
  반드시 `CRON_SECRET` 을 설정하세요(미설정 시 프로덕션에서 503).
- Vercel 외 환경에서는 Supabase `pg_cron` + `pg_net` 으로 동일 엔드포인트를 호출하도록
  대체할 수 있습니다.

## 5. 웹훅 등록

PortOne 콘솔 → 웹훅 URL 에 `https://<도메인>/api/webhooks/portone` 등록,
시크릿을 `PORTONE_WEBHOOK_SECRET` 에 입력(서명 검증). 자세한 흐름은
`docs/billing-test-flow.md`.

## 6. CI

`.github/workflows/ci.yml` (PR 게이트): lint · typecheck · test(vitest) · build +
RLS/권한 pgTAP. e2e 는 `.github/workflows/e2e.yml`(수동/주간, 테스트 Supabase 필요).
