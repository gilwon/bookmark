// 브라우저에서 PDF 파일을 선택해 즉시 미리보는 뷰어
"use client";

import { createClient } from "@supabase/supabase-js";
import { ExternalLink, FileText, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { sortSavedPdfs, type PdfListSortKey } from "@/lib/list-utils";
import {
  PDF_STORAGE_BUCKET,
  PDF_STORAGE_MIME,
  pdfContentFingerprint,
} from "@/lib/pdf-storage";
import { cn } from "@/lib/utils";

type Preview = {
  name: string;
  size: number;
  url: string;
  file: File;
};

type SavedPdf = {
  id: string;
  name: string;
  size: number;
  createdAt: string | null;
};

/** PDF를 서버에 전송하지 않고 브라우저의 기본 PDF 뷰어로 표시한다. */
export function PdfViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [savedPdfs, setSavedPdfs] = useState<SavedPdf[]>([]);
  const [sort, setSort] = useState<PdfListSortKey>("name_asc");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sortedSavedPdfs = useMemo(
    () => sortSavedPdfs(savedPdfs, sort),
    [savedPdfs, sort]
  );

  const loadSavedPdfs = useCallback(async () => {
    try {
      const response = await fetch("/api/pdfs");
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "저장된 PDF 목록을 불러오지 못했습니다.");
      }
      setSavedPdfs(body as SavedPdf[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장된 PDF 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadSavedPdfs());
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [loadSavedPdfs]);

  async function selectFile(file: File) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
    const isPdf = header.some((_, index) =>
      signature.every((byte, offset) => header[index + offset] === byte)
    );
    if (!isPdf) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreview({ name: file.name, size: file.size, url, file });
    setError(null);
    setStatus(null);
    setSaved(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function reset() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreview(null);
    setError(null);
    setStatus(null);
    setSaved(false);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function savePdf() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    setStatus("저장 준비 중…");
    try {
      const fingerprint = await pdfContentFingerprint(
        new Uint8Array(await preview.file.arrayBuffer())
      );
      const response = await fetch("/api/pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preview.name,
          type: PDF_STORAGE_MIME,
          size: preview.size,
          fingerprint,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "PDF 저장을 준비하지 못했습니다.");
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error("Supabase 공개 환경 변수가 설정되지 않았습니다.");
      }
      setStatus("PDF 저장 중…");
      const { error: uploadError } = await createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
        .storage.from(PDF_STORAGE_BUCKET)
        .uploadToSignedUrl(body.path, body.token, preview.file, {
          contentType: PDF_STORAGE_MIME,
          upsert: false,
          metadata: { originalName: preview.name },
        });
      if (uploadError) {
        const duplicate =
          uploadError.status === 409 ||
          uploadError.statusCode === "409" ||
          /already exists|resource already exists|duplicate/i.test(
            uploadError.message
          );
        throw new Error(
          duplicate ? "이미 저장된 PDF입니다." : uploadError.message
        );
      }

      await loadSavedPdfs();
      setSaved(true);
      setStatus("PDF를 저장했습니다.");
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "PDF를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePdf(pdf: SavedPdf) {
    if (!window.confirm(`\"${pdf.name}\"을 삭제할까요?`)) return;
    setDeletingId(pdf.id);
    setError(null);
    setStatus("PDF 삭제 중…");
    try {
      const response = await fetch(`/api/pdfs/${pdf.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "PDF를 삭제하지 못했습니다.");
      }
      setSavedPdfs((files) => files.filter((file) => file.id !== pdf.id));
      setStatus("PDF를 삭제했습니다.");
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "PDF를 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="PDF 파일 선택"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void selectFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-card/40 hover:border-indigo-400/60 hover:bg-muted/30"
        )}
      >
        <Upload
          className={cn(
            "h-7 w-7",
            dragOver ? "text-indigo-500" : "text-muted-foreground"
          )}
        />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {dragOver ? "여기에 놓으세요" : "PDF를 끌어다 놓거나 클릭해서 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            선택 즉시 이 브라우저에서 열리며 저장 버튼을 눌러 보관할 수 있습니다.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void selectFile(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}

      {preview && (
        <section className="space-y-3" aria-label="PDF 미리보기">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{preview.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(preview.size / 1024 / 1024).toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                MB
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="min-h-11 sm:min-h-8"
                disabled={saving || saved}
                onClick={() => void savePdf()}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "저장 중…" : saved ? "저장됨" : "저장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                disabled={saving}
                onClick={reset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </Button>
            </div>
          </div>

          <iframe
            src={preview.url}
            title={`${preview.name} 미리보기`}
            className="h-[70vh] min-h-[480px] w-full rounded-xl border border-border bg-white"
          />
        </section>
      )}

      <section className="space-y-3" aria-labelledby="saved-pdfs-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="saved-pdfs-title" className="text-lg font-semibold tracking-tight">
              저장된 PDF
            </h2>
            <span className="text-xs text-muted-foreground">최근 {savedPdfs.length}개</span>
          </div>
          <div className="w-full space-y-1 sm:w-44">
            <label htmlFor="pdf-sort" className="text-xs text-muted-foreground">
              정렬
            </label>
            <Select
              id="pdf-sort"
              className="h-11 sm:h-9"
              value={sort}
              onChange={(event) => setSort(event.target.value as PdfListSortKey)}
            >
              <option value="name_asc">이름 가나다</option>
              <option value="created_desc">등록일 최신</option>
            </Select>
          </div>
        </div>

        {loadingList ? (
          <p className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            목록을 불러오는 중…
          </p>
        ) : savedPdfs.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            저장된 PDF가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
            {sortedSavedPdfs.map((pdf) => (
              <li
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{pdf.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {(pdf.size / 1024 / 1024).toLocaleString("ko-KR", {
                      maximumFractionDigits: 2,
                    })}
                    MB
                    {pdf.createdAt &&
                      ` · ${new Date(pdf.createdAt).toLocaleString("ko-KR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/pdfs/${pdf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    열기
                  </a>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    disabled={deletingId === pdf.id}
                    onClick={() => void deletePdf(pdf)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === pdf.id ? "삭제 중…" : "삭제"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
