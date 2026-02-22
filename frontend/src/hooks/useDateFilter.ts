import { useState, useEffect } from 'react';

/**
 * Shared hook for debounced search with date/status filtering.
 * Used by Tasks, Contacts, Deals, and other list pages.
 */
export function useDebouncedSearch(delay = 300) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, delay);
    return () => clearTimeout(timer);
  }, [searchQuery, delay]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
  };
}
