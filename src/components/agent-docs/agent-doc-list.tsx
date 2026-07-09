// 에이전트 문서 목록 — 템플릿 생성 / 드래그앤드롭 업로드 / 삭제
"use client";

import {
  Bot,
  Download,
  FileCode2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  AGENT_DOC_KIND_LABEL,
  getAgentDocTemplates,
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** 허용 확장자·MIME */
const TEXT_EXT = /\.(md|markdown|mdx|txt)$/i;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/** 텍스트 파일 여부 */
function isTextLikeFile(file: File): boolean {
  if (TEXT_EXT.test(file.name)) return true;
  if (
    file.type.startsWith("text/") ||
    file.type === "application/x-markdown" ||
    file.type === ""
  ) {
    // 확장자가 있으면 확장자로 한 번 더 확인
    if (file.name.includes(".") && !TEXT_EXT.test(file.name)) return false;
    return true;
  }
  return false;
}

/** 에이전트 문서 목록 UI */
export function AgentDocList({ docs }: { docs: AgentDoc[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgentDocKind | "all">("all");
  const [q, setQ] = useState("");
  const templates = getAgentDocTemplates();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      if (!needle) return true;
      return [d.title, d.filename, d.description ?? "", d.content]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [docs, filter, q]);

  /** 템플릿으로 새 문서 생성 후 에디터로 이동 */
  async function createFromTemplate(kind: AgentDocKind) {
    setCreating(true);
    try {
      const res = await fetch("/api/agent-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: kind }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const doc = (await res.json()) as AgentDoc;
      router.push(`/agent-docs/${doc.id}`);
      router.refresh();
    } catch {
      alert("문서 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  /**
   * FileList / File[] 을 읽어 API로 저장한다.
   * 성공 시 마지막 문서로 이동(1개) 또는 목록 갱신(여러 개).
   */
  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploading(true);
    setUploadMsg(null);

    const results: { ok: boolean; name: string; error?: string; id?: string }[] =
      [];

    for (const file of files) {
      if (!isTextLikeFile(file)) {
        results.push({
          ok: false,
          name: file.name,
          error: "지원하지 않는 형식 (.md / .txt)",
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        results.push({
          ok: false,
          name: file.name,
          error: "2MB 초과",
        });
        continue;
      }

      try {
        const content = await file.text();
        const filename = normalizeFilename(file.name);
        const kind = inferKindFromFilename(filename);
        const title = filename.replace(/\.md$/i, "") || filename;

        const res = await fetch("/api/agent-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            title,
            kind,
            description: `파일에서 가져옴 · ${file.name}`,
            content,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "저장 실패");
        }
        const doc = (await res.json()) as AgentDoc;
        results.push({ ok: true, name: file.name, id: doc.id });
      } catch (err) {
        results.push({
          ok: false,
          name: file.name,
          error: err instanceof Error ? err.message : "읽기 실패",
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok);

    if (okCount === 1 && fail.length === 0 && results[0]?.id) {
      setUploadMsg(`「${results[0].name}」 저장됨`);
      router.push(`/agent-docs/${results[0].id}`);
      router.refresh();
    } else {
      const parts = [`${okCount}개 저장`];
      if (fail.length > 0) {
        parts.push(
          `실패 ${fail.length}: ${fail.map((f) => `${f.name}(${f.error})`).join(", ")}`
        );
      }
      setUploadMsg(parts.join(" · "));
      router.refresh();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(id: string) {
    if (!confirm("이 에이전트 문서를 삭제할까요?")) return;
    const res = await fetch(`/api/agent-docs/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  /** 브라우저에서 .md 다운로드 */
  function downloadMd(doc: AgentDoc) {
    const blob = new Blob([doc.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename || "NOTES.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 드롭 영역 이벤트 */
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading || creating) return;
    const files = e.dataTransfer.files;
    if (files?.length) void importFiles(files);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          템플릿으로 만들거나, 로컬 Markdown 파일을 드래그앤드롭·선택해
          가져오세요.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button
              key={t.kind}
              variant="secondary"
              size="sm"
              disabled={creating || uploading}
              onClick={() => void createFromTemplate(t.kind)}
            >
              <Plus className="h-4 w-4" />
              {t.filename}
            </Button>
          ))}
        </div>
      </div>

      {/* 드래그앤드롭 업로드 존 */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-card/30 hover:border-indigo-400/60 hover:bg-muted/40",
          (uploading || creating) && "pointer-events-none opacity-60"
        )}
      >
        <Upload
          className={cn(
            "h-8 w-8",
            dragOver ? "text-indigo-500" : "text-muted-foreground"
          )}
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {uploading
              ? "파일 읽는 중…"
              : dragOver
                ? "여기에 놓으면 저장됩니다"
                : "파일을 끌어다 놓거나 클릭해서 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            .md · .markdown · .mdx · .txt · 여러 파일 가능 · 파일당 최대 2MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
          }}
        />
      </div>

      {uploadMsg && (
        <p className="text-sm text-muted-foreground">{uploadMsg}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">검색</label>
          <Input
            placeholder="파일명, 제목, 본문…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1 w-full sm:w-40">
          <label className="text-xs text-muted-foreground">종류</label>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as AgentDocKind | "all")
            }
            className="flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">전체</option>
            {(Object.keys(AGENT_DOC_KIND_LABEL) as AgentDocKind[]).map(
              (k) => (
                <option key={k} value={k}>
                  {AGENT_DOC_KIND_LABEL[k]}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {docs.length === 0
            ? "아직 저장된 에이전트 문서가 없습니다. 템플릿 또는 파일 드롭으로 시작하세요."
            : "필터 조건에 맞는 문서가 없습니다."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((doc) => (
            <Card
              key={doc.id}
              className="group transition-colors hover:border-border"
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
                  {doc.kind === "other" ? (
                    <FileCode2 className="h-5 w-5" />
                  ) : (
                    <Bot className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {AGENT_DOC_KIND_LABEL[doc.kind]}
                    </Badge>
                    <code className="truncate text-xs text-muted-foreground">
                      {doc.filename}
                    </code>
                  </div>
                  <Link
                    href={`/agent-docs/${doc.id}`}
                    className="block truncate font-medium hover:text-indigo-500"
                  >
                    {doc.title}
                  </Link>
                  {doc.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {doc.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    수정 {new Date(doc.updatedAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadMd(doc)}
                    aria-label="다운로드"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400"
                    onClick={() => void handleDelete(doc.id)}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
