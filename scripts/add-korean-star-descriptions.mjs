// GitHub Star 영문 설명에 정적 한국어 번역을 병기하고 이후 동기화에도 보존한다
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^("|\x27)|(\x27|")$/g, "");
  }
}

const translations = JSON.parse(
  readFileSync("src/data/star-descriptions-ko.json", "utf8")
);
const separator = "\n\n";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: rows, error } = await sb
  .from("github_stars")
  .select("id, repo_full_name, description");
if (error) throw error;

let updated = 0;
for (const row of rows) {
  const translation = translations[row.repo_full_name];
  if (!translation || !row.description) continue;
  if (/[가-힣]/.test(row.description)) continue;
  const existingTranslation = row.description
    .split(separator)
    .slice(1)
    .join(separator)
    .trim();
  if (existingTranslation && /[가-힣]/.test(existingTranslation)) continue;
  const original = row.description.split(separator)[0].trim();
  const { error: updateError } = await sb
    .from("github_stars")
    .update({ description: `${original}${separator}${translation}` })
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated++;
}
console.log({ updated, translations: Object.keys(translations).length });
