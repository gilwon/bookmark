// 목록 검색 입력 + 자동완성(suggest) 드롭다운
// Lucian UX/UI Prompt #034 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#034
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
import "./lucian-034.css";

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

/** 라벨에서 입력한 글자와 맞는 첫 부분을 강조 */
function highlight(text: string, needle: string) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/**
 * 검색 입력 + suggest.
 * 키보드 ↑↓ Enter Esc, 클릭 선택, 바깥 클릭 닫기.
 * 강조된 후보가 입력값으로 시작하면 남은 글자를 흐리게 잇고, Tab으로 받아들인다.
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
  // 목록에서 고른 값. 입력값이 이와 같으면 확정 상태(is-set)로 보인다
  const [picked, setPicked] = useState<string | null>(null);

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
  const needle = value.trim().toLowerCase();
  const active = showList ? filtered[hi] : undefined;
  // 강조된 후보가 입력값으로 시작할 때만 남은 글자를 흐리게 잇는다
  const ghost =
    active &&
    value &&
    active.value.length > value.length &&
    active.value.toLowerCase().startsWith(value.toLowerCase())
      ? active.value.slice(value.length)
      : "";

  useEffect(() => {
    setHi(0);
  }, [value, open]);

  // 방향키로 옮긴 후보가 목록 스크롤 밖이면 보이게 한다
  useEffect(() => {
    if (!showList) return;
    document
      .getElementById(`${listId}-opt-${hi}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [hi, showList, listId]);

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
      setPicked(item.value);
      setOpen(false);
    },
    [onChange]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중 Enter·방향키는 조합 확정에 쓰이므로 건너뛴다
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (filtered.length > 0) setOpen(true);
      return;
    }
    if (!showList) {
      if (e.key === "Escape") (e.target as HTMLInputElement).blur();
      return;
    }
    // 034처럼 끝에서 반대쪽 끝으로 돈다
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      const item = filtered[hi];
      if (item) {
        e.preventDefault();
        pick(item);
      }
    } else if (e.key === "Tab" && ghost && !e.shiftKey && active) {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "ux u034",
        value !== "" && picked === value && "is-set",
        className
      )}
    >
      <div className="u034-box">
        <Search className="u034-pl" aria-hidden="true" />
        <div className="u034-wrap">
          <span className="u034-ghost" aria-hidden="true">
            {ghost && (
              <>
                <b>{value}</b>
                {ghost}
              </>
            )}
          </span>
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="both"
            aria-activedescendant={
              showList && filtered[hi] ? `${listId}-opt-${hi}` : undefined
            }
            className={cn("u034-in", inputClassName)}
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
        </div>
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="검색 제안"
          className="u034-list"
        >
          <li
            className="u034-hl"
            role="presentation"
            style={{ "--i": hi } as React.CSSProperties}
          />
          {filtered.map((item, i) => {
            const active = i === hi;
            return (
              <li
                key={`${item.group ?? ""}:${item.value}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={active}
                className="u034-o"
                style={{ animationDelay: `${i * 35}ms` }}
                onPointerMove={() => {
                  if (!active) setHi(i);
                }}
                onMouseDown={(e) => {
                  // blur 전에 선택
                  e.preventDefault();
                  pick(item);
                }}
              >
                <span>
                  <b>{highlight(item.label ?? item.value, needle)}</b>
                  {item.group && <small>{item.group}</small>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
