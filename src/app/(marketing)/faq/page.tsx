import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: `${siteConfig.name} 자주 묻는 질문 — 무료체험, 요금제, 데이터 보안, 결제, 해지.`,
  alternates: { canonical: "/faq" },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "무료체험은 어떻게 시작하나요?",
    a: "회원가입 후 별도 결제 정보 없이 14일 동안 모든 기능을 사용할 수 있습니다. 체험이 끝나면 자동으로 Free 플랜으로 전환되며, 원할 때 유료 플랜으로 업그레이드할 수 있습니다.",
  },
  {
    q: "신고 마감일은 정확한가요?",
    a: "과세유형·결산월 등 일반적인 기준으로 마감을 자동 생성하고 주말·공휴일을 영업일로 보정합니다. 다만 표시되는 마감일은 일반 케이스 기준 예시이므로, 개별 사안은 반드시 담당 세무사의 검수와 개정세법 반영이 필요합니다.",
  },
  {
    q: "거래처 자료(개인정보)는 안전하게 보관되나요?",
    a: "모든 데이터는 워크스페이스(사무소) 단위로 격리되며, 데이터베이스 행 수준 보안(RLS)으로 다른 사무소가 접근할 수 없습니다. AI 분류 시에도 학습 이력이 다른 사무소로 새지 않도록 이중으로 차단합니다. 자세한 내용은 개인정보처리방침을 참고하세요.",
  },
  {
    q: "AI 자료 분류는 어떤 원리인가요?",
    a: "업로드한 서류를 AI가 종류·거래처·신고기간으로 분류합니다. 사용자가 확정·교정한 이력을 참고자료로 활용해 쓸수록 정확해지는 구조이며, 모델을 별도로 학습(파인튜닝)시키지 않습니다.",
  },
  {
    q: "요금은 어떻게 청구되나요?",
    a: "Team은 직원 시트당 월정액, Pro는 정액으로 매월 청구됩니다. 모든 금액은 부가세(VAT) 별도이며, 포트원(PortOne)을 통해 안전하게 결제됩니다. 세금계산서·현금영수증 발급은 결제 후 안내됩니다.",
  },
  {
    q: "직원을 몇 명까지 추가할 수 있나요?",
    a: "Free는 1인, Team은 시트 수만큼, Pro는 무제한입니다. 직원은 이메일 초대로 같은 사무소에 합류하며, 거래처별로 담당을 배정할 수 있습니다.",
  },
  {
    q: "해지하면 데이터는 어떻게 되나요?",
    a: "구독은 언제든 해지할 수 있으며, 해지 시 이용 기간 종료까지 사용한 뒤 Free로 전환됩니다. 환불 기준은 환불정책을 따릅니다.",
  },
  {
    q: "카카오 알림톡·외부 연동도 쓸 수 있나요?",
    a: "이메일·인앱 알림은 기본 제공됩니다. 카카오 알림톡·SMS 등 외부 연동은 Pro 플랜에서 활성화되며, 연동 시 개인정보 제3자 제공·위탁 고지에 따라 처리됩니다.",
  },
];

export default function FaqPage() {
  // FAQPage 구조화 데이터(SEO) — JSON-LD.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">자주 묻는 질문</h1>
        <p className="mt-3 text-muted-foreground">
          궁금한 점이 더 있으면{" "}
          <a href={`mailto:${siteConfig.email.support}`} className="font-medium text-primary hover:underline">
            {siteConfig.email.support}
          </a>{" "}
          으로 문의해 주세요.
        </p>
      </div>

      <div className="mt-10 divide-y rounded-xl border">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button asChild size="lg">
          <Link href="/signup">14일 무료로 시작</Link>
        </Button>
      </div>
    </div>
  );
}
