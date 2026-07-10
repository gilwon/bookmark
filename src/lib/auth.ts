// Auth.js(NextAuth v5) — GitHub OAuth + (개발) Credentials, 토큰은 DB 암호 저장
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";
import {
  deleteGithubToken,
  hasGithubToken,
  saveGithubToken,
} from "@/lib/oauth-tokens";

const devSecret = "mymark-dev-secret-change-me";
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const isProdRuntime =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

if (!secret) {
  if (isProdRuntime) {
    throw new Error(
      "[auth] AUTH_SECRET(또는 NEXTAUTH_SECRET)이 없습니다. 프로덕션에서는 필수입니다."
    );
  }
  console.warn(
    "[auth] AUTH_SECRET이 없습니다. 개발용 고정 시크릿을 사용합니다."
  );
}

/** 프로덕션에서는 Dev Login을 기본 비활성 (ENABLE_DEV_LOGIN=true 로 예외). */
function isDevLoginEnabled() {
  if (process.env.ENABLE_DEV_LOGIN === "true") return true;
  if (process.env.ENABLE_DEV_LOGIN === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** 사용 가능한 Provider 목록을 구성한다. */
function buildProviders() {
  const providers = [];

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
        authorization: {
          params: {
            // public star 목록 + 프로필 읽기
            scope: "read:user user:email",
          },
        },
      })
    );
  }

  if (isDevLoginEnabled()) {
    providers.push(
      Credentials({
        id: "credentials",
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        /** 고정 개발 계정만 허용한다. */
        async authorize(credentials) {
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;
          if (email === "dev@local" && password === "dev") {
            return {
              id: "dev",
              name: "Dev User",
              email: "dev@local",
            };
          }
          return null;
        },
      })
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  secret: secret ?? devSecret,
  providers: buildProviders(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /**
     * JWT 콜백.
     * access_token은 JWT/세션에 넣지 않고 서버 DB에 암호화 저장한다.
     */
    async jwt({ token, user, account, profile }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (
        account?.provider === "github" &&
        account.access_token &&
        token.sub
      ) {
        try {
          await saveGithubToken(token.sub, account.access_token);
          token.hasGithub = true;
        } catch (err) {
          console.error("[auth] GitHub 토큰 저장 실패", err);
          token.hasGithub = false;
        }
        const login =
          profile &&
          typeof profile === "object" &&
          "login" in profile &&
          typeof (profile as { login?: unknown }).login === "string"
            ? (profile as { login: string }).login
            : undefined;
        if (login) token.githubLogin = login;
      } else if (token.sub && typeof token.hasGithub !== "boolean") {
        // 매 요청 DB 조회 방지 — 최초 1회만 확인 후 JWT에 캐시
        try {
          token.hasGithub = await hasGithubToken(token.sub);
        } catch (err) {
          console.error("[auth] hasGithubToken 실패", err);
          token.hasGithub = false;
        }
      }

      // 레거시 필드 제거 (이전 세션에 남아 있을 수 있음)
      delete token.accessToken;

      return token;
    },
    /** 클라이언트 세션에는 토큰 평문을 절대 실지 않는다. */
    async session({ session, token }) {
      // Auth.js 일부 경로에서 session/user 가 비어 올 수 있음
      if (!session?.user) {
        return {
          ...session,
          user: {
            id: (token?.sub as string) ?? "unknown",
            name: null,
            email: null,
            image: null,
          },
          expires: session?.expires ?? new Date(0).toISOString(),
          hasGithub: Boolean(token?.hasGithub),
          githubLogin:
            typeof token?.githubLogin === "string"
              ? token.githubLogin
              : undefined,
        };
      }
      session.user.id = (token?.sub as string) ?? "unknown";
      session.hasGithub = Boolean(token?.hasGithub);
      session.githubLogin =
        typeof token?.githubLogin === "string" ? token.githubLogin : undefined;
      return session;
    },
  },
  events: {
    /** 로그아웃 시 서버 저장 토큰 정리 */
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const userId = token?.sub;
      if (userId) {
        try {
          await deleteGithubToken(userId);
        } catch (err) {
          console.error("[auth] 토큰 삭제 실패", err);
        }
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
