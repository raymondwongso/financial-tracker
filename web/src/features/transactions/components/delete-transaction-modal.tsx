"use client";

import { useState } from "react";
import type { Transaction } from "@financialtracker/shared";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatIdr } from "@/lib/format";
import { useDeleteTransaction } from "../hooks";

export function DeleteTransactionModal({
  transaction: t,
  onClose,
  onDeleted,
}: {
  transaction: Transaction;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const del = useDeleteTransaction();
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
            onDeleted?.();
            onClose();
          },
          onError: (err) => setError(err.message),
        })
      }
    >
      <p className="font-semibold">
        {formatIdr(t.amount)} · {t.categoryName} · {formatDate(t.createdAt)}
      </p>
      <p className="text-muted">This changes the account balance.</p>
    </ConfirmDeleteModal>
  );
}
