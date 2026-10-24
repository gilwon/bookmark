// 목록 로딩 중 보여 주는 행 스켈레톤 (서버 컴포넌트, CSS 애니메이션만 사용)
// Lucian UX/UI Prompt #079 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#079
import { cn } from "@/lib/utils";
import "./lucian-079.css";

export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("ux u079", className)}>
      <span className="sr-only">불러오는 중</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="u079-row">
            <div className="u079-av u079-s"><span className="u079-sk" /></div>
            <div className="u079-nm">
              <div className="u079-s"><span className="u079-sk" /></div>
              <div className="u079-s"><span className="u079-sk" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
