# 🚀 런치 체크리스트

출시 직전 점검 목록. 모든 항목을 확인한 뒤 프로덕션 트래픽을 받으세요.
관련 상세는 `docs/deployment.md`, `docs/security-checklist.md`, `docs/margin-protection.md`.

## 1. 인프라 · 도메인

- [ ] 커스텀 도메인 연결 및 HTTPS 적용 (HSTS 유효 확인)
- [ ] `NEXT_PUBLIC_SITE_URL` 을 실제 도메인으로 설정 (인증 콜백·OG·sitemap)
- [ ] Supabase 프로덕션 프로젝트 생성, 마이그레이션 `supabase db push`(0001→0013) 적용
- [ ] RLS 검증: `pnpm test:rls:local`(또는 `supabase test db`) 그린

## 2. 환경변수 (REQUIRED 모두 설정)

- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `PORTONE_API_SECRET` / `PORTONE_WEBHOOK_SECRET` / `NEXT_PUBLIC_PORTONE_STORE_ID` / `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
- [ ] `CRON_SECRET`
- [ ] `SUPERUSER_EMAILS` (내부 마진 모니터 접근자)

## 3. 이메일 · 알림

- [ ] SMTP 설정 및 **발신자 도메인 인증(SPF / DKIM / DMARC)** 완료
- [ ] Supabase Auth 이메일 확인(Confirm email) **활성** + 발신 도메인 설정
- [ ] (선택) Solapi 카카오 알림톡 템플릿 승인 및 키 입력

## 4. 결제

- [ ] PortOne **실거래(라이브) 전환** — 테스트 키 → 라이브 키 교체
- [ ] 웹훅 URL(`/api/webhooks/portone`) 등록 + 서명 시크릿 일치 확인
- [ ] 첫 결제 → 매월 자동 청구 → 취소/재개 1회 실거래 검증
- [ ] 세금계산서/현금영수증 발급 안내 메일/프로세스 준비

## 5. 법적 문서 (필수)

- [ ] 이용약관 / 개인정보처리방침 / 환불정책 / 제3자 제공·위탁 — **변호사·노무사·세무사 검토 완료**
- [ ] `lib/site.ts` 의 회사·사업자·연락처 정보를 **실제 값**으로 교체(플레이스홀더 제거)
- [ ] 전자상거래법 사업자정보(푸터) 정확성 확인

## 6. 마진 · 비용 보호

- [ ] `lib/pricing/cogs.ts` 단가·환율·`TARGET_MARGIN`(기본 50%) 최종 확인
- [ ] 플랜별 문서 쿼터(`PLAN_DOC_QUOTA`) 및 초과 정책(하드캡/오버리지) 확인
- [ ] `AI_DAILY_CLASSIFY_LIMIT` 적정값 설정
- [ ] 마진 모니터 크론(`/api/cron/margin`) 동작 + 슈퍼유저 알림 수신 확인

## 7. 백업 · 데이터 보호

- [ ] Supabase 자동 백업/PITR 활성, 복구 리허설 1회
- [ ] Storage 백업/버전관리 정책 수립
- [ ] 개인정보 파기 절차(거래처 종료/삭제) 동작 확인
- [ ] 보존기간(회원 탈퇴 시까지 / 결제 5년 / 자료 계약종료 시) 정책 일치

## 8. 모니터링 · 운영

- [ ] `SENTRY_DSN` 설정 및 에러 리포팅 켜짐 확인(테스트 예외 1건 수신)
- [ ] 구조화 로깅 수집/대시보드 연결
- [ ] 레이트리밋 적정값 확인(멀티 인스턴스면 Redis/Upstash 승격 검토)
- [ ] Vercel 크론 4종 등록/동작 확인

## 9. 보안 최종

- [ ] 보안 헤더(CSP/HSTS 등) 응답 확인
- [ ] 비밀의 `NEXT_PUBLIC_` 노출 0 (부팅 가드 통과)
- [ ] 권한 우회/테넌트 격리 테스트 그린

## 10. 데이터 정리

- [ ] **데모/시드 데이터 제거** (`supabase/seed.sql` 은 프로덕션에 적용하지 않기)
- [ ] 테스트 계정/테스트 결제 내역 정리
- [ ] 내부 슈퍼유저 외 불필요한 계정 제거

## 11. 릴리스 게이트 (CI 그린)

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] `pnpm test:rls:local`
- [ ] (선택) `pnpm test:e2e` — 테스트 Supabase 프로젝트에서
