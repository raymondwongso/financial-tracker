import type { Metadata } from "next";
import { AccountDetailView } from "@/features/accounts/components/account-detail-view";

export const metadata: Metadata = { title: "Account" };

export default async function AccountDetailPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  return <AccountDetailView accountId={Number(id)} />;
}
