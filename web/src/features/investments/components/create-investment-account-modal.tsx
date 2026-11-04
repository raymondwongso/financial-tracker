"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { InvestmentAssetType } from "@financialtracker/shared";
import { PrimaryButton } from "@/components/ui/button";
import { Field, TextField, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useCreateInvestmentAccount } from "../hooks";

export function CreateInvestmentAccountModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateInvestmentAccount();
  const [assetType, setAssetType] = useState<InvestmentAssetType>("stock");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [errors, setErrors] = useState<{ name?: string; symbol?: string }>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Name is required";
    if (assetType === "stock" && !symbol.trim()) next.symbol = "Ticker is required";
    setErrors(next);
    if (next.name || next.symbol) return;
    create.mutate(
      { name: name.trim(), assetType, symbol: assetType === "stock" ? symbol.trim() : undefined },
      {
        onSuccess: (a) => {
          toast(`Investment account ${a.name} created`);
          onClose();
        },
        onError: (err) =>
          setErrors({
            name: err instanceof ApiError && err.status === 409 ? "An investment account with this name already exists" : err.message,
          }),
      },
    );
  }

  return (
    <Modal title="New investment account" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        <Field label="Type" htmlFor="asset-type">
          <select id="asset-type" className={inputClass} value={assetType} onChange={(e) => setAssetType(e.target.value as InvestmentAssetType)}>
            <option value="stock">Stock (per ticker)</option>
            <option value="gold">Gold (per gram)</option>
          </select>
        </Field>
        <TextField label="Name" name="name" value={name} onChange={(e) => { setName(e.target.value); setErrors({}); }} error={errors.name} autoFocus />
        {assetType === "stock" && (
          <TextField label="Ticker" name="symbol" placeholder="BBCA" value={symbol} onChange={(e) => { setSymbol(e.target.value); setErrors({}); }} error={errors.symbol} maxLength={20} />
        )}
        <PrimaryButton type="submit" block icon={<Check size={18} />} disabled={create.isPending}>
          Create investment account
        </PrimaryButton>
      </form>
    </Modal>
  );
}
