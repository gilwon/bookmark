// PWA 미설치 시 설치 안내 토스트
"use client";

import { Download, Share, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "mymark-pwa-install-dismissed";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** standalone 이면 이미 설치(홈 화면) 상태로 본다 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ms = DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - ts < ms;
  } catch {
    return false;
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

/**
 * 미설치 사용자에게 하단 토스트로 설치 안내.
 * Chromium: beforeinstallprompt / iOS: 공유 → 홈 화면 추가 안내.
 */
export function PwaInstallToast() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [iosHint, setIosHint] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [installing, setInstalling] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (isDismissedRecently()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setIosHint(false);
      setShowManual(false);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);

    const t = window.setTimeout(() => {
      if (isStandalone() || isDismissedRecently()) return;
      if (isIosSafari()) {
        setIosHint(true);
        setVisible(true);
        return;
      }
      setVisible(true);
    }, 2500);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(t);
    };
  }, []);

  async function handleInstall() {
    if (deferred) {
      setInstalling(true);
      try {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
        setVisible(false);
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    if (isIosSafari()) {
      setIosHint(true);
      return;
    }
    setShowManual((v) => !v);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="앱 설치 안내"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md"
    >
      <div className="rounded-xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              MyMark 앱 설치
            </p>
            {iosHint ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Safari 하단{" "}
                <Share className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
                <strong className="text-foreground">공유</strong> →{" "}
                <strong className="text-foreground">홈 화면에 추가</strong> 를
                누르면 앱처럼 사용할 수 있습니다.
              </p>
            ) : showManual && !deferred ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                브라우저 주소창의{" "}
                <strong className="text-foreground">설치</strong> 아이콘을
                누르거나, 메뉴에서{" "}
                <strong className="text-foreground">앱 설치</strong> /
                <strong className="text-foreground"> 홈 화면에 추가</strong> 를
                선택하세요.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                홈 화면에 설치하면 더 빠르게 열고, 앱처럼 사용할 수 있습니다.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {!iosHint && (
                <Button
                  size="sm"
                  onClick={() => void handleInstall()}
                  disabled={installing}
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing
                    ? "설치 중…"
                    : deferred
                      ? "설치하기"
                      : "설치 방법"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={dismiss}>
                나중에
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
