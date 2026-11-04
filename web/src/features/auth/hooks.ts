"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginRequest, RegisterRequest } from "@financialtracker/shared";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => apiGet<AuthUser>("/auth/me"),
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: LoginRequest) => apiPost<AuthUser>("/auth/login", req),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (req: RegisterRequest) => apiPost<AuthUser>("/auth/register", req) });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>("/auth/logout"),
    onSuccess: () => qc.clear(),
  });
}
