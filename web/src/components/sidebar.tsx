'use client';

import type { User } from '@ft/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import { AccountIcon, BrandMark, ChatIcon, DashboardIcon, ListIcon } from './icons';

const NAV = [
  { href: '/chat', label: 'Chat', Icon: ChatIcon },
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/accounts', label: 'Accounts', Icon: AccountIcon },
  { href: '/transactions', label: 'Transactions', Icon: ListIcon },
];

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <aside className="app-sidebar">
      <div className="brand">
        <BrandMark />
        <span>Financial Tracker</span>
      </div>
      <nav aria-label="Main" className="d-flex flex-column gap-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`navlink${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto d-flex align-items-center gap-2 px-2 pt-3 border-top">
        <span className="avatar">{initials(user.name)}</span>
        <span className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
          <span className="fw-bold small text-truncate">{user.name}</span>
          <span className="text-secondary text-truncate" style={{ fontSize: 12 }}>
            {user.email}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-link btn-sm fw-bold p-0"
          onClick={logout}
          disabled={loggingOut}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
