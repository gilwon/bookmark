// 모바일(터치) 화면 상단에서 아래로 당겨 페이지를 새로고침 (PWA·브라우저 공통)
// Lucian UX/UI Prompt #085 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#085
"use client";

import { useEffect, useRef } from "react";
import "./lucian-085.css";

const THRESHOLD = 70;

/** 안쪽 스크롤 영역이 위로 더 스크롤될 수 있으면 true */
function inScrolledArea(el: EventTarget | null) {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) return true;
    if (n.matches?.("input,textarea,select,[role=dialog]")) return true;
  }
  return false;
}

export function PullToRefresh() {
  const rootRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const msg = msgRef.current!;
    // 터치 기기에서만 동작 (데스크톱 마우스 제외)
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let startY = 0;
    let pull = 0;
    let active = false;
    let busy = false;

    const set = (p: number) => {
      pull = p;
      root.style.setProperty("--pull", p.toFixed(1));
      root.classList.toggle("is-ready", p >= THRESHOLD);
      msg.textContent = p >= THRESHOLD ? "놓으면 새로고침" : "아래로 당겨 새로고침";
    };

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || inScrolledArea(e.target)) return;
      active = true;
      startY = e.touches[0].clientY;
      root.classList.remove("rel");
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const d = e.touches[0].clientY - startY;
      // 위로 밀거나 스크롤이 시작되면 취소
      if (d <= 0 || window.scrollY > 0) {
        if (pull > 0) set(0);
        if (d <= 0) active = false;
        return;
      }
      if (e.cancelable) e.preventDefault(); // 브라우저 기본 당김 새로고침 차단
      set(120 * (1 - Math.exp(-d / 140))); // 당길수록 무거워지는 저항
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (pull >= THRESHOLD) {
        busy = true;
        root.classList.add("rel", "is-load");
        set(THRESHOLD);
        msg.textContent = "새로고침 중";
        setTimeout(() => window.location.reload(), reduce ? 100 : 500);
      } else {
        root.classList.add("rel");
        set(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    // 브라우저 기본 당김 새로고침·바운스 방지
    document.documentElement.style.overscrollBehaviorY = "contain";

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.documentElement.style.overscrollBehaviorY = "";
    };
  }, []);

  return (
    <div ref={rootRef} className="ux u085" aria-hidden="true">
      <span className="u085-ind">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" pathLength="100" />
          <path d="M12 1.6l3.4 2.6L12 6.8z" />
        </svg>
      </span>
      <span ref={msgRef} className="u085-msg">아래로 당겨 새로고침</span>
    </div>
  );
}
