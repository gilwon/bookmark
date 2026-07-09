// agent_docs DB 행 ↔ AgentDoc API 모델 변환
import {
  parseBundle,
  pickPrimaryFile,
  serializeBundle,
  type AgentDocFilePart,
} from "@/lib/agent-doc-bundle";
import type { AgentDocRow } from "@/lib/db";
import type { AgentDoc, AgentDocKind } from "@/lib/types";

const KINDS = new Set<AgentDocKind>(["skill", "agents", "claude", "other"]);

type Row = AgentDocRow;

/** DB 행을 API AgentDoc으로 변환한다. */
export function rowToAgentDoc(row: Row): AgentDoc {
  const kind = KINDS.has(row.kind as AgentDocKind)
    ? (row.kind as AgentDocKind)
    : "other";

  let files = parseBundle(row.bundle);
  // 레거시: bundle 비어 있으면 content만으로 단일 파일
  if (files.length === 0 && (row.content || row.filename)) {
    files = [{ filename: row.filename || "NOTES.md", content: row.content }];
  }

  return {
    id: row.id,
    userId: row.userId,
    kind,
    filename: row.filename,
    title: row.title,
    description: row.description,
    content: row.content,
    files,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * files 배열에서 저장용 필드(filename, content, bundle, kind 힌트)를 만든다.
 */
export function fieldsFromFiles(
  files: AgentDocFilePart[],
  fallbackFilename = "NOTES.md"
): {
  filename: string;
  content: string;
  bundle: string;
} {
  const primary = pickPrimaryFile(files);
  const filename = primary?.filename ?? fallbackFilename;
  const content = primary?.content ?? "";
  // primary가 files에 없으면 앞에 넣기
  const normalized =
    primary && !files.some((f) => f.filename === primary.filename)
      ? [primary, ...files]
      : files.length > 0
        ? files
        : [{ filename, content }];
  return {
    filename,
    content,
    bundle: serializeBundle(normalized),
  };
}
