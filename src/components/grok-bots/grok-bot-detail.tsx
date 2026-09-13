// 그록봇 상세 — 읽기·수정·즐겨찾기·삭제
"use client";

import { ArrowLeft, ExternalLink, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GROK_BOT_CATEGORY_ORDER,
  normalizeTemplateUrl,
  parseGrokBotEntries,
} from "@/lib/grok-bot";
import type { GrokBot, GrokBotEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function entriesToLines(entries: GrokBotEntry[]): string {
  return entries
    .map((e) => {
      const parts = [e.name];
      if (e.descriptionKo) parts.push(e.descriptionKo);
      if (e.schedule) parts.push(e.schedule);
      return parts.join(" | ");
    })
    .join("\n");
}

function linesToEntries(text: string): GrokBotEntry[] {
  return parseGrokBotEntries(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  );
}

/** 등록된 그록봇을 읽고 같은 화면에서 고친다. */
export function GrokBotDetail({ bot }: { bot: GrokBot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(bot.name);
  const [nameEn, setNameEn] = useState(bot.nameEn);
  const [creator, setCreator] = useState(bot.creator);
  const [category, setCategory] = useState(bot.category ?? "");
  const [slug, setSlug] = useState(bot.slug ?? "");
  const [description, setDescription] = useState(bot.description);
  const [howItWorks, setHowItWorks] = useState(bot.howItWorks);
  const [notes, setNotes] = useState(bot.notes);
  const [templateUrl, setTemplateUrl] = useState(bot.templateUrl);
  const [sourceUrl, setSourceUrl] = useState(bot.sourceUrl ?? "");
  const [officialMarketplace, setOfficialMarketplace] = useState(
    bot.officialMarketplace
  );
  const [skillsText, setSkillsText] = useState(entriesToLines(bot.skills));
  const [routinesText, setRoutinesText] = useState(entriesToLines(bot.routines));

  const showNameEn =
    bot.nameEn.trim() && bot.nameEn.trim() !== bot.name.trim();
  const showSource =
    Boolean(bot.sourceUrl?.trim()) &&
    normalizeTemplateUrl(bot.sourceUrl ?? "") !==
      normalizeTemplateUrl(bot.templateUrl);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [
      ...GROK_BOT_CATEGORY_ORDER,
      bot.category ?? "",
    ]) {
      const t = c.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [bot.category]);

  function startEdit() {
    setName(bot.name);
    setNameEn(bot.nameEn);
    setCreator(bot.creator);
    setCategory(bot.category ?? "");
    setSlug(bot.slug ?? "");
    setDescription(bot.description);
    setHowItWorks(bot.howItWorks);
    setNotes(bot.notes);
    setTemplateUrl(bot.templateUrl);
    setSourceUrl(bot.sourceUrl ?? "");
    setOfficialMarketplace(bot.officialMarketplace);
    setSkillsText(entriesToLines(bot.skills));
    setRoutinesText(entriesToLines(bot.routines));
    setError(null);
    setEditing(true);
  }

  async function toggleFavorite() {
    if (favoriting) return;
    setFavoriting(true);
    try {
      const res = await fetch(`/api/grok-bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !bot.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoriting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 그록봇을 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/grok-bots/${bot.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/grok-bots");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
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
    setSaving(true);
    try {
      const res = await fetch(`/api/grok-bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nameEn,
          creator,
          category,
          slug,
          description,
          howItWorks,
          notes,
          templateUrl,
          sourceUrl,
          officialMarketplace,
          skills: linesToEntries(skillsText),
          routines: linesToEntries(routinesText),
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
    <article className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/grok-bots"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Link>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-10",
              bot.isFavorite ? "text-amber-500" : "text-muted-foreground"
            )}
            aria-pressed={bot.isFavorite}
            disabled={favoriting}
            onClick={() => void toggleFavorite()}
          >
            <Star className={cn("h-3.5 w-3.5", bot.isFavorite && "fill-current")} />
            {bot.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          </Button>
          <a
            href={bot.templateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "sm" }), "h-10")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            템플릿 열기
          </a>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="edit-name" className="text-xs text-muted-foreground">
                이름
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-name-en"
                className="text-xs text-muted-foreground"
              >
                영문명
              </label>
              <Input
                id="edit-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-creator"
                className="text-xs text-muted-foreground"
              >
                제작자
              </label>
              <Input
                id="edit-creator"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-category"
                className="text-xs text-muted-foreground"
              >
                카테고리
              </label>
              <Input
                id="edit-category"
                list="edit-category-list"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={saving}
              />
              <datalist id="edit-category-list">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-slug" className="text-xs text-muted-foreground">
                슬러그
              </label>
              <Input
                id="edit-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-template"
                className="text-xs text-muted-foreground"
              >
                템플릿 URL
              </label>
              <Input
                id="edit-template"
                value={templateUrl}
                onChange={(e) => setTemplateUrl(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label
                htmlFor="edit-source"
                className="text-xs text-muted-foreground"
              >
                원본 URL
              </label>
              <Input
                id="edit-source"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-description"
              className="text-xs text-muted-foreground"
            >
              설명
            </label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-how" className="text-xs text-muted-foreground">
              작동 방식
            </label>
            <Textarea
              id="edit-how"
              value={howItWorks}
              onChange={(e) => setHowItWorks(e.target.value)}
              className="min-h-24"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-notes" className="text-xs text-muted-foreground">
              메모
            </label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-routines"
              className="text-xs text-muted-foreground"
            >
              루틴 (한 줄에 이름 | 설명)
            </label>
            <Textarea
              id="edit-routines"
              value={routinesText}
              onChange={(e) => setRoutinesText(e.target.value)}
              className="min-h-24"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-skills"
              className="text-xs text-muted-foreground"
            >
              스킬 (한 줄에 이름 | 설명)
            </label>
            <Textarea
              id="edit-skills"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="min-h-24"
              disabled={saving}
            />
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={officialMarketplace}
              onChange={(e) => setOfficialMarketplace(e.target.checked)}
              disabled={saving}
            />
            공식 마켓플레이스
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="h-10">
              {saving ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
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
            <div className="flex flex-wrap items-center gap-1.5">
              {bot.category ? (
                <Badge variant="secondary">{bot.category}</Badge>
              ) : null}
              {bot.officialMarketplace ? (
                <Badge variant="default">공식 마켓</Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">{bot.name}</h1>
            {showNameEn ? (
              <p className="text-sm text-muted-foreground">{bot.nameEn}</p>
            ) : null}
            {bot.creator ? (
              <p className="text-sm text-muted-foreground">{bot.creator}</p>
            ) : null}
            {showSource && bot.sourceUrl ? (
              <a
                href={bot.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                원본(X)
              </a>
            ) : null}
          </header>
          {bot.description ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {bot.description}
            </p>
          ) : null}
          {bot.howItWorks ? (
            <section className="space-y-1">
              <h2 className="text-sm font-semibold">작동 방식</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {bot.howItWorks}
              </p>
            </section>
          ) : null}
          {bot.routines.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">루틴</h2>
              <ul className="space-y-1 text-sm">
                {bot.routines.map((e, i) => (
                  <li key={`${e.name}-${i}`}>
                    <span className="font-medium">{e.name}</span>
                    {e.descriptionKo ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {e.descriptionKo}
                      </span>
                    ) : null}
                    {e.schedule ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({e.schedule})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {bot.skills.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">스킬</h2>
              <ul className="space-y-1 text-sm">
                {bot.skills.map((e, i) => (
                  <li key={`${e.name}-${i}`}>
                    <span className="font-medium">{e.name}</span>
                    {e.descriptionKo ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {e.descriptionKo}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {bot.notes.trim() ? (
            <section className="space-y-1">
              <h2 className="text-sm font-semibold">메모</h2>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {bot.notes}
              </p>
            </section>
          ) : null}
          <p className="text-xs text-muted-foreground">
            등록 {new Date(bot.createdAt).toLocaleString("ko-KR")}
            {bot.updatedAt !== bot.createdAt
              ? ` · 수정 ${new Date(bot.updatedAt).toLocaleString("ko-KR")}`
              : ""}
          </p>
        </>
      )}
    </article>
  );
}
