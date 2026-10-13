// X 북마크 본문에 한글이 없으면 정적 번역을 붙인다.
import translations from "../data/x-bookmark-text-ko.json" with { type: "json" };

const table = translations as Record<string, string>;

function lookup(tweetId: string): string {
  return table[tweetId]?.trim() ?? "";
}

/** 본문에 한글이 없고 표에 있을 때만 한국어를 돌려준다. */
export function koreanTweetText(tweetId: string, text: string): string {
  if (/[가-힣]/.test(text)) return "";
  return lookup(tweetId);
}

/** API 본문 뒤에 번역을 붙인다. 이미 붙어 있거나 본문이 한글이면 그대로 둔다. */
export function mergeKoreanTweet(tweetId: string, apiText: string): string {
  const ko = koreanTweetText(tweetId, apiText);
  if (!ko) return apiText;
  const suffix = `\n\n${ko}`;
  if (apiText.endsWith(suffix)) return apiText;
  return `${apiText.trimEnd()}${suffix}`;
}

/** 저장된 본문에서 원문과 번역을 나눈다. 표에만 있어도 번역을 보여 준다. */
export function presentTweet(
  tweetId: string,
  stored: string
): { text: string; textKo: string } {
  const ko = lookup(tweetId);
  if (!ko) return { text: stored, textKo: "" };
  const suffix = `\n\n${ko}`;
  if (stored.endsWith(suffix)) {
    return { text: stored.slice(0, -suffix.length), textKo: ko };
  }
  if (/[가-힣]/.test(stored)) return { text: stored, textKo: "" };
  return { text: stored, textKo: ko };
}
