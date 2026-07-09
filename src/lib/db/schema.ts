// 하위 호환: 테이블 직접 접근은 더 이상 권장하지 않음 → @/lib/store
// SQLite 스키마 타입만 필요 시 schema.sqlite 사용
export type {
  AgentDocRow,
  BookmarkRow,
  CustomPageRow,
  GithubStarRow,
  OauthTokenRow,
} from "@/lib/store/types";
