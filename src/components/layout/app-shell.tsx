// 인증된 앱 레이아웃 셸 — 좌측 사이드바 + 메인 + 커맨드 팔레트
import { CommandPalette } from "@/components/command-palette";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

/** 사이드바와 메인 콘텐츠 영역을 배치한다. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      {/* 데스크톱에서는 고정 레일(w-60)만큼 본문을 밀어낸다 */}
      {/* 모바일에서는 하단 탭 바 높이와 홈 인디케이터 영역만큼 본문 끝을 띄운다 */}
      <main className="min-w-0 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
        <div className="w-full p-4">
          {children}
        </div>
      </main>
      {/* ⌘K 전역 검색 팔레트 */}
      <CommandPalette />
      {/* 모바일 하단 대메뉴 (lg 이상에서는 CSS 로 숨김) */}
      <BottomNav />
    </div>
  );
}
