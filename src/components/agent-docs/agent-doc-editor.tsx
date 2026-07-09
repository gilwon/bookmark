// 에이전트 문서 에디터 — 번들 탭(.md / .skill) · 자동 저장 · 드롭
"use client";

import { Check, Copy, Download, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  isAllowedAgentDocName,
  isSkillExtName,
  type AgentDocFilePart,
} from "@/lib/agent-doc-bundle";
import {
  AGENT_DOC_KIND_LABEL,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  doc: AgentDoc;
};

/** 에이전트 문서 메타·번들 파일 편집 */
export function AgentDocEditor({ doc }: Props) {
  const initialFiles: AgentDocFilePart[] =
    doc.files?.length > 0
      ? doc.files
      : [{ filename: doc.filename, content: doc.content }];

  const [title, setTitle] = useState(doc.title);
  const [kind, setKind] = useState<AgentDocKind>(doc.kind);
  const [description, setDescription] = useState(doc.description ?? "");
  const [files, setFiles] = useState<AgentDocFilePart[]>(initialFiles);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const active = files[activeIdx] ?? files[0];

  /** 서버 저장 (전체 번들) */
  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agent-docs/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || files[0]?.filename || "문서",
          kind,
          description,
          files,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setStatus("저장됨");
    } catch {
      setStatus("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [description, doc.id, files, kind, title]);

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

  function updateActiveContent(text: string) {
    setFiles((prev) =>
      prev.map((f, i) => (i === activeIdx ? { ...f, content: text } : f))
    );
    markDirty();
  }

  function updateActiveFilename(name: string) {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeIdx ? { ...f, filename: normalizeFilename(name) } : f
      )
    );
    markDirty();
  }

  function addEmptyFile(ext: "md" | "skill") {
    const base =
      ext === "skill"
        ? `part-${files.length + 1}.skill`
        : files.some((f) => /^skill\.md$/i.test(f.filename))
          ? `NOTES-${files.length + 1}.md`
          : "SKILL.md";
    setFiles((prev) => [...prev, { filename: base, content: "" }]);
    setActiveIdx(files.length);
    if (ext === "skill") setKind("skill");
    markDirty();
  }

  function removeActiveFile() {
    if (files.length <= 1) {
      alert("최소 1개 파일이 필요합니다.");
      return;
    }
    if (!confirm(`「${active?.filename}」을(를) 번들에서 제거할까요?`)) return;
    setFiles((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    markDirty();
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(active?.content ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  }

  function downloadActive() {
    const name = active?.filename || "NOTES.md";
    const blob = new Blob([active?.content ?? ""], {
      type: isSkillExtName(name)
        ? "text/plain;charset=utf-8"
        : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 파일 드롭: ZIP/.skill 패키지는 해제, 텍스트는 병합 */
  async function onDropFiles(e: React.DragEvent) {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files || []);
    if (list.length === 0) return;

    const next: AgentDocFilePart[] = [];
    let packageTitle: string | undefined;

    for (const file of list) {
      if (file.size > 12 * 1024 * 1024) {
        alert(`${file.name}: 용량 초과`);
        continue;
      }
      try {
        const { tryExtractZipFile, isZipBytes } = await import(
          "@/lib/zip-agent-docs"
        );
        const extracted = await tryExtractZipFile(file);
        if (extracted && extracted.parts.length > 0) {
          for (const p of extracted.parts) {
            next.push({ filename: p.filename, content: p.content });
          }
          packageTitle = extracted.packageName;
          setKind("skill");
          continue;
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        if (isZipBytes(buf)) {
          alert(`${file.name}: ZIP 해제 실패`);
          continue;
        }
        if (!isAllowedAgentDocName(file.name) && !isSkillExtName(file.name)) {
          if (!file.type.startsWith("text/") && file.type !== "") continue;
        }
        const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        next.push({
          filename: normalizeFilename(file.name),
          content: text,
        });
      } catch {
        alert(`${file.name}: 읽기 실패`);
      }
    }
    if (next.length === 0) return;

    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.filename.toLowerCase(), f]));
      for (const n of next) {
        map.set(n.filename.toLowerCase(), n);
      }
      return Array.from(map.values());
    });
    if (packageTitle) {
      setTitle(packageTitle);
      setDescription(`패키지에서 가져옴 · ${list.map((f) => f.name).join(", ")}`);
    } else if (next.some((n) => isSkillExtName(n.filename) || /^skill\.md$/i.test(n.filename))) {
      setKind("skill");
    }
    setActiveIdx(0);
    markDirty();
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
        <div className="space-y-1 sm:col-span-2">
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

      {/* 번들 파일 탭 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
          {files.map((f, i) => (
            <button
              key={`${f.filename}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-mono transition-colors",
                i === activeIdx
                  ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-300"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f.filename}
              {isSkillExtName(f.filename) && (
                <span className="ml-1 opacity-70">·skill</span>
              )}
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => addEmptyFile("md")}
          >
            <Plus className="h-3.5 w-3.5" />
            .md
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => addEmptyFile("skill")}
          >
            <Plus className="h-3.5 w-3.5" />
            .skill
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          번들 {files.length}개 파일
          {files.length > 1 && " · skill.md 와 .skill 을 한 문서에서 함께 봅니다"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button variant="secondary" onClick={() => void copyContent()}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "복사됨" : "현재 파일 복사"}
        </Button>
        <Button variant="outline" onClick={downloadActive}>
          <Download className="h-4 w-4" />
          현재 파일 다운로드
        </Button>
        <Button
          variant="ghost"
          className="text-red-400"
          onClick={removeActiveFile}
          disabled={files.length <= 1}
        >
          <Trash2 className="h-4 w-4" />
          탭 제거
        </Button>
        {status && (
          <span className="text-xs text-muted-foreground">{status}</span>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">현재 파일명</label>
        <Input
          value={active?.filename ?? ""}
          onChange={(e) => updateActiveFilename(e.target.value)}
          className="font-mono text-sm"
          placeholder="SKILL.md 또는 foo.skill"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          본문 (파일 드롭: 1개면 교체, 여러 개면 번들에 병합)
        </label>
        <Textarea
          value={active?.content ?? ""}
          onChange={(e) => updateActiveContent(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onDropFiles(e)}
          className="min-h-[480px] font-mono text-sm leading-relaxed"
          placeholder={
            isSkillExtName(active?.filename ?? "")
              ? "# .skill 파일 내용…"
              : "# SKILL.md / AGENTS.md / CLAUDE.md …"
          }
          spellCheck={false}
        />
      </div>
    </div>
  );
}
