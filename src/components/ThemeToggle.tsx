'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Server always renders the 'dark' default (no access to localStorage), so
  // the icon must match that until after hydration to avoid a mismatch.
  const resolvedTheme = mounted ? theme : 'dark';

  return (
    <button
      aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={resolvedTheme === 'light'}
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {resolvedTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
