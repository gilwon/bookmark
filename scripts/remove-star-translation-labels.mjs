// GitHub Star 설명에 표시된 한국어 번역 라벨을 줄바꿈으로 바꾼다
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: rows, error } = await sb
  .from("github_stars")
  .select("id, description")
  .like("description", "%\n\n한국어. %");
if (error) throw error;

let updated = 0;
for (const row of rows) {
  const { error: updateError } = await sb
    .from("github_stars")
    .update({ description: row.description.replace("\n\n한국어. ", "\n\n") })
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated++;
}
console.log({ updated });
