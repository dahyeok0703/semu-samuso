# 세무사무소 업무 SaaS (semu-samuso)

세무사무소 내부 업무를 관리하는 멀티테넌트 웹 애플리케이션입니다. 거래처·신고·마감·수임을
한 곳에서 관리하는 것을 목표로 하며, 현재는 인증/멀티테넌시/앱 셸 골격까지 구현되어 있습니다.

## 기술 스택

- **Next.js 15** (App Router, TypeScript strict)
- **Supabase** (Postgres + Auth + Storage + SMTP), 마이그레이션은 Supabase CLI로 관리
- **Tailwind CSS v4** + **shadcn/ui** + lucide-react
- **react-hook-form** + **zod**, 데이터는 서버 컴포넌트 + server actions
- **pnpm**

자세한 아키텍처·도메인 용어·코드 원칙은 [`CLAUDE.md`](./CLAUDE.md)를 참고하세요.

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

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase API URL. 로컬은 `supabase start` 출력값. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon(public) 키. 브라우저에 노출됨. |
| `SUPABASE_SERVICE_ROLE_KEY` | ⛔️(선택) | 서버 전용 관리 키. 어드민/유지보수 스크립트용. **절대 클라이언트 노출 금지.** 없으면 service-role 기능(감사 로그·AI 사용량 기록) 비활성. |
| `ANTHROPIC_API_KEY` | ⛔️(선택) | Claude API 키. 서류 자동 분류용. 없으면 자동 분류 비활성 + 수동 분류 폴백(앱은 정상 동작). |
| `AI_DAILY_CLASSIFY_LIMIT` | ⛔️(선택) | 워크스페이스별 일일 자동 분류 호출 한도(기본 500). 비용 가드. |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `SMTP_FROM` | ⛔️(선택) | 독촉 이메일 발송용 SMTP. 없으면 이메일 채널은 발송 대신 로그(개발/데모). |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` · `SOLAPI_SENDER` · `SOLAPI_PFID` · `SOLAPI_KAKAO_TEMPLATE_ID` | ⛔️(선택) | 카카오 알림톡/SMS. 없으면 해당 채널 비활성 + 자동 이메일 폴백. |
| `CRON_SECRET` | ⛔️(선택) | `/api/cron/reminders` 보호용 시크릿(Vercel Cron). 프로덕션 필수. |
| `NEXT_PUBLIC_SITE_URL` | ⛔️(선택) | 인증 리다이렉트/메일 콜백 링크 생성용 공개 origin. 없으면 요청 호스트로 폴백. 프로덕션에서는 명시 권장. |

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm lint` / `pnpm format` | 린트 / 포맷 |
| `pnpm db:start` / `pnpm db:stop` | 로컬 Supabase 시작 / 정지 |
| `pnpm db:reset` | 로컬 DB 초기화 + 마이그레이션 재적용 |
| `pnpm db:diff` | 스키마 변경분으로 새 마이그레이션 생성 |
| `pnpm db:types` | DB 스키마 → TypeScript 타입 재생성 |

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

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
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
- ⬜️ 기능 페이지(마감/수임)는 골격(빈 상태)만 — 추후 구현 예정
