// 목록이 비었거나 검색 결과가 없을 때 보여 주는 공통 빈 상태 (떠 있는 빈 폴더 + 문구 + 선택 액션)
// Lucian UX/UI Prompt #088 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#088
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./lucian-088.css";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// 원본 스크립트는 템플릿 생성·목록 삭제 데모 전용이라 포팅하지 않음. 남은 모션은 CSS만으로 동작한다
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("ux u088", className)}>
      <div className="u088-body">
        <div className="u088-empty">
          <div className="u088-art" aria-hidden="true">
            <div className="u088-fl">
              <svg viewBox="0 0 168 128">
                <path d="M16 26a10 10 0 0 1 10-10h34a8 8 0 0 1 6 2.6l8 8.4h68a10 10 0 0 1 10 10v66a10 10 0 0 1-10 10H26a10 10 0 0 1-10-10z" fill="#0B9B70" />
                <g className="u088-pp a">
                  <rect x="30" y="26" width="92" height="72" rx="6" fill="#EEF1F7" />
                  <path d="M42 40h48M42 50h62M42 60h36" stroke="#C9D1DF" strokeWidth="3" strokeLinecap="round" />
                </g>
                <g className="u088-pp b">
                  <rect x="50" y="32" width="90" height="68" rx="6" fill="#fff" />
                  <path d="M62 46h52M62 56h64M62 66h30" stroke="#D3DAE6" strokeWidth="3" strokeLinecap="round" />
                </g>
                <g className="u088-front">
                  <path d="M10 50a10 10 0 0 1 10-10h128a10 10 0 0 1 10 10.8l-5 52a10 10 0 0 1-10 9.2H25a10 10 0 0 1-10-9.2z" fill="#16C08C" />
                  <path d="M22 47h124" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
                  <rect x="66" y="72" width="36" height="8" rx="4" fill="#fff" fillOpacity=".38" />
                </g>
              </svg>
            </div>
            <span className="u088-sh" />
          </div>
          <p className="u088-t">{title}</p>
          {description && <p className="u088-s">{description}</p>}
          {/* 액션 버튼에 손을 올리거나 포커스하면 폴더가 벌어지도록 .u088-tpl 안에 둔다 */}
          {action && <div className="u088-tpl">{action}</div>}
        </div>
      </div>
    </div>
  );
}
