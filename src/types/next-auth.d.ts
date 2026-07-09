// next-auth 세션 타입 — accessToken 비노출, hasGithub/githubLogin 메타만
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    /** 서버에 GitHub OAuth 토큰이 저장되어 있는지 */
    hasGithub?: boolean;
    /** GitHub 로그인 핸들 (예: octocat) */
    githubLogin?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    hasGithub?: boolean;
    githubLogin?: string;
    /** @deprecated 서버 DB로 이전됨 — 사용 금지 */
    accessToken?: string;
  }
}
