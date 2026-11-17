import type { Metadata } from "next";
import { AccountDetailView } from "@/features/accounts/components/account-detail-view";

export const metadata: Metadata = { title: "Account" };

// (app)/layout gates on client-side auth and renders nothing during prerender, so this route can't be instant.
export const instant = false;

export default async function AccountDetailPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  return <AccountDetailView accountId={Number(id)} />;
}
