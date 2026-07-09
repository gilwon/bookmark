// 인증된 앱 레이아웃 셸 — 사이드바 + 메인
import { Sidebar } from "./sidebar";

/** 사이드바와 메인 콘텐츠 영역을 배치한다. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
