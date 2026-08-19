// OAuth 공급자 계정을 앱 사용자 ID로 변환하는 함수
const PRIMARY_GITHUB_ACCOUNT_ID = "15724434";
const PRIMARY_USER_ID = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export function stableUserId(
  provider: string | undefined,
  providerAccountId: string | undefined,
  fallbackId: string | undefined,
  githubLogin: string | undefined
): string | undefined {
  if (githubLogin === "gilwon") return PRIMARY_USER_ID;
  if (provider !== "github" || !providerAccountId) return fallbackId;
  if (providerAccountId === PRIMARY_GITHUB_ACCOUNT_ID) return PRIMARY_USER_ID;
  return `github:${providerAccountId}`;
}
