// 목록 다중 선택 상태 훅
"use client";

import { useCallback, useMemo, useState } from "react";

/** id 목록에 대한 전체 선택 / 토글 / 초기화 */
export function useSelection(itemIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const idSet = useMemo(() => new Set(itemIds), [itemIds]);

  // 목록이 바뀌면 존재하지 않는 id 제거
  const visibleSelected = useMemo(() => {
    const next = new Set<string>();
    for (const id of selected) {
      if (idSet.has(id)) next.add(id);
    }
    return next;
  }, [selected, idSet]);

  const selectedCount = visibleSelected.size;
  const allSelected =
    itemIds.length > 0 && itemIds.every((id) => visibleSelected.has(id));
  const someSelected = selectedCount > 0 && !allSelected;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOn = itemIds.length > 0 && itemIds.every((id) => prev.has(id));
      if (allOn) return new Set();
      return new Set(itemIds);
    });
  }, [itemIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback(
    (id: string) => visibleSelected.has(id),
    [visibleSelected]
  );

  return {
    selected: visibleSelected,
    selectedIds: Array.from(visibleSelected),
    selectedCount,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
    isSelected,
  };
}
