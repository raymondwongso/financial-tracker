"use client";

import { LayoutDashboard, LogOut, Menu, PanelLeftClose, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useLogout, useMe } from "@/features/auth/hooks";
import { CreateInvestmentTransactionFab } from "@/features/investments/components/create-investment-transaction-fab";
import { CreateTransactionFab } from "@/features/transactions/components/create-transaction-fab";
import { initials } from "@/lib/format";

const STORAGE_KEY = "kas.sidebar.collapsed";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getCollapsed = () => localStorage.getItem(STORAGE_KEY) === "1";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Account", icon: Wallet },
  { href: "/investments", label: "Investments", icon: TrendingUp },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();
  const [drawer, setDrawer] = useState(false);
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, () => false);

  const toggle = () => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    listeners.forEach((l) => l());
  };
  const current = NAV.find((n) => pathname.startsWith(n.href));
  const fullName = me ? `${me.firstName} ${me.lastName}` : "";

  const onLogout = () =>
    logout.mutate(undefined, { onSettled: () => router.replace("/login?loggedout=1") });

  // On desktop the sidebar can be collapsed; in the mobile drawer it is always expanded.
  const slim = collapsed;

  return (
    <div className="min-h-screen md:flex">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-ink bg-bg px-4 py-2 md:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setDrawer(true)} className="flex h-11 w-11 items-center justify-center border-2 border-ink">
          <Menu size={20} />
        </button>
        <span className="text-[17px] font-extrabold">{current?.label ?? "Kas"}</span>
      </div>

      {drawer && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setDrawer(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r-2 border-ink bg-surface transition-transform duration-200 ${drawer ? "translate-x-0" : "-translate-x-[105%]"} md:sticky md:top-0 md:h-screen md:translate-x-0 md:transition-[width] md:duration-[180ms] ${slim ? "md:w-[72px]" : "md:w-[248px]"} md:shrink-0`}
      >
        <div className="flex min-h-20 items-center gap-3 border-b-2 border-ink px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink font-extrabold text-bg">
            {me ? initials(me.firstName, me.lastName) : ""}
          </div>
          <div className={`min-w-0 ${slim ? "md:hidden" : ""}`}>
            <p className="truncate font-semibold">{fullName}</p>
            <p className="truncate text-xs text-muted">{me?.email}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                onClick={() => setDrawer(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-6 py-3 font-semibold ${slim ? "md:justify-center md:px-0" : ""} ${active ? "bg-ink text-bg" : "hover:bg-grid"}`}
              >
                <Icon size={18} />
                <span className={slim ? "md:hidden" : ""}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          className={`flex items-center gap-3 border-t-2 border-ink px-6 py-3 font-semibold text-expense-text hover:bg-expense-tint ${slim ? "md:justify-center md:px-0" : ""}`}
        >
          <LogOut size={18} />
          <span className={slim ? "md:hidden" : ""}>Log out</span>
        </button>
        <button
          type="button"
          onClick={() => (drawer ? setDrawer(false) : toggle())}
          title={collapsed ? "Expand" : "Collapse"}
          className={`flex items-center gap-3 border-t-2 border-ink px-6 py-3 font-semibold hover:bg-grid ${slim ? "md:justify-center md:px-0" : ""}`}
        >
          <PanelLeftClose size={18} className={collapsed ? "md:rotate-180" : ""} />
          <span className={slim ? "md:hidden" : ""}>
            <span className="md:hidden">Close menu</span>
            <span className="hidden md:inline">{collapsed ? "Expand" : "Collapse"}</span>
          </span>
        </button>
      </aside>

      <main className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 px-4 pt-5 pb-[170px] md:px-12 md:pt-10 md:pb-[190px]">
        {children}
      </main>
      <CreateTransactionFab />
      <CreateInvestmentTransactionFab />
    </div>
  );
}
