# 세무사무소 업무 SaaS (semu-samuso)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/dahyeok0703/semu-samuso)

세무사무소 내부 업무를 관리하는 멀티테넌트 웹 애플리케이션입니다. 거래처·신고·마감·수임을
한 곳에서 관리하는 것을 목표로 하며, 현재는 인증/멀티테넌시/앱 셸 골격까지 구현되어 있습니다.

## ▶ StackBlitz에서 바로 열기

위 **Open in StackBlitz** 배지를 누르면 브라우저에서 바로 실행됩니다. 또는 GitHub 주소
앞에 `stackblitz.com/github/` 를 붙이면 됩니다:

```
https://stackblitz.com/github/dahyeok0703/semu-samuso
# 특정 브랜치: https://stackblitz.com/github/dahyeok0703/semu-samuso/tree/<branch>
```

- `.stackblitzrc` 가 `pnpm dev` 로 자동 실행하고, Supabase **데모 placeholder** 환경변수를
  주입해 부팅 크래시 없이 뜨도록 합니다(`env.ts` 의 필수값 검증 통과).
- StackBlitz(WebContainer)에는 실제 Supabase/DB가 없으므로 **공개 화면(랜딩 `/`, `/features`,
  `/pricing`, `/faq`, `/legal/*`)** 이 동작합니다. 로그인·대시보드 등 인증 화면은 실제 Supabase
  키가 필요하니, 직접 써 보려면 `.env.local` 에 본인 키를 넣고 로컬에서 실행하세요(아래 5분 셋업).

## 기술 스택

- **Next.js 15** (App Router, TypeScript strict)
- **Supabase** (Postgres + Auth + Storage + SMTP), 마이그레이션은 Supabase CLI로 관리
- **Tailwind CSS v4** + **shadcn/ui** + lucide-react
- **react-hook-form** + **zod**, 데이터는 서버 컴포넌트 + server actions
- **pnpm**

자세한 아키텍처·도메인 용어·코드 원칙은 [`CLAUDE.md`](./CLAUDE.md)를 참고하세요.

## ⚡ 5분 셋업 (프로덕션 배포)

1. **Supabase 프로젝트 만들기** — [supabase.com](https://supabase.com) 에서 새 프로젝트
   생성 → Settings/API 에서 `Project URL`, `anon key`, `service_role key` 확보.
2. **마이그레이션 적용** — 로컬에서:
   ```bash
   pnpm install
   supabase link --project-ref <YOUR_REF>
   supabase db push        # 0001 → 0013 적용 (Storage 버킷·RLS 포함)
   ```
3. **키 3종(+) 입력** — Vercel 환경변수에 최소 다음을 넣습니다:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (+ AI/결제까지면 `ANTHROPIC_API_KEY`, `PORTONE_*`).
4. **배포** — GitHub 저장소를 [Vercel](https://vercel.com) 에 import → Deploy.
   크론 4종은 `vercel.json` 으로 자동 등록됩니다(`CRON_SECRET` 설정 필요).

> 전체 변수표·Supabase/Vercel/Cron 절차는 [`docs/deployment.md`](./docs/deployment.md),
> 출시 점검은 [`LAUNCH.md`](./LAUNCH.md) 를 따르세요. 선택 통합(SMTP/Solapi/Sentry)이
> 없어도 핵심 기능은 정상 동작합니다(graceful degradation).

## 사전 요구사항

- Node.js 20+ (권장 22)
- pnpm 9+
- Docker (로컬 Supabase 실행용) — [Supabase CLI 문서](https://supabase.com/docs/guides/cli) 참고

## 로컬 실행

```bash
# 1) 의존성 설치
pnpm install

# 2) 환경변수 준비
cp .env.example .env.local

# 3) 로컬 Supabase 시작 (Postgres/Auth/Storage/메일 캐처 포함)
pnpm db:start
#   → 출력되는 API URL / anon key / service_role key를 .env.local에 채워 넣는다.
#   → 메일(가입 확인·비번 재설정)은 Inbucket에서 확인: http://localhost:54324

# 4) 마이그레이션 적용 (DB 초기화 + migrations 재적용)
pnpm db:reset

# 5) (선택) DB 타입 재생성
pnpm db:types

# 6) 개발 서버
pnpm dev
#   → http://localhost:3000
```

> 환경변수가 누락/오류면 부팅 시점에 명확한 에러로 중단됩니다(`src/lib/env.ts`).

### 첫 사용 흐름

1. `/signup`에서 이메일·비밀번호·사무소 이름·이름으로 가입.
2. 가입 즉시 **사무소(workspace)가 생성되고 본인이 owner로 등록**됩니다.
3. 로컬에서는 Inbucket(http://localhost:54324)에서 확인 메일을 열어 링크 클릭 → 로그인.
4. `/dashboard`로 진입.

## 환경변수

| 변수                                                                                                  |   필수   | 설명                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                            |    ✅    | Supabase API URL. 로컬은 `supabase start` 출력값.                                                                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                                       |    ✅    | Supabase anon(public) 키. 브라우저에 노출됨.                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                           | ⛔️(선택) | 서버 전용 관리 키. 어드민/유지보수 스크립트용. **절대 클라이언트 노출 금지.** 없으면 service-role 기능(감사 로그·AI 사용량 기록) 비활성. |
| `ANTHROPIC_API_KEY`                                                                                   | ⛔️(선택) | Claude API 키. 서류 자동 분류용. 없으면 자동 분류 비활성 + 수동 분류 폴백(앱은 정상 동작).                                               |
| `AI_DAILY_CLASSIFY_LIMIT`                                                                             | ⛔️(선택) | 워크스페이스별 일일 자동 분류 호출 한도(기본 500). 비용 가드.                                                                            |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `SMTP_FROM`                                   | ⛔️(선택) | 독촉 이메일 발송용 SMTP. 없으면 이메일 채널은 발송 대신 로그(개발/데모).                                                                 |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` · `SOLAPI_SENDER` · `SOLAPI_PFID` · `SOLAPI_KAKAO_TEMPLATE_ID` | ⛔️(선택) | 카카오 알림톡/SMS. 없으면 해당 채널 비활성 + 자동 이메일 폴백.                                                                           |
| `CRON_SECRET`                                                                                         | ⛔️(선택) | `/api/cron/reminders` 보호용 시크릿(Vercel Cron). 프로덕션 필수.                                                                         |
| `NEXT_PUBLIC_SITE_URL`                                                                                | ⛔️(선택) | 인증 리다이렉트/메일 콜백 링크 생성용 공개 origin. 없으면 요청 호스트로 폴백. 프로덕션에서는 명시 권장.                                  |

## 주요 스크립트

| 명령                             | 설명                                   |
| -------------------------------- | -------------------------------------- |
| `pnpm dev`                       | 개발 서버                              |
| `pnpm build` / `pnpm start`      | 프로덕션 빌드 / 실행                   |
| `pnpm typecheck`                 | 타입 검사                              |
| `pnpm lint` / `pnpm format`      | 린트 / 포맷                            |
| `pnpm db:start` / `pnpm db:stop` | 로컬 Supabase 시작 / 정지              |
| `pnpm db:reset`                  | 로컬 DB 초기화 + 마이그레이션 재적용   |
| `pnpm db:diff`                   | 스키마 변경분으로 새 마이그레이션 생성 |
| `pnpm db:types`                  | DB 스키마 → TypeScript 타입 재생성     |

## 데이터 모델

```
workspaces (사무소)  ── plan, trial_ends_at, billing_customer_id
  ├─ members (직원)            role: owner|staff, status, invited_email
  ├─ clients (거래처)          biz_name, biz_reg_no, tax_type, closing_month …
  │    ├─ client_assignments (직원↔거래처 N:N) → staff 쓰기 범위의 기준
  │    ├─ filing_tasks (신고)  status, docs_status, due_date, 담당자
  │    │     └─ expected_documents (제출서류 체크리스트, 누락 체크)
  │    ├─ documents (수집 서류) source: upload|email|kakao|codef, AI 분류 메타
  │    ├─ classification_history (★분류 학습 이력 — RAG 루프)
  │    └─ reminders (발송 기록) channel: email|inapp|kakao|sms
  ├─ ai_usage (★월별 AI 토큰·원가, owner 전용)
  ├─ notifications (직원별 인앱 알림)
  ├─ audit_logs (감사 로그, owner 전용)
  └─ billing_events (결제 웹훅, owner 전용)
```

모든 테이블은 `id`, `workspace_id`, `created_at`, `updated_at`를 가지며
**RLS로 사무소 단위 격리**됩니다. 자세한 정책/헬퍼는 `CLAUDE.md` 3·6절과
`supabase/migrations/`를 참고하세요.

### 마이그레이션 적용 · 시드 · 타입 생성

```bash
pnpm db:start          # 로컬 Supabase (Docker)
pnpm db:reset          # 0001~0005 마이그레이션 적용 + supabase/seed.sql 시드
pnpm db:types          # public 스키마 → src/types/database.types.ts 재생성
```

데모 로그인(시드, 로컬 전용):

| 역할        | 이메일                 | 비밀번호   |
| ----------- | ---------------------- | ---------- |
| 대표(owner) | `demo-owner@semu.test` | `demo1234` |
| 직원(staff) | `demo-staff@semu.test` | `demo1234` |

### RLS 격리 테스트

워크스페이스 격리가 실제로 강제되는지 pgTAP로 검증합니다
(`supabase/tests/rls_isolation_test.sql`, 30개 단언):

```bash
pnpm db:test           # supabase test db (Docker)
```

Docker가 없는 환경에서는 로컬 PostgreSQL + pgTAP로 동일 테스트를 실행합니다:

```bash
# 사전: postgresql, postgresql-contrib, pgtap(+pg_prove) 설치, 로컬 PG 기동
pnpm test:rls:local    # scripts/test-rls-local.sh
```

검증 항목: ①타 워크스페이스 데이터 비노출(거래처·직원 등) ②staff가 미배정/타
워크스페이스 거래처를 수정 불가 ③`classification_history`가 타 워크스페이스에서
조회 불가 ④owner 전용 조회(ai_usage/audit_logs) ⑤WITH CHECK·service_role 우회.

### 테스트 전체 / CI

```bash
pnpm lint && pnpm typecheck && pnpm test   # 단위(vitest): filing-rules·웹훅·마진·쿼터·보안 등
pnpm test:rls:local                        # RLS/권한 통합 pgTAP (66 단언)
pnpm test:e2e                              # Playwright e2e (테스트 Supabase·확인메일 OFF 필요)
```

- **CI 게이트**(`.github/workflows/ci.yml`): PR마다 lint·typecheck·test·build + RLS pgTAP.
- **e2e**(`.github/workflows/e2e.yml`): 수동/주간 — 가입→온보딩→거래처→일정→대시보드
  플로우(`e2e/`). 자세한 배포는 [`docs/deployment.md`](./docs/deployment.md).

## 프로젝트 구조

```
src/app/(auth)   비인증 화면 (로그인/회원가입/비번찾기)
src/app/(app)    인증 필요 화면 (대시보드/거래처/신고/마감/수임/설정)
src/lib          env 검증, supabase 클라이언트, server action 래퍼, 인증
src/components    UI 프리미티브(shadcn) + 앱 셸
supabase          config.toml + migrations/ + seed.sql + tests/(pgTAP)
scripts           Docker 없이 RLS 테스트하는 로컬 PG 하니스
```

## 현재 구현 상태

- ✅ 앱 셸(반응형 사이드바 + 헤더 + 모바일 시트 내비)
- ✅ **선택 외부 연동(어댑터+기능 플래그, `lib/integrations/`)**: 키/계약 없으면 자동 비활성·
  핵심 동작 무영향. (A) Solapi 알림톡/SMS — 워크스페이스별 키 해석 + 발송결과 콜백
  `/api/webhooks/solapi`, 미설정 시 이메일 폴백 (B) CODEF 거래내역 — 동의 기반·민감정보
  비저장(비식별 요약), 비활성 시 안전 거부 (C) 더존 스마트A·세무사랑Pro 가져오기 — ERP
  내보내기 파일 파싱→거래처 매핑(기존 일괄 등록 재사용). 관리자 설정(`/settings`)에서 토글 +
  키 입력(키는 `integration_settings` service-role 전용·화면 비노출, 감사로그엔 키 이름만)
  · 📄 `docs/integrations.md`
- ✅ **테스트·배포 파이프라인 + 런치 체크리스트**: 단위(vitest 78)+RLS/권한 통합(pgTAP 66)+
  결제 웹훅/마진/쿼터 + Playwright e2e(가입→온보딩→거래처→일정→대시보드), CI(GitHub Actions:
  lint·typecheck·test·build + pgTAP, PR 게이트), 배포 가이드(`docs/deployment.md`: 환경변수표·
  Supabase 마이그레이션·Vercel·Cron 4종), 런치 체크리스트(`LAUNCH.md`), README "5분 셋업"
- ✅ **출시 전 보안/운영 하드닝**: 보안 헤더(CSP·HSTS·X-Frame-Options·nosniff·Referrer·
  Permissions, `X-Powered-By` 제거), 레이트리밋(인증·업로드·AI·웹훅, IP·워크스페이스 단위),
  파일 업로드 3중 검증(브라우저+서버액션+Storage 버킷 타입·용량), Storage private+서명 URL,
  거래처 종료/삭제 시 개인정보 파기(파일+이력), Sentry 연동(키 없으면 no-op)+구조화 로깅,
  비밀 `NEXT_PUBLIC_` 노출 부팅 가드, 권한 우회/테넌트 격리 통합 테스트(pgTAP 66)
  · 📄 `docs/security-checklist.md`
- ✅ **공개 마케팅 사이트 + 법적 페이지 + SEO**: 랜딩(`/`, 히어로·기능·사회적 증거 자리·가격
  요약·CTA), `/features`·`/pricing`·`/faq`(FAQ 구조화 데이터), 법적 문서(`/legal/terms`,
  `privacy`(처리 항목·목적·보유기간 표), `refund`, `third-party`(제3자 제공·위탁)) — 모두
  **변호사·노무사·세무사 검토 필요** 경고를 문서 상단/코드 주석에 명시한 초안(플레이스홀더).
  마케팅 헤더/푸터(사업자정보·문의 이메일 자리), `metadata`+`sitemap.xml`+`robots.txt`+OG 이미지.
  회사/연락처 정보는 `lib/site.ts` 한 곳에서 관리(플레이스홀더 → 실제 값 교체 필요)
- ✅ **온보딩 마법사**(`/onboarding`, owner): 가입 직후 ① 사무소·대표 정보 → ② 거래처 추가
  (수동 1건 또는 엑셀 업로드) → ③ 해당 거래처 올해 신고 일정 자동 생성 미리보기 → ④ 완료 시
  대시보드 이동, 진행률 표시·건너뛰기·완료 상태 저장(다시 안 뜸), 대시보드 "다음 할 일" CTA
  (거래처 추가/일정 생성/직원 초대) + 제품 투어 툴팁 1회
- ✅ **역할별 대시보드**(`/dashboard`, 서버 집계): owner = 이번 주/달 마감, 위험 거래처,
  직원별 부하(막대)·신고유형별 진행률(스택 바, recharts), 위험 거래처 Top 리스트 /
  staff = 배정분만 "오늘·이번 주 할 일"(임박 task + 누락 자료, 카드에서 상태 즉시 변경)
- ✅ 인증(이메일+비번 가입/로그인/비번 재설정/변경), 라우트 보호
- ✅ 멀티테넌시(13개 테이블) + RLS 워크스페이스 격리, 가입 시 workspace 자동 생성
- ✅ RLS 격리 pgTAP 테스트(30 단언) — staff 쓰기 범위·학습 이력 격리까지 검증
- ✅ 데모 시드(워크스페이스 1 + 거래처 3 + 운영 데이터 + 로그인 계정)
- ✅ 환경변수 검증, 에러 바운더리/not-found/로딩 스켈레톤/토스트
- ✅ 통일된 server action 래퍼(zod + try/catch + `{ ok, data, error }`) + 권한 가드 유틸
  (`lib/auth/guards`: requireOwner/requireClientWrite)
- ✅ **팀 협업**: 이메일 직원 초대(SMTP) → 수락 시 같은 workspace에 staff 합류(RLS 기반,
  서비스롤 불필요·escalation 차단), 멤버 관리(`/team`: 역할 변경·비활성화·초대 재발송/취소),
  거래처 일괄 재배정(owner), 감사 로그 뷰어(`/audit`: 멤버/액션/기간 필터 + 페이지네이션)
- ✅ **거래처(client) 관리**: 목록(검색·필터·정렬·서버 페이지네이션), 등록/수정
  (사업자번호 형식·체크섬 검증 + 중복 경고), 상세(탭: 신고/자료/독촉/정보),
  담당직원 배정(owner 변경·staff 조회·멀티), 엑셀 일괄 등록(템플릿→검증→미리보기→
  부분 등록), soft delete + 확인 모달, 모든 쓰기 audit_logs 기록·토스트·낙관적 업데이트
- ✅ **신고 마감 자동 생성 엔진**(`lib/filing-rules/`, 규칙=데이터 테이블): 과세유형·플래그
  (반기원천·성실신고·결산월)로 연도별 `filing_task` + 제출서류 자동 생성(중복 skip),
  주말/공휴일 영업일 보정(공휴일 표 연도별 주입), 거래처 상세 [신고 일정] 타임라인,
  전사 캘린더(`/calendar`, 월간 그리드+목록, 담당/유형/상태 필터, 임박 강조),
  연초 일괄 생성 배치, task 상태·문서 체크 변경 UI, 엔진 단위 테스트(vitest)
  · ⚠️ 마감일은 일반 케이스 기준 예시 — 세무사 검수/개정세법 반영 필요
- ✅ **자료 수취 + Claude AI 자동 분류(RAG 학습 루프)**: 드래그앤드롭 업로드(Storage,
  워크스페이스별 경로·RLS), `/api/classify`에서 과거 확정 이력(classification_history)을
  참고자료로 주입해 분류(Haiku 4.5 기본·Sonnet 4.6 폴백, structured output, prompt
  caching), 사용자 확정/교정 시 이력 누적(쓸수록 정확↑), 누락 감지(docs_status 자동),
  AI 사용량/원가 적재, 일일 한도·키 없으면 수동 폴백, 분류 정확도 추이 `/admin`
  · ⚠️ 이력은 RLS + 프롬프트 격리로 타 워크스페이스 비노출
- ✅ **자료 미제출 독촉/알림**: 채널 추상화(`lib/messaging/`, `send(channel, payload)`) —
  인앱(notifications)·이메일(SMTP)은 기본, 카카오 알림톡/SMS는 Solapi 키 넣으면 켜지는
  토글(미설정 시 자동 이메일 폴백). 규칙 엔진(D-7/3/1·docs 미완료 후보), `/reminders`
  (후보 일괄/개별 발송·자동발송 ON/OFF·채널 선택·이력), 템플릿(거래처/마감일/필요서류),
  거래처 [독촉 이력] 탭 + 헤더 알림 벨, 매일 1회 Vercel Cron(`/api/cron/reminders`)
- ✅ **구독 결제(PortOne v2 빌링키 · 토스페이먼츠)**: 어댑터 분리(`lib/billing/provider.ts`
  → 토스 직연동 교체 가능), 플랜(free 1인·거래처 10건 / team 시트당 월정액 / pro 무제한+연동),
  14일 무료체험 → 만료 시 free 강등. 공개 `/pricing` + 내부 `/billing`(현재 플랜·결제수단·청구
  이력·세금계산서 안내), 빌링키 발급→첫 결제→매월 자동 청구·플랜/시트 변경·결제수단 변경·취소/재개,
  웹훅 `/api/webhooks/portone`(Standard Webhooks 서명 검증 + `event_key` 멱등 + 본문 불신뢰 재조회),
  플랜·시트·연동 한도 enforcement(거래처/직원/카카오), 결제 실패 그레이스(3일)+상단 배너,
  매일 Cron(`/api/cron/billing`)로 만료 강등 · 빌링키는 서비스롤 전용 테이블에 격리(화면 비노출)
  · 🔑 PortOne 키 없으면 결제 UI는 "준비중"으로 비활성, 핵심 기능은 정상(내부용 런칭 가능)
  · 📄 테스트 결제 흐름: `docs/billing-test-flow.md`
- ✅ **비용 계측 + 마진 보호**(목표: 어떤 계정도 마진 ≥ 목표치 50% 보장): 단가·환율·PG수수료·
  메시지단가·목표마진·쿼터·초과정책을 전부 설정(`lib/pricing/cogs.ts`)으로 분리. 플랜별 포함
  문서 쿼터(free 30 / team 400×석 / pro 10,000) 초과 시 **하드캡(분류 중단→수동)** 또는
  **오버리지(문서당 원가×2 자동 과금)** 선택. 비용 절감 기본(Haiku 고정·prompt caching·낮은
  confidence만 Sonnet 폴백·비긴급 분류는 Batch API 50%↓ 경로 `/api/cron/ai-batch`). owner
  대시보드 문서 사용량/쿼터 게이지, 내부(슈퍼유저) 마진 모니터(`/admin`: 워크스페이스별 MRR vs
  COGS·목표 미만 자동 플래그)+ 일일 크론(`/api/cron/margin`) 알림
  · 🔒 `ai_usage`는 owner 전용, `margin_flags`는 service_role 전용(내부 비노출)
  · 📄 마진 모델: `docs/margin-protection.md`
- ⬜️ 기능 페이지(마감/수임)는 골격(빈 상태)만 — 추후 구현 예정
