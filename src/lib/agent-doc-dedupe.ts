// 에이전트 문서 중복 판정 — 파일명+본문 완전 일치 지문 생성
export function docFingerprint(
  files: { filename: string; content: string }[]
): string {
  if (files.length === 0) return "";
  const items = files.map((f) => {
    const filename = f.filename.trim().toLowerCase();
    const content = f.content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trimEnd();
    // 본문에 개행이 있어도 항목 경계가 섞이지 않도록 NUL 로 구분
    return `${filename}\u0000${content}`;
  });
  // 파일 순서 무관 — 정렬 후 join
  return items.sort().join("\u0000");
}
