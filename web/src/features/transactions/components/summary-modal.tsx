"use client";

import { Modal } from "@/components/ui/modal";
import { useAccountSummary } from "../hooks";
import { PiePanel } from "./pie-panel";

interface Props {
  accountId: number;
  accountName: string;
  from: string;
  to: string;
  rangeText: string;
  onClose: () => void;
}

export function SummaryModal({ accountId, accountName, from, to, rangeText, onClose }: Props) {
  const { data, isPending, isError } = useAccountSummary(accountId, from, to, true);
  return (
    <Modal title={`${accountName} · Summary`} subtitle={rangeText} onClose={onClose} wide>
      {isPending && <p className="text-muted">Loading…</p>}
      {isError && <p className="text-expense-text">Could not load the summary.</p>}
      {data && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8">
          <PiePanel title="Income" kind="income" rows={data.income} />
          <PiePanel title="Expense" kind="expense" rows={data.expense} />
        </div>
      )}
    </Modal>
  );
}
