"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteSignupAction } from "@/lib/team/actions";

export function InviteSignup({ token, email }: { token: string; email: string }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteSignupAction({ token, fullName, password });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{email}</span> 주소로 확인 메일을 보냈습니다.
        메일의 링크를 눌러 가입을 완료하면 이 사무소에 합류됩니다.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" value={email} readOnly disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">이름</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "가입 중…" : "가입하고 합류"}
      </Button>
    </form>
  );
}
