import "@testing-library/jest-dom/vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountWithBalance } from "@financialtracker/shared";
import { renderWithProviders } from "@/test/render";
import { AccountsView } from "./accounts-view";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const account = (o: Partial<AccountWithBalance>): AccountWithBalance => ({
  id: 1, name: "Cash", description: "", initialBalance: 0, createdAt: "2026-01-01T00:00:00.000Z",
  balance: 0, lastTransactionAt: null, ...o,
});

const totalBand = async () => within((await screen.findByText("Total assets")).parentElement!);

describe("AccountsView total assets", () => {
  it("shows the sum of all account balances", async () => {
    apiGet.mockResolvedValue([account({ id: 1, balance: 1_000_000 }), account({ id: 2, name: "Bank", balance: 2_500_000 })]);
    renderWithProviders(<AccountsView />);
    expect((await totalBand()).getByText("Rp 3.500.000")).toBeInTheDocument();
  });

  it("includes negative balances in the sum", async () => {
    apiGet.mockResolvedValue([account({ id: 1, balance: 1_000_000 }), account({ id: 2, name: "Card", balance: -400_000 })]);
    renderWithProviders(<AccountsView />);
    expect((await totalBand()).getByText("Rp 600.000")).toBeInTheDocument();
  });

  it("shows no total without accounts", async () => {
    apiGet.mockResolvedValue([]);
    renderWithProviders(<AccountsView />);
    expect(await screen.findByText(/No accounts yet/)).toBeInTheDocument();
    expect(screen.queryByText("Total assets")).not.toBeInTheDocument();
  });
});
