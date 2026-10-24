// 북마크·Star 카드 공통 래퍼 — 커서를 따라 카드가 기울고 반사광과 테두리 빛이 모인다
// Lucian UX/UI Prompt #050 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#050
"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import "./lucian-050.css";

/** 빛을 끄고 기울기를 0도로 되돌린다 */
function reset(root: HTMLElement) {
  root.classList.remove("is-live");
  root.style.setProperty("--rx", "0deg");
  root.style.setProperty("--ry", "0deg");
}

export function LucianCard({
  children,
  className,
  tilt = true,
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 편집 버튼을 누른 순간처럼 포인터가 카드 위에 있는 채로 꺼지면 기운 상태가 남으므로 바로 되돌린다
  useEffect(() => {
    if (!tilt && ref.current) reset(ref.current);
  }, [tilt]);

  // 커서 위치로 기울기와 빛의 자리를 함께 정한다. 가로 최대 7도, 세로 최대 5도
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!tilt || e.pointerType === "touch") return;
    // 회전하는 안쪽 Card 가 아니라 루트에서 재야 좌표가 틀어지지 않는다
    const root = e.currentTarget;
    const r = root.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    root.classList.add("is-live");
    root.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
    root.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    // 움직임 줄이기 설정이면 빛만 따라오고 기울지 않는다
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.style.setProperty("--ry", ((x - 0.5) * 14).toFixed(2) + "deg");
    root.style.setProperty("--rx", ((0.5 - y) * 10).toFixed(2) + "deg");
  }

  return (
    <div
      ref={ref}
      className="u050"
      onPointerMove={onPointerMove}
      onPointerLeave={(e) => reset(e.currentTarget)}
    >
      <Card className={cn("u050-card", className)}>
        <span className="u050-glare" aria-hidden="true" />
        {children}
      </Card>
    </div>
  );
}
