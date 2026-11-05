// 내보낸 eli5 서가 JSON 폴더에서 목록과 본문 데이터 파일 두 개를 다시 만든다.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("사용법: node scripts/import-eli5-shelf.mjs <내보낸 JSON 폴더>");
  process.exit(1);
}

// 제목에 이 문구가 들어 있으면 가져오지 않는다.
const EXCLUDED = ["한 폴더 두 시스템", "Next.js vs TanStack"];

const items = [];
const bodies = {};
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  const row = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  if (EXCLUDED.some((word) => String(row.title).includes(word))) continue;
  const id = path.basename(file, ".json");
  // 잘못된 행이 조용히 404 카드가 되지 않도록 먼저 막는다.
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error(`id 형식 오류 ${file}`);
  if (!["설명", "비교"].includes(row.kind)) throw new Error(`kind 오류 ${file}`);
  if (typeof row.html !== "string" || row.html.trim() === "") throw new Error(`html 없음 ${file}`);
  items.push({
    id,
    title: row.title,
    repo: row.repo,
    repoUrl: row.repoUrl,
    summary: row.summary,
    kind: row.kind,
    tags: row.tags,
    date: row.date,
    sourceUrl: row.url,
  });
  bodies[id] = row.html;
}
items.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title, "ko") : a.date < b.date ? 1 : -1));

const out = path.join(import.meta.dirname, "..", "src", "data");
fs.writeFileSync(path.join(out, "eli5-shelf.json"), JSON.stringify(items, null, 2) + "\n");
fs.writeFileSync(path.join(out, "eli5-shelf-bodies.json"), JSON.stringify(bodies, null, 2) + "\n");
console.log(`목록 ${items.length}건, 본문 ${Object.keys(bodies).length}건`);
