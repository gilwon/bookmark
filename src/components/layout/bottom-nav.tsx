// 모바일 화면 하단 대메뉴 탭 바 — 사이드바 섹션 5개를 탭으로, 현재 경로의 섹션을 선택 상태로 보인다
// Lucian UX/UI Prompt #041 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#041
"use client";

import { Bookmark, BookmarkCheck, GitFork, LayoutDashboard, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navSections } from "./sidebar";
import "./lucian-041.css";

/** 섹션 순서와 같은 순서의 탭 아이콘 */
const ICONS = [LayoutDashboard, Bookmark, BookmarkCheck, GitFork, MessageSquareText];

/** 섹션마다 탭 하나. 라벨이 없는 첫 섹션은 "홈"이고, 이동 경로는 섹션의 첫 항목이다. */
const TABS = navSections.map((section, i) => {
  const hrefs = (section.items as readonly { href: string }[]).map((item) => item.href);
  return { label: section.label ?? "홈", href: hrefs[0], hrefs, Icon: ICONS[i] };
});

/** 경로가 속한 탭 번호. 어느 섹션에도 없으면 -1 */
function matchTab(pathname: string) {
  return TABS.findIndex((tab) =>
    tab.hrefs.some((h) => pathname === h || pathname.startsWith(h + "/"))
  );
}

/** 탭 i 의 중심. 탭은 좌우 14px 안쪽에서 같은 폭(flex:1)이므로 hydration 전에도 CSS 만으로 맞는 자리에 놓인다. */
function initialX(i: number) {
  return `calc(14px + (100% - 28px) * ${(i + 0.5) / TABS.length})`;
}

export function BottomNav() {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const match = matchTab(pathname);
  // 섹션 밖 경로에서는 마지막 선택을 유지한다
  const [sel, setSel] = useState(match >= 0 ? match : 0);
  if (match >= 0 && match !== sel) setSel(match);
  // 첫 위치는 한 번만 정해 React 가 rAF 로 쓴 --x 를 다시 덮지 않게 한다
  const [style] = useState(() => ({ "--x": initialX(sel) }) as React.CSSProperties);
  const spring = useRef({ x: 0, v: 0, target: 0, raf: 0, placed: false });

  useEffect(() => {
    const root = ref.current!;
    const s = spring.current;
    const tab = root.querySelectorAll<HTMLElement>(".u041-tab")[sel];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = () => tab.parentElement!.offsetLeft + tab.offsetWidth / 2;
    const put = (x: string) => root.style.setProperty("--x", x + "px");
    // 파인 홈과 원은 같은 x 값을 쓰고, 그 값을 스프링으로 움직여 함께 미끄러지게 한다
    const step = () => {
      const a = (s.target - s.x) * 0.16 - s.v * 0.42;
      s.v += a;
      s.x += s.v;
      put(s.x.toFixed(2));
      if (Math.abs(s.target - s.x) > 0.3 || Math.abs(s.v) > 0.3) s.raf = requestAnimationFrame(step);
      else {
        s.x = s.target;
        s.v = 0;
        put(String(s.x));
        s.raf = 0;
      }
    };
    s.target = center();
    // 첫 렌더와 동작 줄이기 설정에서는 애니메이션 없이 제자리에 놓는다
    if (!s.placed || reduce) {
      s.x = s.target;
      s.v = 0;
      put(String(s.x));
      s.placed = true;
    } else if (!s.raf) s.raf = requestAnimationFrame(step);
    // 화면 폭이 바뀌면 탭 중심도 바뀌므로 다시 계산한다
    const ro = new ResizeObserver(() => {
      s.target = center();
      if (!s.raf) {
        s.x = s.target;
        put(String(s.x));
      }
    });
    ro.observe(root);
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      ro.disconnect();
    };
  }, [sel]);

  /** 좌우 방향키로 탭 사이 포커스를 순환해서 옮긴다. 이동은 Enter(링크 기본 동작)로 한다. */
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const tabs = ref.current!.querySelectorAll<HTMLElement>(".u041-tab");
    tabs[(i + d + tabs.length) % tabs.length].focus();
  };

  return (
    <nav ref={ref} aria-label="하단 메뉴" className="ux u041" style={style}>
      <span className="u041-shadow" aria-hidden="true" />
      <div className="u041-bar" aria-hidden="true" />
      <span className="u041-bub" aria-hidden="true" />
      <ul className="u041-tabs">
        {TABS.map(({ label, href, Icon }, i) => (
          <li key={href}>
            <Link
              href={href}
              className="u041-tab"
              aria-current={i === sel ? "page" : undefined}
              tabIndex={i === sel ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="u041-ic" aria-hidden="true">
                <Icon />
              </span>
              <span className="u041-lab">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
