"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountSummary,
  Category,
  CreateTransactionRequest,
  Transaction,
  TransactionPage,
} from "@financialtracker/shared";
import { apiDelete, apiGet, apiPost, withQuery } from "@/lib/api-client";

export const PAGE_SIZE = 10;

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => apiGet<Category[]>("/categories") });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiPost<Category>("/categories", { name }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTransactionRequest) => apiPost<Transaction>("/transactions", req),
    onSuccess: () => {
      for (const key of ["accounts", "transactions", "summary", "dashboard"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/transactions/${id}`),
    onSuccess: () => {
      for (const key of ["accounts", "transactions", "summary", "dashboard"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useTransactions(accountId: number, from: string, to: string, cursor: string | null) {
  return useQuery({
    queryKey: ["transactions", accountId, from, to, cursor],
    queryFn: () =>
      apiGet<TransactionPage>(
        withQuery(`/accounts/${accountId}/transactions`, { from, to, cursor, limit: PAGE_SIZE }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAccountSummary(accountId: number, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ["summary", accountId, from, to],
    queryFn: () => apiGet<AccountSummary>(withQuery(`/accounts/${accountId}/summary`, { from, to })),
    enabled,
  });
}
