"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const MARKETING_NAV = [
  { title: "기능", href: "/features" },
  { title: "요금제", href: "/pricing" },
  { title: "FAQ", href: "/faq" },
] as const;

/** Sticky public-site header. `isAuthed` swaps the CTA between 로그인/대시보드. */
export function MarketingHeader({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        <nav className="hidden items-center gap-7 md:flex" aria-label="주요 메뉴">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <Button asChild>
              <Link href="/dashboard">대시보드</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">로그인</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">무료로 시작</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="메뉴 열기">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <div className="mt-6 flex flex-col gap-1">
              {MARKETING_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {item.title}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                {isAuthed ? (
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link href="/dashboard">대시보드</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" onClick={() => setOpen(false)}>
                      <Link href="/login">로그인</Link>
                    </Button>
                    <Button asChild onClick={() => setOpen(false)}>
                      <Link href="/signup">무료로 시작</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
