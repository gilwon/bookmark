"use client";
// 맥북가이버 회차 목록 — 도구 필터 + 검색 + 회차별 내용 바로가기
import Link from "next/link";
import { useMemo, useState } from "react";
import type { GuideEpisode } from "@/lib/macbookguyver";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function EpisodeList({ episodes }: { episodes: GuideEpisode[] }) {
  const [tool, setTool] = useState("all");
  const [q, setQ] = useState("");

  const tools = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of episodes) for (const t of e.tools) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()];
  }, [episodes]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return episodes.filter((e) => {
      if (tool !== "all" && !e.tools.includes(tool)) return false;
      if (!query) return true;
      const hay = [e.title, e.guest, e.summary, ...e.sections.map((s) => `${s.title} ${s.summary}`)]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [episodes, tool, q]);

  const chip = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTool(id)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
        tool === id
          ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-200"
          : "border-border bg-card text-muted-foreground hover:border-indigo-500/30 hover:text-foreground"
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회차·주제 검색" className="max-w-sm" />
      <div className="flex flex-wrap gap-2">
        {chip("all", "전체", episodes.length)}
        {tools.map(([t, n]) => chip(t, t, n))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 회차가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <Card key={e.slug} className="transition-colors hover:border-indigo-500/40">
              <CardContent className="space-y-3 p-4">
                <Link href={`/macbookguyver/${e.slug}`} className="group block space-y-1">
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    {e.number}화 · {e.guest} · {e.date}
                  </span>
                  <span className="block text-base font-semibold group-hover:text-indigo-500">{e.title}</span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">{e.summary}</span>
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  {e.tools.map((t) => (
                    <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
                <ol className="grid gap-1 sm:grid-cols-2">
                  {e.sections.map((s, i) => (
                    <li key={s.id}>
                      <Link
                        href={`/macbookguyver/${e.slug}#${s.id}`}
                        className="flex gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
                      >
                        <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="text-muted-foreground">{s.kicker}</span>
                        <span className="truncate font-medium">{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/macbookguyver/${e.slug}`}
                  className="inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  프롬프트 보러 가기 →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
