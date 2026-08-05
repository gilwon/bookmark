// 사용자가 소유한 저장 PDF의 열기와 삭제를 처리한다
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  PDF_STORAGE_BUCKET,
  isPdfStorageId,
  parsePdfObjectName,
  pdfUserFolder,
} from "@/lib/pdf-storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PdfRouteContext = { params: Promise<{ id: string }> };

async function findOwnedPath(userId: string, id: string) {
  const folder = pdfUserFolder(userId);
  const { data, error } = await getSupabaseAdmin()
    .storage.from(PDF_STORAGE_BUCKET)
    .list(folder, { limit: 2, search: id });
  if (error) throw error;
  const file = data.find((item) => parsePdfObjectName(item.name)?.id === id);
  return file ? `${folder}/${file.name}` : null;
}

export async function GET(_request: Request, { params }: PdfRouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isPdfStorageId(id)) {
    return NextResponse.json({ error: "PDF 식별자가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const path = await findOwnedPath(session.user.id, id);
    if (!path) {
      return NextResponse.json({ error: "PDF를 찾을 수 없습니다." }, { status: 404 });
    }
    const { data, error } = await getSupabaseAdmin()
      .storage.from(PDF_STORAGE_BUCKET)
      .createSignedUrl(path, 60);
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("[pdfs] 서명 열기 URL 생성 실패", error);
    return NextResponse.json(
      { error: "PDF를 열지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: PdfRouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isPdfStorageId(id)) {
    return NextResponse.json({ error: "PDF 식별자가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const path = await findOwnedPath(session.user.id, id);
    if (!path) {
      return NextResponse.json({ error: "PDF를 찾을 수 없습니다." }, { status: 404 });
    }
    const { error } = await getSupabaseAdmin()
      .storage.from(PDF_STORAGE_BUCKET)
      .remove([path]);
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[pdfs] 삭제 실패", error);
    return NextResponse.json(
      { error: "PDF를 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}
