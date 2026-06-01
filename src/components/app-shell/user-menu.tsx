"use client";

import { useTransition } from "react";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { signOutAndRedirect } from "@/lib/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}

export function UserMenu({
  displayName,
  email,
  role,
}: {
  displayName: string;
  email: string | null;
  role: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        await signOutAndRedirect();
      } catch {
        toast.error("로그아웃에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-9 rounded-full p-0">
          <Avatar>
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{displayName}</span>
          {email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          ) : null}
          <span className="text-xs font-normal text-muted-foreground">
            {role === "owner" ? "대표 (owner)" : "직원 (staff)"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User />
            계정 설정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            사무소 설정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={isPending}
        >
          <LogOut />
          {isPending ? "로그아웃 중…" : "로그아웃"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
