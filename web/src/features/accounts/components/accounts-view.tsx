"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { formatDate, formatIdr } from "@/lib/format";
import { useAccounts } from "../hooks";
import { CreateAccountModal } from "./create-account-modal";

export function AccountsView() {
  const router = useRouter();
  const { data: accounts, isPending, isError } = useAccounts();
  const [creating, setCreating] = useState(false);
  const open = (id: number) => router.push(`/accounts/${id}`);
  const balanceClass = (n: number) => (n < 0 ? "text-expense-text" : "");
  const total = accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
            {accounts?.length ?? 0} {accounts?.length === 1 ? "account" : "accounts"}
          </p>
          <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.025em] md:text-5xl">Accounts</h1>
        </div>
        <PrimaryButton icon={<Plus size={18} />} onClick={() => setCreating(true)}>
          New account
        </PrimaryButton>
      </div>

      {isPending && <p className="text-muted">Loading…</p>}
      {isError && <p className="text-expense-text">Could not load accounts.</p>}
      {accounts?.length === 0 && <p className="text-muted">No accounts yet. Create your first one.</p>}

      {accounts && accounts.length > 0 && (
        <>
          <dl className="border-y-2 border-ink py-4">
            <dt className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Total assets</dt>
            <dd className={`text-2xl font-extrabold ${balanceClass(total)}`}>{formatIdr(total)}</dd>
          </dl>

          <div className="hidden border-t-2 border-ink md:block">
            <div className="grid grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_minmax(150px,1.1fr)_130px_150px] gap-4 border-b-2 border-ink px-2 py-3 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Latest balance</span>
              <span>Created at</span>
              <span>Last transaction</span>
            </div>
            {accounts.map((a) => (
              <div
                key={a.id}
                role="link"
                tabIndex={0}
                onClick={() => open(a.id)}
                onKeyDown={(e) => e.key === "Enter" && open(a.id)}
                className="grid cursor-pointer grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_minmax(150px,1.1fr)_130px_150px] gap-4 border-b border-line px-2 py-4 hover:bg-surface-hover"
              >
                <span className="font-semibold">{a.name}</span>
                <span className="text-sm text-muted">{a.description}</span>
                <span className={`text-right font-semibold ${balanceClass(a.balance)}`}>{formatIdr(a.balance)}</span>
                <span>{formatDate(a.createdAt)}</span>
                <span>{a.lastTransactionAt ? formatDate(a.lastTransactionAt) : "—"}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col border-t-2 border-ink md:hidden">
            {accounts.map((a) => (
              <button key={a.id} type="button" onClick={() => open(a.id)} className="flex flex-col gap-1 border-b border-line py-4 text-left hover:bg-surface-hover">
                <span className="flex justify-between gap-3">
                  <span className="font-semibold">{a.name}</span>
                  <span className={`font-semibold ${balanceClass(a.balance)}`}>{formatIdr(a.balance)}</span>
                </span>
                <span className="text-sm text-muted">{a.description}</span>
                <span className="text-xs text-muted">
                  Created {formatDate(a.createdAt)} · Last transaction {a.lastTransactionAt ? formatDate(a.lastTransactionAt) : "—"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {creating && <CreateAccountModal onClose={() => setCreating(false)} />}
    </div>
  );
}
