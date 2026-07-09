// 텍스트 PDF 업로드 → 마크다운 초안(미리보기) → 페이지 저장
"use client";

import { FileUp, Save, Upload } from "lucide-react";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { markdownToTiptapDoc } from "@/lib/markdown-to-tiptap";
import {
  extractPdfToMarkdown,
  MAX_PDF_BYTES,
  titleFromPdfName,
} from "@/lib/pdf-to-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ViewMode = "preview" | "source";

/** PDF 파일을 골라 텍스트를 추출한 뒤 페이지로 저장한다. */
export function PdfImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [meta, setMeta] = useState<{
    pageCount: number;
    charCount: number;
    likelyScanned: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  /** 마크다운 → HTML 미리보기 (읽기 전용) */
  const previewHtml = useMemo(() => {
    if (!markdown.trim()) return "";
    try {
      return marked.parse(markdown, {
        gfm: true,
        breaks: false,
        async: false,
      }) as string;
    } catch {
      return `<p>${markdown.replace(/</g, "&lt;")}</p>`;
    }
  }, [markdown]);

  async function processFile(file: File) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(
        `파일이 너무 큽니다 (최대 ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)}MB).`
      );
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    setMeta(null);
    setViewMode("preview");
    try {
      const buf = await file.arrayBuffer();
      const result = await extractPdfToMarkdown(buf, file.name);
      setFileName(file.name);
      setTitle(result.title || titleFromPdfName(file.name));
      setMarkdown(result.markdown);
      setMeta({
        pageCount: result.pageCount,
        charCount: result.charCount,
        likelyScanned: result.likelyScanned,
      });
      if (result.likelyScanned || result.charCount === 0) {
        setError(
          "추출된 텍스트가 거의 없습니다. 스캔(이미지) PDF 일 수 있습니다. OCR 은 지원하지 않습니다."
        );
        setStatus("내용을 확인·보완한 뒤 저장하세요.");
      } else {
        setStatus(
          `추출 완료 · 약 ${result.charCount.toLocaleString("ko-KR")}자. 미리보기를 확인한 뒤 저장하세요.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 추출 실패");
      setMarkdown("");
      setFileName(null);
      setMeta(null);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!markdown.trim()) {
      setError("저장할 내용이 없습니다. 먼저 PDF 를 불러오세요.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const content = markdownToTiptapDoc(markdown);
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || fileName || "PDF 가져오기",
          content,
        }),
      });
      const page = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (page as { error?: string }).error || "저장 실패"
        );
      }
      const id = (page as { id?: string }).id;
      if (id) {
        router.push(`/pages/${id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">
          PDF로 페이지 등록
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          텍스트 PDF 를 올리면 마크다운 문서로 정리합니다. 미리보기로 확인한 뒤
          페이지로 저장하세요. (스캔 PDF · OCR 미지원)
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !loading && !saving) void processFile(f);
        }}
        onClick={() => !loading && !saving && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-background/40 hover:border-indigo-400/60 hover:bg-muted/30",
          (loading || saving) && "pointer-events-none opacity-60"
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
            {loading
              ? "PDF → 마크다운 변환 중…"
              : dragOver
                ? "여기에 놓으세요"
                : "PDF 를 끌어다 놓거나 클릭해서 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            .pdf · 최대 {Math.floor(MAX_PDF_BYTES / 1024 / 1024)}MB · 텍스트
            레이어 필요
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={loading || saving}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void processFile(f);
          }}
        />
      </div>

      {fileName && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{fileName}</span>
          {meta && (
            <span className="shrink-0 tabular-nums">
              · {meta.charCount.toLocaleString("ko-KR")}자
            </span>
          )}
        </p>
      )}

      {(markdown || title) && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="페이지 제목"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground">본문 초안</label>
              <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    viewMode === "preview"
                      ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setViewMode("preview")}
                >
                  미리보기
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    viewMode === "source"
                      ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setViewMode("source")}
                >
                  마크다운
                </button>
              </div>
            </div>

            {viewMode === "preview" ? (
              <div
                className={cn(
                  "pdf-md-preview max-h-[min(60vh,520px)] min-h-[240px] overflow-y-auto",
                  "rounded-xl border border-border bg-background px-5 py-4"
                )}
                // 추출 미리보기 전용 — 사용자 입력이 아닌 변환 결과
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <Textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="min-h-[280px] font-mono text-sm leading-relaxed"
                placeholder="마크다운 원본…"
                disabled={saving}
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              기본은 렌더된 미리보기입니다. 수정이 필요하면 「마크다운」 탭에서
              고친 뒤 저장하세요.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !markdown.trim()}
          >
            <Save className="h-4 w-4" />
            {saving ? "저장 중…" : "페이지로 저장"}
          </Button>
        </>
      )}

      {status && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{status}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
