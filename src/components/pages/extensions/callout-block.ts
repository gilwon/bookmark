// Notion형 <aside> 콜아웃 블록 — 붙여넣기·저장 시 유지
import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** 선택 영역을 콜아웃으로 감싸거나 해제한다. */
      toggleCallout: () => ReturnType;
      /** 빈 콜아웃을 삽입한다. */
      insertCallout: () => ReturnType;
    };
  }
}

/**
 * <aside> / data-type=callout 을 편집 가능한 콜아웃 박스로 렌더한다.
 */
export const CalloutBlock = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: false,

  parseHTML() {
    return [
      { tag: "aside" },
      { tag: 'aside[data-type="callout"]' },
      { tag: 'div[data-type="callout"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        class: "notion-callout",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      insertCallout:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "💡 " }],
              },
            ],
          }),
    };
  },

  addInputRules() {
    // `::: ` 입력 시 콜아웃 시작 (선택)
    return [
      wrappingInputRule({
        find: /^:::\s$/,
        type: this.type,
      }),
    ];
  },
});
