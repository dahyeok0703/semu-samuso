import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getSession } from "@/lib/auth/session";

/**
 * Public marketing + legal pages layout (header + footer). These routes are
 * reachable without authentication (see middleware PUBLIC_PREFIXES). The header
 * swaps its CTA when a session exists.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader isAuthed={Boolean(session)} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
