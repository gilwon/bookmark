// Service Worker 등록 (PWA 설치·오프라인 기반)
"use client";

import { useEffect } from "react";

/** 프로덕션·localhost 에서 /sw.js 등록 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 개발 중 핫리로드 방해 최소화 — 로컬에서도 PWA 테스트 가능하게 등록
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (err) {
        console.warn("[pwa] SW 등록 실패", err);
      }
    };

    // load 이후 등록 (초기 렌더 방해 감소)
    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }
  }, []);

  return null;
}
