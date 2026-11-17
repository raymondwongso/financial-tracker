import type { Metadata } from "next";
import { InvestmentDetailView } from "@/features/investments/components/investment-detail-view";

export const metadata: Metadata = { title: "Investment" };

// (app)/layout gates on client-side auth and renders nothing during prerender, so this route can't be instant.
export const instant = false;

export default async function InvestmentDetailPage({ params }: PageProps<"/investments/[id]">) {
  const { id } = await params;
  return <InvestmentDetailView accountId={Number(id)} />;
}
