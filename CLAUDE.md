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

| 용어 | 코드 식별자 | 설명 |
|------|-------------|------|
| 사무소 | `workspace` | 최상위 테넌트. 하나의 세무사무소. |
| 직원 | `member` | workspace에 속한 사용자. `role`: `owner`(대표) / `staff`(직원). |
| 거래처 | `client` | 사무소가 수임한 사업자(고객사). |
| 수임 | engagement | 거래처와의 업무 계약/수임 관계. |
| 신고 | filing | 부가가치세·종합소득세·법인세 등 세무 신고. |
| 마감 | closing | 기장/결산 마감 작업. |
| 과세유형 | `tax_type` | `general`(일반), `simplified`(간이), `exempt`(면세), `corporate`(법인). |

## 3. 핵심 원칙 (반드시 준수)

1. **모든 테넌트 테이블은 `workspace_id` + RLS.**
   - 사용자 데이터를 담는 모든 테이블은 `workspace_id uuid not null` 컬럼을 갖는다.
   - 반드시 RLS를 켜고, 멤버십 기반 정책을 건다. 재귀 방지를 위해
     `public.is_workspace_member(workspace_id)` / `public.workspace_role(workspace_id)`
     (SECURITY DEFINER) 헬퍼를 사용한다. **클라이언트 측 필터링에 의존하지 말 것.**

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
| `pnpm db:types` | DB → TypeScript 타입 재생성 |

## 6. 새 도메인 테이블 추가 체크리스트

1. `supabase/migrations/NNNN_*.sql` 생성: `workspace_id` 컬럼 + FK + 인덱스.
2. RLS 활성화 + `is_workspace_member` / `workspace_role` 기반 정책.
3. `updated_at` 트리거(`set_updated_at`) 연결.
4. `pnpm db:reset` 후 `pnpm db:types`로 타입 재생성.
5. zod 스키마 + `action()` 래퍼로 server action 작성.
6. 서버 컴포넌트에서 읽기, 빈 상태/로딩/에러 처리.
