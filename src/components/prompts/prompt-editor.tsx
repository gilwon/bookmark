// 프롬프트 등록·수정 — 메타 + 섹션 블록
"use client";

import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Prompt, PromptSection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  mode: "create" | "edit";
  initial?: Prompt | null;
};

/** 프롬프트 작성/수정 폼 */
export function PromptEditor({ mode, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [whenToUse, setWhenToUse] = useState(initial?.whenToUse ?? "");
  const [sections, setSections] = useState<PromptSection[]>(
    initial?.sections?.length
      ? initial.sections
      : [
          { title: "1차 프롬프트", body: "" },
          { title: "2차 프롬프트", body: "" },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function updateSection(i: number, patch: Partial<PromptSection>) {
    setSections((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { title: `${prev.length + 1}차 프롬프트`, body: "" },
    ]);
  }

  function removeSection(i: number) {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function copySection(i: number) {
    const body = sections[i]?.body ?? "";
    try {
      await navigator.clipboard.writeText(body);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        category: category.trim() || null,
        summary: summary.trim() || null,
        whenToUse: whenToUse.trim() || null,
        sections,
      };
      const res =
        mode === "create"
          ? await fetch("/api/prompts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/prompts/${initial!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "저장 실패"
        );
      }
      const id = (data as { id?: string }).id ?? initial?.id;
      if (id) {
        router.push(`/prompts/${id}`);
        router.refresh();
      } else {
        router.push("/prompts");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">제목</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 우리 회사 톤으로 외부 공문메일 작성하기"
            disabled={saving}
            className="text-base font-semibold"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">목차</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="예: 1-1. 하루의 시작_…"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">프롬프트 요약</label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="예: 하단 본문을 참고해주세요."
              disabled={saving}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            이런 상황에 사용해요
          </label>
          <Textarea
            value={whenToUse}
            onChange={(e) => setWhenToUse(e.target.value)}
            placeholder="예: 우리 회사가 평소 쓰던 톤 그대로 꼼꼼하게 공문 메일 작성하고 싶을 때"
            className="min-h-[72px]"
            disabled={saving}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">본문 섹션</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addSection}
            disabled={saving}
          >
            <Plus className="h-4 w-4" />
            섹션 추가
          </Button>
        </div>

        {sections.map((sec, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Input
                value={sec.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
                className="h-8 max-w-xs border-0 bg-transparent px-1 font-medium shadow-none focus-visible:ring-0"
                placeholder={`${i + 1}차 프롬프트`}
                disabled={saving}
              />
              <div className="ml-auto flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copySection(i)}
                  disabled={saving || !sec.body}
                >
                  <Copy
                    className={cn(
                      "h-3.5 w-3.5",
                      copiedIdx === i && "text-emerald-500"
                    )}
                  />
                  {copiedIdx === i ? "복사됨" : "복사"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400"
                  onClick={() => removeSection(i)}
                  disabled={saving || sections.length <= 1}
                  aria-label="섹션 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Textarea
              value={sec.body}
              onChange={(e) => updateSection(i, { body: e.target.value })}
              placeholder="프롬프트 본문을 입력하세요…"
              className={cn(
                "min-h-[200px] resize-y rounded-none border-0 bg-zinc-950/90 px-4 py-3",
                "font-mono text-sm leading-relaxed text-zinc-100",
                "focus-visible:ring-0 dark:bg-zinc-950"
              )}
              disabled={saving}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => router.back()}
        >
          취소
        </Button>
      </div>
    </div>
  );
}
