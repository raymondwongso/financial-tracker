"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountWithBalance } from "@financialtracker/shared";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { useDeleteAccount } from "../hooks";

export function DeleteAccountModal({ account, onClose }: { account: AccountWithBalance; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const del = useDeleteAccount();
  const [error, setError] = useState("");
  const hasTransactions = account.lastTransactionAt !== null;

  return (
    <ConfirmDeleteModal
      title={`Delete ${account.name}?`}
      error={error}
      pending={del.isPending}
      confirmText={hasTransactions ? account.name : undefined}
      onClose={onClose}
      onConfirm={() =>
        del.mutate(account.id, {
          onSuccess: () => {
            toast("Account deleted");
            router.replace("/accounts");
          },
          onError: (err) => setError(err.message),
        })
      }
    >
      <p className="text-muted">
        {hasTransactions
          ? "This permanently deletes the account and all its transactions. This can't be undone."
          : "This account has no transactions. It will be deleted permanently."}
      </p>
    </ConfirmDeleteModal>
  );
}
