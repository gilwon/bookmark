// 페이지 본문에 북마크·GitHub Star 카드를 삽입하는 Tiptap 노드
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedNodeView } from "@/components/pages/embed-node-view";
import type { EmbedAttrs } from "@/components/pages/extensions/embed-types";

export type { EmbedAttrs, EmbedKind } from "@/components/pages/extensions/embed-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embedBlock: {
      /** 북마크 또는 Star 임베드 블록을 삽입한다. */
      insertEmbed: (attrs: EmbedAttrs) => ReturnType;
    };
  }
}

/** 스냅샷 속성으로 렌더되는 atom 임베드 노드 */
export const EmbedBlock = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      kind: { default: "bookmark" },
      refId: { default: "" },
      title: { default: "" },
      url: { default: "" },
      description: { default: null },
      image: { default: null },
      subtitle: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "embed-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNodeView);
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
