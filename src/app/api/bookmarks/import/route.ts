// 북마크 HTML 일괄 import — OG 메타(이미지·설명·파비콘) 추출 포함
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireUser } from "@/lib/authz";
import { categoryFromUrl, extractMeta, mapPool } from "@/lib/meta";
import { store } from "@/lib/store";

export const runtime = "nodejs";
/** Vercel 등에서 메타 추출 시간 확보 (플랜 한도 내) */
export const maxDuration = 60;

type ImportItem = {
  url: string;
  title?: string;
  category?: string | null;
  tags?: string[];
  addDate?: string | null;
};

/** 요청당 상한 — 클라이언트는 이보다 작은 배치로 나눈다 */
const MAX_ITEMS = 40;
/** 동시에 스크래핑할 URL 수 */
const META_CONCURRENCY = 5;
/** import 용 메타 타임아웃(초) */
const META_TIMEOUT_SEC = 6;

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "items 배열이 필요합니다." },
      { status: 400 }
    );
  }
  if (body.items.length > MAX_ITEMS) {
    return NextResponse.json(
      {
        error: `한 번에 최대 ${MAX_ITEMS}개까지 import 할 수 있습니다. 배치로 나눠 주세요.`,
      },
      { status: 400 }
    );
  }

  // fetchMeta: false 이면 메타 생략 (빠른 삽입만)
  const fetchMeta = body.fetchMeta !== false;

  const existing = await store.listBookmarks(gate.user.userId);
  const existingByUrl = new Map(
    existing.map((b) => [b.url.toLowerCase(), b] as const)
  );
  /** 이번 요청에서 이미 처리한 URL */
  const seen = new Set<string>();

  type Prepared = {
    url: string;
    titleHint: string;
    category: string;
    tags: string[];
    createdAt: string;
    /** 이미 있고 메타가 비어 있으면 갱신 */
    enrichId?: string;
  };

  const prepared: Prepared[] = [];
  let skipped = 0;
  let invalid = 0;
  const now = new Date().toISOString();

  for (const raw of body.items as ImportItem[]) {
    if (!raw || typeof raw.url !== "string") {
      invalid += 1;
      continue;
    }
    let url = raw.url.trim();
    if (!url) {
      invalid += 1;
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      if (/^\/\//.test(url)) url = `https:${url}`;
      else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
      else {
        invalid += 1;
        continue;
      }
    }
    if (!/^https?:\/\//i.test(url)) {
      invalid += 1;
      continue;
    }

    const key = url.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    const prev = existingByUrl.get(key);
    if (prev) {
      // 이미지·설명이 비어 있으면 메타 보강 대상으로 포함
      const needsMeta =
        fetchMeta && (!prev.image || !prev.description || !prev.favicon);
      if (!needsMeta) {
        skipped += 1;
        continue;
      }
    }

    let titleHint =
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : prev?.title || "";
    if (!titleHint) {
      try {
        titleHint = new URL(url).hostname;
      } catch {
        titleHint = url;
      }
    }

    const category =
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category.trim()
        : prev?.category || categoryFromUrl(url);

    const tags = Array.isArray(raw.tags)
      ? raw.tags.map(String).filter(Boolean)
      : [];

    prepared.push({
      url,
      titleHint,
      category,
      tags,
      createdAt:
        typeof raw.addDate === "string" && raw.addDate
          ? raw.addDate
          : prev?.createdAt || now,
      enrichId: prev?.id,
    });
  }

  let imported = 0;
  let enriched = 0;

  // 메타 추출 (동시성 제한) 후 insert / update
  await mapPool(prepared, META_CONCURRENCY, async (item) => {
    let title = item.titleHint;
    let description: string | null = null;
    let image: string | null = null;
    let favicon: string | null = null;

    if (fetchMeta) {
      try {
        const meta = await extractMeta(item.url, {
          timeoutSec: META_TIMEOUT_SEC,
        });
        // HTML 제목이 호스트/URL 수준이면 OG 제목 우선
        const hintLooksWeak =
          !item.titleHint ||
          item.titleHint === item.url ||
          (() => {
            try {
              return item.titleHint === new URL(item.url).hostname;
            } catch {
              return false;
            }
          })();
        title = hintLooksWeak
          ? meta.title || item.titleHint
          : item.titleHint || meta.title;
        description = meta.description;
        image = meta.image;
        favicon = meta.favicon;
      } catch {
        // 메타 실패해도 북마크는 HTML 제목으로 저장
      }
    }

    if (!favicon) {
      try {
        favicon = `${new URL(item.url).origin}/favicon.ico`;
      } catch {
        favicon = null;
      }
    }

    if (item.enrichId) {
      await store.updateBookmark(item.enrichId, gate.user.userId, {
        title,
        description,
        image,
        favicon,
        // 카테고리는 HTML 폴더 정보가 있으면 유지/갱신
        category: item.category,
      });
      enriched += 1;
      return;
    }

    await store.insertBookmark({
      id: uuidv4(),
      userId: gate.user.userId,
      url: item.url,
      title,
      description,
      image,
      favicon,
      tags: JSON.stringify(item.tags),
      category: item.category,
      isFavorite: 0,
      createdAt: item.createdAt,
    });
    imported += 1;
  });

  return NextResponse.json({
    ok: true,
    imported,
    enriched,
    skipped,
    invalid,
    total: body.items.length,
    metaFetched: fetchMeta,
  });
}
