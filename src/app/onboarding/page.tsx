import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/app/onboarding/_components/onboarding-wizard";
import { Brand } from "@/components/app-shell/brand";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "시작하기" };

export default async function OnboardingPage() {
  const session = await requireSession();
  // Onboarding is the owner's one-time setup; staff join an existing workspace.
  if (session.member.role !== "owner") redirect("/dashboard");
  if (session.workspace.onboarded_at) redirect("/dashboard");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="flex min-h-dvh flex-col items-center bg-muted/30 px-4 py-10">
      <div className="mb-6">
        <Brand workspaceName={session.workspace.name} />
      </div>
      <OnboardingWizard
        initialOffice={{ name: session.workspace.name, ownerName: session.member.name }}
        clients={clients ?? []}
        year={new Date().getUTCFullYear()}
      />
    </div>
  );
}
