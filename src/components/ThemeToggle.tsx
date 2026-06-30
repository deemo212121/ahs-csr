'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-toggle ${className}`} role="group" aria-label="Theme">
      <button
        aria-pressed={theme === 'dark'}
        className={`theme-toggle-option ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        suppressHydrationWarning
        type="button"
      >
        <Moon size={14} />
        <span>Dark</span>
      </button>
      <button
        aria-pressed={theme === 'light'}
        className={`theme-toggle-option ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        suppressHydrationWarning
        type="button"
      >
        <Sun size={14} />
        <span>Light</span>
      </button>
    </div>
  );
}
