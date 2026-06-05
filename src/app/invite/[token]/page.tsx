import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvite } from "@/app/invite/[token]/accept-invite";
import { InviteSignup } from "@/app/invite/[token]/invite-signup";
import { Brand } from "@/components/app-shell/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getInviteByToken } from "@/lib/team/actions";

export const metadata: Metadata = { title: "초대 수락" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-6 flex justify-center">
        <Brand />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>유효하지 않은 초대</CardTitle>
            <CardDescription>초대 링크가 잘못되었거나 만료되었습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">로그인으로</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const expired = new Date(invite.expiresAt) < new Date();
  const usable = invite.status === "pending" && !expired;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const emailMatches = user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{invite.workspaceName} 초대</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{invite.email}</span> 주소로 직원 초대가
            왔습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!usable ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {expired ? "만료된 초대입니다." : "이미 처리되었거나 취소된 초대입니다."} 사무소
              대표에게 재발송을 요청하세요.
            </p>
          ) : user ? (
            emailMatches ? (
              <AcceptInvite token={token} />
            ) : (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                현재 <b>{user.email}</b> 계정으로 로그인되어 있어 이 초대(<b>{invite.email}</b>)를
                수락할 수 없습니다. 초대 대상 이메일로 다시 로그인해 주세요.
              </p>
            )
          ) : (
            <>
              <InviteSignup token={token} email={invite.email} />
              <p className="text-center text-xs text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`}
                  className="font-medium text-primary hover:underline"
                >
                  로그인
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
