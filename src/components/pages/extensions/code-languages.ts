// 코드 블록 언어 목록 — 노션형 선택 UI용

export type CodeLanguage = {
  /** 저장·class 에 쓰는 id (예: javascript) */
  id: string;
  /** UI 표시명 */
  label: string;
  /** 검색용 별칭 */
  aliases?: string[];
};

/** 자주 쓰는 언어를 앞에, 나머지는 알파벳 */
export const CODE_LANGUAGES: CodeLanguage[] = [
  { id: "", label: "일반 텍스트", aliases: ["text", "plain", "plaintext"] },
  { id: "javascript", label: "JavaScript", aliases: ["js"] },
  { id: "typescript", label: "TypeScript", aliases: ["ts"] },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "java", label: "Java" },
  { id: "go", label: "Go", aliases: ["golang"] },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS", aliases: ["sass"] },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML", aliases: ["yml"] },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  { id: "bash", label: "Bash", aliases: ["sh", "shell", "zsh"] },
  { id: "sql", label: "SQL" },
  { id: "graphql", label: "GraphQL", aliases: ["gql"] },
  { id: "jsx", label: "JSX" },
  { id: "tsx", label: "TSX" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby", aliases: ["rb"] },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin", aliases: ["kt"] },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++", aliases: ["c++", "cxx"] },
  { id: "csharp", label: "C#", aliases: ["cs", "c#"] },
  { id: "objectivec", label: "Objective-C", aliases: ["objc"] },
  { id: "dart", label: "Dart" },
  { id: "elixir", label: "Elixir", aliases: ["ex"] },
  { id: "elm", label: "Elm" },
  { id: "erlang", label: "Erlang", aliases: ["erl"] },
  { id: "fsharp", label: "F#", aliases: ["fs", "f#"] },
  { id: "flow", label: "Flow" },
  { id: "fortran", label: "Fortran" },
  { id: "gherkin", label: "Gherkin" },
  { id: "glsl", label: "GLSL" },
  { id: "haskell", label: "Haskell", aliases: ["hs"] },
  { id: "hcl", label: "HCL", aliases: ["terraform", "tf"] },
  { id: "idris", label: "Idris" },
  { id: "ebnf", label: "EBNF" },
  { id: "lua", label: "Lua" },
  { id: "perl", label: "Perl", aliases: ["pl"] },
  { id: "r", label: "R" },
  { id: "scala", label: "Scala" },
  { id: "solidity", label: "Solidity", aliases: ["sol"] },
  { id: "toml", label: "TOML" },
  { id: "xml", label: "XML" },
  { id: "dockerfile", label: "Dockerfile", aliases: ["docker"] },
  { id: "diff", label: "Diff" },
  { id: "nginx", label: "Nginx" },
  { id: "powershell", label: "PowerShell", aliases: ["ps1"] },
  { id: "protobuf", label: "Protocol Buffers", aliases: ["proto"] },
  { id: "regex", label: "Regex", aliases: ["regexp"] },
  { id: "vim", label: "Vim" },
  { id: "wasm", label: "WebAssembly", aliases: ["wat"] },
  { id: "zig", label: "Zig" },
];

/** id 또는 별칭 → 정규 id */
export function normalizeLanguageId(raw: string | null | undefined): string {
  if (raw == null) return "";
  const key = raw.trim().toLowerCase();
  if (!key || key === "null" || key === "plain" || key === "plaintext" || key === "text") {
    return "";
  }
  for (const lang of CODE_LANGUAGES) {
    if (lang.id === key) return lang.id;
    if (lang.aliases?.some((a) => a.toLowerCase() === key)) return lang.id;
  }
  return key;
}

/** 표시 라벨 */
export function languageLabel(id: string | null | undefined): string {
  const norm = normalizeLanguageId(id);
  const found = CODE_LANGUAGES.find((l) => l.id === norm);
  if (found) return found.label;
  if (!norm) return "일반 텍스트";
  return norm;
}

/** 검색 필터 */
export function filterLanguages(query: string): CodeLanguage[] {
  const q = query.trim().toLowerCase();
  if (!q) return CODE_LANGUAGES;
  return CODE_LANGUAGES.filter((l) => {
    if (l.label.toLowerCase().includes(q)) return true;
    if (l.id.toLowerCase().includes(q)) return true;
    return l.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false;
  });
}
