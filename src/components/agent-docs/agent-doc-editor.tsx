// 에이전트 문서 에디터 — 수동 저장만 (자동 저장 없음)
"use client";

import { Check, Copy, Download, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  isAllowedAgentDocName,
  isSkillExtName,
  type AgentDocFilePart,
} from "@/lib/agent-doc-bundle";
import {
  draftQueueLength,
  peekDraft,
  setDraftQueue,
  shiftDraft,
  updateCurrentDraft,
  type AgentDocDraft,
} from "@/lib/agent-doc-draft";
import { extractMetaFromFiles } from "@/lib/agent-doc-meta";
import {
  AGENT_DOC_KIND_LABEL,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props =
  | { mode: "edit"; doc: AgentDoc }
  | { mode: "create"; /** 없으면 sessionStorage 초안 */ initialDraft?: AgentDocDraft };

/** 에이전트 문서 메타·번들 파일 편집 (저장 버튼으로만 반영) */
export function AgentDocEditor(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === "create";

  const seed = isCreate
    ? props.initialDraft ?? null
    : {
        kind: props.doc.kind,
        title: props.doc.title,
        description: props.doc.description ?? "",
        files:
          props.doc.files?.length > 0
            ? props.doc.files
            : [{ filename: props.doc.filename, content: props.doc.content }],
      };

  const [title, setTitle] = useState(seed?.title ?? "");
  const [kind, setKind] = useState<AgentDocKind>(seed?.kind ?? "other");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [files, setFiles] = useState<AgentDocFilePart[]>(
    seed?.files?.length
      ? seed.files
      : [{ filename: "NOTES.md", content: "" }]
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(
    isCreate ? "미저장 초안" : null
  );
  const [copied, setCopied] = useState(false);
  const [queueLeft, setQueueLeft] = useState(0);
  const [dirty, setDirty] = useState(isCreate);

  const active = files[activeIdx] ?? files[0];
  const docId = props.mode === "edit" ? props.doc.id : null;

  // 생성 모드: sessionStorage 초안 로드
  useEffect(() => {
    if (!isCreate) return;
    if (props.mode === "create" && props.initialDraft) {
      setQueueLeft(Math.max(0, draftQueueLength() - 1));
      return;
    }
    const d = peekDraft();
    if (!d) {
      setStatus("초안이 없습니다. 목록에서 파일을 추가하세요.");
      return;
    }
    applyDraft(d);
    setQueueLeft(Math.max(0, draftQueueLength() - 1));
    setDirty(true);
    setStatus("미저장 초안 — 저장을 눌러야 DB에 반영됩니다");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [isCreate]);

  function applyDraft(d: AgentDocDraft) {
    setTitle(d.title);
    setKind(d.kind);
    setDescription(d.description);
    setFiles(
      d.files.length > 0 ? d.files : [{ filename: "NOTES.md", content: "" }]
    );
    setActiveIdx(0);
  }

  function markDirty() {
    setDirty(true);
    setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
    if (isCreate) {
      updateCurrentDraft({
        kind,
        title,
        description,
        files,
      });
    }
  }

  /** 본문에서 제목·설명 다시 채우기 */
  function fillMetaFromContent() {
    const meta = extractMetaFromFiles(files);
    setTitle(meta.title);
    setDescription(meta.description);
    setDirty(true);
    setStatus("본문에서 제목·설명을 채웠습니다 (미저장)");
  }

  /** 서버 저장 — 생성 POST / 수정 PATCH */
  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (isCreate) {
        const res = await fetch("/api/agent-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || files[0]?.filename || "문서",
            kind,
            description,
            files,
          }),
        });
        if (!res.ok) throw new Error("저장 실패");
        const created = (await res.json()) as AgentDoc;
        shiftDraft(); // 현재 초안 제거
        const remaining = draftQueueLength();
        setQueueLeft(remaining);
        setDirty(false);

        if (remaining > 0) {
          const next = peekDraft();
          if (next) {
            applyDraft(next);
            setDirty(true);
            setStatus(
              `저장됨 · 남은 초안 ${remaining}개 — 이어서 확인 후 저장하세요`
            );
            return;
          }
        }
        setStatus("저장됨");
        router.replace(`/agent-docs/${created.id}`);
        router.refresh();
      } else if (docId) {
        const res = await fetch(`/api/agent-docs/${docId}`, {
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
        setDirty(false);
        setStatus("저장됨");
        router.refresh();
      }
    } catch {
      setStatus("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [description, docId, files, isCreate, kind, router, title]);

  // 생성 모드 편집 시 초안 동기화
  useEffect(() => {
    if (!isCreate || !dirty) return;
    updateCurrentDraft({ kind, title, description, files });
  }, [isCreate, dirty, kind, title, description, files]);

  function updateActiveContent(text: string) {
    setFiles((prev) =>
      prev.map((f, i) => (i === activeIdx ? { ...f, content: text } : f))
    );
    setDirty(true);
    setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
  }

  function updateActiveFilename(name: string) {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === activeIdx ? { ...f, filename: normalizeFilename(name) } : f
      )
    );
    setDirty(true);
    setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
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
    setDirty(true);
    setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
  }

  function removeActiveFile() {
    if (files.length <= 1) {
      alert("최소 1개 파일이 필요합니다.");
      return;
    }
    if (!confirm(`「${active?.filename}」을(를) 번들에서 제거할까요?`)) return;
    setFiles((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setDirty(true);
    setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
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

    const merged = (() => {
      const map = new Map(files.map((f) => [f.filename.toLowerCase(), f]));
      for (const n of next) {
        map.set(n.filename.toLowerCase(), n);
      }
      return Array.from(map.values());
    })();

    setFiles(merged);
    const meta = extractMetaFromFiles(merged, packageTitle);
    setTitle(meta.title);
    setDescription(meta.description);
    if (packageTitle || next.some((n) => /^skill\.md$/i.test(n.filename))) {
      setKind("skill");
    }
    setActiveIdx(0);
    setDirty(true);
    setStatus("파일 반영됨 — 저장을 눌러야 DB에 반영됩니다");
  }

  function discardCreate() {
    if (dirty && !confirm("저장하지 않은 초안을 버리고 목록으로 갈까요?")) {
      return;
    }
    setDraftQueue([]);
    router.push("/agent-docs");
  }

  return (
    <div className="space-y-4">
      {isCreate ? (
        <button
          type="button"
          onClick={discardCreate}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 목록으로 (초안 취소)
        </button>
      ) : (
        <Link
          href="/agent-docs"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 에이전트 문서 목록
        </Link>
      )}

      {isCreate && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          새 문서 초안입니다. <strong>저장</strong>을 눌러야 목록에 남습니다.
          {queueLeft > 0 && ` · 대기 중 초안 ${queueLeft}개 더 있음`}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">제목</label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
              setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
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
              setDirty(true);
              setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
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
              setDirty(true);
              setStatus(isCreate ? "미저장 초안" : "수정됨 (미저장)");
            }}
            placeholder="한 줄 설명"
          />
        </div>
      </div>

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
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          <Save className="h-4 w-4" />
          {saving ? "저장 중…" : isCreate ? "저장 (등록)" : "저장"}
        </Button>
        <Button type="button" variant="secondary" onClick={fillMetaFromContent}>
          <Sparkles className="h-4 w-4" />
          본문에서 제목·설명 채우기
        </Button>
        <Button variant="secondary" onClick={() => void copyContent()}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "복사됨" : "현재 파일 복사"}
        </Button>
        <Button variant="outline" onClick={downloadActive}>
          <Download className="h-4 w-4" />
          다운로드
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
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          본문 (파일 드롭 가능 · 자동 저장 없음)
        </label>
        <Textarea
          value={active?.content ?? ""}
          onChange={(e) => updateActiveContent(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onDropFiles(e)}
          className="min-h-[480px] font-mono text-sm leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
