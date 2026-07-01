'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function StickyHorizontalScroll({ className, children }: { className?: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<'content' | 'bar' | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    const ghost = ghostRef.current;
    if (!content || !ghost) return;

    const updateWidth = () => {
      ghost.style.width = `${content.scrollWidth}px`;
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  function onContentScroll() {
    if (syncingFrom.current === 'bar') {
      syncingFrom.current = null;
      return;
    }
    if (barRef.current && contentRef.current) {
      syncingFrom.current = 'content';
      barRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
  }

  function onBarScroll() {
    if (syncingFrom.current === 'content') {
      syncingFrom.current = null;
      return;
    }
    if (barRef.current && contentRef.current) {
      syncingFrom.current = 'bar';
      contentRef.current.scrollLeft = barRef.current.scrollLeft;
    }
  }

  return (
    <div className="sticky-hscroll-outer">
      <div className={className} onScroll={onContentScroll} ref={contentRef}>
        {children}
      </div>
      <div className="sticky-hscroll-bar" onScroll={onBarScroll} ref={barRef}>
        <div className="sticky-hscroll-ghost" ref={ghostRef} />
      </div>
    </div>
  );
}
