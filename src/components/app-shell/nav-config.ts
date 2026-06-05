import {
  Building2,
  CalendarCheck,
  CalendarDays,
  FileSignature,
  FileText,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Short description shown in tooltips / mobile. */
  description?: string;
};

/** Primary navigation. Mirrors the domain vocabulary documented in CLAUDE.md. */
export const navItems: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "사무소 현황 한눈에 보기",
  },
  {
    title: "거래처",
    href: "/clients",
    icon: Building2,
    description: "수임 거래처 관리",
  },
  {
    title: "신고",
    href: "/filings",
    icon: FileText,
    description: "부가세·종합소득세 등 신고 관리",
  },
  {
    title: "캘린더",
    href: "/calendar",
    icon: CalendarDays,
    description: "전사 신고 마감 캘린더",
  },
  {
    title: "마감",
    href: "/closings",
    icon: CalendarCheck,
    description: "기장 및 결산 마감",
  },
  {
    title: "수임",
    href: "/engagements",
    icon: FileSignature,
    description: "수임 계약 관리",
  },
];

export const secondaryNavItems: NavItem[] = [
  {
    title: "설정",
    href: "/settings",
    icon: Settings,
    description: "사무소·직원·계정 설정",
  },
];
