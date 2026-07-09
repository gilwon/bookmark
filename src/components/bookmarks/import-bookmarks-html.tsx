// 브라우저 북마크 HTML export 업로드 / 드래그앤드롭 import
"use client";

import { FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  looksLikeBookmarkHtml,
  parseNetscapeBookmarksHtml,
} from "@/lib/netscape-bookmarks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_HTML_BYTES = 15 * 1024 * 1024;

/** HTML 북마크 파일을 파싱해 일괄 등록한다. */
export function ImportBookmarksHtml() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | File[]) {
    const file = Array.from(fileList)[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    if (!/\.html?$/i.test(file.name) && file.type && !file.type.includes("html")) {
      setError("HTML 북마크 파일(.html)을 선택하세요.");
      return;
    }
    if (file.size > MAX_HTML_BYTES) {
      setError("파일이 너무 큽니다 (최대 15MB).");
      return;
    }

    setLoading(true);
    try {
      const html = await file.text();
      if (!looksLikeBookmarkHtml(html, file.name)) {
        setError(
          "브라우저 북마크 HTML 형식이 아닌 것 같습니다. Chrome/Firefox 내보내기 파일을 사용하세요."
        );
        setLoading(false);
        return;
      }

      const parsed = parseNetscapeBookmarksHtml(html);
      if (parsed.length === 0) {
        setError("파일에서 북마크 링크를 찾지 못했습니다.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/bookmarks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: parsed.map((p) => ({
            url: p.url,
            title: p.title,
            category: p.category,
            addDate: p.addDate,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "import 실패");
      }

      setMessage(
        `가져오기 완료 · 추가 ${data.imported ?? 0}개` +
          (data.skipped ? ` · 중복 스킵 ${data.skipped}` : "") +
          (data.invalid ? ` · 무효 ${data.invalid}` : "") +
          ` (파일 내 ${parsed.length}개 링크)`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "가져오기 실패");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
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
          if (!loading && e.dataTransfer.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:flex-row sm:justify-between sm:text-left",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-card/30 hover:border-indigo-400/50 hover:bg-muted/30",
          loading && "pointer-events-none opacity-60"
        )}
      >
        <div className="flex items-center gap-3">
          <Upload
            className={cn(
              "h-6 w-6 shrink-0",
              dragOver ? "text-indigo-500" : "text-muted-foreground"
            )}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {loading
                ? "가져오는 중…"
                : dragOver
                  ? "여기에 놓으면 가져옵니다"
                  : "북마크 HTML 가져오기"}
            </p>
            <p className="text-xs text-muted-foreground">
              Chrome / Edge / Firefox 내보내기 파일 (예: bookmarks_….html) ·
              폴더는 카테고리로 저장 · 중복 URL 스킵
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <FileUp className="h-4 w-4" />
          파일 선택
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
          }}
        />
      </div>
      {message && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
