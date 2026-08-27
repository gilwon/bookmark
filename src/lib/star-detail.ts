// GitHub Star 상세(레포 메타·README) 정규화와 조회.

export const README_MAX_CHARS = 300_000;

export type StarRepoDetail = {
  homepage: string | null;
  license: string | null;
  defaultBranch: string | null;
  forks: number;
  openIssues: number;
  watchers: number;
  pushedAt: string | null;
};

/** owner/repo 문자열을 분리한다. */
export function splitRepoFullName(
  fullName: string
): { owner: string; repo: string } | null {
  const s = fullName.trim();
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

/** README 길이를 상한으로 자른다. */
export function capReadme(md: string, max = README_MAX_CHARS): string {
  if (md.length <= max) return md;
  return md.slice(0, max);
}

function shouldLeaveReadmeUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (u.startsWith("#")) return true;
  if (/^https?:\/\//i.test(u)) return true;
  if (/^mailto:/i.test(u)) return true;
  return false;
}

function parseMdDest(inner: string): { url: string; title: string } | null {
  const t = inner.trim();
  if (!t) return null;
  const angled = /^<([^>]+)>(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/.exec(t);
  if (angled) {
    return { url: angled[1], title: (angled[2] ?? "").trim() };
  }
  const m = /^(\S+)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/.exec(t);
  if (!m) return { url: t, title: "" };
  return { url: m[1], title: (m[2] ?? "").trim() };
}

/** README의 상대 이미지·링크를 GitHub 절대 URL로 바꾼다. */
export function rewriteReadmeUrls(
  md: string,
  owner: string,
  repo: string,
  branch: string
): string {
  return md.replace(
    /(!?)\[([^\]]*)\]\(([^)]+)\)/g,
    (full, bang: string, text: string, inner: string) => {
      const parsed = parseMdDest(inner);
      if (!parsed) return full;
      if (shouldLeaveReadmeUrl(parsed.url)) return full;
      let path = parsed.url.trim().replace(/^\.\//, "");
      path = path.replace(/^\/+/, "");
      if (!path) return full;
      const href = bang
        ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
        : `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      const titlePart = parsed.title ? ` ${parsed.title}` : "";
      return `${bang}[${text}](${href}${titlePart})`;
    }
  );
}

function asNullableString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  if (v == null) return null;
  return null;
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 저장된 detail_json을 파싱한다. */
export function parseStarDetailJson(
  raw: string | null | undefined
): StarRepoDetail | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    return {
      homepage: asNullableString(o.homepage),
      license: asNullableString(o.license),
      defaultBranch: asNullableString(o.defaultBranch),
      forks: asNumber(o.forks),
      openIssues: asNumber(o.openIssues),
      watchers: asNumber(o.watchers),
      pushedAt: asNullableString(o.pushedAt),
    };
  } catch {
    return null;
  }
}

/** 레포 상세를 JSON 문자열로 직렬화한다. */
export function serializeStarDetailJson(detail: StarRepoDetail): string {
  return JSON.stringify({
    homepage: detail.homepage,
    license: detail.license,
    defaultBranch: detail.defaultBranch,
    forks: detail.forks,
    openIssues: detail.openIssues,
    watchers: detail.watchers,
    pushedAt: detail.pushedAt,
  });
}

function githubHeaders(
  accessToken?: string | null,
  accept = "application/vnd.github+json"
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "MyMark-bookmark-hub",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function throwGithubHttpError(res: Response): Promise<never> {
  if (res.status === 404) {
    throw new Error("레포를 찾을 수 없습니다. (비공개이거나 존재하지 않음)");
  }
  const body = await res.text().catch(() => "");
  throw new Error(
    `GitHub API 오류 (${res.status})${body ? `: ${body.slice(0, 120)}` : ""}`
  );
}

type GithubRepoPayload = {
  description: string | null;
  language: string | null;
  stargazers_count?: number;
  topics?: string[];
  html_url?: string;
  homepage?: string | null;
  license?: { spdx_id?: string | null; name?: string | null } | null;
  default_branch?: string | null;
  forks_count?: number;
  forks?: number;
  open_issues_count?: number;
  open_issues?: number;
  subscribers_count?: number;
  watchers_count?: number;
  watchers?: number;
  pushed_at?: string | null;
};

/** GitHub에서 레포 메타와 README를 가져와 정규화한다. */
export async function fetchGithubRepoDetail(
  fullName: string,
  accessToken?: string | null
): Promise<{
  detail: StarRepoDetail;
  readmeMd: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  url: string;
  defaultBranch: string;
}> {
  const parts = splitRepoFullName(fullName);
  if (!parts) throw new Error("잘못된 레포 형식입니다.");
  const { owner, repo } = parts;
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const res = await fetch(repoUrl, {
    headers: githubHeaders(accessToken),
    cache: "no-store",
  });
  if (!res.ok) await throwGithubHttpError(res);
  const data = (await res.json()) as GithubRepoPayload;

  const defaultBranch = data.default_branch?.trim() || "main";
  const license =
    data.license?.spdx_id || data.license?.name || null;
  const homepage = asNullableString(data.homepage);
  const detail: StarRepoDetail = {
    homepage,
    license: asNullableString(license),
    defaultBranch,
    forks: asNumber(data.forks_count ?? data.forks ?? 0),
    openIssues: asNumber(data.open_issues_count ?? data.open_issues ?? 0),
    watchers: asNumber(
      data.subscribers_count ?? data.watchers_count ?? data.watchers ?? 0
    ),
    pushedAt: asNullableString(data.pushed_at),
  };

  const readmeRes = await fetch(`${repoUrl}/readme`, {
    headers: githubHeaders(accessToken, "application/vnd.github.raw+json"),
    cache: "no-store",
  });
  let rawReadme = "";
  if (readmeRes.status === 404) {
    rawReadme = "";
  } else if (!readmeRes.ok) {
    await throwGithubHttpError(readmeRes);
  } else {
    rawReadme = await readmeRes.text();
  }

  const readmeMd = rewriteReadmeUrls(
    capReadme(rawReadme),
    owner,
    repo,
    defaultBranch
  );

  return {
    detail,
    readmeMd,
    description: data.description ?? null,
    language: data.language ?? null,
    stars: asNumber(data.stargazers_count ?? 0),
    topics: Array.isArray(data.topics)
      ? data.topics.filter((t): t is string => typeof t === "string")
      : [],
    url: asNullableString(data.html_url) || `https://github.com/${owner}/${repo}`,
    defaultBranch,
  };
}
