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
| `SUPABASE_SERVICE_ROLE_KEY` | ⛔️(선택) | 서버 전용 관리 키. 어드민/유지보수 스크립트용. **절대 클라이언트 노출 금지.** 없으면 service-role 기능 비활성. |
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
- ✅ 인증(이메일+비번 가입/로그인/비번 재설정/변경), 라우트 보호
- ✅ 멀티테넌시(13개 테이블) + RLS 워크스페이스 격리, 가입 시 workspace 자동 생성
- ✅ RLS 격리 pgTAP 테스트(30 단언) — staff 쓰기 범위·학습 이력 격리까지 검증
- ✅ 데모 시드(워크스페이스 1 + 거래처 3 + 운영 데이터 + 로그인 계정)
- ✅ 환경변수 검증, 에러 바운더리/not-found/로딩 스켈레톤/토스트
- ✅ 통일된 server action 래퍼(zod + try/catch + `{ ok, data, error }`)
- ✅ **거래처(client) 관리**: 목록(검색·필터·정렬·서버 페이지네이션), 등록/수정
  (사업자번호 형식·체크섬 검증 + 중복 경고), 상세(탭: 신고/자료/독촉/정보),
  담당직원 배정(owner 변경·staff 조회·멀티), 엑셀 일괄 등록(템플릿→검증→미리보기→
  부분 등록), soft delete + 확인 모달, 모든 쓰기 audit_logs 기록·토스트·낙관적 업데이트
- ⬜️ 기능 페이지(신고/마감/수임)는 골격(빈 상태)만 — 추후 구현 예정
