// 그록봇 추가 폼 — 이름·템플릿 URL 필수
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GROK_BOT_CATEGORY_ORDER } from "@/lib/grok-bot";
import { cn } from "@/lib/utils";

/** 목록 상단에서 그록봇을 추가한다. */
export function GrokBotComposer({
  existingCategories = [],
}: {
  existingCategories?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [creator, setCreator] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [howItWorks, setHowItWorks] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [officialMarketplace, setOfficialMarketplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...GROK_BOT_CATEGORY_ORDER, ...existingCategories]) {
      const t = c.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [existingCategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    if (!templateUrl.trim()) {
      setError("템플릿 URL을 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/grok-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nameEn,
          creator,
          category,
          description,
          howItWorks,
          templateUrl,
          sourceUrl: sourceUrl.trim() || undefined,
          officialMarketplace,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "저장에 실패했습니다."
        );
      }
      setName("");
      setNameEn("");
      setCreator("");
      setCategory("");
      setDescription("");
      setHowItWorks("");
      setTemplateUrl("");
      setSourceUrl("");
      setOfficialMarketplace(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4",
        error && "border-red-400/60"
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="grok-bot-name" className="text-xs text-muted-foreground">
            이름
          </label>
          <Input
            id="grok-bot-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="한글 이름"
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="grok-bot-name-en"
            className="text-xs text-muted-foreground"
          >
            영문명 (선택)
          </label>
          <Input
            id="grok-bot-name-en"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="English name"
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="grok-bot-creator"
            className="text-xs text-muted-foreground"
          >
            제작자 (선택)
          </label>
          <Input
            id="grok-bot-creator"
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            placeholder="제작자"
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="grok-bot-category"
            className="text-xs text-muted-foreground"
          >
            카테고리 (선택)
          </label>
          <Input
            id="grok-bot-category"
            list="grok-bot-category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="카테고리"
            disabled={loading}
          />
          <datalist id="grok-bot-category-list">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="space-y-1">
        <label
          htmlFor="grok-bot-description"
          className="text-xs text-muted-foreground"
        >
          설명 (선택)
        </label>
        <Textarea
          id="grok-bot-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="이 봇이 하는 일"
          className="min-h-20"
          disabled={loading}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="grok-bot-how"
          className="text-xs text-muted-foreground"
        >
          작동 방식 (선택)
        </label>
        <Textarea
          id="grok-bot-how"
          value={howItWorks}
          onChange={(e) => setHowItWorks(e.target.value)}
          placeholder="어떻게 쓰는지"
          className="min-h-20"
          disabled={loading}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="grok-bot-template"
            className="text-xs text-muted-foreground"
          >
            템플릿 URL
          </label>
          <Input
            id="grok-bot-template"
            type="text"
            inputMode="url"
            value={templateUrl}
            onChange={(e) => setTemplateUrl(e.target.value)}
            placeholder="https://x.ai/bot/..."
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="grok-bot-source"
            className="text-xs text-muted-foreground"
          >
            원본 URL (선택)
          </label>
          <Input
            id="grok-bot-source"
            type="text"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://x.com/..."
            disabled={loading}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={officialMarketplace}
            onChange={(e) => setOfficialMarketplace(e.target.checked)}
            disabled={loading}
          />
          공식 마켓플레이스
        </label>
        <Button type="submit" disabled={loading} className="h-10 shrink-0">
          <Plus className="h-4 w-4" />
          {loading ? "저장 중…" : "추가"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
