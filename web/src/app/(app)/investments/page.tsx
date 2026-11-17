import type { Metadata } from "next";
import { InvestmentsView } from "@/features/investments/components/investments-view";

export const metadata: Metadata = { title: "Investments" };

// (app)/layout gates on client-side auth and renders nothing during prerender, so this route can't be instant.
export const instant = false;

export default function InvestmentsPage() {
  return <InvestmentsView />;
}
