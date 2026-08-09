// TiptapEditor의 링크 클릭 설정을 검증한다
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Link from "@tiptap/extension-link";
import test from "node:test";
import ts from "typescript";

const componentPath = new URL(
  "../src/components/pages/tiptap-editor.tsx",
  import.meta.url
);

test("TiptapEditor의 Link 확장은 클릭 시 링크를 연다", async () => {
  const source = await readFile(componentPath, "utf8");
  const file = ts.createSourceFile(
    componentPath.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let openOnClick;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "configure" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Link"
    ) {
      const config = node.arguments[0];
      if (config && ts.isObjectLiteralExpression(config)) {
        const option = config.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "openOnClick"
        );
        if (option && ts.isPropertyAssignment(option)) {
          openOnClick = option.initializer.kind === ts.SyntaxKind.TrueKeyword;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  assert.equal(openOnClick, true);

  const extension = Link.configure({ openOnClick });
  assert.equal(extension.options.openOnClick, openOnClick);

  const plugins = extension.config.addProseMirrorPlugins.call({
    options: extension.options,
    type: { name: "link" },
    editor: { view: { dom: {} } },
  });
  const linkPlugin = plugins.find(
    (plugin) => typeof plugin.props.handleClick === "function"
  );
  assert.ok(linkPlugin);

  class FakeAnchor {}
  const anchor = new FakeAnchor();
  anchor.href = "https://example.com/from-tiptap";
  anchor.target = "_blank";
  const opened = [];
  const previousAnchor = globalThis.HTMLAnchorElement;
  const previousWindow = globalThis.window;
  globalThis.HTMLAnchorElement = FakeAnchor;
  globalThis.window = {
    open: (...args) => opened.push(args),
  };

  try {
    const handled = linkPlugin.props.handleClick(
      {
        editable: true,
        state: {
          schema: { nodes: {}, marks: { link: { name: "link" } } },
          selection: {
            empty: true,
            storedMarks: null,
            $head: { marks: () => [] },
          },
        },
      },
      0,
      { button: 0, target: anchor }
    );

    assert.equal(handled, true);
    assert.equal(opened[0]?.[0], anchor.href);
  } finally {
    globalThis.HTMLAnchorElement = previousAnchor;
    globalThis.window = previousWindow;
  }
});
