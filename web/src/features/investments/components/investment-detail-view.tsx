"use client";

import { ArrowLeft, BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { InvestmentTransaction } from "@financialtracker/shared";
import { PrimaryButton } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatIdr, formatPrice, formatQuantity } from "@/lib/format";
import { useInvestmentAccount, useInvestmentTransactions } from "../hooks";
import { AddInvestmentTransactionModal } from "./add-investment-transaction-modal";
import { DeleteInvestmentAccountModal } from "./delete-investment-account-modal";
import { DeleteInvestmentTransactionModal } from "./delete-investment-transaction-modal";
import { Gain } from "./gain";
import { PriceHistoryModal } from "./price-history-modal";
import { UpdatePriceModal } from "./update-price-modal";

const label = "text-xs font-semibold tracking-[0.08em] text-muted uppercase";

export function InvestmentDetailView({ accountId }: { accountId: number }) {
  const { data: account, error } = useInvestmentAccount(accountId);
  const { data: transactions } = useInvestmentTransactions(accountId);
  const [adding, setAdding] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [history, setHistory] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleting, setDeleting] = useState<InvestmentTransaction | null>(null);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/investments" className="text-primary hover:underline">← Investments</Link>
        <p>Investment account not found.</p>
      </div>
    );
  }
  if (!account) return <p className="text-muted">Loading…</p>;

  const unit = account.unit;
  return (
    <div className="flex flex-col gap-7">
      <Link href="/investments" className="flex items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft size={16} /> Investments
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <p className={`flex items-center gap-2 ${label}`}>
            {account.assetType} · {account.symbol}
            <button type="button" aria-label="Price history" onClick={() => setHistory(true)} className="flex h-8 w-8 items-center justify-center border-2 border-ink text-ink hover:bg-ink hover:text-bg">
              <BarChart3 size={16} />
            </button>
            <button type="button" aria-label="Delete account" onClick={() => setDeletingAccount(true)} className="flex h-8 w-8 items-center justify-center border-2 border-ink text-muted hover:border-expense-text hover:text-expense-text">
              <Trash2 size={16} />
            </button>
          </p>
          <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.025em] md:text-5xl">{account.name}</h1>
        </div>
        <PrimaryButton icon={<Plus size={18} />} onClick={() => setAdding(true)}>Add transaction</PrimaryButton>
      </div>

      <dl className="grid grid-cols-2 gap-5 lg:grid-cols-5">
        <div><dt className={label}>Quantity</dt><dd className="text-2xl font-extrabold">{formatQuantity(account.quantity)} <span className="text-base font-semibold text-muted">{unit === "gram" ? "g" : "shares"}</span></dd></div>
        <div><dt className={label}>Average buy price</dt><dd className="text-2xl font-extrabold">{account.quantity > 0 ? formatPrice(account.avgCost) : "—"}</dd></div>
        <div><dt className={label}>Market value</dt><dd className="text-2xl font-extrabold">{account.marketValue === null ? "—" : formatIdr(account.marketValue)}</dd></div>
        <div><dt className={label}>Unrealized gain</dt><dd className="text-2xl font-extrabold"><Gain value={account.unrealizedGain} base={account.totalCost} /></dd></div>
        <div><dt className={label}>Realized gain</dt><dd className="text-2xl font-extrabold"><Gain value={account.realizedGain} /></dd></div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
        <div>
          <p className={label}>Current price per {unit}</p>
          <p className="text-xl font-bold">
            {account.currentPrice === null ? "No price yet" : formatPrice(account.currentPrice)}
            {account.priceUpdatedAt && <span className="ml-3 text-sm font-normal text-muted">updated {formatDate(account.priceUpdatedAt)}</span>}
          </p>
        </div>
        <button type="button" onClick={() => setPricing(true)} className="flex min-h-11 items-center gap-2 border-2 border-ink px-4 font-semibold hover:bg-ink hover:text-bg">
          <Pencil size={16} /> Update price
        </button>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold">Transactions</h2>
        {transactions?.length === 0 && <p className="text-muted">No transactions yet.</p>}
        {transactions && transactions.length > 0 && (
          <table className="w-full border-t-2 border-ink text-left">
            <thead>
              <tr className={`border-b-2 border-ink ${label}`}>
                <th className="py-3 pr-2">Date</th><th className="pr-2">Side</th><th className="pr-2 text-right">Quantity</th><th className="pr-2 text-right">Price</th><th className="pr-2 text-right">Total</th><th className="hidden pr-2 md:table-cell">Note</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="group border-b border-line">
                  <td className="py-3 pr-2">{formatDate(t.tradedOn)}</td>
                  <td className={`pr-2 font-semibold uppercase ${t.side === "buy" ? "text-income-text" : "text-expense-text"}`}>{t.side}</td>
                  <td className="pr-2 text-right">{formatQuantity(t.quantity)}</td>
                  <td className="pr-2 text-right">{formatPrice(t.unitPrice)}</td>
                  <td className="pr-2 text-right font-semibold">{formatIdr(t.quantity * t.unitPrice)}</td>
                  <td className="hidden pr-2 text-sm text-muted md:table-cell">{t.note}</td>
                  <td className="w-8 text-right">
                    <button type="button" aria-label="Delete transaction" onClick={() => setDeleting(t)} className="text-muted hover:text-expense-text focus-visible:text-expense-text">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && <AddInvestmentTransactionModal account={account} onClose={() => setAdding(false)} />}
      {deleting && <DeleteInvestmentTransactionModal transaction={deleting} onClose={() => setDeleting(null)} />}
      {history && <PriceHistoryModal account={account} onClose={() => setHistory(false)} />}
      {pricing && <UpdatePriceModal account={account} onClose={() => setPricing(false)} />}
      {deletingAccount && <DeleteInvestmentAccountModal account={account} onClose={() => setDeletingAccount(false)} />}
    </div>
  );
}
