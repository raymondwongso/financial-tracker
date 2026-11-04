"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardSummary, TotalAssets } from "@financialtracker/shared";
import { apiGet, withQuery } from "@/lib/api-client";

export function useDashboardSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => apiGet<DashboardSummary>(withQuery("/dashboard/summary", { from, to })),
    placeholderData: keepPreviousData,
  });
}

export function useTotalAssets() {
  return useQuery({
    queryKey: ["dashboard", "total-assets"],
    queryFn: () => apiGet<TotalAssets>("/dashboard/total-assets"),
  });
}
