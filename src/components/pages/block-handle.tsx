// 노션형 블록 호버 핸들 — + / 드래그(⋮⋮)
"use client";

import type { Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { insertSlashTrigger } from "@/components/pages/slash-menu";

type Props = {
  editor: Editor | null;
  /** 에디터 래퍼(좌표 기준) */
  containerRef: React.RefObject<HTMLElement | null>;
  onDirty?: () => void;
};

type HandleState = {
  visible: boolean;
  top: number;
  /** 블록 시작 문서 위치 */
  pos: number;
  height: number;
};

/**
 * 블록 왼쪽 호버 시 + · 드래그 핸들 표시.
 * + : 아래에 단락 추가 후 `/` 메뉴 트리거
 * 드래그: HTML5 drag 로 블록 순서 변경
 */
export function BlockHandle({ editor, containerRef, onDirty }: Props) {
  const [handle, setHandle] = useState<HandleState>({
    visible: false,
    top: 0,
    pos: 0,
    height: 24,
  });
  const [dragging, setDragging] = useState(false);

  const hide = useCallback(() => {
    if (!dragging) setHandle((h) => ({ ...h, visible: false }));
  }, [dragging]);

  const showForDom = useCallback(
    (blockEl: HTMLElement) => {
      if (!editor || !containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const bRect = blockEl.getBoundingClientRect();
      // ProseMirror 좌표 → pos
      const pos = editor.view.posAtDOM(blockEl, 0);
      setHandle({
        visible: true,
        top: bRect.top - cRect.top + containerRef.current.scrollTop,
        pos,
        height: Math.max(bRect.height, 24),
      });
    },
    [editor, containerRef]
  );

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;

    const onMove = (e: MouseEvent) => {
      if (dragging) return;
      const t = e.target as HTMLElement | null;
      if (!t || !root.contains(t)) {
        hide();
        return;
      }
      // 최상위 블록 노드 찾기
      let el: HTMLElement | null = t;
      while (el && el !== root) {
        const parentEl: HTMLElement | null = el.parentElement;
        if (parentEl === root) break;
        el = parentEl;
      }
      if (!el || el === root) {
        hide();
        return;
      }
      // 테이블 등 제외
      if (el.classList.contains("ProseMirror")) {
        hide();
        return;
      }
      showForDom(el);
    };

    const onLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && root.contains(related)) return;
      // 핸들로 이동 시 유지
      const handleEl = containerRef.current?.querySelector(
        "[data-block-handle]"
      );
      if (related && handleEl?.contains(related)) return;
      hide();
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [editor, hide, showForDom, dragging, containerRef]);

  if (!editor || !handle.visible) return null;

  function addBelow() {
    if (!editor) return;
    const { pos } = handle;
    try {
      const $pos = editor.state.doc.resolve(pos);
      const end = $pos.after($pos.depth === 0 ? 1 : $pos.depth);
      editor
        .chain()
        .focus()
        .insertContentAt(end, { type: "paragraph" })
        .run();
      // 방금 넣은 단락으로 이동 후 슬래시
      requestAnimationFrame(() => {
        insertSlashTrigger(editor);
        onDirty?.();
      });
    } catch {
      editor.chain().focus().insertContent({ type: "paragraph" }).run();
      insertSlashTrigger(editor);
      onDirty?.();
    }
  }

  function onDragStart(e: React.DragEvent) {
    if (!editor) return;
    setDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(handle.pos));
    // 블록 하이라이트
    try {
      const node = editor.view.nodeDOM(handle.pos) as HTMLElement | null;
      node?.classList.add("is-dragging-block");
    } catch {
      /* ignore */
    }
  }

  function onDragEnd() {
    setDragging(false);
    editor?.view.dom
      .querySelectorAll(".is-dragging-block")
      .forEach((n) => n.classList.remove("is-dragging-block"));
  }

  return (
    <div
      data-block-handle
      className={cn(
        "absolute z-30 flex items-center gap-0.5 opacity-0 transition-opacity",
        "pointer-events-auto",
        handle.visible && "opacity-100"
      )}
      style={{
        top: handle.top,
        left: -4,
        transform: "translateX(-100%)",
        height: Math.min(handle.height, 40),
      }}
      onMouseEnter={() => setHandle((h) => ({ ...h, visible: true }))}
      onMouseLeave={hide}
    >
      <button
        type="button"
        title="아래에 블록 추가"
        aria-label="아래에 블록 추가"
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addBelow();
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="드래그하여 이동"
        aria-label="드래그하여 이동"
        draggable
        className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * 에디터 루트에 드롭 핸들러 등록 — 블록 순서 변경
 */
export function useBlockDragDrop(
  editor: Editor | null,
  onDirty?: () => void
) {
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const fromStr = e.dataTransfer?.getData("text/plain");
      if (!fromStr || !editor) return;
      const fromPos = Number(fromStr);
      if (Number.isNaN(fromPos)) return;

      const coords = { left: e.clientX, top: e.clientY };
      const posInfo = editor.view.posAtCoords(coords);
      if (!posInfo) return;

      try {
        const $from = editor.state.doc.resolve(fromPos);
        // 최상위 블록
        let depth = $from.depth;
        while (depth > 0 && $from.node(depth).type.name === "doc") depth -= 1;
        // find block depth under doc
        let blockDepth = $from.depth;
        while (blockDepth > 1) blockDepth -= 1;
        const node = $from.node(1);
        const start = $from.before(1);
        const end = $from.after(1);

        const $to = editor.state.doc.resolve(posInfo.pos);
        let toStart = $to.before(1);
        // 아래로 드롭 시 블록 끝 뒤로
        if (toStart > start) {
          toStart = $to.after(1);
        }

        if (toStart === start) return;

        const tr = editor.state.tr;
        const slice = tr.doc.slice(start, end);
        tr.delete(start, end);
        // 삭제 후 위치 보정
        const mapped = tr.mapping.map(toStart > start ? toStart - (end - start) : toStart);
        tr.insert(mapped, slice.content);
        editor.view.dispatch(tr);
        onDirty?.();
      } catch {
        /* 복잡한 구조에서는 무시 */
      }
    };

    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    return () => {
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
    };
  }, [editor, onDirty]);
}
