// X 북마크 목록 페이지
import { headers } from "next/headers";
import { XBookmarksView } from "@/components/x-bookmarks/x-bookmarks-view";
import { auth } from "@/lib/auth";
import { hasXAppConfig, hasXToken } from "@/lib/oauth-tokens";
import { store } from "@/lib/store";
import {
  isMissingXBookmarksTable,
  X_BOOKMARKS_TABLE_USER_MESSAGE,
} from "@/lib/x-bookmarks";
import { resolveAppOrigin, xCallbackUrl } from "@/lib/x-oauth";
import type { XBookmarkRow } from "@/lib/store";

export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function XBookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; connected?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const query = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${proto}://${host}` : null;
  const callbackUrl = xCallbackUrl(
    resolveAppOrigin({
      configured: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
      requestOrigin,
    })
  );

  let rows: XBookmarkRow[] = [];
  let tableMissing = false;
  try {
    rows = await store.listXBookmarks(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      isMissingXBookmarksTable(message) ||
      message === X_BOOKMARKS_TABLE_USER_MESSAGE
    ) {
      tableMissing = true;
    } else {
      throw err;
    }
  }

  const lastSynced =
    rows.reduce<string | null>((acc, row) => {
      if (!acc) return row.lastSynced;
      return Date.parse(row.lastSynced) > Date.parse(acc) ? row.lastSynced : acc;
    }, null) ?? null;

  return (
    <XBookmarksView
      items={rows}
      hasXApp={hasXAppConfig()}
      hasX={await hasXToken(userId)}
      tableMissing={tableMissing}
      callbackUrl={callbackUrl}
      lastSynced={lastSynced}
      notice={one(query.error)}
      connected={one(query.connected) === "1"}
    />
  );
}
