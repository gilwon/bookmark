// 설치 현황 동기화의 순수 판정(배포 환경·요약 줄 파싱)과 상수. 테스트용으로 import 없이 둔다

/** 스캔 스크립트가 스냅샷을 올리는 Storage 키 */
export const INSTALLED_TOOLS_SNAPSHOT_KEY = "snapshot.json";

/** 자식 프로세스 제한 시간(3분) */
export const SYNC_TIMEOUT_MS = 180_000;

/** 자식 프로세스 출력을 메모리에 남기는 상한(꼬리 200KB) */
export const SYNC_OUTPUT_CAP = 200 * 1024;

/** 배포 환경 안내 문구 */
export const SYNC_UNAVAILABLE_MESSAGE = "로컬에서 실행한 앱에서만 동기화할 수 있습니다";

/** VERCEL 환경변수가 있거나 홈에 .claude 가 없으면 배포 환경으로 보고 동기화를 막는다 */
export function isDeploymentEnv({
  vercel,
  hasClaudeDir,
}: {
  vercel: string | undefined;
  hasClaudeDir: boolean;
}): boolean {
  return Boolean(vercel) || !hasClaudeDir;
}

export type SyncSummary = { skills: number; plugins: number; zip: number; syncedAt: string };

/** 출력에서 마지막 SYNC_SUMMARY 줄을 찾아 개수와 시각을 뽑는다. 없거나 형식이 다르면 null */
export function parseSyncSummary(stdout: string): SyncSummary | null {
  const re = /^SYNC_SUMMARY skills=(\d+) plugins=(\d+) zip=(\d+) generatedAt=(\S+)\s*$/gm;
  let last: RegExpExecArray | null = null;
  for (let m = re.exec(stdout); m; m = re.exec(stdout)) last = m;
  if (!last || Number.isNaN(Date.parse(last[4]))) return null;
  return {
    skills: Number(last[1]),
    plugins: Number(last[2]),
    zip: Number(last[3]),
    syncedAt: last[4],
  };
}

/** 누적 출력에 조각을 더하고 상한을 넘으면 앞을 버려 꼬리만 남긴다(요약 줄은 맨 끝에 있다) */
export function appendTail(buf: string, chunk: string, cap = SYNC_OUTPUT_CAP): string {
  const next = buf + chunk;
  return next.length > cap ? next.slice(-cap) : next;
}
