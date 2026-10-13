// 한글이 없는 X 북마크 본문에 정적 한국어 번역을 저장한다.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { mergeKoreanTweet } from "../src/lib/x-bookmark-ko.ts";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^("|\x27)|(\x27|")$/g, "");
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: rows, error } = await sb
  .from("x_bookmarks")
  .select("id, tweet_id, text");
if (error) throw error;

let updated = 0;
let skipped = 0;
for (const row of rows ?? []) {
  const next = mergeKoreanTweet(row.tweet_id, row.text ?? "");
  if (next === (row.text ?? "")) {
    skipped += 1;
    continue;
  }
  const { error: updateError } = await sb
    .from("x_bookmarks")
    .update({ text: next })
    .eq("id", row.id);
  if (updateError) throw updateError;
  updated += 1;
}
console.log({ updated, skipped, rows: rows?.length ?? 0 });
