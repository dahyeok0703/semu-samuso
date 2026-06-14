/**
 * 외부 연동 공통 타입/메타데이터 (client-safe). 각 연동은 lib/integrations/<provider>
 * 아래로 격리되며, 키/토글이 없으면 자동 비활성된다(핵심 동작 무영향).
 */

export type IntegrationProvider = "solapi" | "codef" | "erp_import";

export type SolapiConfig = {
  apiKey?: string;
  apiSecret?: string;
  sender?: string;
  pfId?: string;
  kakaoTemplateId?: string;
};

export type CodefConfig = {
  clientId?: string;
  clientSecret?: string;
  publicKey?: string;
};

export type ErpImportConfig = Record<string, never>;

export type IntegrationConfig = SolapiConfig | CodefConfig | ErpImportConfig;

/** A single configurable key field (drives the admin form). */
export type IntegrationKeyField = {
  key: string;
  label: string;
  /** Secret fields are write-only in the UI (masked, never returned). */
  secret: boolean;
  placeholder?: string;
};

export type IntegrationMeta = {
  provider: IntegrationProvider;
  name: string;
  description: string;
  /** 키가 필요 없는 연동(파일 import 등)은 빈 배열 → 토글만. */
  keys: IntegrationKeyField[];
  /** 개인정보 위탁/제공 고지 대상 여부(법적 안내 연계). */
  thirdParty: boolean;
};

export const INTEGRATIONS: Record<IntegrationProvider, IntegrationMeta> = {
  solapi: {
    provider: "solapi",
    name: "Solapi 알림톡 · SMS",
    description: "카카오 알림톡/SMS 발송. 미설정 시 자동으로 이메일로 폴백됩니다.",
    thirdParty: true,
    keys: [
      { key: "apiKey", label: "API Key", secret: false },
      { key: "apiSecret", label: "API Secret", secret: true },
      { key: "sender", label: "발신번호", secret: false, placeholder: "0212345678" },
      { key: "pfId", label: "카카오 채널 PFID", secret: false },
      { key: "kakaoTemplateId", label: "알림톡 템플릿 ID", secret: false },
    ],
  },
  codef: {
    provider: "codef",
    name: "CODEF 거래내역 수집",
    description:
      "거래처 동의 기반으로 은행/카드 거래내역을 수집해 자료로 적재합니다(민감정보 비저장).",
    thirdParty: true,
    keys: [
      { key: "clientId", label: "Client ID", secret: false },
      { key: "clientSecret", label: "Client Secret", secret: true },
      { key: "publicKey", label: "Public Key", secret: true },
    ],
  },
  erp_import: {
    provider: "erp_import",
    name: "더존 스마트A · 세무사랑Pro 가져오기",
    description: "ERP 에서 내보낸 거래처/자료 파일을 파싱해 매핑합니다. 키가 필요 없습니다.",
    thirdParty: false,
    keys: [],
  },
};

export const INTEGRATION_ORDER: IntegrationProvider[] = ["solapi", "codef", "erp_import"];

/** UI-safe status: which keys are set (boolean) without exposing values. */
export type IntegrationStatus = {
  provider: IntegrationProvider;
  enabled: boolean;
  /** 워크스페이스 또는 env 로 사용 가능한지(실제 동작 가능 여부). */
  available: boolean;
  /** key → 설정됨 여부(값 비노출). */
  configured: Record<string, boolean>;
  /** 설정 출처. */
  source: "workspace" | "env" | "none";
};
