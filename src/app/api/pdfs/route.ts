// 사용자의 저장 PDF 목록과 서명 업로드 토큰을 제공한다
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  PDF_STORAGE_BUCKET,
  createPdfFingerprintObjectName,
  isDuplicatePdfFingerprint,
  isPdfContentFingerprint,
  parsePdfObjectName,
  parsePdfFingerprintObjectName,
  pdfContentFingerprint,
  pdfUserFolder,
  validatePdfUploadMeta,
} from "@/lib/pdf-storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isStorageNotFound(error: { status?: number; statusCode?: string } | null) {
  return error?.status === 404 || error?.statusCode === "404";
}

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

  try {
    const files = await Promise.all(
      data.map(async (file) => {
        const legacy = parsePdfObjectName(file.name);
        if (legacy) {
          return {
            id: legacy.id,
            name: legacy.name,
            size:
              typeof file.metadata?.size === "number" ? file.metadata.size : 0,
            createdAt: file.created_at ?? file.updated_at,
          };
        }

        const fingerprint = parsePdfFingerprintObjectName(file.name);
        if (!fingerprint) return null;
        const path = `${folder}/${file.name}`;
        const { data: info, error: infoError } = await getSupabaseAdmin()
          .storage.from(PDF_STORAGE_BUCKET)
          .info(path);
        if (infoError) throw infoError;
        const originalName = info.metadata?.originalName;
        return {
          id: fingerprint,
          name:
            typeof originalName === "string" && originalName.trim()
              ? originalName
              : `${fingerprint}.pdf`,
          size:
            typeof info.metadata?.size === "number"
              ? info.metadata.size
              : typeof file.metadata?.size === "number"
                ? file.metadata.size
                : 0,
          createdAt: file.created_at ?? file.updated_at,
        };
      })
    );
    return NextResponse.json(files.filter((file) => file !== null));
  } catch (infoError) {
    console.error("[pdfs] 파일 정보 조회 실패", infoError);
    return NextResponse.json(
      { error: "저장된 PDF 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
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
  const fingerprint = (body as { fingerprint?: unknown }).fingerprint;
  if (!isPdfContentFingerprint(fingerprint)) {
    return NextResponse.json(
      { error: "PDF 내용 지문이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const folder = pdfUserFolder(session.user.id);
  const objectName = createPdfFingerprintObjectName(fingerprint);
  if (!objectName) {
    return NextResponse.json(
      { error: "PDF 내용 지문이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const path = `${folder}/${objectName}`;
  const { data: existing, error: exactLookupError } = await getSupabaseAdmin()
    .storage.from(PDF_STORAGE_BUCKET)
    .info(path);
  if (existing && !exactLookupError) {
    return NextResponse.json(
      { error: "이미 저장된 PDF입니다." },
      { status: 409 }
    );
  }
  if (exactLookupError && !isStorageNotFound(exactLookupError)) {
    console.error("[pdfs] 신규 중복 조회 실패", exactLookupError);
    return NextResponse.json(
      { error: "PDF 중복 여부를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  // ponytail: 레거시는 최근 100개만 검사하며, 초과 시 일회성 경로 마이그레이션으로 전환한다.
  const { data: recent, error: legacyLookupError } = await getSupabaseAdmin()
    .storage.from(PDF_STORAGE_BUCKET)
    .list(folder, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (legacyLookupError) {
    console.error("[pdfs] 레거시 중복 조회 실패", legacyLookupError);
    return NextResponse.json(
      { error: "PDF 중복 여부를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  for (const file of recent) {
    if (!parsePdfObjectName(file.name)) continue;
    const { data: blob, error: downloadError } = await getSupabaseAdmin()
      .storage.from(PDF_STORAGE_BUCKET)
      .download(`${folder}/${file.name}`);
    if (downloadError) {
      console.error("[pdfs] 레거시 PDF 다운로드 실패", downloadError);
      return NextResponse.json(
        { error: "PDF 중복 여부를 확인하지 못했습니다." },
        { status: 500 }
      );
    }
    const existingFingerprint = await pdfContentFingerprint(
      new Uint8Array(await blob.arrayBuffer())
    );
    if (isDuplicatePdfFingerprint(fingerprint, [existingFingerprint])) {
      return NextResponse.json(
        { error: "이미 저장된 PDF입니다." },
        { status: 409 }
      );
    }
  }

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

  return NextResponse.json({ id: fingerprint, path: data.path, token: data.token });
}
