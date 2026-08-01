// 인증된 앱 레이아웃 셸 — 사이드바 + 메인 + 커맨드 팔레트
import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "./sidebar";

/** 사이드바와 메인 콘텐츠 영역을 배치한다. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // 배경 블롭은 body가 그리므로 셸은 캔버스를 덮지 않는다
    <div className="min-h-screen text-foreground">
      <Sidebar />
      <main>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
      {/* ⌘K 전역 검색 팔레트 */}
      <CommandPalette />
    </div>
  );
}
