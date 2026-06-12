/**
 * 사이트(마케팅/법적 페이지) 공통 설정 — 단일 소스 오브 트루스.
 *
 * ⚠️ 아래 회사/사업자 정보와 연락처는 모두 **플레이스홀더**입니다. 실제 서비스
 * 오픈 전 정확한 값으로 교체하고, 법적 문서는 반드시 변호사·노무사·세무사 검토를
 * 받으세요(전자상거래법·개인정보보호법 등 고지 의무).
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://semu.example";

export const siteConfig = {
  /** 서비스(제품) 이름. */
  name: "세무메이트",
  /** 라틴 표기(OG 이미지 등 한글 글리프 미지원 환경용). */
  nameLatin: "SemuMate",
  taglineLatin: "Zero missing documents. Automated deadlines.",
  /** 한 줄 가치 제안. */
  tagline: "거래처 자료 누락 제로, 마감 자동 추적",
  description:
    "세무사무소를 위한 거래처·신고 마감·자료 수취 관리 SaaS. AI 자동 분류로 누락을 막고, 신고 마감을 자동으로 추적합니다.",
  url: siteUrl,

  // 연락처 (플레이스홀더 — 실제 값으로 교체)
  email: {
    support: "support@semu.example",
    privacy: "privacy@semu.example",
    billing: "billing@semu.example",
  },

  // 사업자 정보 (플레이스홀더 — 전자상거래법 제10조 표시사항. 실제 값으로 교체)
  company: {
    legalName: "(주)세무메이트", // 상호 / 법인명
    ceo: "홍길동", // 대표자
    bizRegNo: "000-00-00000", // 사업자등록번호
    mailOrderNo: "0000-서울강남-00000", // 통신판매업 신고번호
    address: "서울특별시 강남구 테헤란로 000, 0층 (역삼동)", // 주소
    privacyOfficer: "홍길동", // 개인정보 보호책임자
    hosting: "Amazon Web Services / Supabase / Vercel", // 호스팅/인프라
  },

  /** 법적 문서 최종 개정일(플레이스홀더). 실제 시행일로 갱신. */
  legalEffectiveDate: "2026-06-01",
} as const;

export type SiteConfig = typeof siteConfig;
