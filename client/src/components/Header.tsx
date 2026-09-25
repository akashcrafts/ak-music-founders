import React from 'react';
import { Moon, Sun, Terminal, RefreshCw, ExternalLink } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  showDebug: boolean;
  setShowDebug: (val: boolean) => void;
  onReset?: () => void;
  hasActiveJob: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  showDebug,
  setShowDebug,
  onReset,
  hasActiveJob,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={onReset}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          {/* akashcraft.com logo icon gradient */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4facfe] to-[#00f2fe] p-0.5 shadow-md shadow-[#00f2fe]/20 group-hover:scale-105 transition-transform duration-200 flex items-center justify-center">
            <div className="w-full h-full bg-[#08080B] rounded-[10px] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="akLogoGrad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4facfe"></stop>
                    <stop offset="100%" stopColor="#00f2fe"></stop>
                  </linearGradient>
                </defs>
                <rect width="30" height="30" rx="8" fill="url(#akLogoGrad)"></rect>
                <path d="M9.2 20.5 13.1 9.5h2.2l3.9 11h-2l-.9-2.6h-4.3l-.9 2.6H9.2Zm3.4-4.3h3.1l-1.55-4.45L12.6 16.2Z" fill="#08080B"></path>
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-white">
                AK Music Founder
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-gradient-to-r from-[#4facfe]/15 to-[#00f2fe]/15 text-[#00b4d8] dark:text-[#00f2fe] border border-[#00f2fe]/30">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>Made by</span>
              <a 
                href="https://akashcraft.com" 
                target="_blank" 
                rel="noreferrer"
                className="font-medium text-neutral-800 dark:text-neutral-200 hover:text-[#00f2fe] transition-colors inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                Akash Singh
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {hasActiveJob && onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Start a new upload"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Analysis</span>
            </button>
          )}

          {/* Dev Debug Panel Toggle */}
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
              showDebug
                ? 'bg-[#00f2fe]/10 border-[#00f2fe]/40 text-[#00b4d8] dark:text-[#00f2fe] shadow-sm'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
            }`}
            title="Toggle Developer & Pipeline Debug Panel"
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden md:inline">Dev Panel</span>
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
