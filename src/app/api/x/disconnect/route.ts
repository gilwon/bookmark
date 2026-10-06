// 현재 사용자에게 연결된 X 토큰을 지운다
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { deleteXToken } from "@/lib/oauth-tokens";

export const runtime = "nodejs";

/** POST /api/x/disconnect */
export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  await deleteXToken(gate.user.userId);
  return NextResponse.json({ ok: true });
}
