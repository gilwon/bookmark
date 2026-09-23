"use client";
// 맥북가이버 회차 가이드 — 한눈에 보기 · 목차 · 내 정보로 바꾸기 · 프롬프트 보기/복사
import { Check, ChevronDown, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  defaultFieldValues,
  fillPrompt,
  splitPromptParts,
  type GuideEpisode,
  type GuidePrompt,
} from "@/lib/macbookguyver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FIELD_EVENT = "mymark:macbookguyver-fields";

function storageKey(slug: string) {
  return `mymark:macbookguyver:${slug}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(FIELD_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FIELD_EVENT, onChange);
  };
}

/** 입력값을 이 브라우저 localStorage에 둔다. */
function useFieldValues(slug: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey(slug)) ?? "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}"
  );
  const values = useMemo<Record<string, string>>(() => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }, [raw]);

  function write(next: Record<string, string>) {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(next));
      window.dispatchEvent(new Event(FIELD_EVENT));
    } catch {
      // quota 등은 무시
    }
  }

  return { values, write };
}

/** 스크롤 위치에 맞는 목차 항목 id */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    function update() {
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [ids]);
  return active;
}

function PromptCard({
  prompt,
  values,
  defaults,
  forceOpen,
}: {
  prompt: GuidePrompt;
  values: Record<string, string>;
  defaults: Record<string, string>;
  forceOpen: boolean | null;
}) {
  const [open, setOpen] = useState(true);
  const [ok, setOk] = useState(false);
  const shown = forceOpen ?? open;
  const parts = splitPromptParts(prompt.text, values, defaults);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(fillPrompt(prompt.text, values, defaults));
      setOk(true);
      window.setTimeout(() => setOk(false), 1200);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <div id={`p-${prompt.id}`} className="scroll-mt-20 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{prompt.title}</p>
          <p className="text-[11px] text-muted-foreground">{prompt.where}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !shown && "-rotate-90")} />
          {shown ? "접기" : "프롬프트 보기"}
        </Button>
        <Button type="button" size="sm" variant={ok ? "secondary" : "default"} onClick={onCopy}>
          {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {ok ? "복사됨" : "복사"}
        </Button>
      </div>
      {shown && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-3 font-sans text-[13px] leading-relaxed">
          {parts.map((p, i) =>
            p.type === "text" ? (
              <span key={i}>{p.value}</span>
            ) : (
              <mark
                key={i}
                className="rounded bg-yellow-200/80 px-0.5 text-foreground dark:bg-yellow-500/30"
              >
                {p.value}
              </mark>
            )
          )}
        </pre>
      )}
      {prompt.note && (
        <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {prompt.note}
        </p>
      )}
    </div>
  );
}

export function EpisodeGuide({ episode }: { episode: GuideEpisode }) {
  const defaults = useMemo(() => defaultFieldValues(episode.fields), [episode.fields]);
  const { values, write } = useFieldValues(episode.slug);
  const [forceOpen, setForceOpen] = useState<boolean | null>(null);

  const tocIds = useMemo(
    () => ["overview", "my-info", ...episode.sections.map((s) => s.id)],
    [episode.sections]
  );
  const active = useActiveSection(tocIds);
  const toc = [
    { id: "overview", label: "한눈에 보기" },
    { id: "my-info", label: "내 정보로 바꾸기" },
    ...episode.sections.map((s) => ({ id: s.id, label: s.title })),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-8">
      <div className="min-w-0 space-y-10">
        <details className="rounded-lg border border-border bg-card px-3 py-2 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">목차</summary>
          <nav className="mt-2 flex flex-col gap-1">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="text-xs text-muted-foreground hover:text-indigo-500">
                {t.label}
              </a>
            ))}
          </nav>
        </details>

        <section id="overview" className="scroll-mt-20 space-y-3">
          <h2 className="text-base font-semibold tracking-[-0.02em]">한눈에 보기</h2>
          <p className="text-sm text-muted-foreground">
            회차에서 만든 자동화를 순서대로 모았습니다. 필요한 단계로 바로 이동하세요.
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {episode.sections.map((s, i) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-3">
                <a href={`#${s.id}`} className="group block">
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    {i + 1} · {s.kicker}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold group-hover:text-indigo-500">
                    {s.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {s.summary}
                  </span>
                </a>
                <ul className="mt-2 space-y-1">
                  {s.prompts.map((p) => (
                    <li key={p.id}>
                      <a
                        href={`#p-${p.id}`}
                        className="text-xs text-muted-foreground hover:text-indigo-500"
                      >
                        → {p.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section id="my-info" className="scroll-mt-20 space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-base font-semibold tracking-[-0.02em]">내 정보로 바꾸기</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => write({})}>
              <RotateCcw className="h-3.5 w-3.5" />
              기본값으로 되돌리기
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            입력한 값이 아래 프롬프트의 노란 칸에 들어가고 복사할 때도 그대로 복사됩니다. 값은 이
            브라우저에만 저장됩니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {episode.fields.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="text-xs font-medium">{f.label}</span>
                <Input
                  value={values[f.key] ?? f.defaultValue}
                  placeholder={f.defaultValue}
                  onChange={(e) => write({ ...values, [f.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">프롬프트</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setForceOpen(true)}>
            모두 펼치기
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setForceOpen(false)}>
            모두 접기
          </Button>
          {forceOpen !== null && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setForceOpen(null)}>
              개별 설정
            </Button>
          )}
        </div>

        {episode.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20 space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                {i + 1} · {s.kicker}
              </p>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
            </div>
            {s.steps && (
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {s.table && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      {s.table.head.map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row) => (
                      <tr key={row[0]} className="border-t border-border">
                        {row.map((cell) => (
                          <td key={cell} className="px-3 py-2 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="space-y-3">
              {s.prompts.map((p) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  values={values}
                  defaults={defaults}
                  forceOpen={forceOpen}
                />
              ))}
            </div>
            {s.tips && (
              <div className="grid gap-3 sm:grid-cols-3">
                {s.tips.map((t) => (
                  <div key={t.title} className="rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs font-semibold">{t.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <a
          href={episode.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-indigo-500"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          원문(영상 속 프롬프트)은 jocoding.net에서 보기
        </a>
      </div>

      <aside className="hidden lg:block">
        <nav className="sticky top-6 space-y-1">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/70">
            목차
          </p>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={cn(
                "block rounded-md px-2 py-1 text-xs transition-colors",
                active === t.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
