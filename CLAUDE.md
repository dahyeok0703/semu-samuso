# CLAUDE.md

세무사무소 내부 업무 관리 SaaS. 이 문서는 아키텍처, 도메인 용어, 코드 컨벤션,
그리고 반드시 지켜야 하는 핵심 원칙을 정의합니다. 코드를 작성/수정하기 전에 읽으세요.

## 1. 아키텍처 개요

- **프레임워크**: Next.js 15 (App Router) + React 19 + TypeScript (`strict`,
  `noUncheckedIndexedAccess`).
- **백엔드/DB**: Supabase (Postgres + Auth + Storage + SMTP). 스키마는 전부
  `supabase/migrations/`의 SQL 마이그레이션으로 관리하며, CLI로 적용한다.
- **UI**: Tailwind CSS v4 + shadcn/ui(new-york) + lucide-react 아이콘. 토스트는 sonner.
- **폼**: react-hook-form + zod (`@hookform/resolvers`).
- **데이터 패칭**: 읽기는 **서버 컴포넌트**에서 직접, 쓰기는 **server actions**로.
- **패키지 매니저**: pnpm.

### 레이어 / 디렉터리

```
src/
  app/
    (auth)/            # 비인증 화면 (로그인/회원가입/비번찾기). 로그인 시 /dashboard로 리다이렉트
    (app)/             # 인증 필요 화면. 레이아웃에서 requireSession()로 보호
    update-password/   # 리셋 링크 후 진입(이미 인증됨) — (auth) 그룹 밖에 둔다
    auth/callback/     # 이메일 확인·비번 재설정 코드 교환 라우트 핸들러
    global-error.tsx   # 루트 에러 바운더리
    not-found.tsx / loading.tsx
  components/
    ui/                # shadcn 프리미티브 (직접 편집 가능)
    app-shell/         # 사이드바·헤더·모바일 내비 등 셸
    form/              # 폼 보조 컴포넌트
  lib/
    env.ts             # zod 환경변수 검증 (부팅 시 1회) + feature flags
    supabase/          # server.ts / client.ts / middleware.ts 클라이언트 분리
    actions/           # safe-action 래퍼 + 헬퍼
    auth/              # 인증 스키마/액션/세션 헬퍼
  types/
    database.types.ts  # Supabase 타입 (pnpm db:types로 재생성)
middleware.ts          # 세션 갱신 + 라우트 보호
supabase/              # config.toml + migrations/
```

### 인증 & 멀티테넌시 흐름

1. 회원가입(`signUpAction`) → Supabase `auth.users` insert.
2. DB 트리거 `handle_new_user()`(SECURITY DEFINER)가 **workspace 1개를 생성**하고
   가입자를 **owner member**로 등록한다. (메타데이터 `office_name`, `full_name` 사용)
3. `middleware.ts`가 모든 요청에서 세션을 갱신하고, 미인증 사용자가 보호 라우트에
   접근하면 `/login`으로 리다이렉트한다.
4. `(app)` 레이아웃은 `requireSession()`으로 한 번 더 방어하고, 사용자의 member +
   workspace를 로드해 셸에 전달한다.

## 2. 도메인 용어 (Domain glossary)

| 용어 | 코드 식별자 (테이블) | 설명 |
|------|-------------|------|
| 사무소 | `workspaces` | 최상위 테넌트. `plan`(free/team/pro), `trial_ends_at`, `billing_customer_id`. |
| 직원 | `members` | workspace 사용자. `role`: owner/staff, `status`: active/inactive, `invited_email`(초대). |
| 거래처 | `clients` | 사무소가 수임한 사업자(고객사). |
| 담당 배정 | `client_assignments` | 직원 ↔ 거래처 N:N. staff 쓰기 권한의 기준. |
| 신고 | `filing_tasks` | 부가세·종소세·법인세 등 신고/마감 업무. `status`, `docs_status`. |
| 제출서류 체크리스트 | `expected_documents` | 신고별 필요 서류 + 수취 여부(누락 체크). |
| 서류 | `documents` | 수집 파일. `source`(upload/email/kakao/codef), AI 분류 메타. |
| 분류 학습 이력 | `classification_history` | ★RAG 학습 루프. 확정/교정된 분류 누적. **워크스페이스 외부로 절대 노출 금지.** |
| AI 사용량 | `ai_usage` | ★마진 보호. 워크스페이스·월별 토큰/원가 집계. owner 읽기 전용. |
| 리마인더 | `reminders` | 거래처 대상 발송 기록(email/inapp/kakao/sms). |
| 인앱 알림 | `notifications` | 직원별 알림. 본인 것만 조회/수정. |
| 감사 로그 | `audit_logs` | 행위 추적. owner 읽기 전용, 기록은 서비스 역할. |
| 결제 이벤트 | `billing_events` | 결제 웹훅 원본. owner 읽기 전용. |
| 과세유형 | `tax_type` | `general`(일반), `simplified`(간이), `exempt`(면세), `corporate`(법인). |

모든 테이블은 `id uuid pk`, `workspace_id`, `created_at`, `updated_at`를 가진다.

## 3. 핵심 원칙 (반드시 준수)

1. **모든 테넌트 테이블은 `workspace_id` + RLS.**
   - 사용자 데이터를 담는 모든 테이블은 `workspace_id uuid not null` 컬럼을 갖는다.
   - 반드시 RLS를 켜고, 멤버십 기반 정책을 건다. 재귀 방지를 위해 아래의
     SECURITY DEFINER 헬퍼(검색경로 고정)를 사용한다. **클라이언트 측 필터링에 의존 금지.**
     - `current_workspace_id()` / `current_member_id()` / `current_member()` — 로그인 사용자(`auth.uid()`)의 활성 member 기준.
     - `is_owner()` — owner 여부.
     - `is_assigned_to_client(client_id)` — staff 쓰기 범위(담당 배정) 판정.
     - `can_write_task(task_id)` — owner/담당자/담당 거래처 기준 신고 업무 쓰기 판정.
   - **표준 정책 형태**:
     - 읽기: `workspace_id = current_workspace_id()` (workspace 전원 읽기).
     - 쓰기(owner): `... and is_owner()`.
     - 쓰기(staff 범위): `... and (is_owner() or is_assigned_to_client(client_id))`.
     - owner 전용 조회(`ai_usage`/`audit_logs`/`billing_events`): `... and is_owner()`, 기록(insert)은 `service_role` 전용(RLS 우회).
     - `classification_history`: `select`은 `workspace_id = current_workspace_id()`로 **반드시 자기 워크스페이스로 한정**.
     - `notifications`: 본인(`member_id = current_member_id()`) 것만.

2. **외부 연동은 기능 플래그(feature flag)로 격리한다.**
   - 홈택스/스크래핑/결제 등 외부 서비스 연동은 `src/lib/env.ts`의 `features`에서
     플래그로 노출하고, 호출부는 `env`를 직접 읽지 말고 `features.X`를 확인한다.
   - 연동 코드는 별도 모듈로 분리해 핵심 흐름과 결합하지 않는다.

3. **키 없으면 우아하게 비활성(graceful degradation).**
   - 선택적 통합의 키가 없으면 크래시하지 말고 해당 기능만 비활성화한다.
   - 단, **핵심 설정(Supabase URL/anon key)은 예외** — 누락 시 `env.ts`가 부팅을
     중단시킨다(잘못된 설정으로 조용히 뜨는 것을 막기 위해).

4. **server action은 항상 `safe-action` 래퍼를 거친다.**
   - `action(schema, handler)`로 감싸 zod 검증 + try/catch + 통일된
     `{ ok, data } | { ok, error }` 응답을 보장한다.
   - 예상된 실패는 `ActionException(code, message, fieldErrors?)`를 throw한다.

5. **에러/로딩/빈 상태는 기본값이다.**
   - 라우트마다 `loading.tsx`(스켈레톤), `error.tsx`(바운더리)를 고려한다.
   - 목록 화면은 빈 상태(`EmptyState`)를 반드시 처리한다.

## 4. 코드 컨벤션

- **클라이언트/서버 경계**: 서버 컴포넌트가 기본. 상호작용이 필요한 경우에만
  `"use client"`. Supabase는 서버=`lib/supabase/server.ts`,
  브라우저=`lib/supabase/client.ts`를 사용(혼용 금지).
- **임포트**: 절대경로 별칭 `@/*` 사용. 외부 → 내부 순으로 그룹화.
- **타입**: `any` 금지. DB 타입은 `@/types/database.types`에서 가져온다.
- **검증**: 모든 외부 입력(폼/액션/라우트)은 zod로 검증한다.
- **사용자 노출 문구는 한국어.** 코드 식별자/주석 키워드는 영어.
- **네이밍**: 컴포넌트 PascalCase, 함수/변수 camelCase, server action은 `~Action` 접미사.
- **포맷팅**: Prettier(`pnpm format`) + ESLint(`pnpm lint`). 미사용 변수는 `_` 프리픽스.

## 5. 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` / `pnpm start` | 프로덕션 빌드/실행 |
| `pnpm typecheck` | 타입 검사 (`tsc --noEmit`) |
| `pnpm lint` / `pnpm format` | 린트 / 포맷 |
| `pnpm db:start` / `pnpm db:stop` | 로컬 Supabase 시작/정지 |
| `pnpm db:reset` | 마이그레이션 재적용(로컬 DB 초기화) |
| `pnpm db:diff` | 스키마 변경 → 새 마이그레이션 생성 |
| `pnpm db:types` | DB → TypeScript 타입 재생성 (로컬 Supabase 필요) |
| `pnpm db:test` | RLS pgTAP 테스트 실행 (`supabase test db`, Docker) |
| `pnpm test:rls:local` | Docker 없이 로컬 Postgres+pgTAP로 RLS 테스트 |

## 6. 데이터베이스 & RLS 테스트

- 스키마: `supabase/migrations/0001_core.sql` … `0005_comms_audit.sql` (순서대로 적용).
- 시드: `supabase/seed.sql` (데모 워크스페이스 1 + 거래처 3 + 데모 로그인).
- RLS 테스트: `supabase/tests/rls_isolation_test.sql` (pgTAP).
  - 워크스페이스 간 데이터 비노출, staff 쓰기 범위 제한, `classification_history`
    타 워크스페이스 비조회, owner 전용 조회, `service_role` 우회 등을 검증.
- Docker 없이 검증할 때는 `scripts/pg-local/supabase_env.sql`(auth 환경 셰임) +
  `scripts/test-rls-local.sh`를 사용한다.

## 7. 새 도메인 테이블 추가 체크리스트

1. `supabase/migrations/NNNN_*.sql` 생성: `id`, `workspace_id` + FK + 인덱스, `created_at/updated_at`.
2. RLS 활성화 + 위 헬퍼(`current_workspace_id()`/`is_owner()`/`is_assigned_to_client()` 등) 기반 정책.
3. `updated_at` 트리거(`set_updated_at`) 연결 + 역할별 `grant`.
4. `pnpm db:reset` 후 `pnpm db:types`로 타입 재생성.
5. `supabase/tests/`에 격리 테스트 추가 → `pnpm db:test`(또는 `test:rls:local`)로 확인.
6. zod 스키마 + `action()` 래퍼로 server action 작성, 서버 컴포넌트 읽기 + 빈/로딩/에러 처리.
