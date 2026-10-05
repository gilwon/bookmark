// 설치 현황의 직접 만든 스킬 ZIP 을 로그인 사용자에게만 60초 서명 URL 로 내려 준다
import { type NextRequest, NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { zipKeysOf } from "@/lib/installed-tools";
import {
  INSTALLED_TOOLS_BUCKET,
  INSTALLED_TOOLS_SIGNED_URL_TTL,
  isAllowedZipKey,
} from "@/lib/installed-tools-download";
import { getInstalledToolsLatest } from "@/lib/installed-tools-source";
import { getSupabaseAdmin, isSupabaseJsConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// 동기화 직후 새 zipKey 가 바로 허용되도록 매 요청 원본을 다시 읽는다
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  // 스냅샷에 없는 키와 경로 조작 키는 존재 여부를 숨기려고 404 로 통일한다
  const key = request.nextUrl.searchParams.get("key");
  // 허용 키는 페이지와 같은 원본(Storage snapshot.json 또는 정적 스냅샷 중 최신)에서 가져온다
  if (!isAllowedZipKey(key, zipKeysOf(await getInstalledToolsLatest()))) return ownershipError();

  if (!isSupabaseJsConfigured()) {
    return NextResponse.json(
      { error: "저장소가 설정되지 않아 ZIP 을 내려받을 수 없습니다." },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(INSTALLED_TOOLS_BUCKET)
      .createSignedUrl(key, INSTALLED_TOOLS_SIGNED_URL_TTL);
    if (error) {
      const { status, statusCode } = error as { status?: number; statusCode?: string };
      if (status === 404 || statusCode === "404") return ownershipError();
      throw error;
    }
    if (!data?.signedUrl) throw new Error("서명 URL 이 없습니다.");
    // NextResponse.redirect 기본은 307 이라 302 를 명시한다
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    console.error("[installed-tools] 서명 다운로드 URL 생성 실패", error);
    return NextResponse.json(
      { error: "ZIP 다운로드 주소를 만들지 못했습니다." },
      { status: 500 }
    );
  }
}
