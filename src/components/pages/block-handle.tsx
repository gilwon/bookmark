// 노션형 블록 호버 핸들 — 왼쪽 거터에 + / ⋮⋮ (텍스트와 분리)
"use client";

import type { Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { insertSlashTrigger } from "@/components/pages/slash-menu";

type Props = {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLElement | null>;
  onDirty?: () => void;
};

type HandleState = {
  visible: boolean;
  /** container 기준 첫 줄 상단 Y */
  top: number;
  blockStart: number;
  blockIndex: number;
};

/** 숨김 지연 — 텍스트 → 거터 이동 시 깜빡임 방지 (노션 유사) */
const HIDE_DELAY_MS = 320;

/**
 * pos 가 속한 최상위 블록 정보.
 */
function topLevelBlockInfo(
  editor: Editor,
  pos: number
): { start: number; end: number; index: number } | null {
  try {
    const doc = editor.state.doc;
    const size = doc.content.size;
    const safe = Math.max(0, Math.min(pos, size));
    const $pos = doc.resolve(safe);

    let index: number;
    if ($pos.depth >= 1) {
      index = $pos.index(0);
    } else {
      index = Math.min($pos.index(0), Math.max(0, doc.childCount - 1));
    }
    if (index < 0 || index >= doc.childCount) return null;

    let start = 0;
    for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
    const node = doc.child(index);
    return { start, end: start + node.nodeSize, index };
  } catch {
    return null;
  }
}

function moveBlockToGap(
  editor: Editor,
  fromIndex: number,
  toGap: number
): boolean {
  const doc = editor.state.doc;
  const n = doc.childCount;
  if (fromIndex < 0 || fromIndex >= n) return false;
  if (toGap < 0 || toGap > n) return false;
  if (toGap === fromIndex || toGap === fromIndex + 1) return false;

  let start = 0;
  for (let i = 0; i < fromIndex; i++) start += doc.child(i).nodeSize;
  const node = doc.child(fromIndex);
  const end = start + node.nodeSize;

  let insertPos = 0;
  for (let i = 0; i < toGap; i++) insertPos += doc.child(i).nodeSize;

  try {
    const tr = editor.state.tr.delete(start, end);
    const mapped = tr.mapping.map(insertPos);
    const clamped = Math.max(0, Math.min(mapped, tr.doc.content.size));
    tr.insert(clamped, node);
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  } catch {
    return false;
  }
}

function dropGapAt(
  editor: Editor,
  container: HTMLElement,
  clientY: number
): { gapIndex: number; indicatorTop: number } | null {
  const root = editor.view.dom;
  const children = Array.from(root.children) as HTMLElement[];
  if (children.length === 0) return null;

  const cRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop || 0;

  for (let i = 0; i < children.length; i++) {
    const el = children[i]!;
    const r = el.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    if (clientY < mid) {
      return {
        gapIndex: i,
        indicatorTop: r.top - cRect.top + scrollTop - 1,
      };
    }
  }

  const last = children[children.length - 1]!;
  const lr = last.getBoundingClientRect();
  return {
    gapIndex: children.length,
    indicatorTop: lr.bottom - cRect.top + scrollTop - 1,
  };
}

/**
 * clientY 로 최상위 블록 DOM.
 * 좌우 제한 없음 — 거터에 있어도 Y 만 맞으면 해당 블록.
 */
function findBlockAtY(
  editor: Editor,
  clientY: number
): HTMLElement | null {
  const root = editor.view.dom;
  const children = Array.from(root.children) as HTMLElement[];
  for (const el of children) {
    const r = el.getBoundingClientRect();
    // 블록 위·아래 약간의 여유 (노션처럼 살짝 벗어나도 유지)
    if (clientY >= r.top - 6 && clientY <= r.bottom + 6) return el;
  }
  return null;
}

function domBlockIndex(editor: Editor, blockEl: HTMLElement): number {
  return Array.from(editor.view.dom.children).indexOf(blockEl);
}

/**
 * 블록 왼쪽 거터에 + · 드래그 핸들.
 * - 텍스트 영역과 겹치지 않게 absolute left 고정
 * - 본문/거터 어디서든 Y 매칭 시 표시, 벗어난 뒤에도 잠시 유지
 */
export function BlockHandle({ editor, containerRef, onDirty }: Props) {
  const [handle, setHandle] = useState<HandleState>({
    visible: false,
    top: 0,
    blockStart: 0,
    blockIndex: 0,
  });
  const [dragging, setDragging] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragSession = useRef<{
    fromIndex: number;
    gapIndex: number;
  } | null>(null);
  const handleRef = useRef(handle);
  handleRef.current = handle;
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideSoon = useCallback(() => {
    if (draggingRef.current || pinnedRef.current) return;
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (!pinnedRef.current && !draggingRef.current) {
        setHandle((h) => ({ ...h, visible: false }));
      }
    }, HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const showForDom = useCallback(
    (blockEl: HTMLElement) => {
      if (!editor || !containerRef.current) return;
      clearHideTimer();
      const cRect = containerRef.current.getBoundingClientRect();
      const bRect = blockEl.getBoundingClientRect();

      let blockStart = 0;
      let blockIndex = domBlockIndex(editor, blockEl);
      try {
        const pos = editor.view.posAtDOM(blockEl, 0);
        const info = topLevelBlockInfo(editor, pos);
        if (info) {
          blockStart = info.start;
          blockIndex = info.index;
        }
      } catch {
        if (blockIndex < 0) return;
        let s = 0;
        for (let i = 0; i < blockIndex; i++) {
          s += editor.state.doc.child(i).nodeSize;
        }
        blockStart = s;
      }

      if (blockIndex < 0) return;

      // 첫 줄 높이 기준 세로 중앙 (블록 전체가 아니라 한 줄)
      const lineH = Math.min(
        parseFloat(getComputedStyle(blockEl).lineHeight) || 28,
        36
      );
      const top =
        bRect.top -
        cRect.top +
        (containerRef.current.scrollTop || 0) +
        Math.max(0, (Math.min(bRect.height, lineH + 8) - 28) / 2);

      setHandle({
        visible: true,
        top,
        blockStart,
        blockIndex,
      });
    },
    [editor, containerRef, clearHideTimer]
  );

  // 호버 추적 — container 전체(거터 포함). 텍스트를 벗어나도 Y 매칭이면 유지
  useEffect(() => {
    if (!editor) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) return;

      // 핸들 자체 위면 고정
      if ((e.target as HTMLElement | null)?.closest?.("[data-block-handle]")) {
        pinnedRef.current = true;
        clearHideTimer();
        setHandle((h) => (h.visible ? h : { ...h, visible: true }));
        return;
      }

      pinnedRef.current = false;
      const block = findBlockAtY(editor, e.clientY);
      if (block) {
        showForDom(block);
      } else {
        hideSoon();
      }
    };

    const onLeave = (e: MouseEvent) => {
      if (draggingRef.current) return;
      const related = e.relatedTarget as Node | null;
      // 컨테이너 안 자식으로 이동하면 무시
      if (related && container.contains(related)) return;
      pinnedRef.current = false;
      hideSoon();
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      clearHideTimer();
    };
  }, [editor, containerRef, showForDom, hideSoon, clearHideTimer]);

  const endDrag = useCallback((editorInstance: Editor) => {
    const session = dragSession.current;
    dragSession.current = null;
    draggingRef.current = false;

    editorInstance.view.dom
      .querySelectorAll(".is-dragging-block")
      .forEach((n) => n.classList.remove("is-dragging-block"));
    document.body.classList.remove("block-dragging");
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");

    setDragging(false);
    setIndicatorTop(null);
    pinnedRef.current = false;

    if (
      session &&
      moveBlockToGap(editorInstance, session.fromIndex, session.gapIndex)
    ) {
      onDirtyRef.current?.();
    }
  }, []);

  function startDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (!editor) return;
    e.preventDefault();
    e.stopPropagation();

    const fromIndex = handleRef.current.blockIndex;
    if (fromIndex < 0 || fromIndex >= editor.state.doc.childCount) return;

    const btn = e.currentTarget;
    const pointerId = e.pointerId;

    try {
      const info = topLevelBlockInfo(editor, handleRef.current.blockStart + 1);
      if (info) {
        const node = editor.view.nodeDOM(info.start) as HTMLElement | null;
        node?.classList.add("is-dragging-block");
      }
    } catch {
      /* ignore */
    }

    draggingRef.current = true;
    dragSession.current = { fromIndex, gapIndex: fromIndex };
    pinnedRef.current = true;
    setDragging(true);
    setIndicatorTop(handleRef.current.top);
    document.body.classList.add("block-dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    try {
      btn.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }

    const container = containerRef.current;
    const ed = editor;
    let finished = false;

    const onMove = (ev: PointerEvent) => {
      if (finished || ev.pointerId !== pointerId) return;
      if (!dragSession.current || !container) return;
      ev.preventDefault();
      const drop = dropGapAt(ed, container, ev.clientY);
      if (!drop) return;
      dragSession.current.gapIndex = drop.gapIndex;
      setIndicatorTop(drop.indicatorTop);
    };

    const onUp = (ev: PointerEvent) => {
      if (finished || ev.pointerId !== pointerId) return;
      finished = true;
      ev.preventDefault();
      btn.removeEventListener("pointermove", onMove);
      btn.removeEventListener("pointerup", onUp);
      btn.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        if (btn.hasPointerCapture(pointerId)) {
          btn.releasePointerCapture(pointerId);
        }
      } catch {
        /* ignore */
      }
      endDrag(ed);
    };

    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function addBelow() {
    if (!editor) return;
    const info = topLevelBlockInfo(editor, handle.blockStart + 1);
    try {
      const end = info?.end ?? editor.state.selection.to;
      editor
        .chain()
        .focus()
        .insertContentAt(end, { type: "paragraph" })
        .run();
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

  if (!editor) return null;

  return (
    <>
      {dragging && indicatorTop != null && (
        <div
          className="pointer-events-none absolute left-12 right-0 z-40 h-0.5 rounded-full bg-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
          style={{ top: indicatorTop }}
        />
      )}

      {handle.visible && (
        <div
          data-block-handle
          className={cn(
            // 왼쪽 거터 고정 — 텍스트 영역(padding-left) 안쪽에 겹치지 않음
            "absolute z-30 flex items-center gap-0",
            "pointer-events-auto",
            dragging && "opacity-90"
          )}
          style={{
            top: handle.top,
            left: 2,
            width: "2.5rem",
          }}
          onMouseEnter={() => {
            pinnedRef.current = true;
            clearHideTimer();
            setHandle((h) => ({ ...h, visible: true }));
          }}
          onMouseLeave={() => {
            if (!draggingRef.current) {
              pinnedRef.current = false;
              hideSoon();
            }
          }}
        >
          <button
            type="button"
            title="아래에 블록 추가 (/)"
            aria-label="아래에 블록 추가"
            className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/80 hover:bg-muted hover:text-foreground"
            onMouseDown={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            }}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              addBelow();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="드래그하여 순서 변경"
            aria-label="드래그하여 순서 변경"
            className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/80 hover:bg-muted hover:text-foreground active:cursor-grabbing touch-none"
            onPointerDown={startDrag}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            }}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

/** 하위 호환 — 드래그는 BlockHandle 내부에서 처리 */
export function useBlockDragDrop(
  _editor: Editor | null,
  _onDirty?: () => void
) {
  // no-op
}
