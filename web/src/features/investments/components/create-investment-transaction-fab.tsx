"use client";

import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatQuantity } from "@/lib/format";
import { useInvestmentAccounts } from "../hooks";
import { AddInvestmentTransactionModal } from "./add-investment-transaction-modal";

const INVESTMENT_DETAIL = /^\/investments\/(\d+)\/?$/;

function CreateInvestmentTransactionModal({ onClose }: { onClose: () => void }) {
  const { data } = useInvestmentAccounts();
  const match = INVESTMENT_DETAIL.exec(usePathname());
  const [selectedId, setSelectedId] = useState<number | null>(match ? Number(match[1]) : null);

  if (!data) return null;
  if (data.items.length === 0) {
    return (
      <Modal title="Add investment transaction" onClose={onClose}>
        <p className="mb-4">No investment accounts yet.</p>
        <Link href="/investments" onClick={onClose} className="font-semibold text-primary hover:underline">
          Go to Investments
        </Link>
      </Modal>
    );
  }

  const account = data.items.find((a) => a.id === selectedId) ?? data.items[0]!;
  return (
    <AddInvestmentTransactionModal
      account={account}
      onClose={onClose}
      accountPicker={
        <Field label="Investment account" htmlFor="inv-account">
          <Dropdown
            id="inv-account"
            value={account.id}
            placeholder="Select account"
            options={data.items.map((a) => ({
              value: a.id,
              label: a.name,
              hint: `${formatQuantity(a.quantity)} ${a.unit}s`,
            }))}
            onChange={setSelectedId}
          />
        </Field>
      }
    />
  );
}

export function CreateInvestmentTransactionFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="New investment transaction"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-20 flex h-[60px] w-[60px] items-center justify-center bg-primary text-bg shadow-[0_6px_18px_rgba(0,0,0,.5)] hover:bg-primary-hover md:right-6 md:bottom-6"
      >
        <TrendingUp size={26} />
      </button>
      {open && <CreateInvestmentTransactionModal onClose={() => setOpen(false)} />}
    </>
  );
}
