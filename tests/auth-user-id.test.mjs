// GitHub OAuth 계정과 기존 앱 사용자 ID 연결을 검증하는 테스트
import assert from "node:assert/strict";
import test from "node:test";
import { authConfig } from "../src/lib/auth.ts";

test("기존 GitHub 계정은 기존 저장 데이터의 사용자 ID를 유지한다", async () => {
  const token = await authConfig.callbacks.jwt({
    token: {},
    user: { id: "oauth-login-random-id" },
    account: { provider: "github", providerAccountId: "15724434" },
    profile: { login: "gilwon" },
  });

  assert.equal(token.sub, "f72e9a44-79d8-4061-a700-3ec50bb04a97");
});

test("다른 GitHub 계정은 provider 계정 ID로 고정된다", async () => {
  const token = await authConfig.callbacks.jwt({
    token: {},
    user: { id: "oauth-login-random-id" },
    account: { provider: "github", providerAccountId: "99999999" },
    profile: { login: "another-user" },
  });

  assert.equal(token.sub, "github:99999999");
});

test("기존 본인 GitHub 세션도 기존 사용자 ID로 복구한다", async () => {
  const token = await authConfig.callbacks.jwt({
    token: { sub: "oauth-login-random-id", githubLogin: "gilwon" },
    user: undefined,
    account: undefined,
    profile: undefined,
  });

  assert.equal(token.sub, "f72e9a44-79d8-4061-a700-3ec50bb04a97");
});
