"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { InvestmentAccount } from "@financialtracker/shared";
import { PrimaryButton } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Field, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { toIsoDate } from "@/lib/date-range";
import { useSetInvestmentPrice } from "../hooks";

export function UpdatePriceModal({ account, onClose }: { account: InvestmentAccount; onClose: () => void }) {
  const toast = useToast();
  const setPrice = useSetInvestmentPrice(account.id);
  const [value, setValue] = useState(account.currentPrice === null ? "" : String(account.currentPrice));
  const today = toIsoDate(new Date());
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const price = Number(value);
    if (!(price > 0)) return setError("Price must be greater than zero");
    if (!date || date > today) return setError("Pick a date that is not in the future");
    setPrice.mutate(
      { price, date },
      {
        onSuccess: () => {
          toast("Price saved");
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Modal title={`Update price · ${account.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        <Field label="Date" htmlFor="price-date">
          <input id="price-date" type="date" className={inputClass} value={date} max={today} onChange={(e) => { setDate(e.target.value); setError(""); }} />
        </Field>
        <Field label={`Current price per ${account.unit}`} htmlFor="price" error={error}>
          <DecimalInput id="price" value={value} onChange={(v) => { setValue(v); setError(""); }} maxDecimals={2} prefix="Rp" />
        </Field>
        <PrimaryButton type="submit" block icon={<Check size={18} />} disabled={setPrice.isPending}>
          Save price
        </PrimaryButton>
      </form>
    </Modal>
  );
}
