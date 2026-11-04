import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TotalAssets } from "@financialtracker/shared";
import { renderWithProviders } from "@/test/render";
import { TotalAssetsSection } from "./total-assets-section";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), apiGet }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const assets = (o: Partial<TotalAssets> = {}): TotalAssets => ({
  total: 125_000_000, accountsTotal: 75_000_000, investmentsTotal: 50_000_000, unpricedInvestmentCount: 0, ...o,
});

describe("TotalAssetsSection", () => {
  it("shows the total, both sub-totals and their percentage share", async () => {
    apiGet.mockResolvedValue(assets());
    renderWithProviders(<TotalAssetsSection />);
    expect(await screen.findByText("Rp 125.000.000")).toBeInTheDocument();
    expect(screen.getAllByText("Total assets")).toHaveLength(1);
    expect(screen.getByText("Rp 75.000.000 · 60%")).toBeInTheDocument();
    expect(screen.getByText("Rp 50.000.000 · 40%")).toBeInTheDocument();
    expect(screen.queryByText(/no price/)).not.toBeInTheDocument();
  });

  it("warns about unpriced positions (singular and plural)", async () => {
    apiGet.mockResolvedValue(assets({ unpricedInvestmentCount: 1 }));
    const { unmount } = renderWithProviders(<TotalAssetsSection />);
    expect(await screen.findByText("1 investment position has no price and is not included.")).toBeInTheDocument();
    unmount();
    apiGet.mockResolvedValue(assets({ unpricedInvestmentCount: 3 }));
    renderWithProviders(<TotalAssetsSection />);
    expect(await screen.findByText("3 investment positions have no price and are not included.")).toBeInTheDocument();
  });

  it("shows zeros and no split bar when there are no assets", async () => {
    apiGet.mockResolvedValue(assets({ total: 0, accountsTotal: 0, investmentsTotal: 0 }));
    renderWithProviders(<TotalAssetsSection />);
    expect(await screen.findByText("Rp 0")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 0 · 0%")).toHaveLength(2);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a loading state, then an error state", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TotalAssetsSection />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    cleanup();
    apiGet.mockRejectedValue(new Error("boom"));
    // No retries, so the failure surfaces immediately instead of after backoff.
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TotalAssetsSection />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Could not load total assets.")).toBeInTheDocument();
  });
});
