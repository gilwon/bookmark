// 에이전트 문서 목록 — 템플릿 생성 / 삭제
"use client";

import { Bot, Download, FileCode2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AGENT_DOC_KIND_LABEL,
  getAgentDocTemplates,
} from "@/lib/agent-doc-templates";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** 에이전트 문서 목록 UI */
export function AgentDocList({ docs }: { docs: AgentDoc[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          템플릿으로 새 문서를 만들거나, 기존 Markdown을 붙여 넣어 보관하세요.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button
              key={t.kind}
              variant="secondary"
              size="sm"
              disabled={creating}
              onClick={() => void createFromTemplate(t.kind)}
            >
              <Plus className="h-4 w-4" />
              {t.filename}
            </Button>
          ))}
        </div>
      </div>

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
            ? "아직 저장된 에이전트 문서가 없습니다. 위 템플릿으로 시작하세요."
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
