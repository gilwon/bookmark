"use server";
// 심팀장 자료실 목록을 홈 카드와 맞추고 화면 캐시를 갱신한다.
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncShimGuides } from "../../../../scripts/fetch-shim-guides.mjs";

export type SyncShimGuidesResult =
  | { ok: true; message: string; addedCount: number; total: number }
  | { ok: false; message: string };

export async function syncShimGuidesAction(): Promise<SyncShimGuidesResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "동기화에 실패했습니다." };
  }
  try {
    const result = await syncShimGuides();
    revalidatePath("/shim-guides");
    revalidatePath("/shim-guides/[slug]", "page");
    const addedCount = result.added.length;
    const message = addedCount === 0 ? "이미 최신입니다." : `${addedCount}건을 추가했습니다.`;
    return { ok: true, message, addedCount, total: result.total };
  } catch (error) {
    console.error("심팀장 자료실 동기화에 실패했습니다.", error);
    return { ok: false, message: "동기화에 실패했습니다." };
  }
}
