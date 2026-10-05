// 이 머신의 설치 상태를 다시 스캔해 ZIP 과 snapshot.json 을 Storage 에 올린다(로컬 실행 전용)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import {
  SYNC_TIMEOUT_MS,
  SYNC_UNAVAILABLE_MESSAGE,
  appendTail,
  isDeploymentEnv,
  parseSyncSummary,
} from "@/lib/installed-tools-sync";

export const runtime = "nodejs";

// ponytail: 프로세스 하나 기준 잠금. 서버 인스턴스가 여럿이면 막지 못하지만 로컬 전용이라 충분하다
let running = false;

/** 고정 인자로 스캔 스크립트를 돌린다. 요청 값은 어디에도 넣지 않는다 */
function runScan(): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/scan-installed-tools.mjs", "--sync"], {
      cwd: process.cwd(),
      timeout: SYNC_TIMEOUT_MS,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (c: string) => (stdout = appendTail(stdout, c)));
    child.stderr.setEncoding("utf8").on("data", (c: string) => (stderr = appendTail(stderr, c)));
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

/** 실패 응답. 출력·경로는 서버 로그에만 남기고 응답에는 일반화한 문구만 준다 */
function failed(): NextResponse {
  return NextResponse.json(
    { error: "동기화에 실패했습니다. 서버 로그를 확인하세요." },
    { status: 500 }
  );
}

export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  if (
    isDeploymentEnv({
      vercel: process.env.VERCEL,
      hasClaudeDir: existsSync(join(homedir(), ".claude")),
    })
  ) {
    return NextResponse.json({ error: SYNC_UNAVAILABLE_MESSAGE }, { status: 501 });
  }
  if (running) {
    return NextResponse.json({ error: "이미 동기화 중입니다. 잠시 뒤 다시 시도하세요." }, { status: 409 });
  }

  running = true;
  try {
    const result = await runScan();
    const summary = result.code === 0 ? parseSyncSummary(result.stdout) : null;
    if (!summary) {
      console.error("[installed-tools] 동기화 실패", {
        code: result.code,
        signal: result.signal,
        stdout: result.stdout.slice(-4000),
        stderr: result.stderr.slice(-4000),
      });
      return failed();
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[installed-tools] 동기화 프로세스 실행 실패", error);
    return failed();
  } finally {
    running = false;
  }
}
