// 에이전트 문서 Markdown 에디터 — 자동 저장 / 복사 / 다운로드 / 드롭 교체
"use client";

import { Check, Copy, Download, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AGENT_DOC_KIND_LABEL,
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  doc: AgentDoc;
};

/** 에이전트 문서 메타·본문 편집 */
export function AgentDocEditor({ doc }: Props) {
  const [title, setTitle] = useState(doc.title);
  const [filename, setFilename] = useState(doc.filename);
  const [kind, setKind] = useState<AgentDocKind>(doc.kind);
  const [description, setDescription] = useState(doc.description ?? "");
  const [content, setContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** 서버 저장 */
  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agent-docs/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || filename,
          filename,
          kind,
          description,
          content,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setStatus("저장됨");
    } catch {
      setStatus("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [content, description, doc.id, filename, kind, title]);

  // debounce 자동 저장
  useEffect(() => {
    if (status !== "수정됨…") return;
    const t = setTimeout(() => {
      void save();
    }, 1200);
    return () => clearTimeout(t);
  }, [status, save]);

  function markDirty() {
    setStatus("수정됨…");
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  }

  function downloadMd() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "NOTES.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 본문 영역에 파일 드롭 시 내용 교체 */
  async function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("2MB 이하 파일만 가능합니다.");
      return;
    }
    try {
      const text = await file.text();
      const name = normalizeFilename(file.name);
      setContent(text);
      setFilename(name);
      setTitle(name.replace(/\.md$/i, "") || name);
      setKind(inferKindFromFilename(name));
      setDescription(`파일에서 가져옴 · ${file.name}`);
      setStatus("수정됨…");
    } catch {
      alert("파일을 읽지 못했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/agent-docs"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 에이전트 문서 목록
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">제목</label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="표시 제목"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">파일명</label>
          <Input
            value={filename}
            onChange={(e) => {
              setFilename(e.target.value);
              markDirty();
            }}
            placeholder="SKILL.md"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">종류</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as AgentDocKind);
              markDirty();
            }}
            className="flex h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(Object.keys(AGENT_DOC_KIND_LABEL) as AgentDocKind[]).map((k) => (
              <option key={k} value={k}>
                {AGENT_DOC_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">설명</label>
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            placeholder="한 줄 설명 (선택)"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button variant="secondary" onClick={() => void copyContent()}>
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "복사됨" : "본문 복사"}
        </Button>
        <Button variant="outline" onClick={downloadMd}>
          <Download className="h-4 w-4" />
          .md 다운로드
        </Button>
        {status && (
          <span className="text-xs text-muted-foreground">{status}</span>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Markdown 본문 (파일 드롭으로 내용 교체 가능)
        </label>
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            markDirty();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onDropFile(e)}
          className="min-h-[480px] font-mono text-sm leading-relaxed"
          placeholder="# CLAUDE.md / AGENTS.md / SKILL.md …"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
