// Claude가 만든 Star 설명을 조회하고 독립 HTML로 표시한다.
import guides from "@/data/star-claude-eli5.json";

type ClaudeStarGuide = {
  summary: string;
  steps: { icon: string; label: string; text: string }[];
  install: string;
  installCommand: string;
  usage: string;
  usageCommand: string;
  source: string;
};

const byRepo: Record<string, ClaudeStarGuide> = guides;

export function getClaudeStarGuide(repo: string): ClaudeStarGuide | undefined {
  const key = repo.toLowerCase();
  return Object.hasOwn(byRepo, key) ? byRepo[key] : undefined;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function officialSourceLink(value: string): string {
  if (!URL.canParse(value)) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) return "";
  return `<footer><a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">공식 문서 보기</a></footer>`;
}

function commandBlock(command: string): string {
  return command.trim() ? `<pre><code>${escapeHtml(command)}</code></pre>` : "";
}

export function renderClaudeStarGuide(repo: string, guide: ClaudeStarGuide): string {
  const name = escapeHtml(repo);
  const steps = guide.steps.map(({ icon, label, text }) => `
    <li><span class="icon" aria-hidden="true">${escapeHtml(icon)}</span><strong>${escapeHtml(label)}</strong><p>${escapeHtml(text)}</p><span class="arrow" aria-hidden="true">→</span></li>
  `).join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} 그림 설명서</title>
<style>
  :root { color-scheme: light dark; --paper: #fff9ed; --ink: #292016; --box: #fffdf7; --line: #dccab0; --link: #704300; --code: #382b20; --code-ink: #fff4db; --step-one: #f9db9b; --step-two: #d9eacb; --step-three: #f9d9cc; }
  @media (prefers-color-scheme: dark) {
    :root { --paper: #231c16; --ink: #fff2df; --box: #30261e; --line: #705b46; --link: #ffdc94; --code: #463528; --step-one: #553b17; --step-two: #35452c; --step-three: #55392e; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 1rem/1.6 system-ui, sans-serif; }
  main { max-inline-size: 58rem; margin-inline: auto; padding: clamp(1rem, 4vw, 3rem); overflow-wrap: anywhere; }
  h1, h2, p { margin: 0; }
  h1 { font-size: clamp(1.65rem, 4vw, 3rem); line-height: 1.15; }
  header p { margin-block-start: .65rem; font-size: clamp(1.12rem, 2vw, 1.4rem); font-weight: 650; }
  figure { margin: 1.6rem 0; }
  ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; list-style: none; margin: 0; padding: 0; }
  li { position: relative; padding: .9rem; border-radius: .9rem; background: var(--step-one); text-align: center; }
  li:nth-child(2) { background: var(--step-two); }
  li:nth-child(3) { background: var(--step-three); }
  .arrow { position: absolute; inset-inline-end: -1.3rem; inset-block-start: 40%; }
  li:last-child .arrow { display: none; }
  .icon { display: block; font-size: clamp(2.8rem, 7vw, 4.5rem); line-height: 1.15; }
  li strong { display: block; margin: .45rem 0 .2rem; }
  .instructions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
  section { background: var(--box); border: 1px solid var(--line); border-radius: .85rem; padding: 1rem; }
  section h2 { margin-block-end: .3rem; font-size: 1.2rem; }
  section p { white-space: pre-line; }
  pre { margin: .65rem 0 0; padding: .65rem; border-radius: .45rem; background: var(--code); color: var(--code-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
  footer { margin-block-start: .75rem; }
  a { display: inline-flex; min-block-size: 2.75rem; align-items: center; color: var(--link); text-underline-offset: .15em; }
  a:focus-visible { outline: .15rem solid currentColor; outline-offset: .2rem; }
  @media (max-width: 36rem) {
    ol, .instructions { grid-template-columns: 1fr; }
    li { display: grid; grid-template-columns: 3.75rem minmax(0, 1fr); align-items: center; gap: 0 .4rem; text-align: start; }
    .icon { grid-row: span 2; }
    li strong { margin: 0; }
    .arrow { inset: auto 0 -1.45rem; text-align: center; transform: rotate(90deg); }
  }
</style>
</head>
<body>
<main>
  <header><h1>${name}</h1><p>${escapeHtml(guide.summary)}</p></header>
  <figure data-eli5-diagram aria-label="어떻게 쓰는지 그림으로 보기"><ol role="list">${steps}</ol></figure>
  <div class="instructions">
    <section id="install"><h2>설치 방법</h2><p>${escapeHtml(guide.install)}</p>${commandBlock(guide.installCommand)}</section>
    <section id="usage"><h2>사용 방법</h2><p>${escapeHtml(guide.usage)}</p>${commandBlock(guide.usageCommand)}</section>
  </div>
  ${officialSourceLink(guide.source)}
</main>
</body>
</html>`;
}
