// Linear식 좌측 내비게이션 — 데스크톱 고정 레일, 모바일 드로어
"use client";

import {
  Bookmark,
  Bot,
  FileText,
  GitBranch,
  GitFork,
  GitGraph as Github,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  PenLine,
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

/** 섹션으로 묶은 내비게이션. Linear처럼 라벨은 작고 대문자다. */
const navSections = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "홈", icon: LayoutDashboard },
      { href: "/search", label: "통합 검색", icon: Search },
    ],
  },
  {
    label: "라이브러리",
    items: [
      { href: "/bookmarks", label: "북마크", icon: Bookmark },
      { href: "/pages", label: "페이지", icon: FileText },
      { href: "/copies", label: "카피", icon: PenLine },
      { href: "/pdf-viewer", label: "PDF 뷰어", icon: FileText },
    ],
  },
  {
    label: "GitHub",
    items: [
      { href: "/stars", label: "Stars", icon: GitFork },
      { href: "/github-links", label: "GitHub 링크", icon: Github },
      { href: "/skills", label: "스킬", icon: GitBranch },
    ],
  },
  {
    label: "프롬프트",
    items: [
      { href: "/prompts", label: "프롬프트", icon: MessageSquareText },
      { href: "/claude-prompts", label: "Claude", icon: Sparkles },
      { href: "/agent-docs", label: "문서", icon: Bot },
    ],
  },
] as const;

/** ⌘K 팔레트를 연다. 팔레트가 window keydown을 듣고 있어 합성 이벤트로 충분하다. */
function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

/** 좌측 내비게이션 본문 — 데스크톱 레일과 모바일 드로어가 공유한다. */
function NavBody({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium tracking-[-0.02em] text-foreground transition-colors hover:bg-muted"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-600 text-[11px] font-semibold text-white">
            M
          </span>
          <span className="truncate">MyMark</span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
        {onClose && (
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openCommandPalette();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-7"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">검색</span>
          <kbd className="ml-auto shrink-0 font-sans text-[11px] text-muted-foreground/80">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {navSections.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className={cn(i > 0 && "mt-4")}>
            {section.label && (
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="flex flex-col gap-px">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-md px-2 text-[13px] transition-colors lg:h-7",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-indigo-600 dark:text-indigo-400" : ""
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
            {session?.user?.name ?? session?.user?.email ?? "MyMark"}
          </p>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            aria-label="로그아웃"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

/** 데스크톱 고정 레일 + 모바일 상단 바/드로어 */
export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
        <NavBody />
      </aside>

      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border bg-background px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link
          href="/dashboard"
          className="text-sm font-medium tracking-[-0.02em] text-foreground"
        >
          MyMark
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="검색"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-border bg-sidebar">
            <NavBody
              onNavigate={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
