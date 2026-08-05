// 비공개 PDF Storage 버킷을 생성하거나 제한 설정을 맞춘다
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^("|\x27)|(\x27|")$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다."
  );
}

const bucketId = "pdf-files";
const options = {
  public: false,
  fileSizeLimit: 20 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf"],
};
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: bucket, error: lookupError } = await supabase.storage.getBucket(bucketId);
const bucketNotFound =
  lookupError?.status === 404 || lookupError?.statusCode === "404";

if (lookupError && !bucketNotFound) throw lookupError;
if (!bucket) {
  const { error } = await supabase.storage.createBucket(bucketId, options);
  if (error) throw error;
  console.log(`${bucketId} 버킷을 생성했습니다.`);
} else {
  const valid =
    bucket.public === false &&
    bucket.file_size_limit === options.fileSizeLimit &&
    bucket.allowed_mime_types?.length === 1 &&
    bucket.allowed_mime_types[0] === options.allowedMimeTypes[0];
  if (!valid) {
    const { error } = await supabase.storage.updateBucket(bucketId, options);
    if (error) throw error;
    console.log(`${bucketId} 버킷 설정을 수정했습니다.`);
  } else {
    console.log(`${bucketId} 버킷 설정이 올바릅니다.`);
  }
}
