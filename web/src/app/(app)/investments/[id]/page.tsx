import type { Metadata } from "next";
import { InvestmentDetailView } from "@/features/investments/components/investment-detail-view";

export const metadata: Metadata = { title: "Investment" };

export default async function InvestmentDetailPage({ params }: PageProps<"/investments/[id]">) {
  const { id } = await params;
  return <InvestmentDetailView accountId={Number(id)} />;
}
