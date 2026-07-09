// 로그인 페이지 — GitHub OAuth + (개발) Dev Login
"use client";

import { GitFork } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 로그인 화면 — 등록된 Provider만 노출 */
export default function LoginPage() {
  const [loading, setLoading] = useState<"github" | "dev" | null>(null);
  const [hasGithub, setHasGithub] = useState(false);
  const [hasDev, setHasDev] = useState(false);
  const [providersLoaded, setProvidersLoaded] = useState(false);

  useEffect(() => {
    /** Auth.js providers 엔드포인트로 활성 로그인 수단 확인 */
    async function loadProviders() {
      try {
        const res = await fetch("/api/auth/providers");
        const data = (await res.json()) as Record<string, { id: string }>;
        setHasGithub(Boolean(data.github));
        setHasDev(Boolean(data.credentials));
      } catch {
        setHasGithub(false);
        setHasDev(true);
      } finally {
        setProvidersLoaded(true);
      }
    }
    void loadProviders();
  }, []);

  async function loginGithub() {
    setLoading("github");
    await signIn("github", { callbackUrl: "/stars" });
  }

  async function loginDev() {
    setLoading("dev");
    await signIn("credentials", {
      email: "dev@local",
      password: "dev",
      callbackUrl: "/bookmarks",
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">MyMark</CardTitle>
          <p className="text-sm text-muted-foreground">
            개인 북마크 · GitHub Stars · 페이지 허브
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!providersLoaded ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              로그인 옵션 확인 중…
            </p>
          ) : (
            <>
              {hasGithub ? (
                <Button
                  onClick={() => void loginGithub()}
                  disabled={loading !== null}
                  className="w-full"
                  size="lg"
                >
                  <GitFork className="h-4 w-4" />
                  {loading === "github" ? "이동 중…" : "GitHub로 로그인"}
                </Button>
              ) : (
                <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  GitHub OAuth가 설정되지 않았습니다.{" "}
                  <code className="text-[11px]">GITHUB_ID</code> /{" "}
                  <code className="text-[11px]">GITHUB_SECRET</code> 을
                  .env.local에 넣고 서버를 재시작하세요.
                </p>
              )}

              {hasGithub && hasDev && (
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">
                      또는
                    </span>
                  </div>
                </div>
              )}

              {hasDev && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void loginDev()}
                    disabled={loading !== null}
                    className="w-full"
                    size="lg"
                  >
                    {loading === "dev"
                      ? "로그인 중…"
                      : "Dev Login (로컬 데모)"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-1">
                    Dev Login은 Star 동기화를 지원하지 않습니다.
                  </p>
                </>
              )}

              {!hasGithub && !hasDev && (
                <p className="text-center text-sm text-muted-foreground">
                  사용 가능한 로그인 수단이 없습니다. 환경 변수를 확인하세요.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
