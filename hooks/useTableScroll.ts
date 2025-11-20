'use client';

import { useState, useEffect, RefObject } from 'react';

/**
 * Hook to detect horizontal scrolling in a table container
 * Used to show/hide shadow effect on frozen columns
 * 
 * @param containerRef - React ref to the scrollable container element
 * @returns boolean indicating if container is scrolled horizontally (>10px)
 */
export function useTableScroll(containerRef: RefObject<HTMLDivElement>) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollLeft > 10);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  return isScrolled;
}