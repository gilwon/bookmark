// Pages 첨부 ZIP을 현재 사용자에게만 서명 다운로드로 제공한다
import { NextResponse } from "next/server";
import { ownershipError, requireUser } from "@/lib/authz";
import {
  PAGE_ATTACHMENT_STORAGE_BUCKET,
  createPageAttachmentObjectPath,
} from "@/lib/page-attachment-storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PageAttachmentRouteContext = {
  params: Promise<{ sourceId: string; filename: string }>;
};

function isNotFound(error: { status?: number; statusCode?: string } | null) {
  return error?.status === 404 || error?.statusCode === "404";
}

export async function GET(
  _request: Request,
  { params }: PageAttachmentRouteContext
) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { sourceId, filename } = await params;
  const path = createPageAttachmentObjectPath(gate.user.userId, sourceId, filename);
  if (!path) {
    return NextResponse.json(
      { error: "첨부 파일 경로가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const storage = getSupabaseAdmin().storage.from(PAGE_ATTACHMENT_STORAGE_BUCKET);
    const { error: infoError } = await storage.info(path);
    if (isNotFound(infoError)) return ownershipError();
    if (infoError) throw infoError;

    const { data, error } = await storage.createSignedUrl(path, 60, {
      download: filename,
    });
    if (isNotFound(error)) return ownershipError();
    if (error || !data?.signedUrl) throw error ?? new Error("서명 URL이 없습니다.");
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("[page-attachments] 서명 다운로드 URL 생성 실패", error);
    return NextResponse.json(
      { error: "첨부 파일을 다운로드하지 못했습니다." },
      { status: 500 }
    );
  }
}
