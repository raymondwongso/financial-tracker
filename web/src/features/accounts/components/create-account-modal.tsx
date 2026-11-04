"use client";

import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Field, TextField, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useCreateAccount } from "../hooks";

export function CreateAccountModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAccount();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    create.mutate(
      { name: name.trim(), description: description.trim(), initialBalance: Number(balance || "0") },
      {
        onSuccess: (a) => {
          toast(`Account ${a.name} created`);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof ApiError && err.status === 409 ? "An account with this name already exists" : err.message),
      },
    );
  }

  return (
    <Modal title="New account" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        <TextField label="Name" name="name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} error={error} autoFocus />
        <Field label="Description" htmlFor="description">
          <textarea id="description" rows={3} maxLength={500} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Initial balance" htmlFor="initial-balance">
          <AmountInput id="initial-balance" value={balance} onChange={setBalance} />
        </Field>
        <PrimaryButton type="submit" block icon={<Check size={18} />} disabled={create.isPending}>
          Create account
        </PrimaryButton>
      </form>
    </Modal>
  );
}
