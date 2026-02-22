import { useState, useCallback } from 'react';

/**
 * Shared hook for bulk selection and action patterns.
 * Used by Tasks, Deals, and other list pages that support multi-select.
 */
export function useBulkActions<T extends number = number>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleSelect = useCallback((id: T) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(prev => {
      if (prev.size === ids.length) {
        return new Set();
      }
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    isEditMode,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleEditMode,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
  };
}
