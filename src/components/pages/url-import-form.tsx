// URL 불러오기 → 마크다운 textarea 편집 → 페이지 저장
"use client";

import { Download, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markdownToTiptapDoc } from "@/lib/markdown-to-tiptap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** URL 입력 후 본문을 마크다운으로 불러와 페이지로 저장한다. */
export function UrlImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFetch() {
    const raw = url.trim();
    if (!raw) {
      setError("URL을 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/pages/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "불러오기 실패"
        );
      }
      const titleVal = String((data as { title?: string }).title || "");
      const md = String((data as { markdown?: string }).markdown || "");
      const src = String((data as { sourceUrl?: string }).sourceUrl || raw);
      setTitle(titleVal);
      setMarkdown(md);
      setSourceUrl(src);
      setStatus("불러오기 완료 — 내용을 확인한 뒤 저장하세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
      setMarkdown("");
      setSourceUrl(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!markdown.trim()) {
      setError("저장할 마크다운 내용이 없습니다. 먼저 불러오기를 하세요.");
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
          title: title.trim() || sourceUrl || "제목 없는 페이지",
          content,
        }),
      });
      const page = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (page as { error?: string }).error || "저장 실패"
        );
      }
      setStatus("저장됨");
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
          URL로 페이지 등록
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          URL을 입력하고 불러오기를 누르면 본문이 마크다운으로 채워집니다. 수정
          후 저장하세요.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="flex-1 font-mono text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleFetch();
            }
          }}
          disabled={loading || saving}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={loading || saving}
          onClick={() => void handleFetch()}
          className="shrink-0"
        >
          <Download className="h-4 w-4" />
          {loading ? "불러오는 중…" : "불러오기"}
        </Button>
      </div>

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
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              본문 (마크다운)
            </label>
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="min-h-[280px] font-mono text-xs leading-relaxed"
              placeholder="불러오기 후 마크다운이 여기에 표시됩니다…"
              disabled={saving}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !markdown.trim()}
            >
              <Save className="h-4 w-4" />
              {saving ? "저장 중…" : "저장"}
            </Button>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-indigo-600 hover:underline dark:text-indigo-300"
              >
                원문 열기
              </a>
            )}
          </div>
        </>
      )}

      {status && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{status}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
