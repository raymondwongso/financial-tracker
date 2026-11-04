"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useMe } from "@/features/auth/hooks";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: me, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (!me) return null;
  return <AppShell>{children}</AppShell>;
}
