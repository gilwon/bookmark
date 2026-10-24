// 저장·복사·삭제 결과를 화면 오른쪽 아래에 겹쳐 쌓이는 토스트로 알리는 ToastProvider·useToast
// Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070
"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import "./lucian-070.css";

type ToastKind = "success" | "error" | "info";
type ToastOptions = { kind?: ToastKind; duration?: number };
type ToastFn = (message: string, opts?: ToastOptions) => void;

const DUR = 4500;
const COLOR: Record<ToastKind, string> = {
  success: "var(--ux-mint)",
  error: "var(--ux-danger)",
  info: "var(--ux-accent)",
};
const ICON: Record<ToastKind, string> = {
  success: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>',
  error: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>',
  info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>',
};

const warnOutside: ToastFn = () =>
  console.warn("useToast: ToastProvider 밖에서 호출돼 무시합니다");

// Provider 밖에서 부르면 기본값이 경고만 남기고 무시한다
const ToastContext = createContext<{ toast: ToastFn }>({ toast: warnOutside });

/** toast(message, { kind, duration }) 를 돌려준다 */
export function useToast() {
  return useContext(ToastContext);
}

/** 토스트 스택을 화면에 한 번 그리고 하위 트리에 toast 함수를 내려준다 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const pushRef = useRef<ToastFn | null>(null);

  // 원본 스크립트처럼 DOM 을 직접 다룬다 (요소별 위치·크기를 측정해 CSS 변수로 쓰기 때문)
  useEffect(() => {
    const zone = zoneRef.current!;
    const live = liveRef.current!;
    type Toast = { el: HTMLDivElement; left: number; dur: number };
    const list: Toast[] = [];
    const timers = new Set<number>();
    let open = false;
    let raf = 0;
    let last = 0;

    // 접혀 있을 때는 뒤 알림을 작게 겹치고, 펼치면 높이만큼 위로 쌓아 목록처럼 보여 준다
    function layout() {
      if (!list.length) open = false;
      let acc = 0;
      list.forEach((t, i) => {
        const el = t.el;
        el.classList.toggle("back", !open && i > 0);
        if (open) {
          el.style.setProperty("--y", -acc + "px");
          el.style.setProperty("--s", "1");
          el.style.setProperty("--o", "1");
          acc += el.offsetHeight + 8;
        } else {
          el.style.setProperty("--y", -(i * 14) + "px");
          el.style.setProperty("--s", (1 - i * 0.06).toFixed(2));
          el.style.setProperty("--o", i > 2 ? "0" : "1");
        }
        el.style.zIndex = String(50 - i);
        el.inert = !open && i > 0;
      });
      // 펼친 동안만 영역이 포인터를 받아 알림 사이 틈에서 접히지 않게 한다
      zone.classList.toggle("open", open);
    }

    function remove(t: Toast, dir?: number) {
      const i = list.indexOf(t);
      if (i < 0) return;
      list.splice(i, 1);
      t.el.classList.add("leave");
      if (dir) {
        t.el.style.setProperty("--dir", String(dir));
        t.el.classList.add("side");
      }
      const id = window.setTimeout(() => {
        timers.delete(id);
        t.el.remove();
      }, 450);
      timers.add(id);
      layout();
    }

    // 펼쳐 둔 동안은 남은 시간이 줄지 않고, 알림이 없으면 루프를 멈춘다
    function loop(now: number) {
      const dt = now - last;
      last = now;
      const t = list[0];
      if (!open && t) {
        t.left -= dt;
        t.el.style.setProperty("--left", Math.max(0, t.left / t.dur).toFixed(3));
        if (t.left <= 0) remove(t);
      }
      raf = list.length ? requestAnimationFrame(loop) : 0;
    }

    function push(message: string, opts: ToastOptions = {}) {
      const kind = opts.kind ?? "info";
      const dur = opts.duration ?? DUR;
      const el = document.createElement("div");
      el.className = "u070-t enter";
      el.style.setProperty("--c", COLOR[kind]);
      el.setAttribute("role", kind === "error" ? "alert" : "status");
      el.innerHTML =
        '<span class="u070-ic" aria-hidden="true">' +
        ICON[kind] +
        '</span><span class="u070-tx"><b></b></span><button class="u070-x" type="button" aria-label="알림 닫기"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
      el.querySelector("b")!.textContent = message;
      const t: Toast = { el, left: dur, dur };
      zone.appendChild(el);
      list.unshift(t);
      void el.offsetWidth;
      el.classList.remove("enter");
      layout();
      live.textContent = message;
      el.querySelector(".u070-x")!.addEventListener("click", () => remove(t));
      // 옆으로 밀어 닫기
      let sx = 0;
      let dx = 0;
      let down = false;
      el.addEventListener("pointerdown", (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        down = true;
        sx = e.clientX;
        dx = 0;
        el.setPointerCapture(e.pointerId);
        el.classList.add("drag");
      });
      el.addEventListener("pointermove", (e) => {
        if (!down) return;
        dx = e.clientX - sx;
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--o", String(Math.max(0.2, 1 - Math.abs(dx) / 260)));
      });
      const end = () => {
        if (!down) return;
        down = false;
        el.classList.remove("drag");
        if (Math.abs(dx) > 90) remove(t, dx > 0 ? 1 : -1);
        else {
          el.style.setProperty("--dx", "0px");
          layout();
        }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    }

    function setOpen(v: boolean) {
      if (open === v || (v && !list.length)) return;
      open = v;
      layout();
    }
    // 영역은 접힌 동안 포인터를 통과시키므로 enter/leave 대신 버블되는 over/out 으로 판단한다
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "mouse") setOpen(true);
    };
    const onOut = (e: PointerEvent) => {
      if (
        e.pointerType === "mouse" &&
        !zone.contains(e.relatedTarget as Node | null) &&
        !zone.contains(document.activeElement)
      )
        setOpen(false);
    };
    const onFocusIn = () => setOpen(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!zone.contains(e.relatedTarget as Node | null)) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("button") && list.length > 1) setOpen(!open);
    };
    // Esc 는 포커스가 있는 알림(없으면 맨 앞 알림)을 닫는다
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !list.length) return;
      remove(list.find((t) => t.el.contains(document.activeElement)) ?? list[0]);
    };
    // 터치로 펼친 뒤 바깥을 누르면 접어 영역이 페이지 입력을 계속 막지 않게 한다
    const onDocDown = (e: PointerEvent) => {
      if (!zone.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    zone.addEventListener("pointerover", onOver);
    zone.addEventListener("pointerout", onOut);
    zone.addEventListener("focusin", onFocusIn);
    zone.addEventListener("focusout", onFocusOut);
    zone.addEventListener("click", onClick);
    zone.addEventListener("keydown", onKey);
    pushRef.current = push;

    return () => {
      pushRef.current = null;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener("pointerdown", onDocDown);
      zone.removeEventListener("pointerover", onOver);
      zone.removeEventListener("pointerout", onOut);
      zone.removeEventListener("focusin", onFocusIn);
      zone.removeEventListener("focusout", onFocusOut);
      zone.removeEventListener("click", onClick);
      zone.removeEventListener("keydown", onKey);
      zone.querySelectorAll(".u070-t").forEach((el) => el.remove());
    };
  }, []);

  const value = useMemo<{ toast: ToastFn }>(
    () => ({
      toast: (message, opts) => (pushRef.current ?? warnOutside)(message, opts),
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ux u070">
        <div ref={zoneRef} className="u070-zone" role="region" aria-label="알림" tabIndex={-1}>
          <div ref={liveRef} className="u070-live" aria-live="polite" />
        </div>
      </div>
    </ToastContext.Provider>
  );
}
