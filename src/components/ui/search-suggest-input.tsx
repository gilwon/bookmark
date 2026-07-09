// 목록 검색 입력 + 자동완성(suggest) 드롭다운
"use client";

import { Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type SearchSuggestItem = {
  /** 선택 시 검색창에 넣을 값 */
  value: string;
  /** 목록에 보일 라벨 (기본 value) */
  label?: string;
  /** 그룹 라벨 (제목 / 태그 등) */
  group?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** 후보 목록 (중복·빈 문자열은 내부에서 정리) */
  suggestions: SearchSuggestItem[] | string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  /** 드롭다운에 보일 최대 개수 */
  maxItems?: number;
  /** 입력이 비어 있을 때도 상위 후보 표시 */
  showWhenEmpty?: boolean;
};

function normalizeItems(
  suggestions: SearchSuggestItem[] | string[]
): SearchSuggestItem[] {
  const seen = new Set<string>();
  const out: SearchSuggestItem[] = [];
  for (const raw of suggestions) {
    const item =
      typeof raw === "string"
        ? { value: raw, label: raw }
        : {
            value: raw.value,
            label: raw.label ?? raw.value,
            group: raw.group,
          };
    const key = item.value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      value: item.value.trim(),
      label: (item.label ?? item.value).trim(),
      group: item.group,
    });
  }
  return out;
}

/** needle 기준 매칭 점수 — 앞부분 일치 우선 */
function rankMatch(item: SearchSuggestItem, needle: string): number {
  if (!needle) return 1;
  const v = item.value.toLowerCase();
  const l = (item.label ?? item.value).toLowerCase();
  if (v === needle || l === needle) return 100;
  if (v.startsWith(needle) || l.startsWith(needle)) return 80;
  if (v.includes(needle) || l.includes(needle)) return 40;
  // 공백 분리 토큰
  const tokens = `${v} ${l}`.split(/[\s/._-]+/);
  if (tokens.some((t) => t.startsWith(needle))) return 60;
  return 0;
}

/**
 * 검색 입력 + suggest.
 * 키보드 ↑↓ Enter Esc, 클릭 선택, 바깥 클릭 닫기.
 */
export function SearchSuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  inputClassName,
  id,
  maxItems = 8,
  showWhenEmpty = true,
}: Props) {
  const autoId = useId();
  const listId = `${id ?? autoId}-suggest`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const items = useMemo(
    () => normalizeItems(suggestions),
    [suggestions]
  );

  const filtered = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) {
      if (!showWhenEmpty) return [];
      return items.slice(0, maxItems);
    }
    return items
      .map((item) => ({ item, score: rankMatch(item, needle) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label!.localeCompare(b.item.label!, "ko"))
      .slice(0, maxItems)
      .map((x) => x.item);
  }, [items, value, maxItems, showWhenEmpty]);

  const showList = open && filtered.length > 0;

  useEffect(() => {
    setHi(0);
  }, [value, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (item: SearchSuggestItem) => {
      onChange(item.value);
      setOpen(false);
    },
    [onChange]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (filtered.length > 0) setOpen(true);
      return;
    }
    if (!showList) {
      if (e.key === "Escape") (e.target as HTMLInputElement).blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = filtered[hi];
      if (item) {
        e.preventDefault();
        pick(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && filtered[hi] ? `${listId}-opt-${hi}` : undefined
        }
        className={cn("pl-8", inputClassName)}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-md border border-border bg-card py-1 text-foreground shadow-md"
        >
          {filtered.map((item, i) => {
            const active = i === hi;
            return (
              <li
                key={`${item.group ?? ""}:${item.value}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={active}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-sm",
                  active
                    ? "bg-indigo-600/15 text-foreground"
                    : "text-foreground hover:bg-muted/70"
                )}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  // blur 전에 선택
                  e.preventDefault();
                  pick(item);
                }}
              >
                <span className="truncate font-medium">
                  {item.label ?? item.value}
                </span>
                {item.group && (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {item.group}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
