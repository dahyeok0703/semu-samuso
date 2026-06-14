# 보안 / 운영 하드닝 체크리스트

출시 전 보안 점검 결과와 적용된 통제, 그리고 운영 절차를 정리한다. 각 항목은
코드/마이그레이션/테스트로 뒷받침된다.

## 0. 이번 하드닝에서 발견·수정한 취약점

| #   | 발견                                                                    | 수정                                                                              |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | 문서 업로드에 파일 타입·용량 서버 강제가 없었음                         | Storage 버킷 `file_size_limit`/`allowed_mime_types`(0013) + 앱단 `validateUpload` |
| 2   | `registerDocumentAction` 의 `filePath` 가 워크스페이스 검증 없이 신뢰됨 | 경로 프리픽스/트래버설 검증(`isValidObjectPath`) + MIME 화이트리스트              |
| 3   | 거래처 삭제 시 Storage 파일이 남아 개인정보가 잔존                      | 삭제·파기 시 `purgeClientStorage` 로 파일 영구 삭제                               |
| 4   | 보안 응답 헤더 없음(CSP/HSTS 등)                                        | `next.config.ts` 전역 보안 헤더                                                   |
| 5   | 인증/업로드/AI/웹훅에 레이트리밋 없음                                   | IP·워크스페이스 단위 레이트리밋                                                   |
| 6   | 비밀이 `NEXT_PUBLIC_` 로 노출될 위험에 대한 가드 없음                   | 부팅 시 `NEXT_PUBLIC_*SECRET/TOKEN/...` 누출 검사(throw)                          |

## 1. RLS / 테넌트 격리 ✅

- 모든 테넌트 테이블에 `workspace_id` + RLS. helper(`current_workspace_id()`/`is_owner()`/
  `is_assigned_to_client()`/`can_write_task()`)는 SECURITY DEFINER + 검색경로 고정.
- 민감/내부 테이블은 service_role 전용: `billing_accounts`(빌링키), `margin_flags`(마진 지표).
- owner 전용 조회: `ai_usage`/`audit_logs`/`billing_events`/`payments`.
- `classification_history` 는 **읽기·쓰기 모두** 자기 워크스페이스로 제한(누출 양방향 차단).
- **통합 테스트**(`pnpm test:rls:local`, pgTAP 66 assertions):
  - `security_hardening_test.sql`(신규): 읽기/쓰기/삭제 격리, staff 의 배정 외 수정 차단,
    owner 전용 테이블 staff 비노출, `classification_history` 누출(read+insert), service_role 우회.
  - `rls_isolation_test.sql` / `billing_test.sql` / `cost_metering_test.sql` / `invitations_test.sql`.

## 2. 입력 검증 ✅

- 모든 server action 은 `action(zodSchema, handler)` 래퍼(zod 검증 + 통일 에러). route 는
  자체 zod/서명/시크릿 검증.
- 파일 업로드: 타입(PDF/이미지) + 용량(20MB) 을 **3중** 강제 — 브라우저(`validateUpload`),
  server action(`isAllowedMime`+경로검증), Storage 버킷(`allowed_mime_types`/`file_size_limit`).
- 사업자등록번호 형식·체크섬 검증(`lib/clients/biz-reg-no`), UUID/enum 검증 등 도메인 스키마.

## 3. 시크릿 관리 ✅

- 비밀은 전부 서버 전용 env(`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`, `SMTP_*`, `SOLAPI_*`, `CRON_SECRET`,
  `SENTRY_DSN`). 클라이언트 번들에는 `NEXT_PUBLIC_*`(URL·publishable 키)만.
- `features.*` 는 boolean 만 노출(값 비노출). 클라이언트에서 server 비밀 참조 시 `undefined`→false.
- 부팅 가드: `NEXT_PUBLIC_` 접두사에 `SECRET|SERVICE_ROLE|PASS|PRIVATE|TOKEN|API_KEY` 패턴이
  보이면 **부팅 중단**.

## 4. 레이트리밋 ✅ (단일 인스턴스 기준)

`lib/security/rate-limit.ts`(고정 윈도우) + `guard()`(전역 비활성 플래그 지원).

| 대상            | 키                                            | 기본 한도  |
| --------------- | --------------------------------------------- | ---------- |
| 인증(로그인 등) | `auth:<scope>:<ip>`                           | 10 / 분    |
| 업로드 등록     | `upload:<workspaceId>`                        | 60 / 분    |
| AI 분류         | `classify:<workspaceId>` + `classify-ip:<ip>` | 30·60 / 분 |
| 웹훅            | `webhook:<ip>`                                | 120 / 분   |

> ⚠️ 인메모리라 **프로세스 단위**다. 멀티 인스턴스/서버리스에서 엄격한 전역 제한이 필요하면
> Redis/Upstash 로 교체한다(호출부는 `guard()`에만 의존하므로 교체 범위가 좁다).

## 5. 보안 헤더 / CSRF / 서명 ✅

- `next.config.ts` 전역 헤더: **CSP**(self + Supabase + PortOne 한정, `frame-ancestors 'none'`,
  `object-src 'none'`, `upgrade-insecure-requests`), **HSTS**(2년·preload),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Powered-By` 제거.
- **CSRF**: Next App Router server action 은 동일 출처(Origin/Host) 검증이 기본 내장. 상태 변경은
  전부 server action/서명된 웹훅으로만 수행.
- **웹훅 서명**: PortOne Standard Webhooks HMAC-SHA256 + 타임스탬프(리플레이 방지) 검증,
  `event_key` 유니크 멱등, 본문 불신뢰(provider 재조회). 서명 실패는 보안 이벤트로 기록.
- 잔여 권고: 나중에 **nonce 기반 strict CSP**(`'unsafe-inline'` 제거)로 강화.

## 6. 에러 모니터링 / 로깅 ✅

- `lib/observability/logger.ts`: 서버 단일라인 JSON 구조화 로깅(레벨별).
- `lib/observability/report.ts`: `captureException/captureMessage`. `SENTRY_DSN` 있으면
  `@sentry/nextjs`(선택 의존성)로 전송, 없으면 **no-op + 구조화 로그**.
- `src/instrumentation.ts` `onRequestError` 로 서버 라우트/액션 미처리 예외 자동 캡처.
- 웹훅 처리 실패·서명 거부, classify 실패를 명시적으로 캡처.

## 7. 데이터 보호

- **Storage**: `documents` 버킷 private(`public=false`) + 객체경로 RLS(워크스페이스 프리픽스).
  조회는 60초 TTL **서명 URL**(`getDocumentUrlAction`)로만. 퍼블릭 URL 미사용.
- **개인정보 파기(거래처 종료)**: `purgeClientDataAction`(owner) — 수취 자료(파일+행)와
  분류 학습 이력을 영구 삭제. 거래처 **삭제** 시에도 Storage 파일을 함께 제거(잔존 방지).
- **백업 정책(운영 문서화 필요)**:
  - DB: Supabase 자동 일일 백업 + PITR(유료 플랜) 활성 권장. 복구 리허설 분기 1회.
  - Storage: 버킷 버전관리/복제 정책 수립. 백업 보존 30일 권장.
  - 비밀: 키 회전 주기(권장 90일) 및 유출 시 즉시 회전 절차.
- **보존기간**: 회원 정보=탈퇴 시까지, 결제=법정 5년, 거래처/세무자료=이용계약 종료 시 파기.
  (개인정보처리방침 표와 일치 유지)

## 8. 권한 우회 방지 ✅

- 권한 가드 유틸(`lib/auth/guards`: `requireOwner`/`requireClientWrite`) + 도메인별
  `assertOwner`/시트·연동 게이팅. owner 전용 작업은 RLS + 가드 **이중**.
- 자동 테스트: `security_hardening_test.sql` 가 staff 의 (a) 배정 외 거래처 수정, (b) 삭제,
  (c) owner 전용 테이블 읽기, (d) service-only 테이블 쓰기 차단을 검증.

## 운영 전 최종 확인(릴리스 게이트)

- [ ] 프로덕션 env 에 `CRON_SECRET`, `PORTONE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
      (사용 시) `SENTRY_DSN` 설정. `SUPERUSER_EMAILS` 설정.
- [ ] 법적 문서/회사 정보(`lib/site.ts`) 실제 값 + 전문가 검토 완료.
- [ ] HTTPS 강제(HSTS 유효), 도메인 preload 등록 검토.
- [ ] Supabase 백업/PITR 활성, 복구 리허설 1회.
- [ ] 멀티 인스턴스 배포 시 레이트리밋을 Redis/Upstash 로 승격.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls:local` 그린.
