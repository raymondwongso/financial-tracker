"use client";

import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { TransactionType } from "@financialtracker/shared";
import { useAccounts } from "@/features/accounts/hooks";
import { AmountInput } from "@/components/ui/amount-input";
import { PrimaryButton } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Field, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { occurredAtForDate, toIsoDate } from "@/lib/date-range";
import { formatIdr } from "@/lib/format";
import { useCategories, useCreateCategory, useCreateTransaction } from "../hooks";

interface Props {
  onClose: () => void;
  /** Preselect an account (e.g. from the account detail page). */
  defaultAccountId?: number;
}

export function CreateTransactionModal({ onClose, defaultAccountId }: Props) {
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const createTx = useCreateTransaction();

  const [accountId, setAccountId] = useState<number | null>(defaultAccountId ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [today] = useState(() => toIsoDate(new Date()));
  const [date, setDate] = useState(today);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ account?: string; category?: string; amount?: string; date?: string; form?: string }>({});

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;

  function submitCategory(close: () => void) {
    const name = (newCategory ?? "").trim();
    if (!name) return;
    createCategory.mutate(name, {
      onSuccess: (c) => {
        setCategoryId(c.id);
        setErrors((e) => ({ ...e, category: undefined }));
        setNewCategory(null);
        close();
      },
      onError: (err) => setErrors((e) => ({ ...e, category: err.message })),
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (effectiveAccountId === null) found.account = "Choose an account";
    if (categoryId === null) found.category = "Choose a category";
    if (!amount || Number(amount) <= 0) found.amount = "Enter an amount greater than 0";
    if (!date) found.date = "Choose a date";
    else if (date > today) found.date = "Date cannot be in the future";
    setErrors(found);
    if (Object.keys(found).length > 0 || effectiveAccountId === null || categoryId === null) return;

    createTx.mutate(
      {
        accountId: effectiveAccountId,
        categoryId,
        type,
        amount: Number(amount),
        description: description.trim() || undefined,
        occurredAt: occurredAtForDate(date),
      },
      {
        onSuccess: (t) => {
          const acc = accounts.find((a) => a.id === t.accountId);
          toast(`${type === "income" ? "Income" : "Expense"} of ${formatIdr(t.amount)} saved to ${acc?.name ?? "account"}`);
          onClose();
        },
        onError: (err) => setErrors({ form: err.message }),
      },
    );
  }

  const toggle = (value: TransactionType, label: string, selected: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={`flex flex-1 items-center justify-between px-3.5 py-3 font-semibold ${type === value ? `${selected} text-white` : "bg-surface hover:bg-surface-hover"}`}
    >
      {label}
      {icon}
    </button>
  );

  return (
    <Modal title="New transaction" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        <Field label="Account" error={errors.account} htmlFor="tx-account">
          <Dropdown
            id="tx-account"
            value={effectiveAccountId}
            placeholder="Select account"
            options={accounts.map((a) => ({ value: a.id, label: a.name, hint: formatIdr(a.balance) }))}
            onChange={setAccountId}
          />
        </Field>

        <Field label="Category" error={errors.category} htmlFor="tx-category">
          <Dropdown
            id="tx-category"
            value={categoryId}
            placeholder="Select category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => {
              setCategoryId(v);
              setErrors((e) => ({ ...e, category: undefined }));
            }}
            footer={(close) => (
              <div className="border-t-2 border-ink">
                {newCategory === null ? (
                  <button type="button" onClick={() => setNewCategory("")} className="w-full px-3.5 py-2.5 text-left font-semibold text-primary hover:bg-surface-hover">
                    + Create new
                  </button>
                ) : (
                  <div className="p-2">
                    <input
                      autoFocus
                      aria-label="Category name"
                      placeholder="Category name"
                      value={newCategory}
                      maxLength={50}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitCategory(close);
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          e.preventDefault();
                          setNewCategory(null);
                        }
                      }}
                      className="w-full border-2 border-ink bg-bg px-3 py-2 focus:border-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-muted">Press Enter to create · Esc to cancel</p>
                  </div>
                )}
              </div>
            )}
          />
        </Field>

        <Field label="Type">
          <div className="flex gap-0.5 border-2 border-ink bg-ink">
            {toggle("income", "Income", "bg-income-strong", <ArrowUpRight size={18} />)}
            {toggle("expense", "Expense", "bg-expense", <ArrowDownRight size={18} />)}
          </div>
        </Field>

        <Field label="Amount" error={errors.amount} htmlFor="tx-amount">
          <AmountInput id="tx-amount" value={amount} onChange={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: undefined })); }} />
        </Field>

        <TextField
          label="Date"
          name="tx-date"
          type="date"
          max={today}
          value={date}
          error={errors.date}
          onChange={(e) => { setDate(e.target.value); setErrors((er) => ({ ...er, date: undefined })); }}
        />

        <TextField label="Description (optional)" name="description" maxLength={120} value={description} onChange={(e) => setDescription(e.target.value)} />

        {errors.form && <p role="alert" className="text-[13px] text-expense-text">{errors.form}</p>}
        <PrimaryButton type="submit" block icon={<Check size={18} />} disabled={createTx.isPending}>
          Save transaction
        </PrimaryButton>
      </form>
    </Modal>
  );
}
