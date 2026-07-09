// 로그인 페이지 — GitHub OAuth + Dev Login
"use client";

import { GitFork } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 로그인 화면 — OAuth 및 개발용 Credentials */
export default function LoginPage() {
  const [loading, setLoading] = useState<"github" | "dev" | null>(null);

  /** GitHub OAuth 로그인 */
  async function loginGithub() {
    setLoading("github");
    await signIn("github", { callbackUrl: "/bookmarks" });
  }

  /** 로컬 데모용 Dev Login */
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
          <Button
            onClick={loginGithub}
            disabled={loading !== null}
            className="w-full"
            size="lg"
          >
            <GitFork className="h-4 w-4" />
            {loading === "github" ? "이동 중…" : "GitHub로 로그인"}
          </Button>
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">또는</span>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={loginDev}
            disabled={loading !== null}
            className="w-full"
            size="lg"
          >
            {loading === "dev" ? "로그인 중…" : "Dev Login (로컬 데모)"}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-2">
            GITHUB_ID가 없어도 Dev Login으로 UI를 확인할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
