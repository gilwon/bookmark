// 인증·소유권 검사 헬퍼 (API 라우트 공통)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type AuthedUser = {
  userId: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  hasGithub: boolean;
  githubLogin?: string | null;
};

/**
 * 세션 사용자를 요구한다.
 * 실패 시 JSON 401 응답을 돌려 호출부가 early return 하게 한다.
 */
export async function requireUser(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      hasGithub: Boolean(session.hasGithub),
      githubLogin: session.githubLogin,
    },
  };
}

/** 리소스가 현재 사용자 소유인지 검사한다. 아니면 404 응답. */
export function ownershipError(): NextResponse {
  // 존재 여부 노출 최소화를 위해 404 통일
  return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
}
