// 언어 선택 NodeView + lowlight 문법 하이라이트 코드 블록
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "@/components/pages/code-block-view";
import { normalizeLanguageId } from "@/components/pages/extensions/code-languages";

/** common 언어 묶음 (전체 all 은 번들 비대) */
const lowlight = createLowlight(common);

/**
 * StarterKit 기본 codeBlock 대신 사용.
 * language 속성 + 검색 가능한 언어 선택 UI + lowlight 하이라이트.
 */
export const CodeBlockNode = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          // <pre data-language> 또는 <code class="language-xxx">
          const data = element.getAttribute("data-language");
          if (data) return normalizeLanguageId(data) || null;
          const code = element.querySelector("code");
          const cls = code?.className ?? element.className ?? "";
          const m = /(?:^|\s)language-([a-z0-9#+-]+)/i.exec(cls);
          return m ? normalizeLanguageId(m[1]) || null : null;
        },
        renderHTML: (attributes: { language?: string | null }) => {
          const lang = normalizeLanguageId(attributes.language);
          if (!lang) return {};
          return {
            "data-language": lang,
            class: `language-${lang}`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({
  lowlight,
});
