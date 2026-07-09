// Auth.js(NextAuth v5) 설정 — GitHub OAuth + 개발용 Credentials
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

const devSecret = "mymark-dev-secret-change-me";
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!secret) {
  console.warn(
    "[auth] AUTH_SECRET이 없습니다. 개발용 고정 시크릿을 사용합니다."
  );
}

/** 사용 가능한 Provider 목록을 구성한다. */
function buildProviders() {
  const providers = [];

  // GitHub OAuth — 환경변수가 있을 때만 활성화
  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    );
  }

  // 로컬 데모용 Dev Login (항상 활성)
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
    /** JWT에 user.id 및 GitHub access_token을 저장한다. */
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (account?.provider === "github" && account.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    /** 세션에 user.id와 accessToken을 노출한다. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? "unknown";
      }
      // Star 동기화용 GitHub 토큰
      (session as { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
