// GitHub 링크를 검색하고 출처와 카테고리로 필터링하는 카드 목록
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type GithubLinkItem = {
  title: string;
  description: string;
  category: string;
  url: string;
};

const sourceOptions = ["전체", "GitHub", "Hugging Face", "기타"] as const;

function getSource(url: string) {
  const hostname = new URL(url).hostname;
  if (hostname === "github.com") return "GitHub";
  if (hostname === "huggingface.co") return "Hugging Face";
  return "기타";
}

export function GithubLinksList({ items }: { items: GithubLinkItem[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("전체");
  const [category, setCategory] = useState("전체");
  const categories = useMemo(
    () => ["전체", ...new Set(items.map((item) => item.category))],
    [items]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (source !== "전체" && getSource(item.url) !== source) return false;
      if (category !== "전체" && item.category !== category) return false;
      if (!needle) return true;
      return [item.title, item.description, item.url]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [category, items, query, source]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목, 설명, URL 검색"
          aria-label="GitHub 링크 검색"
          className="sm:col-span-1"
        />
        <Select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="출처 필터"
          className="h-10"
        >
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              출처: {option}
            </option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="카테고리 필터"
          className="h-10"
        >
          {categories.map((option) => (
            <option key={option} value={option}>
              카테고리: {option}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length.toLocaleString()}개
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 항목이 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-doc-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full transition-colors hover:border-indigo-500/40 active:border-indigo-500/60">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {getSource(item.url)}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {item.category}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold leading-snug">
                      {item.title}
                    </h2>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <span className="mt-auto break-all text-xs text-accent">
                    {item.url} ↗
                  </span>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
