'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Plus, MessageCircle, UserRound } from 'lucide-react';
import { useState } from 'react';
import useUser from '../hooks/useUser';
import AuthPromptModal from './AuthPromptModal';

const navItems = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/categories', label: 'Shop', Icon: LayoutGrid },
  { href: '/sell', label: 'Sell', Icon: Plus },
  { href: '/messages', label: 'Inbox', Icon: MessageCircle },
  { href: '/profile', label: 'Account', Icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);

  return (
    <>
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)]/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_24px_rgba(16,35,23,.06)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 px-1">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.Icon;
            const isProtected = item.href === '/sell' || item.href === '/messages' || item.href === '/profile';
            const className = 'flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 transition ' + (isActive ? 'text-[var(--brand)]' : 'text-[var(--muted)]');
            const content = (
              <>
                <span className={'inline-flex h-7 w-10 items-center justify-center rounded-full transition ' + (isActive ? 'bg-[var(--brand-soft)]' : '')}>
                  <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                </span>
                <span className={'text-[10px] ' + (isActive ? 'font-bold' : 'font-medium')}>{item.label}</span>
              </>
            );
            if (isProtected && !loading && !user) return <button key={item.href} type="button" onClick={() => setAuthPrompt(item.href)} className={className}>{content}</button>;
            return <Link key={item.href} href={item.href} className={className}>{content}</Link>;
          })}
        </div>
      </nav>
      <AuthPromptModal open={Boolean(authPrompt)} next={authPrompt || '/'} onClose={() => setAuthPrompt(null)} />
    </>
  );
}
