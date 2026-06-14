# 선택 외부 연동 (Integrations)

모든 선택 연동은 `src/lib/integrations/` 아래로 격리되며, **키/계약/토글이 없으면 자동
비활성**된다. 연동이 꺼져 있거나 실패해도 핵심 동작에는 영향이 없다(graceful degradation).

## 설정 저장 / 우선순위

- 키는 워크스페이스별 `integration_settings`(**service_role 전용** 테이블, 화면 비노출)에
  저장하거나 env(글로벌)로 줄 수 있다. 해석 시 **워크스페이스 설정이 env 위에 병합**된다
  (`lib/integrations/settings.ts`). 워크스페이스 설정이 없으면 env 로 폴백(기존 동작 보존).
- 관리자 설정(`/settings`, owner): 연동별 **토글 + 키 입력 UI**. 비밀 키는 마스킹·쓰기 전용
  (빈 값이면 기존 값 보존). 저장은 `updateIntegrationAction`(service-role admin)으로만 기록되며
  감사로그에는 키 값이 아니라 설정된 키 **이름**만 남는다.
- 키 입력 UI 의 필드 정의는 `INTEGRATIONS` 메타데이터(`lib/integrations/types.ts`)가 구동한다.

## A. Solapi 알림톡 · SMS

- 어댑터: `lib/integrations/solapi/client.ts`(HMAC-SHA256 송신 + 서명 검증 유틸).
- 채널 추상화(`lib/messaging/channels.ts`)가 워크스페이스 Solapi 설정을 해석해 발송하고,
  **키/템플릿/전화번호가 없으면 자동으로 이메일로 폴백**한다(UX 안 깨짐).
- 발송 결과 콜백: `POST /api/webhooks/solapi` — 서명 검증(`SOLAPI_WEBHOOK_SECRET`) 후
  `groupId` 로 보낸 `reminders` 의 상태(sent/failed)를 갱신. 시크릿 없으면 prod 에선 무시.
- 채널 가용성은 `availableChannels(workspaceId)` 로 워크스페이스 단위 계산된다.

## B. CODEF 거래내역 수집

- 어댑터: `lib/integrations/codef/`(`client.ts` 토큰/요약, `actions.ts` 수집 요청).
- 거래처 **동의(consent) 기반**으로만 동작하며, 연동 비활성 시 `collectCodefAction` 은
  FORBIDDEN 으로 안전하게 거부한다.
- ★**민감정보 비저장 원칙**: 원천 거래내역(계좌번호·승인내역 등)은 저장하지 않고, 비식별
  집계(`summarizeStatement`: 건수·기간·입출금 합계)만 다룬다. 적재 시 `documents.source='codef'`.
- 실제 은행/카드 데이터 수집에는 거래처별 connectedId(동의) 등록 인프라가 선행되어야 하며,
  제3자 제공·위탁 고지(`/legal/third-party`)와 연계된다. 본 구현은 토글/키/동의/요청접수까지를
  안전하게 제공하는 스캐폴드다.

## C. 더존 스마트A · 세무사랑Pro 가져오기

- 파서: `lib/integrations/erp-import/parsers.ts`(pure) — ERP별 헤더 별칭을 흡수해
  거래처 표준형으로 정규화(`상호/사업자등록번호/대표자/업태/연락처/이메일`).
- UI: 거래처 화면의 **ERP 가져오기** 다이얼로그 — 브라우저에서 xlsx/csv 를 행으로 파싱해
  `importErpClientsAction` 으로 전달, 서버가 정규화·검증 후 **기존 일괄 등록 경로**(권한·플랜
  한도·중복검사·감사로그)를 재사용한다. 키가 필요 없으며 토글로만 제어한다.

## 법적 고지 연계

Solapi·CODEF 는 개인정보 제3자 제공·위탁 고지(`/legal/third-party`) 대상이다. 관리자 설정의
각 연동 카드에서 고지로 바로 이동할 수 있다.

## 테스트

```bash
pnpm test            # erp 파서, codef 요약(비식별) 단위 테스트
pnpm test:rls:local  # integration_settings 내부 격리(service-role only) pgTAP
```
