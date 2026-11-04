"use client";

import { useState } from "react";
import type { InvestmentTransaction } from "@financialtracker/shared";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatIdr, formatQuantity } from "@/lib/format";
import { useDeleteInvestmentTransaction } from "../hooks";

export function DeleteInvestmentTransactionModal({
  transaction: t,
  onClose,
}: {
  transaction: InvestmentTransaction;
  onClose: () => void;
}) {
  const toast = useToast();
  const del = useDeleteInvestmentTransaction(t.investmentAccountId);
  const [error, setError] = useState("");

  return (
    <ConfirmDeleteModal
      title="Delete this transaction?"
      error={error}
      pending={del.isPending}
      onClose={onClose}
      onConfirm={() =>
        del.mutate(t.id, {
          onSuccess: () => {
            toast("Transaction deleted");
            onClose();
          },
          onError: (err) => setError(err.message),
        })
      }
    >
      <p className="font-semibold">
        <span className="uppercase">{t.side}</span> {formatQuantity(t.quantity)} · {formatIdr(t.quantity * t.unitPrice)} · {formatDate(t.tradedOn)}
      </p>
      <p className="text-muted">The position and realized gain will be recalculated.</p>
    </ConfirmDeleteModal>
  );
}
