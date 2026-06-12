import Link from "next/link";
import { Mail } from "lucide-react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { siteConfig } from "@/lib/site";

const FOOTER_LINKS: { heading: string; links: { title: string; href: string }[] }[] = [
  {
    heading: "제품",
    links: [
      { title: "기능", href: "/features" },
      { title: "요금제", href: "/pricing" },
      { title: "자주 묻는 질문", href: "/faq" },
    ],
  },
  {
    heading: "법적 고지",
    links: [
      { title: "이용약관", href: "/legal/terms" },
      { title: "개인정보처리방침", href: "/legal/privacy" },
      { title: "환불정책", href: "/legal/refund" },
      { title: "제3자 제공·위탁", href: "/legal/third-party" },
    ],
  },
];

/**
 * 공개 사이트 푸터. 회사/사업자 정보는 siteConfig 의 플레이스홀더이며 실제 값으로
 * 교체해야 합니다(전자상거래법 표시사항).
 */
export function MarketingFooter() {
  const c = siteConfig.company;
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}</p>
            <a
              href={`mailto:${siteConfig.email.support}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-4" /> {siteConfig.email.support}
            </a>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold">{col.heading}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 사업자 정보 (전자상거래법 제10조 표시사항) — 플레이스홀더 */}
        <div className="mt-10 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
          <p>
            {c.legalName} · 대표 {c.ceo} · 사업자등록번호 {c.bizRegNo} · 통신판매업신고{" "}
            {c.mailOrderNo}
          </p>
          <p className="mt-1">{c.address}</p>
          <p className="mt-1">
            개인정보 보호책임자 {c.privacyOfficer} · 문의 {siteConfig.email.support}
          </p>
          <p className="mt-3">
            © {new Date().getFullYear()} {c.legalName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
