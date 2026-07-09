// 검색 필터 바 — q, type, tag, category, from, to
"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 검색 쿼리와 필터를 URL 쿼리스트링으로 반영한다. */
export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState(params.get("type") ?? "all");
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  /** 필터를 적용해 /search 로 이동한다. */
  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type && type !== "all") sp.set("type", type);
    if (tag.trim()) sp.set("tag", tag.trim());
    if (category.trim()) sp.set("category", category.trim());
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    startTransition(() => {
      router.push(`/search?${sp.toString()}`);
    });
  }

  /** 모든 필터를 초기화한다. */
  function reset() {
    setQ("");
    setType("all");
    setTag("");
    setCategory("");
    setFrom("");
    setTo("");
    startTransition(() => {
      router.push("/search");
    });
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex-1 space-y-1 min-w-[180px]">
        <label className="text-xs text-muted-foreground">검색어</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="제목, 설명, URL…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1 w-full sm:w-36">
        <label className="text-xs text-muted-foreground">타입</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="all">전체</option>
          <option value="bookmark">북마크</option>
          <option value="star">GitHub Star</option>
        </select>
      </div>
      <div className="space-y-1 w-full sm:w-32">
        <label className="text-xs text-muted-foreground">태그</label>
        <Input
          placeholder="태그"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>
      <div className="space-y-1 w-full sm:w-36">
        <label className="text-xs text-muted-foreground">카테고리</label>
        <Input
          placeholder="카테고리"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      <div className="space-y-1 w-full sm:w-40">
        <label className="text-xs text-muted-foreground">시작일</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1 w-full sm:w-40">
        <label className="text-xs text-muted-foreground">종료일</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "검색 중…" : "검색"}
        </Button>
        <Button type="button" variant="outline" onClick={reset} disabled={pending}>
          초기화
        </Button>
      </div>
    </form>
  );
}
