// 노션형 블록 호버 핸들 — + / 드래그 순서 변경 (포인터 + 인덱스 기반)
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
  top: number;
  /** 최상위 블록 시작 pos */
  blockStart: number;
  /** 최상위 블록 인덱스 */
  blockIndex: number;
  height: number;
};

/**
 * pos 가 속한 최상위 블록 정보.
 * start = 문서 내 블록 시작 위치, index = doc.child 인덱스.
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

/**
 * fromIndex 블록을 toGap 위치(0=맨 앞, n=맨 뒤)로 이동.
 * toGap === fromIndex 또는 fromIndex+1 이면 변화 없음.
 */
function moveBlockToGap(
  editor: Editor,
  fromIndex: number,
  toGap: number
): boolean {
  const doc = editor.state.doc;
  const n = doc.childCount;
  if (fromIndex < 0 || fromIndex >= n) return false;
  if (toGap < 0 || toGap > n) return false;
  // 제자리 (앞 갭 / 뒤 갭)
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

/** clientY → 드롭 갭 인덱스 + 인디케이터 Y (container 상대) */
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

/** clientY 로 최상위 블록 DOM (에디터 직계 자식) */
function findBlockAtY(
  editor: Editor,
  clientY: number
): HTMLElement | null {
  const root = editor.view.dom;
  const children = Array.from(root.children) as HTMLElement[];
  for (const el of children) {
    const r = el.getBoundingClientRect();
    if (clientY >= r.top - 8 && clientY <= r.bottom + 8) return el;
  }
  return null;
}

/** DOM 요소 → 최상위 블록 인덱스 (형제 순서 기준, PM childCount 와 1:1 가정) */
function domBlockIndex(editor: Editor, blockEl: HTMLElement): number {
  const root = editor.view.dom;
  const children = Array.from(root.children);
  const idx = children.indexOf(blockEl);
  return idx;
}

/**
 * 블록 왼쪽 거터에 + · 드래그 핸들.
 * 드래그는 HTML5 대신 pointer 이벤트 + 갭 인덱스 이동.
 */
export function BlockHandle({ editor, containerRef, onDirty }: Props) {
  const [handle, setHandle] = useState<HandleState>({
    visible: false,
    top: 0,
    blockStart: 0,
    blockIndex: 0,
    height: 28,
  });
  const [dragging, setDragging] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(false);
  const draggingRef = useRef(false);
  /** 드래그 중 동기 상태 (React 배치와 무관) */
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
    }, 150);
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
        // posAtDOM 실패 시 DOM 순서만 사용
        let s = 0;
        for (let i = 0; i < blockIndex; i++) {
          s += editor.state.doc.child(i).nodeSize;
        }
        blockStart = s;
      }

      if (blockIndex < 0) return;

      setHandle({
        visible: true,
        top:
          bRect.top -
          cRect.top +
          (containerRef.current.scrollTop || 0),
        blockStart,
        blockIndex,
        height: Math.max(bRect.height, 28),
      });
    },
    [editor, containerRef, clearHideTimer]
  );

  // 호버 추적
  useEffect(() => {
    if (!editor) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) return;
      if ((e.target as HTMLElement | null)?.closest?.("[data-block-handle]")) {
        pinnedRef.current = true;
        clearHideTimer();
        setHandle((h) => (h.visible ? h : { ...h, visible: true }));
        return;
      }
      pinnedRef.current = false;
      const block = findBlockAtY(editor, e.clientY);
      if (block) showForDom(block);
      else hideSoon();
    };

    const onLeave = (e: MouseEvent) => {
      if (draggingRef.current) return;
      const related = e.relatedTarget as Node | null;
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

  /** 드래그 종료 — 리스너 정리 + 블록 이동 */
  const endDrag = useCallback(
    (editorInstance: Editor) => {
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
    },
    []
  );

  function startDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (!editor) return;
    e.preventDefault();
    e.stopPropagation();

    const fromIndex = handleRef.current.blockIndex;
    if (fromIndex < 0 || fromIndex >= editor.state.doc.childCount) return;

    const btn = e.currentTarget;
    const pointerId = e.pointerId;

    // 시각 피드백
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

    // 포인터 캡처 — 버튼 밖으로 나가도 move/up 이 버튼으로 전달
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

    // 캡처 대상(버튼) + window 둘 다 — 환경별 누락 방지, 동기 등록
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
          className="pointer-events-none absolute left-10 right-0 z-40 h-0.5 rounded-full bg-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
          style={{ top: indicatorTop }}
        />
      )}

      {handle.visible && (
        <div
          data-block-handle
          className={cn(
            "absolute z-30 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm ring-1 ring-border/60",
            "pointer-events-auto",
            dragging && "opacity-90"
          )}
          style={{
            top: handle.top + 2,
            left: 2,
            minHeight: Math.min(Math.max(handle.height, 32), 48),
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="드래그하여 순서 변경"
            aria-label="드래그하여 순서 변경"
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing touch-none"
            onPointerDown={startDrag}
            onClick={(ev) => {
              // 드래그 후 클릭 포커스 방지
              ev.preventDefault();
              ev.stopPropagation();
            }}
          >
            <GripVertical className="h-4 w-4" />
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
  // no-op (로직을 BlockHandle 로 통합)
}
