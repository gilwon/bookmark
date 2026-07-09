// 북마크 카드 — OG 이미지, 제목, 태그, 인라인 편집/삭제
"use client";

import { Check, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Bookmark } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  bookmark: Bookmark;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** 기존 북마크 목록에서 모은 카테고리 제안 */
  categorySuggestions?: string[];
  /** 기존 북마크 목록에서 모은 태그 제안 */
  tagSuggestions?: string[];
};

/** 단일 북마크를 카드로 렌더링한다. */
export function BookmarkCard({
  bookmark,
  selectable,
  selected,
  onToggleSelect,
  categorySuggestions = [],
  tagSuggestions = [],
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 편집 폼 상태
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [category, setCategory] = useState(bookmark.category ?? "");
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [tagInput, setTagInput] = useState("");
  const [showCatSuggest, setShowCatSuggest] = useState(false);
  const [showTagSuggest, setShowTagSuggest] = useState(false);

  const hasImage = Boolean(bookmark.image);

  /** 편집 모드 진입 시 현재 값으로 폼 초기화 */
  function startEdit() {
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setCategory(bookmark.category ?? "");
    setTags([...bookmark.tags]);
    setTagInput("");
    setError(null);
    setEditing(true);
  }

  /** 편집 취소 — 폼 상태 버리고 뷰 모드로 */
  function cancelEdit() {
    setEditing(false);
    setError(null);
    setShowCatSuggest(false);
    setShowTagSuggest(false);
  }

  /** Esc 키로 편집 취소 */
  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  /** 카테고리 입력에 맞는 제안 목록 */
  const filteredCategories = useMemo(() => {
    const needle = category.trim().toLowerCase();
    return categorySuggestions
      .filter((c) => c.toLowerCase() !== needle)
      .filter((c) => !needle || c.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [category, categorySuggestions]);

  /** 태그 입력에 맞는 제안 목록 (이미 선택된 태그 제외) */
  const filteredTags = useMemo(() => {
    const needle = tagInput.trim().toLowerCase();
    const selected = new Set(tags.map((t) => t.toLowerCase()));
    return tagSuggestions
      .filter((t) => !selected.has(t.toLowerCase()))
      .filter((t) => !needle || t.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [tagInput, tags, tagSuggestions]);

  /** 태그 추가 (중복·공백 무시) */
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
    setShowTagSuggest(false);
  }

  /** 태그 제거 */
  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  /** PATCH로 URL·제목·카테고리·태그 저장 */
  async function handleSave() {
    const nextTitle = title.trim();
    const nextUrl = url.trim();
    if (!nextTitle) {
      setError("제목을 입력하세요.");
      return;
    }
    if (!nextUrl) {
      setError("URL을 입력하세요.");
      return;
    }
    try {
      const u = new URL(nextUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        setError("http 또는 https URL만 사용할 수 있습니다.");
        return;
      }
    } catch {
      setError("올바른 URL 형식이 아닙니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextTitle,
          url: nextUrl,
          category: category.trim(),
          tags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "저장에 실패했습니다."
        );
      }
      setEditing(false);
      setShowCatSuggest(false);
      setShowTagSuggest(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 북마크를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  let domain = "";
  try {
    domain = new URL(bookmark.url).hostname;
  } catch {
    domain = bookmark.url;
  }

  /** 선택 체크 — 이미지 위(absolute) 또는 제목 옆(inline) */
  const selectControl = selectable ? (
    <label
      className={cn(
        "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 shadow",
        hasImage && "absolute left-2 top-2 z-10"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-indigo-600"
        checked={Boolean(selected)}
        onChange={onToggleSelect}
        aria-label={`${bookmark.title} 선택`}
      />
    </label>
  ) : null;

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden transition-colors hover:border-border",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40"
      )}
    >
      {hasImage ? (
        <div className="relative">
          {selectControl}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bookmark.image!}
            alt=""
            className="h-36 w-full object-cover bg-muted"
          />
        </div>
      ) : (
        <div className="relative flex h-28 items-center justify-center bg-muted/60 text-sm text-muted-foreground">
          이미지 없음
        </div>
      )}

      {editing ? (
        /* 인라인 편집 폼 */
        <CardContent className="flex flex-1 flex-col gap-3 pt-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
              aria-label="제목 편집"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
              placeholder="https://example.com"
              className="font-mono text-xs"
              aria-label="URL 편집"
              inputMode="url"
              autoComplete="url"
            />
          </div>

          {/* 카테고리 + suggest */}
          <div className="relative space-y-1">
            <label className="text-xs text-muted-foreground">카테고리</label>
            <Input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setShowCatSuggest(true);
              }}
              onFocus={() => setShowCatSuggest(true)}
              onBlur={() => {
                // 클릭 선택을 위해 약간 지연
                setTimeout(() => setShowCatSuggest(false), 150);
              }}
              disabled={saving}
              placeholder="카테고리"
              aria-label="카테고리 편집"
              autoComplete="off"
            />
            {showCatSuggest && filteredCategories.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-md">
                {filteredCategories.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCategory(c);
                        setShowCatSuggest(false);
                      }}
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 태그 칩 + 입력 + suggest */}
          <div className="relative space-y-1">
            <label className="text-xs text-muted-foreground">태그</label>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="gap-1 pr-1"
                >
                  {tag}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() => removeTag(tag)}
                    disabled={saving}
                    aria-label={`${tag} 제거`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggest(true);
              }}
              onFocus={() => setShowTagSuggest(true)}
              onBlur={() => {
                setTimeout(() => setShowTagSuggest(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              disabled={saving}
              placeholder="태그 입력 후 Enter"
              aria-label="태그 추가"
              autoComplete="off"
            />
            {showTagSuggest && filteredTags.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-md">
                {filteredTags.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(t)}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="mt-auto flex items-center justify-end gap-1 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              disabled={saving}
              aria-label="편집 취소"
            >
              <X className="h-3.5 w-3.5" />
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              aria-label="저장"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-2">
              {/* 이미지 없을 때 체크박스를 제목 앞에 두어 겹침 방지 */}
              {!hasImage && selectControl}
              {bookmark.favicon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bookmark.favicon}
                  alt=""
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <CardTitle className="min-w-0 flex-1 line-clamp-2 text-sm leading-snug">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-300"
                >
                  {bookmark.title}
                </a>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {bookmark.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {bookmark.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {bookmark.category && (
                <Badge variant="secondary">{bookmark.category}</Badge>
              )}
              {bookmark.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="truncate text-xs text-muted-foreground">
                {domain}
              </span>
              <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="열기"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={startEdit}
                  aria-label="편집"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:text-red-300"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-label="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
