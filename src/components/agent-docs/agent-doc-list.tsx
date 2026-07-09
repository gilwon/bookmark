// 에이전트 문서 목록 — 템플릿/드롭은 초안만 만들고 저장은 편집 화면에서
"use client";

import {
  Bot,
  Download,
  FileCode2,
  Layers,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  groupUploadParts,
  isAllowedAgentDocName,
  isSkillExtName,
  type AgentDocFilePart,
} from "@/lib/agent-doc-bundle";
import {
  setDraftQueue,
  type AgentDocDraft,
} from "@/lib/agent-doc-draft";
import { extractMetaFromFiles } from "@/lib/agent-doc-meta";
import {
  AGENT_DOC_KIND_LABEL,
  getAgentDocTemplates,
  inferKindFromFilename,
  normalizeFilename,
} from "@/lib/agent-doc-templates";
import {
  groupZipExtractParts,
  isZipBytes,
  isZipFile,
  tryExtractZipFile,
} from "@/lib/zip-agent-docs";
import type { AgentDoc, AgentDocKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_BYTES = 12 * 1024 * 1024;

/** 파일 그룹 → 초안 (제목/설명 본문에서 추출) */
function draftFromGroup(
  group: AgentDocFilePart[],
  packageName?: string
): AgentDocDraft {
  const hasSkill =
    group.some((f) => /^skill\.md$/i.test(f.filename)) ||
    group.some((f) => isSkillExtName(f.filename)) ||
    Boolean(packageName);
  const primary =
    group.find((f) => /^skill\.md$/i.test(f.filename)) ?? group[0]!;
  const kind: AgentDocKind = hasSkill
    ? "skill"
    : inferKindFromFilename(primary.filename);
  const meta = extractMetaFromFiles(group, packageName);
  const names = group.map((f) => f.filename).join(", ");
  return {
    kind,
    title: meta.title,
    description:
      meta.description ||
      (group.length > 1 ? `번들 · ${names}` : `파일 · ${primary.filename}`),
    files: group,
  };
}

/** 에이전트 문서 목록 UI */
export function AgentDocList({ docs }: { docs: AgentDoc[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgentDocKind | "all">("all");
  const [q, setQ] = useState("");
  const templates = getAgentDocTemplates();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      if (!needle) return true;
      const hay = [
        d.title,
        d.filename,
        d.description ?? "",
        d.content,
        ...d.files.flatMap((f) => [f.filename, f.content]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [docs, filter, q]);

  /** 템플릿 → 초안 편집 (DB 저장 안 함, 파일명은 템플릿 그대로) */
  function createFromTemplate(kind: AgentDocKind) {
    const tpl = templates.find((t) => t.kind === kind);
    if (!tpl) return;
    // 템플릿 파일명을 명시적으로 고정 (SKILL.md / AGENTS.md / CLAUDE.md / NOTES.md)
    const files = [
      {
        filename: tpl.filename,
        content: tpl.content,
      },
    ];
    const meta = extractMetaFromFiles(files, tpl.filename.replace(/\.md$/i, ""));
    setDraftQueue([
      {
        kind: tpl.kind,
        title: meta.title || tpl.title,
        description: meta.description || tpl.description,
        files,
      },
    ]);
    setMsg(
      `「${tpl.filename}」 초안 — 저장을 눌러야 등록됩니다.`
    );
    router.push("/agent-docs/new");
  }

  /**
   * 파일/zip 을 읽어 초안 큐로 넘긴다. DB POST 없음.
   */
  async function importFiles(fileList: FileList | File[]) {
    const raw = Array.from(fileList);
    if (raw.length === 0) return;

    setBusy(true);
    setMsg(null);

    const flatParts: AgentDocFilePart[] = [];
    const zipGroups: { group: AgentDocFilePart[]; packageName?: string }[] =
      [];
    const errors: string[] = [];
    let archiveCount = 0;

    for (const file of raw) {
      const sizeLimit =
        isZipFile(file) || isSkillExtName(file.name)
          ? MAX_ZIP_BYTES
          : MAX_FILE_BYTES;
      if (file.size > sizeLimit) {
        errors.push(`${file.name}: 용량 초과`);
        continue;
      }

      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const looksZip =
          isZipFile(file) ||
          isZipBytes(buf) ||
          (isSkillExtName(file.name) && isZipBytes(buf));

        if (looksZip) {
          const extracted = await tryExtractZipFile(file);
          if (extracted) {
            errors.push(...extracted.warnings);
            archiveCount += 1;
            if (extracted.parts.length === 0) continue;
            const groups = groupZipExtractParts(
              extracted.parts,
              groupUploadParts
            );
            const pkg =
              extracted.packageName ||
              file.name.replace(/\.skill$/i, "").replace(/\.zip$/i, "");
            for (const g of groups) {
              zipGroups.push({ group: g, packageName: pkg });
            }
            continue;
          }
        }

        if (!isAllowedAgentDocName(file.name) && !isSkillExtName(file.name)) {
          if (!file.type.startsWith("text/") && file.type !== "") {
            errors.push(`${file.name}: 미지원 형식`);
            continue;
          }
        }
        if (isZipBytes(buf)) {
          errors.push(`${file.name}: ZIP 해제 실패`);
          continue;
        }
        const content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        flatParts.push({
          filename: normalizeFilename(file.name),
          content,
        });
      } catch (err) {
        errors.push(
          `${file.name}: ${err instanceof Error ? err.message : "읽기 실패"}`
        );
      }
    }

    const drafts: AgentDocDraft[] = [
      ...groupUploadParts(flatParts).map((g) => draftFromGroup(g)),
      ...zipGroups.map(({ group, packageName }) =>
        draftFromGroup(group, packageName)
      ),
    ];

    if (drafts.length === 0) {
      setMsg(errors.join(" · ") || "가져올 파일이 없습니다.");
      setBusy(false);
      return;
    }

    setDraftQueue(drafts);
    setMsg(
      [
        `${drafts.length}개 초안 준비`,
        archiveCount > 0 ? `패키지 ${archiveCount}개 해제` : null,
        "저장 버튼을 눌러야 등록됩니다",
        errors.length ? `참고: ${errors.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.push("/agent-docs/new");
  }

  async function handleDelete(id: string) {
    if (!confirm("이 에이전트 문서를 삭제할까요?")) return;
    const res = await fetch(`/api/agent-docs/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  function downloadMd(doc: AgentDoc) {
    const primary = doc.files[0] ?? {
      filename: doc.filename,
      content: doc.content,
    };
    const blob = new Blob([primary.content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = primary.filename || "NOTES.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          템플릿·파일·.skill/.zip 은{" "}
          <strong className="font-medium text-foreground">초안</strong>만
          만듭니다. 편집 화면에서{" "}
          <strong className="font-medium text-foreground">저장</strong>을 눌러야
          목록에 등록됩니다. 제목·설명은 본문에서 자동으로 채웁니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button
              key={t.kind}
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => createFromTemplate(t.kind)}
            >
              <Plus className="h-4 w-4" />
              {t.filename}
            </Button>
          ))}
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
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
          if (!busy && e.dataTransfer.files?.length) {
            void importFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => !busy && fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-card/30 hover:border-indigo-400/60 hover:bg-muted/40",
          busy && "pointer-events-none opacity-60"
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
            {busy
              ? "파일 읽는 중…"
              : dragOver
                ? "놓으면 초안 편집으로 이동합니다"
                : "파일을 끌어다 놓거나 클릭해서 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            .md · .skill(ZIP) · .zip · 자동 저장 없음 · 저장 버튼 필요
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.mdx,.txt,.skill,.zip,text/markdown,text/plain,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
          }}
        />
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

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
            ? "등록된 문서가 없습니다. 템플릿 또는 파일을 추가한 뒤 저장하세요."
            : "필터 조건에 맞는 문서가 없습니다."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((doc) => {
            const fileCount = doc.files?.length || 1;
            return (
              <Card
                key={doc.id}
                className="group transition-colors hover:border-border"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
                    {fileCount > 1 ? (
                      <Layers className="h-5 w-5" />
                    ) : doc.kind === "other" ? (
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
                      {fileCount > 1 && (
                        <Badge variant="outline">번들 · {fileCount}파일</Badge>
                      )}
                      <code className="truncate text-xs text-muted-foreground">
                        {doc.files?.map((f) => f.filename).join(" + ") ||
                          doc.filename}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
