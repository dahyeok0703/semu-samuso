/**
 * Browser-side PortOne v2 helper (client only — NO server imports). Loads the
 * official SDK from the CDN on demand and issues a billing key via the
 * configured TossPayments channel. Returns the billing key (+ masked card info
 * when the SDK provides it) for the server action to charge against.
 */

type IssueResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
  card?: { publisher?: string; name?: string; number?: string };
};

type PortOneSdk = {
  requestIssueBillingKey: (params: Record<string, unknown>) => Promise<IssueResponse>;
};

const CDN = "https://cdn.portone.io/v2/browser-sdk.js";

declare global {
  interface Window {
    PortOne?: PortOneSdk;
  }
}

let loading: Promise<PortOneSdk> | null = null;

function loadSdk(): Promise<PortOneSdk> {
  if (typeof window === "undefined") return Promise.reject(new Error("SDK is browser-only"));
  if (window.PortOne) return Promise.resolve(window.PortOne);
  if (loading) return loading;

  loading = new Promise<PortOneSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CDN;
    script.async = true;
    script.onload = () => {
      if (window.PortOne) resolve(window.PortOne);
      else reject(new Error("PortOne SDK 로드 실패"));
    };
    script.onerror = () => reject(new Error("PortOne SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return loading;
}

export type IssuedBillingKey = {
  billingKey: string;
  cardBrand: string | null;
  cardLast4: string | null;
};

export type IssueConfig = {
  storeId: string;
  channelKey: string;
  customerId: string;
  /** Shown on the PortOne UI. */
  issueName?: string;
};

/**
 * Open the PortOne billing-key issuance flow and resolve the issued key.
 * Throws with a Korean message on cancel/failure.
 */
export async function issueBillingKey(config: IssueConfig): Promise<IssuedBillingKey> {
  const sdk = await loadSdk();
  const res = await sdk.requestIssueBillingKey({
    storeId: config.storeId,
    channelKey: config.channelKey,
    billingKeyMethod: "CARD",
    issueId: `issue_${config.customerId}_${Date.now()}`,
    issueName: config.issueName ?? "세무사무소 구독 결제수단 등록",
    customer: { customerId: config.customerId },
  });

  if (res.code || !res.billingKey) {
    throw new Error(res.message ?? "결제수단 등록이 취소되었습니다.");
  }

  const number = res.card?.number ?? null;
  return {
    billingKey: res.billingKey,
    cardBrand: res.card?.publisher ?? res.card?.name ?? null,
    cardLast4: number ? number.replace(/\D/g, "").slice(-4) || null : null,
  };
}
