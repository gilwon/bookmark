// 설치 현황 데이터 원본 로더(서버 전용). Storage snapshot.json 과 정적 스냅샷 중 최신을 고른다
import {
  localSnapshot,
  mergeKo,
  pickLatestSnapshot,
  type InstalledToolsSnapshot,
} from "@/lib/installed-tools";
import { INSTALLED_TOOLS_BUCKET } from "@/lib/installed-tools-download";
import { INSTALLED_TOOLS_SNAPSHOT_KEY } from "@/lib/installed-tools-sync";
import { getSupabaseAdmin, isSupabaseJsConfigured } from "@/lib/supabase/admin";

/** Storage 의 snapshot.json 을 서비스 롤로 읽는다. 설정이 없거나 읽기·파싱에 실패하면 null */
async function readRemoteSnapshot(): Promise<unknown> {
  if (!isSupabaseJsConfigured()) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(INSTALLED_TOOLS_BUCKET)
      .download(INSTALLED_TOOLS_SNAPSHOT_KEY);
    if (error || !data) return null;
    return JSON.parse(await data.text());
  } catch (error) {
    console.error("[installed-tools] snapshot.json 읽기 실패, 정적 스냅샷을 쓴다", error);
    return null;
  }
}

/** 최신 스냅샷에 한글 번역을 합쳐 돌려준다. 페이지와 다운로드 라우트가 같은 원본을 쓴다 */
export async function getInstalledToolsLatest(): Promise<InstalledToolsSnapshot> {
  return mergeKo(pickLatestSnapshot(await readRemoteSnapshot(), localSnapshot));
}
