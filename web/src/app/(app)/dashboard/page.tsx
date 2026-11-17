import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

// (app)/layout gates on client-side auth and renders nothing during prerender, so this route can't be instant.
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
