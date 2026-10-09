// 등록된 Star를 큰 그림과 짧은 말의 HTML 화면으로 만든다.

export type Eli5Scene =
  | "video"
  | "design"
  | "chat"
  | "terminal"
  | "data"
  | "ai"
  | "book"
  | "code"
  | "star";

const SCENE_RULES: { scene: Eli5Scene; ko: string[]; en: string[] }[] = [
  {
    scene: "video",
    ko: ["영상", "비디오", "애니메이션", "숏폼"],
    en: ["video", "remotion"],
  },
  {
    scene: "design",
    ko: ["디자인", "색상", "폰트", "레이아웃"],
    en: ["design", "css", "ui"],
  },
  {
    scene: "chat",
    ko: ["채팅", "대화", "메신저"],
    en: ["chat"],
  },
  {
    scene: "terminal",
    ko: ["터미널"],
    en: ["terminal", "shell", "cli", "ssh"],
  },
  {
    scene: "data",
    ko: ["데이터", "분석", "차트"],
    en: ["data", "sql"],
  },
  {
    scene: "ai",
    ko: ["에이전트", "인공지능"],
    en: ["ai", "llm", "gpt", "claude", "agent"],
  },
  {
    scene: "book",
    ko: ["문서", "가이드", "학습"],
    en: ["guide", "docs", "tutorial"],
  },
  {
    scene: "code",
    ko: ["코드", "라이브러리", "프레임워크"],
    en: ["library", "framework", "sdk"],
  },
];

const MISSING_ABOUT = "이 별은 아직 짧은 설명이 없어요.";
const README_PENDING = "저장소 글을 아직 가져오지 않았어요.";
const README_EMPTY = "README가 없어요.";
const MISSING_INSTALL = "설치 방법이 저장소 글에 없어요.";
const MISSING_USAGE = "사용 방법이 저장소 글에 없어요.";
const MISSING_PROS = "좋은 점이 저장소 글에 없어요.";
const MISSING_CONS = "아쉬운 점이 저장소 글에 없어요.";

export type Eli5Chunk =
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "code"; text: string };

export type Eli5Brief = {
  about: Eli5Chunk[];
  install: Eli5Chunk[];
  usage: Eli5Chunk[];
  pros: Eli5Chunk[];
  cons: Eli5Chunk[];
};

/** 설명에서 화면 문장을 최대 두 개 고른다. 한글 문단이 있으면 그 문단만 쓴다. */
export function eli5Lines(description: string | null | undefined): string[] {
  if (!description?.trim()) return [];
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const korean = paragraphs.filter((part) => /[가-힣]/.test(part));
  const chosen = korean.at(-1) ?? paragraphs[0];
  if (!chosen) return [];
  return chosen
    .split(/(?<=[.!?。])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map(shortenSentence);
}

/** 이름과 설명의 단어로 그림 장면을 고른다. */
export function pickEli5Scene(text: string): Eli5Scene {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(/[^a-z0-9가-힣+#]+/).filter(Boolean));
  for (const rule of SCENE_RULES) {
    if (rule.ko.some((word) => lower.includes(word))) return rule.scene;
    if (rule.en.some((word) => tokens.has(word))) return rule.scene;
  }
  return "star";
}

/** 설명과 README에서 네 칸에 넣을 문장만 고른다. 글에 없으면 비운다. */
export function eli5Brief(input: {
  description?: string | null;
  readmeMd?: string | null;
  readmeMdKo?: string | null;
  detailFetchedAt?: string | null;
}): Eli5Brief {
  const aboutLines = eli5Lines(input.description);
  const about =
    aboutLines.length > 0
      ? aboutLines.map((text) => ({ kind: "p" as const, text }))
      : [];
  const readme = readmeParts(input.readmeMdKo, input.readmeMd);
  if (!readme) {
    return { about, install: [], usage: [], pros: [], cons: [] };
  }
  return { about, ...readme };
}

/** 다섯 살 설명 HTML 문서. 설명에 없는 사실은 넣지 않는다. */
export function buildStarEli5Html(input: {
  repoFullName: string;
  description: string | null;
  url?: string | null;
  detailPath?: string | null;
  readmeMd?: string | null;
  readmeMdKo?: string | null;
  detailFetchedAt?: string | null;
}): string {
  const title = repoTitle(input.repoFullName);
  const scene = pickEli5Scene(
    `${input.repoFullName} ${input.description ?? ""}`
  );
  const brief = eli5Brief(input);
  const pending = !input.detailFetchedAt && brief.install.length === 0;
  const hasReadme = Boolean(input.readmeMd?.trim() || input.readmeMdKo?.trim());
  const gap = !hasReadme ? (pending ? README_PENDING : README_EMPTY) : "";
  const links = linkRow(input.url, input.detailPath);
  const about = renderBlock(
    "about",
    "뭐예요",
    brief.about,
    MISSING_ABOUT
  );
  const install = renderBlock(
    "install",
    "설치",
    brief.install,
    gap || MISSING_INSTALL
  );
  const usage = renderBlock(
    "usage",
    "사용",
    brief.usage,
    gap || MISSING_USAGE
  );
  const balance = `<section class="block" data-section="balance">
  <h2>장단점</h2>
  <h3>좋은 점</h3>
  ${renderChunks(brief.pros, gap || MISSING_PROS)}
  <h3>아쉬운 점</h3>
  ${renderChunks(brief.cons, gap || MISSING_CONS)}
</section>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — 다섯 살 설명</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: #f4efe6; color: #1c1917; }
  body {
    font-family: "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", sans-serif;
  }
  main {
    width: min(40rem, 100%);
    margin: 0 auto;
    padding: 2.5rem 1.5rem 3rem;
  }
  .hero { text-align: center; }
  .kicker {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: 0.08em;
    color: #6b645b;
  }
  h1 {
    margin: 0.4rem 0 0;
    font-size: clamp(2.6rem, 8vw, 4.6rem);
    line-height: 1.05;
    letter-spacing: -0.04em;
    font-weight: 700;
    word-break: break-word;
  }
  .picture { width: min(16rem, 70vw); margin: 1.5rem auto 0; }
  .picture svg { display: block; width: 100%; height: auto; }
  .block {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e4dccb;
    text-align: left;
  }
  .block h2 {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: 0.08em;
    color: #6b645b;
    font-weight: 600;
  }
  .block h3 { margin: 1rem 0 0; font-size: 1.15rem; }
  .block p, .block li {
    font-size: 1.2rem;
    line-height: 1.45;
    font-weight: 600;
  }
  .block p { margin: 0.8rem 0 0; }
  .block ul { margin: 0.8rem 0 0; padding-left: 1.2rem; }
  .block .empty { color: #6b645b; font-size: 1.05rem; font-weight: 500; }
  .block pre {
    overflow-x: auto;
    margin: 0.8rem 0 0;
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    background: #1c1917;
    color: #f4efe6;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.95rem;
    line-height: 1.45;
    font-weight: 500;
    white-space: pre-wrap;
  }
  .links { margin: 2rem 0 0; font-size: 1rem; text-align: center; }
  .links a { color: #1c1917; margin: 0 0.6rem; }
  .links a:focus-visible { outline: 2px solid #1c1917; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <div class="hero">
    <p class="kicker">다섯 살에게</p>
    <h1>${escapeHtml(title)}</h1>
    <div class="picture" data-scene="${scene}">
      ${sceneSvg(scene)}
    </div>
  </div>
  ${about}
  ${install}
  ${usage}
  ${balance}
  ${links}
</main>
</body>
</html>`;
}

function readmeParts(
  readmeMdKo: string | null | undefined,
  readmeMd: string | null | undefined
): Pick<Eli5Brief, "install" | "usage" | "pros" | "cons"> | null {
  const ko = readmeMdKo?.trim() ?? "";
  const en = readmeMd?.trim() ?? "";
  const primary = /[가-힣]/.test(ko) ? ko : en || ko;
  const secondary = primary === ko ? en : ko;
  if (!primary) return null;
  const first = partsFromMarkdown(primary);
  const second = secondary ? partsFromMarkdown(secondary) : null;
  return {
    install: first.install.length > 0 ? first.install : (second?.install ?? []),
    usage: first.usage.length > 0 ? first.usage : (second?.usage ?? []),
    pros: first.pros.length > 0 ? first.pros : (second?.pros ?? []),
    cons: first.cons.length > 0 ? first.cons : (second?.cons ?? []),
  };
}

function partsFromMarkdown(md: string): Pick<
  Eli5Brief,
  "install" | "usage" | "pros" | "cons"
> {
  const { text, fences } = maskFences(md);
  const blocks = splitBlocks(text);
  const found = {
    install: [] as Eli5Chunk[],
    usage: [] as Eli5Chunk[],
    pros: [] as Eli5Chunk[],
    cons: [] as Eli5Chunk[],
  };
  for (const block of blocks) {
    const kind = headingKind(block.title);
    if (!kind || found[kind].length > 0) continue;
    found[kind] = chunksFromBody(block.body, fences, kind);
  }
  if (found.install.length === 0) {
    const command = preambleInstall(blocks[0]?.body ?? "", fences);
    if (command) found.install = [{ kind: "code", text: command }];
  }
  return found;
}

function maskFences(md: string): { text: string; fences: string[] } {
  const fences: string[] = [];
  const text = md.replace(/```[^\n]*\n[\s\S]*?```/g, (block) => {
    const token = `⟦FENCE_${fences.length}⟧`;
    fences.push(block);
    return token;
  });
  return { text, fences };
}

function splitBlocks(md: string): { title: string; body: string }[] {
  const blocks: { title: string; body: string }[] = [];
  let title = "";
  let buf: string[] = [];
  const flush = () => {
    blocks.push({ title, body: buf.join("\n") });
    buf = [];
  };
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      flush();
      title = heading[1] ?? "";
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

function headingKind(
  title: string
): "install" | "usage" | "pros" | "cons" | null {
  const text = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (isConsHeading(text)) return "cons";
  if (isInstallHeading(text)) return "install";
  if (isUsageHeading(text)) return "usage";
  if (isProsHeading(text)) return "pros";
  return null;
}

function isInstallHeading(text: string): boolean {
  if (text.includes("uninstall")) return false;
  if (text.includes("설치")) return true;
  return /\b(installation|install|installing|setup)\b/.test(text);
}

function isUsageHeading(text: string): boolean {
  if (/(사용법|사용 방법|사용하기|예제|빠른 시작|시작하기)/.test(text)) {
    return true;
  }
  if (/\b(usage|examples?|quickstart)\b/.test(text)) return true;
  if (text.includes("quick start") || text.includes("getting started")) {
    return true;
  }
  return text.includes("how to");
}

function isProsHeading(text: string): boolean {
  if (/(장점|특징)/.test(text)) return true;
  if (/\b(pros|advantages|highlights|features)\b/.test(text)) return true;
  return /^why\b/.test(text);
}

function isConsHeading(text: string): boolean {
  if (/(단점|한계|주의)/.test(text)) return true;
  if (/\b(limitations?|cons|drawbacks|disadvantages|caveats)\b/.test(text)) {
    return true;
  }
  return text.includes("known issues");
}

function chunksFromBody(
  body: string,
  fences: string[],
  kind: "install" | "usage" | "pros" | "cons"
): Eli5Chunk[] {
  const code = firstFence(body, fences);
  const items = listItems(body.replace(/⟦FENCE_\d+⟧/g, ""));
  if (kind === "install" && code) return [{ kind: "code", text: code }];
  if (items.length > 0) return items.map((text) => ({ kind: "li", text }));
  if (code && kind !== "pros" && kind !== "cons") {
    return [{ kind: "code", text: code }];
  }
  return sentences(body.replace(/⟦FENCE_\d+⟧/g, "")).map((text) => ({
    kind: "p",
    text,
  }));
}

function preambleInstall(body: string, fences: string[]): string | null {
  const code = firstFence(body, fences);
  if (!code) return null;
  const command =
    /^(npm|pnpm|yarn|bun|pip3?|pipx|brew|cargo|go|gem|composer|apt-get|winget|docker|npx)\b/im;
  return command.test(code) ? code : null;
}

function firstFence(body: string, fences: string[]): string | null {
  const token = body.match(/⟦FENCE_(\d+)⟧/);
  if (!token) return null;
  const block = fences[Number(token[1])] ?? "";
  const inner = block.match(/```[^\n]*\n([\s\S]*?)```/)?.[1]?.trim() ?? "";
  if (!inner) return null;
  return inner.length > 400 ? `${inner.slice(0, 400)}\n…` : inner;
}

function listItems(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)/);
    if (!item?.[1]) continue;
    const text = shortenPiece(cleanInline(item[1]), 160);
    if (text) items.push(text);
    if (items.length >= 4) break;
  }
  return items;
}

function sentences(body: string): string[] {
  const plain = cleanInline(body.replace(/```[\s\S]*?```/g, " "));
  if (!plain) return [];
  return plain
    .split(/(?<=[.!?。])\s+/)
    .map((sentence) => shortenPiece(sentence.trim(), 160))
    .filter(Boolean)
    .slice(0, 2);
}

function cleanInline(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenPiece(sentence: string, max: number): string {
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const at = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  const base = at >= 40 ? cut.slice(0, at) : cut;
  return `${base.replace(/[,\s]+$/u, "")}…`;
}

function renderBlock(
  id: string,
  label: string,
  chunks: Eli5Chunk[],
  empty: string
): string {
  return `<section class="block" data-section="${id}">
  <h2>${escapeHtml(label)}</h2>
  ${renderChunks(chunks, empty)}
</section>`;
}

function renderChunks(chunks: Eli5Chunk[], empty: string): string {
  if (chunks.length === 0) {
    return `<p class="empty">${escapeHtml(empty)}</p>`;
  }
  const items = chunks.filter((chunk) => chunk.kind === "li");
  const rest = chunks.filter((chunk) => chunk.kind !== "li");
  const html: string[] = [];
  if (items.length > 0) {
    html.push(
      `<ul>${items.map((chunk) => `<li>${escapeHtml(chunk.text)}</li>`).join("")}</ul>`
    );
  }
  for (const chunk of rest) {
    if (chunk.kind === "code") html.push(`<pre>${escapeHtml(chunk.text)}</pre>`);
    else html.push(`<p>${escapeHtml(chunk.text)}</p>`);
  }
  return html.join("\n");
}

function shortenSentence(sentence: string): string {
  if (sentence.length <= 120) return sentence;
  const cut = sentence.slice(0, 120);
  const at = Math.max(
    cut.lastIndexOf(" "),
    cut.lastIndexOf(","),
    cut.lastIndexOf("，")
  );
  const base = at >= 60 ? cut.slice(0, at) : cut;
  return base.replace(/[,\s，]+$/u, "") + "…";
}

function repoTitle(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "별";
  const slash = trimmed.lastIndexOf("/");
  const name = slash >= 0 ? trimmed.slice(slash + 1).trim() : trimmed;
  return name || "별";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return null;
}

function safeDetailPath(path: string | null | undefined): string | null {
  if (!path?.startsWith("/stars/")) return null;
  if (path.includes("//") || /[\\?#:]/.test(path)) return null;
  return path;
}

function linkRow(
  url: string | null | undefined,
  detailPath: string | null | undefined
): string {
  const hrefs: string[] = [];
  const github = safeHttpUrl(url);
  const detail = safeDetailPath(detailPath);
  if (github) {
    hrefs.push(
      `<a href="${escapeHtml(github)}" target="_blank" rel="noopener noreferrer">깃허브에서 보기</a>`
    );
  }
  if (detail) {
    hrefs.push(
      `<a href="${escapeHtml(detail)}" target="_top">자세히 보기</a>`
    );
  }
  if (hrefs.length === 0) return "";
  return `<p class="links">${hrefs.join("")}</p>`;
}

function sceneSvg(scene: Eli5Scene): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" aria-hidden="true">`;
  const close = `</svg>`;
  const body: Record<Eli5Scene, string> = {
    star: `<polygon fill="#f5b942" points="120,30 142.3,89.3 205.6,92.2 156.1,131.7 172.9,192.8 120,158 67.1,192.8 83.9,131.7 34.4,92.2 97.7,89.3"/>`,
    ai: `<circle cx="120" cy="128" r="72" fill="#f7f3ea" stroke="#1c1917" stroke-width="6"/>
      <line x1="120" y1="56" x2="120" y2="28" stroke="#e07a3d" stroke-width="8" stroke-linecap="round"/>
      <circle cx="120" cy="22" r="10" fill="#e07a3d"/>
      <circle cx="96" cy="120" r="8" fill="#1c1917"/>
      <circle cx="144" cy="120" r="8" fill="#1c1917"/>
      <path d="M96 152 Q120 172 144 152" fill="none" stroke="#1c1917" stroke-width="6" stroke-linecap="round"/>`,
    code: `<rect x="48" y="36" width="144" height="48" rx="12" fill="#2f5d50"/>
      <rect x="36" y="96" width="144" height="48" rx="12" fill="#d9783a"/>
      <rect x="60" y="156" width="144" height="48" rx="12" fill="#e7d7b1"/>`,
    design: `<circle cx="72" cy="78" r="42" fill="#e07a3d"/>
      <rect x="122" y="40" width="78" height="78" rx="10" fill="#2f5d50"/>
      <polygon points="48,208 192,208 120,136" fill="#f5b942"/>`,
    video: `<rect x="28" y="48" width="184" height="144" rx="20" fill="#1c1917"/>
      <polygon points="100,90 158,120 100,150" fill="#f6f1e7"/>`,
    data: `<rect x="40" y="110" width="40" height="90" rx="8" fill="#2f5d50"/>
      <rect x="100" y="50" width="40" height="150" rx="8" fill="#e07a3d"/>
      <rect x="160" y="80" width="40" height="120" rx="8" fill="#c4a574"/>`,
    chat: `<rect x="28" y="36" width="130" height="78" rx="28" fill="#2f5d50"/>
      <rect x="82" y="124" width="130" height="78" rx="28" fill="#fffaf3" stroke="#1c1917" stroke-width="6"/>`,
    terminal: `<rect x="24" y="36" width="192" height="168" rx="16" fill="#1c1917"/>
      <circle cx="52" cy="64" r="6" fill="#f4efe6"/>
      <circle cx="74" cy="64" r="6" fill="#f4efe6"/>
      <circle cx="96" cy="64" r="6" fill="#f4efe6"/>
      <rect x="48" y="100" width="110" height="12" rx="4" fill="#6b645b"/>
      <rect x="48" y="128" width="18" height="22" rx="3" fill="#f5b942"/>`,
    book: `<path d="M120 52 L40 76 L40 196 L120 172 Z" fill="#fffaf3" stroke="#1c1917" stroke-width="4"/>
      <path d="M120 52 L200 76 L200 196 L120 172 Z" fill="#fffaf3" stroke="#1c1917" stroke-width="4"/>
      <path d="M120 52 L120 172" stroke="#2f5d50" stroke-width="8" stroke-linecap="round"/>`,
  };
  return `${open}${body[scene]}${close}`;
}
