// 에이전트 문서 목록 — 템플릿 / 드래그앤드롭(번들) / 삭제
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
   * 일반 텍스트 + .zip + .skill(ZIP 패키지) 를 처리한다.
   * .skill 이 PK 헤더(ZIP)면 자동 해제 후 SKILL.md 번들로 저장.
   */
  async function importFiles(fileList: FileList | File[]) {
    const raw = Array.from(fileList);
    if (raw.length === 0) return;

    setUploading(true);
    setUploadMsg(null);

    const flatParts: AgentDocFilePart[] = [];
    const zipGroups: AgentDocFilePart[][] = [];
    /** 그룹별 표시 제목 (패키지 폴더명) */
    const groupTitles: (string | undefined)[] = [];
    const errors: string[] = [];
    let archiveCount = 0;

    for (const file of raw) {
      const sizeLimit =
        isZipFile(file) || isSkillExtName(file.name)
          ? MAX_ZIP_BYTES
          : MAX_FILE_BYTES;
      if (file.size > sizeLimit) {
        errors.push(
          `${file.name}: ${isZipFile(file) || isSkillExtName(file.name) ? "12MB" : "2MB"} 초과`
        );
        continue;
      }

      // --- zip / .skill(ZIP) ---
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const looksZip =
          isZipFile(file) ||
          isZipBytes(buf) ||
          (isSkillExtName(file.name) && isZipBytes(buf));

        if (looksZip) {
          const extracted = await tryExtractZipFile(file);
          // tryExtractZipFile 이 null 이면 아래에서 텍스트 시도
          if (extracted) {
            errors.push(...extracted.warnings);
            archiveCount += 1;
            if (extracted.parts.length === 0) continue;
            const groups = groupZipExtractParts(
              extracted.parts,
              groupUploadParts
            );
            for (const g of groups) {
              zipGroups.push(g);
              groupTitles.push(
                extracted.packageName ||
                  file.name.replace(/\.skill$/i, "").replace(/\.zip$/i, "")
              );
            }
            continue;
          }
        }

        // --- 일반 텍스트 (.md / 텍스트 .skill) ---
        if (!isAllowedAgentDocName(file.name) && !isSkillExtName(file.name)) {
          if (!file.type.startsWith("text/") && file.type !== "") {
            errors.push(`${file.name}: 미지원 형식`);
            continue;
          }
        }
        // ZIP 시그니처인데 여기까지 온 경우 텍스트로 저장 금지
        if (isZipBytes(buf)) {
          errors.push(
            `${file.name}: ZIP 패키지 해제에 실패했습니다. 파일이 손상됐을 수 있습니다.`
          );
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

    const flatGroups = groupUploadParts(flatParts);
    const groups: AgentDocFilePart[][] = [...flatGroups, ...zipGroups];
    const titles: (string | undefined)[] = [
      ...flatGroups.map(() => undefined),
      ...groupTitles,
    ];

    if (groups.length === 0) {
      setUploadMsg(errors.join(" · ") || "가져올 파일이 없습니다.");
      setUploading(false);
      return;
    }

    const createdIds: string[] = [];
    let ok = 0;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]!;
      try {
        const hasSkill =
          group.some((f) => /^skill\.md$/i.test(f.filename)) ||
          group.some((f) => isSkillExtName(f.filename));
        const primary =
          group.find((f) => /^skill\.md$/i.test(f.filename)) ?? group[0]!;
        const names = group.map((f) => f.filename).join(", ");
        const titleFromPkg = titles[gi];
        const title =
          titleFromPkg ||
          primary.filename.replace(/\.md$/i, "").replace(/\.skill$/i, "");

        const res = await fetch("/api/agent-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            kind:
              hasSkill || titleFromPkg
                ? "skill"
                : inferKindFromFilename(primary.filename),
            description:
              group.length > 1
                ? `번들 · ${names}`
                : `파일에서 가져옴 · ${primary.filename}`,
            files: group,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "저장 실패");
        }
        const doc = (await res.json()) as AgentDoc;
        createdIds.push(doc.id);
        ok += 1;
      } catch (err) {
        errors.push(
          `${group.map((g) => g.filename).join("+")}: ${
            err instanceof Error ? err.message : "실패"
          }`
        );
      }
    }

    const notes = [
      groups.some((g) => g.length > 1) ? "skill 번들" : null,
      archiveCount > 0 ? `패키지 ${archiveCount}개 해제` : null,
    ].filter(Boolean);

    if (ok === 1 && errors.length === 0 && createdIds[0]) {
      setUploadMsg(
        `저장됨${notes.length ? ` (${notes.join(", ")})` : ""}`
      );
      router.push(`/agent-docs/${createdIds[0]}`);
      router.refresh();
    } else {
      setUploadMsg(
        [
          `${ok}개 문서 저장${notes.length ? ` · ${notes.join(", ")}` : ""}`,
          errors.length ? `문제: ${errors.join("; ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
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

  function downloadMd(doc: AgentDoc) {
    // 번들이면 대표 파일만 다운로드 (편집기에서 개별 다운로드 권장)
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
          템플릿·.md·{" "}
          <strong className="font-medium text-foreground">
            .skill 패키지(ZIP)
          </strong>
          ·.zip 을 드롭할 수 있습니다. .skill 이 ZIP이면 자동 해제하고 안의
          SKILL.md 를 저장합니다.
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
          if (!uploading && e.dataTransfer.files?.length) {
            void importFiles(e.dataTransfer.files);
          }
        }}
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
            .md · .skill(ZIP 패키지) · .zip · 패키지 최대 12MB · 내부 파일 2MB
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

      {uploadMsg && (
        <p className="text-sm text-muted-foreground">{uploadMsg}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">검색</label>
          <Input
            placeholder="파일명, 제목, 본문, .skill…"
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
            ? "아직 문서가 없습니다. skill 폴더 zip 또는 skill.md + .skill 을 드롭해 보세요."
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
