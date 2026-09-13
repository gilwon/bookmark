// 그록봇 목록 카드 — 설명·루틴·템플릿 링크·즐겨찾기
"use client";

import { ExternalLink, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { normalizeTemplateUrl } from "@/lib/grok-bot";
import type { GrokBot, GrokBotEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOW_PREVIEW = 120;
const ENTRY_PREVIEW = 6;

function EntryList({
  title,
  entries,
}: {
  title: string;
  entries: GrokBotEntry[];
}) {
  if (entries.length === 0) return null;
  const shown = entries.slice(0, ENTRY_PREVIEW);
  const extra = entries.length - shown.length;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-0.5 text-xs text-foreground/90">
        {shown.map((e, i) => (
          <li key={`${e.name}-${i}`} className="truncate">
            <span className="font-medium">{e.name}</span>
            {e.schedule ? (
              <span className="text-muted-foreground"> ({e.schedule})</span>
            ) : null}
            {e.descriptionKo ? (
              <span className="text-muted-foreground"> · {e.descriptionKo}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <p className="text-[11px] text-muted-foreground">+{extra}</p>
      ) : null}
    </div>
  );
}

/** 목록 그리드에 쓰는 그록봇 카드. */
export function GrokBotCard({
  bot,
  selected = false,
  onToggleSelect,
  onToggleFavorite,
  favoriting = false,
}: {
  bot: GrokBot;
  selected?: boolean;
  onToggleSelect?: () => void;
  onToggleFavorite?: () => void;
  favoriting?: boolean;
}) {
  const router = useRouter();
  const [howOpen, setHowOpen] = useState(false);
  const href = `/grok-bots/${bot.id}`;
  const showNameEn = bot.nameEn.trim() && bot.nameEn.trim() !== bot.name.trim();
  const how = bot.howItWorks.trim();
  const howLong = how.length > HOW_PREVIEW;
  const howText =
    howOpen || !howLong ? how : `${how.slice(0, HOW_PREVIEW).trimEnd()}…`;
  const templateUrl = bot.templateUrl;
  const sourceUrl = bot.sourceUrl?.trim() || "";
  const showSource =
    Boolean(sourceUrl) &&
    normalizeTemplateUrl(sourceUrl) !== normalizeTemplateUrl(templateUrl);

  function go() {
    router.push(href);
  }

  return (
    <article
      role="link"
      tabIndex={0}
      className={cn(
        "flex h-full cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-3.5 text-card-foreground transition-colors",
        "hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        selected && "border-indigo-500/40 bg-indigo-600/8"
      )}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="flex items-start gap-2">
        {onToggleSelect ? (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${bot.name} 선택`}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-medium leading-snug tracking-[-0.011em]">
              {bot.name}
            </h2>
            {bot.category ? (
              <Badge variant="secondary" className="max-w-[10rem] truncate">
                {bot.category}
              </Badge>
            ) : null}
            {bot.officialMarketplace ? (
              <Badge variant="default">공식 마켓</Badge>
            ) : null}
          </div>
          {showNameEn ? (
            <p className="truncate text-xs text-muted-foreground">{bot.nameEn}</p>
          ) : null}
          {bot.creator ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {bot.creator}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-10 w-10 shrink-0",
            bot.isFavorite ? "text-amber-500" : "text-muted-foreground"
          )}
          title={bot.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-label={bot.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-pressed={bot.isFavorite}
          disabled={favoriting}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
        >
          <Star className={cn("h-4 w-4", bot.isFavorite && "fill-current")} />
        </Button>
      </div>

      {bot.description ? (
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
          {bot.description}
        </p>
      ) : null}

      {how ? (
        <div className="space-y-1">
          <p className="text-xs leading-relaxed text-muted-foreground">{howText}</p>
          {howLong ? (
            <button
              type="button"
              className="h-10 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
              onClick={(e) => {
                e.stopPropagation();
                setHowOpen((v) => !v);
              }}
            >
              {howOpen ? "접기" : "더보기"}
            </button>
          ) : null}
        </div>
      ) : null}

      <EntryList title="루틴" entries={bot.routines} />
      <EntryList title="스킬" entries={bot.skills} />

      {bot.notes.trim() ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{bot.notes}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <a
          href={templateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "sm" }), "h-10")}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          템플릿 열기
        </a>
        {showSource ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10")}
            onClick={(e) => e.stopPropagation()}
          >
            원본(X)
          </a>
        ) : null}
      </div>
    </article>
  );
}
