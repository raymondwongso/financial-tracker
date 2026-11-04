"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvestmentAccount } from "@financialtracker/shared";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { useDeleteInvestmentAccount } from "../hooks";

export function DeleteInvestmentAccountModal({ account, onClose }: { account: InvestmentAccount; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const del = useDeleteInvestmentAccount();
  const [error, setError] = useState("");
  const hasData = account.lastTradedOn !== null || account.currentPrice !== null;

  return (
    <ConfirmDeleteModal
      title={`Delete ${account.name}?`}
      error={error}
      pending={del.isPending}
      confirmText={hasData ? account.name : undefined}
      onClose={onClose}
      onConfirm={() =>
        del.mutate(account.id, {
          onSuccess: () => {
            toast("Investment account deleted");
            router.replace("/investments");
          },
          onError: (err) => setError(err.message),
        })
      }
    >
      <p className="text-muted">
        {hasData
          ? "This permanently deletes the account with all its transactions and price history. This can't be undone."
          : "This account has no transactions or prices. It will be deleted permanently."}
      </p>
    </ConfirmDeleteModal>
  );
}
