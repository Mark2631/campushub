'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, PlusCircle, User, Users } from 'lucide-react';
import { useState } from 'react';
import useUser from '../hooks/useUser';
import AuthPromptModal from './AuthPromptModal';

const navItems = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/sell', label: 'Sell', Icon: PlusCircle },
  { href: '/messages', label: 'Messages', Icon: MessageCircle },
  { href: '/community', label: 'Community', Icon: Users },
  { href: '/profile', label: 'Profile', Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/50">
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = item.href === pathname || (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.Icon;
              const isProtected = item.href === '/sell' || item.href === '/messages' || item.href === '/profile';
              const className = `flex-1 px-1 py-3 text-center transition-colors sm:py-4 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 border-t-2 border-blue-600 dark:border-blue-400'
                  : 'text-slate-600 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`;
              const content = (
                <>
                  <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 sm:h-8 sm:w-8 dark:bg-slate-900 dark:text-slate-200">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-1 text-[11px] font-medium sm:text-xs">{item.label}</p>
                </>
              );

              if (isProtected && !loading && !user) {
                return (
                  <button key={item.href} type="button" onClick={() => setAuthPrompt(item.href)} className={className}>
                    {content}
                  </button>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <AuthPromptModal open={Boolean(authPrompt)} next={authPrompt || '/'} onClose={() => setAuthPrompt(null)} />
    </>
  );
}
