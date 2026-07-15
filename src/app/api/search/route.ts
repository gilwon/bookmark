// 통합 빠른 검색 — 북마크·페이지·프롬프트·에이전트·Stars
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { parsePromptSections } from "@/lib/prompt-mapper";
import type { QuickSearchItem, QuickSearchType } from "@/lib/quick-search";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export type { QuickSearchItem, QuickSearchType };

function clip(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export async function GET(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const perType = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "6") || 6, 1),
    12
  );

  if (!q) {
    return NextResponse.json({ q: "", items: [] as QuickSearchItem[] });
  }

  const userId = gate.user.userId;
  const opts = { q, limit: perType };

  const [bookmarks, pages, prompts, agentDocs, stars] = await Promise.all([
    store.searchBookmarks(userId, opts),
    store.searchPages(userId, opts),
    store.searchPrompts(userId, opts),
    store.searchAgentDocs(userId, opts),
    store.searchStars(userId, opts),
  ]);

  const items: QuickSearchItem[] = [];

  for (const r of pages) {
    items.push({
      type: "page",
      id: r.id,
      title: r.title || "제목 없는 페이지",
      subtitle: "페이지",
      href: `/pages/${r.id}`,
    });
  }

  for (const r of prompts) {
    const sections = parsePromptSections(r.sections);
    const bodyHint = sections[0]?.body?.slice(0, 60) ?? "";
    items.push({
      type: "prompt",
      id: r.id,
      title: r.title || "제목 없는 프롬프트",
      subtitle: clip(
        [r.category, r.summary, bodyHint].filter(Boolean).join(" · ") ||
          "프롬프트"
      ),
      href: `/prompts/${r.id}`,
    });
  }

  for (const r of agentDocs) {
    items.push({
      type: "agent-doc",
      id: r.id,
      title: r.title || r.filename || "에이전트 문서",
      subtitle: clip(
        [r.kind, r.filename, r.description].filter(Boolean).join(" · ") ||
          "에이전트 문서"
      ),
      href: `/agent-docs/${r.id}`,
    });
  }

  for (const r of bookmarks) {
    items.push({
      type: "bookmark",
      id: r.id,
      title: r.title || r.url,
      subtitle: clip(
        [r.category, r.description, r.url].filter(Boolean).join(" · ")
      ),
      href: r.url,
      external: true,
    });
  }

  for (const r of stars) {
    items.push({
      type: "star",
      id: r.id,
      title: r.repoFullName,
      subtitle: clip(
        [r.language, r.description].filter(Boolean).join(" · ") || "GitHub Star"
      ),
      href: r.url,
      external: true,
    });
  }

  // 타입 간 라운드로빈으로 고르게 섞어 상위만 (한 타입이 독식하지 않게)
  const byType = new Map<QuickSearchType, QuickSearchItem[]>();
  for (const it of items) {
    const list = byType.get(it.type) ?? [];
    list.push(it);
    byType.set(it.type, list);
  }
  const order: QuickSearchType[] = [
    "page",
    "prompt",
    "agent-doc",
    "bookmark",
    "star",
  ];
  const mixed: QuickSearchItem[] = [];
  let added = true;
  while (added && mixed.length < perType * 3) {
    added = false;
    for (const t of order) {
      const list = byType.get(t);
      if (list?.length) {
        mixed.push(list.shift()!);
        added = true;
      }
    }
  }

  return NextResponse.json({ q, items: mixed });
}
