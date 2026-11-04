"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateInvestmentAccountRequest,
  CreateInvestmentTransactionRequest,
  InvestmentAccount,
  InvestmentAccountList,
  InvestmentListQuery,
  InvestmentPricePoint,
  InvestmentTransaction,
  SetInvestmentPriceRequest,
} from "@financialtracker/shared";
import { apiDelete, apiGet, apiPost, apiPut, withQuery } from "@/lib/api-client";

export function useInvestmentAccounts(sort: InvestmentListQuery = {}) {
  return useQuery({
    // Distinct from the detail key ["investments", id]; both still match the ["investments"] invalidations.
    queryKey: ["investments", "list", sort.sortBy ?? null, sort.order ?? null],
    queryFn: () =>
      apiGet<InvestmentAccountList>(withQuery("/investment-accounts", { sortBy: sort.sortBy, order: sort.order })),
    // Keep the old rows on screen while the re-sorted list loads, instead of flashing "Loading…".
    placeholderData: keepPreviousData,
  });
}

export function useInvestmentAccount(id: number) {
  return useQuery({
    queryKey: ["investments", id],
    queryFn: () => apiGet<InvestmentAccount>(`/investment-accounts/${id}`),
  });
}

export function useInvestmentTransactions(id: number) {
  return useQuery({
    queryKey: ["investments", id, "transactions"],
    queryFn: () => apiGet<InvestmentTransaction[]>(`/investment-accounts/${id}/transactions`),
  });
}

export function useInvestmentPriceHistory(id: number) {
  return useQuery({
    queryKey: ["investments", id, "price-history"],
    queryFn: () => apiGet<InvestmentPricePoint[]>(`/investment-accounts/${id}/price-history`),
  });
}

export function useCreateInvestmentAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateInvestmentAccountRequest) => apiPost<InvestmentAccount>("/investment-accounts", req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["investments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateInvestmentTransaction(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateInvestmentTransactionRequest) =>
      apiPost<InvestmentTransaction>(`/investment-accounts/${accountId}/transactions`, req),
    // The position (quantity, average, gain) changes too, so refetch the account and the list.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["investments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteInvestmentTransaction(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txId: number) => apiDelete(`/investment-accounts/${accountId}/transactions/${txId}`),
    // The position (quantity, average, gain) is recalculated server-side, so refetch everything.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["investments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSetInvestmentPrice(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SetInvestmentPriceRequest) =>
      apiPut<InvestmentAccount>(`/investment-accounts/${accountId}/price`, req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["investments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteInvestmentAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/investment-accounts/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["investments", id] });
      void qc.invalidateQueries({ queryKey: ["investments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
