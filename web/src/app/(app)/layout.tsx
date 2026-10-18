import type { User } from '@ft/shared';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { serverApi } from '@/lib/server-api';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await serverApi<User>('/auth/me');
  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="app-main">{children}</div>
    </div>
  );
}
