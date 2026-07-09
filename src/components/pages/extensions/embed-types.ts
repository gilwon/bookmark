// 임베드 블록 속성 타입

export type EmbedKind = "bookmark" | "star";

/** 페이지에 저장되는 임베드 스냅샷 속성 */
export type EmbedAttrs = {
  kind: EmbedKind;
  refId: string;
  title: string;
  url: string;
  description: string | null;
  image: string | null;
  subtitle: string | null;
};
