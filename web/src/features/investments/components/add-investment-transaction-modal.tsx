"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { InvestmentAccount, InvestmentSide } from "@financialtracker/shared";
import { PrimaryButton } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Field, TextField, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { toIsoDate } from "@/lib/date-range";
import { formatQuantity } from "@/lib/format";
import { useCreateInvestmentTransaction } from "../hooks";

const sideBtn = (active: boolean) =>
  `min-h-11 flex-1 border-2 border-ink font-semibold ${active ? "bg-ink text-bg" : "hover:bg-surface-hover"}`;

interface Props {
  account: InvestmentAccount;
  onClose: () => void;
  /** Rendered at the top of the form, e.g. an account picker when the modal is opened from outside an account page. */
  accountPicker?: ReactNode;
}

export function AddInvestmentTransactionModal({ account, onClose, accountPicker }: Props) {
  const toast = useToast();
  const create = useCreateInvestmentTransaction(account.id);
  const today = toIsoDate(new Date());
  const [side, setSide] = useState<InvestmentSide>("buy");
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ date?: string; quantity?: string; unitPrice?: string; form?: string }>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    const p = Number(unitPrice);
    const next: typeof errors = {};
    if (!date || date > today) next.date = "Pick a date that is not in the future";
    else if (account.lastTradedOn && date < account.lastTradedOn) next.date = `Cannot be before the last transaction (${account.lastTradedOn})`;
    if (!(q > 0)) next.quantity = "Quantity must be greater than zero";
    else if (side === "sell" && q > account.quantity) next.quantity = `You only hold ${formatQuantity(account.quantity)} ${account.unit}`;
    if (!(p > 0)) next.unitPrice = "Price must be greater than zero";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    create.mutate(
      { side, tradedOn: date, quantity: q, unitPrice: p, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast(side === "buy" ? "Purchase recorded" : "Sale recorded");
          onClose();
        },
        onError: (err) => setErrors({ form: err.message }),
      },
    );
  }

  return (
    <Modal title={`Add transaction · ${account.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        {accountPicker}
        <div className="flex" role="group" aria-label="Side">
          <button type="button" aria-pressed={side === "buy"} className={sideBtn(side === "buy")} onClick={() => setSide("buy")}>Buy</button>
          <button type="button" aria-pressed={side === "sell"} className={sideBtn(side === "sell")} onClick={() => setSide("sell")}>Sell</button>
        </div>
        <Field label="Date" htmlFor="traded-on" error={errors.date}>
          <input id="traded-on" type="date" className={inputClass} value={date} max={today} min={account.lastTradedOn ?? undefined} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`Quantity (${account.unit}s)`} htmlFor="quantity" error={errors.quantity}>
          <DecimalInput id="quantity" value={quantity} onChange={setQuantity} maxDecimals={6} suffix={account.unit === "gram" ? "g" : "shares"} />
        </Field>
        {side === "sell" && <p className="-mt-3 text-[13px] text-muted">Held: {formatQuantity(account.quantity)} {account.unit}s</p>}
        <Field label={`${side === "buy" ? "Buy" : "Sell"} price per ${account.unit}`} htmlFor="unit-price" error={errors.unitPrice}>
          <DecimalInput id="unit-price" value={unitPrice} onChange={setUnitPrice} maxDecimals={2} prefix="Rp" />
        </Field>
        <TextField label="Note" name="note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
        {errors.form && <p role="alert" className="text-[13px] text-expense-text">{errors.form}</p>}
        <PrimaryButton type="submit" block icon={<Check size={18} />} disabled={create.isPending}>
          Save transaction
        </PrimaryButton>
      </form>
    </Modal>
  );
}
