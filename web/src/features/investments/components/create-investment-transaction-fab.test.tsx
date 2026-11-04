import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentAccount } from "@financialtracker/shared";
import { renderWithProviders } from "@/test/render";
import { CreateInvestmentTransactionFab } from "./create-investment-transaction-fab";

const { apiGet, apiPost, pathname } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  pathname: { value: "/dashboard" },
}));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet,
  apiPost,
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  pathname.value = "/dashboard";
});

const account = (o: Partial<InvestmentAccount> = {}): InvestmentAccount => ({
  id: 1, name: "BBCA", assetType: "stock", symbol: "BBCA", unit: "share", quantity: 200, totalCost: 1_100_000,
  avgCost: 5500, realizedGain: 0, lastTradedOn: null, currentPrice: null, priceUpdatedAt: null,
  marketValue: null, unrealizedGain: null, createdAt: "2026-01-01T00:00:00.000Z", ...o,
});

const list = (items: InvestmentAccount[]) => ({ items, summary: { totalCost: 0, totalValue: null, unrealizedGain: null } });
const open = async () => {
  const user = userEvent.setup();
  renderWithProviders(<CreateInvestmentTransactionFab />);
  await user.click(screen.getByRole("button", { name: "New investment transaction" }));
  return user;
};

describe("CreateInvestmentTransactionFab", () => {
  it("opens the modal on the first account by default", async () => {
    apiGet.mockResolvedValue(list([account(), account({ id: 2, name: "Antam" })]));
    await open();
    expect(await screen.findByText("Add transaction · BBCA")).toBeInTheDocument();
    expect(screen.getByLabelText("Investment account")).toBeInTheDocument();
  });

  it("defaults to the account of the current investment detail page", async () => {
    pathname.value = "/investments/2";
    apiGet.mockResolvedValue(list([account(), account({ id: 2, name: "Antam" })]));
    await open();
    expect(await screen.findByText("Add transaction · Antam")).toBeInTheDocument();
  });

  it("lets the user pick another account and posts to it", async () => {
    apiGet.mockResolvedValue(list([account(), account({ id: 2, name: "Antam", unit: "gram" })]));
    apiPost.mockResolvedValue({ id: 9 });
    const user = await open();
    await user.click(await screen.findByLabelText("Investment account"));
    await user.click(await screen.findByRole("button", { name: /Antam/ }));
    expect(await screen.findByText("Add transaction · Antam")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Quantity/), "2");
    await user.type(screen.getByLabelText(/price per gram/), "1000000");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0]![0]).toBe("/investment-accounts/2/transactions");
  });

  it("shows an empty state without investment accounts", async () => {
    apiGet.mockResolvedValue(list([]));
    await open();
    expect(await screen.findByText(/No investment accounts yet/)).toBeInTheDocument();
  });
});
