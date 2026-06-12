import type { Metadata } from "next";

// ⚠️ 초안(플레이스홀더). 실제 연동 사업자·국외 이전 여부에 맞게 수정하고 변호사 검토 필요.
import { LegalDoc } from "@/components/marketing/legal-doc";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보 제3자 제공·위탁",
  description: `${siteConfig.name} 개인정보 처리위탁 및 제3자 제공 고지(초안).`,
  alternates: { canonical: "/legal/third-party" },
  robots: { index: false },
};

export default function ThirdPartyPage() {
  return (
    <LegalDoc title="개인정보 제3자 제공·위탁 고지">
      <p>
        회사는 안정적인 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하며, 외부 연동 기능을
        사용하는 경우 해당 범위에서 개인정보가 처리됩니다. 실제 위탁 현황은 회사가 사용하는 사업자에
        따라 달라질 수 있으며, 변경 시 본 고지를 갱신합니다.
      </p>

      <h2>1. 개인정보 처리위탁 현황</h2>
      <table>
        <thead>
          <tr>
            <th>수탁자</th>
            <th>위탁 업무</th>
            <th>처리 항목</th>
            <th>이용 조건</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase / 클라우드 인프라({siteConfig.company.hosting})</td>
            <td>데이터 저장·인증·파일 스토리지 등 인프라 운영</td>
            <td>서비스 이용 과정에서 저장되는 전반의 데이터</td>
            <td>상시(이용계약 종료 시까지)</td>
          </tr>
          <tr>
            <td>포트원(PortOne) 및 연결 PG(토스페이먼츠 등)</td>
            <td>유료서비스 결제·정기결제·환불 처리</td>
            <td>결제 식별정보, 결제·청구 내역, 빌링키</td>
            <td>결제 기능 이용 시</td>
          </tr>
          <tr>
            <td>Solapi(쏠라피)</td>
            <td>카카오 알림톡·SMS 발송</td>
            <td>수신자 연락처(전화번호), 메시지 내용</td>
            <td>알림톡/SMS 채널 사용 시(선택)</td>
          </tr>
          <tr>
            <td>Anthropic(Claude API)</td>
            <td>수취 서류 자동 분류(AI)</td>
            <td>분류에 필요한 서류 내용 일부 및 분류용 메타데이터(최소 전송)</td>
            <td>AI 자동 분류 사용 시(선택)</td>
          </tr>
          <tr>
            <td>CODEF(코드에프) 등 스크래핑 연동</td>
            <td>외부 기관 자료 수집 연동</td>
            <td>연동에 필요한 인증·식별 정보</td>
            <td>스크래핑 연동 사용 시(선택)</td>
          </tr>
          <tr>
            <td>이메일 발송(SMTP) 사업자</td>
            <td>알림·독촉·안내 이메일 발송</td>
            <td>수신자 이메일, 메시지 내용</td>
            <td>이메일 발송 기능 이용 시</td>
          </tr>
        </tbody>
      </table>
      <p>
        선택 연동(알림톡/SMS·AI 분류·스크래핑 등)은 이용자가 해당 기능을 활성화하는 경우에만
        동작하며, 사용하지 않으면 관련 위탁도 발생하지 않습니다.
      </p>

      <h2>2. 개인정보의 국외 이전</h2>
      <p>
        일부 수탁자(예: AI·클라우드 사업자)는 개인정보를 국외에서 처리할 수 있습니다. 회사는 국외
        이전이 발생하는 경우 이전받는 자, 이전 국가·일시·방법, 이전 항목, 이용 목적 및 보유기간을
        본 고지 또는 개인정보처리방침을 통해 안내합니다.{" "}
        <strong>(실제 이전 국가·사업자 정보는 시행 전 정확히 기재해야 합니다.)</strong>
      </p>

      <h2>3. 개인정보 제3자 제공</h2>
      <p>
        회사는 원칙적으로 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 다음의 경우는
        예외로 합니다.
      </p>
      <ul>
        <li>이용자가 사전에 동의한 경우</li>
        <li>법령에 특별한 규정이 있거나 수사기관의 적법한 요청이 있는 경우</li>
        <li>요금 정산·분쟁 해결을 위해 필요한 최소한의 범위에서 제공하는 경우</li>
      </ul>

      <h2>4. 문의</h2>
      <p>처리위탁·제3자 제공 관련 문의: {siteConfig.email.privacy}</p>
    </LegalDoc>
  );
}
