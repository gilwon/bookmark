// 사용자의 저장 PDF 목록과 서명 업로드 토큰을 제공한다
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import {
  PDF_STORAGE_BUCKET,
  createPdfObjectName,
  parsePdfObjectName,
  pdfUserFolder,
  validatePdfUploadMeta,
} from "@/lib/pdf-storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const folder = pdfUserFolder(session.user.id);
  const { data, error } = await getSupabaseAdmin()
    .storage.from(PDF_STORAGE_BUCKET)
    .list(folder, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) {
    console.error("[pdfs] 목록 조회 실패", error);
    return NextResponse.json(
      { error: "저장된 PDF 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const files = data.flatMap((file) => {
    const parsed = parsePdfObjectName(file.name);
    if (!parsed) return [];
    return [
      {
        id: parsed.id,
        name: parsed.name,
        size:
          typeof file.metadata?.size === "number" ? file.metadata.size : 0,
        createdAt: file.created_at ?? file.updated_at,
      },
    ];
  });

  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validationError = validatePdfUploadMeta(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const id = uuidv4();
  const objectName = createPdfObjectName(id, (body as { name: string }).name);
  if (!objectName) {
    return NextResponse.json({ error: "PDF 파일명이 올바르지 않습니다." }, { status: 400 });
  }
  const path = `${pdfUserFolder(session.user.id)}/${objectName}`;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(PDF_STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error) {
    console.error("[pdfs] 서명 업로드 URL 생성 실패", error);
    return NextResponse.json(
      { error: "PDF 저장을 준비하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id, path: data.path, token: data.token });
}
