// 스레드 카피 상세 — 읽기·복사·같은 페이지에서 수정
"use client";

import { ArrowLeft, Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseCopyTags } from "@/lib/thread-copy";
import type { ThreadCopy } from "@/lib/types";
import { cn } from "@/lib/utils";

const countFormatter = new Intl.NumberFormat("ko-KR");

/** 등록된 카피를 읽기 전용으로 보여 주고 같은 화면에서 고친다. */
export function CopyDetail({ copy }: { copy: ThreadCopy }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(copy.title);
  const [body, setBody] = useState(copy.body);
  const [sourceUrl, setSourceUrl] = useState(copy.sourceUrl ?? "");
  const [tags, setTags] = useState(copy.tags.join(", "));

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(copy.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!confirm("이 카피를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/copies/${copy.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/copies");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  function startEdit() {
    setTitle(copy.title);
    setBody(copy.body);
    setSourceUrl(copy.sourceUrl ?? "");
    setTags(copy.tags.join(", "));
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("본문을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/copies/${copy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          sourceUrl,
          tags: parseCopyTags(tags),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "저장에 실패했습니다."
        );
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-lg min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/copies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Link>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => void copyBody()}
          >
            <Copy className={cn("h-3.5 w-3.5", copied && "text-emerald-500")} />
            {copied ? "복사됨" : "복사"}
          </Button>
          {!editing && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10"
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-red-400"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </Button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="edit-title" className="text-xs text-muted-foreground">
              제목 (선택)
            </label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="비우면 첫 줄이 제목"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="edit-body" className="text-xs text-muted-foreground">
                본문
              </label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {countFormatter.format(body.length)}자
              </span>
            </div>
            <Textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-48 whitespace-pre-wrap break-words leading-relaxed"
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-source"
              className="text-xs text-muted-foreground"
            >
              출처 URL (선택)
            </label>
            <Input
              id="edit-source"
              type="text"
              inputMode="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-tags" className="text-xs text-muted-foreground">
              태그 (쉼표 구분)
            </label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={saving}
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <>
          <header className="space-y-3 border-b border-border pb-5">
            <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
            {copy.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {copy.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {copy.sourceUrl && (
              <a
                href={copy.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {copy.sourceUrl}
              </a>
            )}
          </header>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {copy.body}
          </p>
          <p className="text-xs text-muted-foreground">
            등록 {new Date(copy.createdAt).toLocaleString("ko-KR")}
            {copy.updatedAt !== copy.createdAt
              ? ` · 수정 ${new Date(copy.updatedAt).toLocaleString("ko-KR")}`
              : ""}
          </p>
        </>
      )}
    </article>
  );
}
