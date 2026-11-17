import type { Metadata } from "next";
import { AccountsView } from "@/features/accounts/components/accounts-view";

export const metadata: Metadata = { title: "Accounts" };

// (app)/layout gates on client-side auth and renders nothing during prerender, so this route can't be instant.
export const instant = false;

export default function AccountsPage() {
  return <AccountsView />;
}
