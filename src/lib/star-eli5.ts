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

const MISSING_LINE = "이 별은 아직 짧은 설명이 없어요.";

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

/** 다섯 살 설명 HTML 문서. 설명에 없는 사실은 넣지 않는다. */
export function buildStarEli5Html(input: {
  repoFullName: string;
  description: string | null;
  url?: string | null;
  detailPath?: string | null;
}): string {
  const title = repoTitle(input.repoFullName);
  const lines = eli5Lines(input.description);
  const spoken = lines.length > 0 ? lines : [MISSING_LINE];
  const scene = pickEli5Scene(
    `${input.repoFullName} ${input.description ?? ""}`
  );
  const links = linkRow(input.url, input.detailPath);
  const body = spoken
    .map((line) => `<p class="line">${escapeHtml(line)}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — 다섯 살 설명</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #f4efe6; color: #1c1917; }
  body {
    min-height: 100%;
    display: flex;
    font-family: "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", sans-serif;
  }
  main {
    width: min(40rem, 100%);
    margin: auto;
    padding: 2.5rem 1.5rem 3rem;
    text-align: center;
  }
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
  .line {
    max-width: 22rem;
    margin: 1.25rem auto 0;
    font-size: clamp(1.45rem, 4vw, 2rem);
    line-height: 1.35;
    font-weight: 600;
  }
  .links { margin: 2rem 0 0; font-size: 1rem; }
  .links a { color: #1c1917; margin: 0 0.6rem; }
  .links a:focus-visible { outline: 2px solid #1c1917; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <p class="kicker">다섯 살에게</p>
  <h1>${escapeHtml(title)}</h1>
  <div class="picture" data-scene="${scene}">
    ${sceneSvg(scene)}
  </div>
  ${body}
  ${links}
</main>
</body>
</html>`;
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
