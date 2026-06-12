# 비용 계측 + 마진 보호

목표: **어떤 고객이 와도 그 계정의 마진이 목표치(기본 50%) 아래로 떨어지지 않게**
코드로 보장한다. 변동비의 위험 레버는 'AI 분류 문서 수' 하나뿐이므로 **쿼터 +
오버리지**로 통제한다.

## 설정 한 곳: `src/lib/pricing/cogs.ts`

단가·환율·PG수수료·메시지단가·목표마진·플랜별 쿼터·초과정책을 전부 여기서 조정한다.
가격 정책이 바뀌어도 코드 수정 없이 이 파일의 상수만 바꾸면 된다.

| 설정                   | 기본값                               |
| ---------------------- | ------------------------------------ |
| `USD_TO_KRW`           | 1,400                                |
| 모델 단가(USD/MTok)    | Haiku 1/5, Sonnet 3/15               |
| `CACHE_READ_DISCOUNT`  | 0.1 (prompt caching)                 |
| `BATCH_DISCOUNT`       | 0.5 (Batch API)                      |
| `PG_FEE_RATE`          | 0.03                                 |
| `MESSAGE_COST_KRW`     | kakao 8 / sms 20 / email 1 / inapp 0 |
| `TARGET_MARGIN`        | 0.5                                  |
| `PLAN_DOC_QUOTA`       | free 30 / team 400×석 / pro 10,000   |
| `DEFAULT_QUOTA_POLICY` | free=hardcap, team/pro=overage       |
| `OVERAGE_MULTIPLIER`   | 2 (원가 × 2로 과금)                  |

## 흐름

```
업로드 → POST /api/classify
  ├─ 일일 한도(AI_DAILY_CLASSIFY_LIMIT)
  ├─ ★월 쿼터 판정  decideDocQuota(workspace, 이번달 doc_count)
  │     ├─ ok       → 분류 진행
  │     ├─ overage  → 분류 진행 + 문서당 (원가×2) 자동 과금(ai_usage.overage_*)
  │     └─ blocked  → 402 QUOTA_EXCEEDED, 자동분류 중단(수동 모드)
  ├─ Haiku 4.5 고정 + system 프롬프트 prompt caching(90%↓)
  ├─ confidence 낮을 때만 Sonnet 4.6 폴백
  └─ usage(토큰/원가) → ai_usage 적재 (cogs.ts 단가로 계산)

급하지 않은 분류 → enqueueBatchClassifyAction → Batch API(50%↓)
  └─ /api/cron/ai-batch 가 폴링·반영, 원가는 batch=true(절반)로 적재
```

## 쿼터 / 오버리지

- **포함 문서 수** = `base + perSeat × 시트수` (team은 시트에 비례 → 매출과 동행).
- **하드캡**: 한도 소진 시 분류 중단 → 수동 모드. (free 기본)
- **오버리지**: 한도 초과분을 문서당 (원가 × 배수)로 자동 과금 → 마진 보존. (team/pro 기본)
- 워크스페이스별로 `workspaces.ai_quota_policy` 로 override 가능.

## 마진 계산 / 모니터링

`computeMargin({ mrr, extraRevenue, aiCost, messageCost })`:

```
revenue = MRR + 오버리지매출
cogs    = AI원가 + 메시지원가 + PG수수료(revenue × 3%)
margin  = (revenue − cogs) / revenue
flagged = margin < TARGET_MARGIN
```

- **owner 대시보드**: 이번 달 문서 사용량/쿼터 게이지 + 남은 한도(`/dashboard`).
- **내부(슈퍼유저) 마진 모니터**: `/admin` 하단(이메일이 `SUPERUSER_EMAILS` 일 때만).
  워크스페이스별 MRR vs COGS·마진율, 목표 미만 자동 플래그.
- **크론** `/api/cron/margin` (매일): `margin_flags` 적재 + 신규 플래그를 슈퍼유저
  이메일로 통지.

### 예시 (team 5석)

```
매출 ₩49,500 + 문서 2,000건 포함
AI원가 ~₩10,000(20%) + PG ₩1,485(3%) → COGS ₩11,485
마진 ≈ 76%  (가격 ≥ 변동비 × 2 충족)
```

문서가 폭주해 2,000건을 넘으면, team은 오버리지로 문서당 ₩10(원가 ₩5 × 2)을 과금해
초과 사용분의 마진도 양수로 유지한다. free는 하드캡으로 30건에서 자동분류가 멈춘다.

## 보안

- `ai_usage`·`margin_flags` 등 원가/마진 지표는 워크스페이스 외부로 노출하지 않는다.
  `ai_usage` 는 owner 전용(RLS), `margin_flags` 는 **service_role 전용**(authenticated
  권한 없음 — 빌링키와 동일한 격리).
- 크로스-워크스페이스 집계(`getMarginMonitor`)는 service_role 로만 동작하고, 페이지에서
  `isSuperuser(email)` 로 한 번 더 가드한다.

## 테스트

```bash
pnpm test            # cogs 단가·쿼터·마진 계산(16) + 기존
pnpm test:rls:local  # margin_flags 내부 격리·classification_jobs 워크스페이스 격리
```
