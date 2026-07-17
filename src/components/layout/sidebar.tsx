// Apple식 글로벌 상단 내비게이션과 모바일 메뉴를 제공한다
"use client";

import {
  Bookmark,
  Bot,
  FileText,
  GitBranch,
  GitFork,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "홈", icon: LayoutDashboard },
  { href: "/bookmarks", label: "북마크", icon: Bookmark },
  { href: "/stars", label: "Stars", icon: GitFork },
  { href: "/pages", label: "페이지", icon: FileText },
  { href: "/prompts", label: "프롬프트", icon: MessageSquareText },
  { href: "/claude-prompts", label: "Claude", icon: Sparkles },
  { href: "/skills", label: "스킬", icon: GitBranch },
  { href: "/agent-docs", label: "문서", icon: Bot },
  { href: "/search", label: "검색", icon: Search },
];

/** Apple식 글로벌 내비게이션. 모바일에서는 드로어로 전환한다. */
export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const navLinks = (mobile = false) =>
    navItems.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors",
            mobile
              ? active
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
              : active
                ? "bg-white/16 text-white"
                : "text-white/70 hover:text-white"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      );
    });

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1d1d1f]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-10">
          <Link
            href="/dashboard"
            className="shrink-0 text-[15px] font-semibold tracking-[-0.03em]"
          >
            MyMark
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-3 lg:flex">
            {navLinks()}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/12 hover:text-white"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              aria-label="로그아웃"
              className="hidden h-8 w-8 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/12 hover:text-white lg:inline-flex"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label="메뉴"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/12 lg:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-[#1d1d1f] px-4 py-5 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-[-0.03em]">MyMark</span>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/12"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">{navLinks(true)}</nav>
            <div className="border-t border-white/10 pt-4">
              <p className="truncate px-3 text-xs text-white/55">
                {session?.user?.name ?? session?.user?.email ?? "MyMark"}
              </p>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs text-white/75 hover:bg-white/12 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                로그아웃
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
