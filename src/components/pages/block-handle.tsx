// 노션형 블록 호버 핸들 — + / 드래그(⋮⋮)
// 텍스트 밖으로 마우스를 옮겨도 거터 영역에서 유지·클릭 가능
"use client";

import type { Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { insertSlashTrigger } from "@/components/pages/slash-menu";

type Props = {
  editor: Editor | null;
  /** 에디터 래퍼(좌표 기준) — 왼쪽 패딩 거터 포함 */
  containerRef: React.RefObject<HTMLElement | null>;
  onDirty?: () => void;
};

type HandleState = {
  visible: boolean;
  top: number;
  pos: number;
  height: number;
};

/**
 * 블록 왼쪽 거터에 + · 드래그 핸들 표시.
 * 컨테이너 전체(텍스트+거터) 기준으로 Y축 추적해 사라지지 않게 함.
 */
export function BlockHandle({ editor, containerRef, onDirty }: Props) {
  const [handle, setHandle] = useState<HandleState>({
    visible: false,
    top: 0,
    pos: 0,
    height: 28,
  });
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(false); // 핸들 위에 있을 때 hide 금지

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideSoon = useCallback(() => {
    if (dragging || pinnedRef.current) return;
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (!pinnedRef.current && !dragging) {
        setHandle((h) => ({ ...h, visible: false }));
      }
    }, 120);
  }, [dragging, clearHideTimer]);

  const showForDom = useCallback(
    (blockEl: HTMLElement) => {
      if (!editor || !containerRef.current) return;
      clearHideTimer();
      const cRect = containerRef.current.getBoundingClientRect();
      const bRect = blockEl.getBoundingClientRect();
      let pos = 0;
      try {
        pos = editor.view.posAtDOM(blockEl, 0);
      } catch {
        return;
      }
      setHandle({
        visible: true,
        top:
          bRect.top -
          cRect.top +
          (containerRef.current.scrollTop || 0),
        pos,
        height: Math.max(bRect.height, 28),
      });
    },
    [editor, containerRef, clearHideTimer]
  );

  /** clientY 기준으로 가장 가까운 최상위 블록 찾기 */
  const findBlockAtY = useCallback(
    (clientY: number): HTMLElement | null => {
      if (!editor) return null;
      const root = editor.view.dom;
      const children = Array.from(root.children) as HTMLElement[];
      for (const el of children) {
        const r = el.getBoundingClientRect();
        // 위아래 여유 8px — 핸들로 이동해도 같은 블록 유지
        if (clientY >= r.top - 8 && clientY <= r.bottom + 8) {
          return el;
        }
      }
      return null;
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (dragging) return;
      // 핸들 위면 유지
      if ((e.target as HTMLElement | null)?.closest?.("[data-block-handle]")) {
        pinnedRef.current = true;
        clearHideTimer();
        setHandle((h) => (h.visible ? h : { ...h, visible: true }));
        return;
      }
      pinnedRef.current = false;

      const block = findBlockAtY(e.clientY);
      if (block) {
        showForDom(block);
      } else {
        hideSoon();
      }
    };

    const onLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && container.contains(related)) return;
      pinnedRef.current = false;
      hideSoon();
    };

    // 컨테이너 전체(왼쪽 패딩 거터 포함)에서 추적
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      clearHideTimer();
    };
  }, [
    editor,
    containerRef,
    dragging,
    findBlockAtY,
    showForDom,
    hideSoon,
    clearHideTimer,
  ]);

  if (!editor || !handle.visible) return null;

  function addBelow() {
    if (!editor) return;
    const { pos } = handle;
    try {
      const $pos = editor.state.doc.resolve(pos);
      const end = $pos.after(1);
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

  function onDragStart(e: React.DragEvent) {
    if (!editor) return;
    setDragging(true);
    pinnedRef.current = true;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(handle.pos));
    try {
      const node = editor.view.nodeDOM(handle.pos) as HTMLElement | null;
      node?.classList.add("is-dragging-block");
    } catch {
      /* ignore */
    }
  }

  function onDragEnd() {
    setDragging(false);
    pinnedRef.current = false;
    editor?.view.dom
      .querySelectorAll(".is-dragging-block")
      .forEach((n) => n.classList.remove("is-dragging-block"));
  }

  // 거터 안쪽에 배치 (transform 밖으로 빼지 않음 → 클릭 가능)
  return (
    <div
      data-block-handle
      className={cn(
        "absolute z-30 flex items-center gap-0.5 rounded-md bg-background/90 p-0.5 shadow-sm ring-1 ring-border/60",
        "pointer-events-auto"
      )}
      style={{
        top: handle.top + 2,
        left: 2,
        // 블록 높이만큼 히트 영역 확보 (최소 32px)
        minHeight: Math.min(Math.max(handle.height, 32), 48),
      }}
      onMouseEnter={() => {
        pinnedRef.current = true;
        clearHideTimer();
        setHandle((h) => ({ ...h, visible: true }));
      }}
      onMouseLeave={() => {
        pinnedRef.current = false;
        hideSoon();
      }}
    >
      <button
        type="button"
        title="아래에 블록 추가 (/)"
        aria-label="아래에 블록 추가"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onMouseDown={(e) => {
          // 포커스 뺏김 방지 + 사라지기 전 클릭 보장
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addBelow();
        }}
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="드래그하여 이동"
        aria-label="드래그하여 이동"
        draggable
        className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <GripVertical className="h-4 w-4" />
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
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
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
        const start = $from.before(1);
        const end = $from.after(1);

        const $to = editor.state.doc.resolve(posInfo.pos);
        let toStart = $to.before(1);
        if (toStart > start) {
          toStart = $to.after(1);
        }

        if (toStart === start) return;

        const tr = editor.state.tr;
        const slice = tr.doc.slice(start, end);
        tr.delete(start, end);
        const mapped = tr.mapping.map(
          toStart > start ? toStart - (end - start) : toStart
        );
        tr.insert(mapped, slice.content);
        editor.view.dispatch(tr);
        onDirty?.();
      } catch {
        /* ignore */
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
