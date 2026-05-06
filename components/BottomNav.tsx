'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', short: 'HM' },
  { href: '/sell', label: 'Sell', short: 'SL' },
  { href: '/messages', label: 'Messages', short: 'MS' },
  { href: '/community', label: 'Community', short: 'CM' },
  { href: '/profile', label: 'Profile', short: 'PF' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/50">
      <div className="mx-auto max-w-6xl px-2 sm:px-4">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = item.href === pathname || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 px-1 py-3 text-center transition-colors sm:py-4 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 border-t-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[9px] font-black tracking-wide text-slate-700 sm:h-8 sm:w-8 sm:text-[10px] dark:bg-slate-900 dark:text-slate-200">
                  {item.short}
                </span>
                <p className="mt-1 text-[11px] font-medium sm:text-xs">{item.label}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
