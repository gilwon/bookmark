// 설치 현황의 직접 만든 스킬 ZIP 을 로그인 사용자에게만 60초 서명 URL 로 내려 준다
import { type NextRequest, NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import { getInstalledZipKeys } from "@/lib/installed-tools";
import {
  INSTALLED_TOOLS_BUCKET,
  INSTALLED_TOOLS_SIGNED_URL_TTL,
  isAllowedZipKey,
} from "@/lib/installed-tools-download";
import { getSupabaseAdmin, isSupabaseJsConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  // 스냅샷에 없는 키와 경로 조작 키는 존재 여부를 숨기려고 404 로 통일한다
  const key = request.nextUrl.searchParams.get("key");
  if (!isAllowedZipKey(key, getInstalledZipKeys())) return ownershipError();

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
