// Star 변경 뱃지 모두 확인 처리
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { store } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/stars/ack — 신규/업데이트 뱃지 초기화 */
export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const cleared = await store.clearStarChanges(gate.user.userId);
  return NextResponse.json({ ok: true, cleared });
}
