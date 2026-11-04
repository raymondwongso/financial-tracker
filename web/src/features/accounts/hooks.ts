"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, AccountWithBalance, CreateAccountRequest } from "@financialtracker/shared";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<AccountWithBalance[]>("/accounts") });
}

export function useAccount(id: number) {
  return useQuery({ queryKey: ["accounts", id], queryFn: () => apiGet<AccountWithBalance>(`/accounts/${id}`) });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateAccountRequest) => apiPost<Account>("/accounts", req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/accounts/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["accounts", id] });
      qc.removeQueries({ queryKey: ["transactions", id] });
      for (const key of ["accounts", "summary", "dashboard"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
