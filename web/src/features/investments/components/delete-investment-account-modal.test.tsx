import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentAccount } from "@financialtracker/shared";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";
import { DeleteInvestmentAccountModal } from "./delete-investment-account-modal";

const { apiDelete, replace } = vi.hoisted(() => ({ apiDelete: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), apiDelete }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const account = (over: Partial<InvestmentAccount> = {}): InvestmentAccount => ({
  id: 3, name: "BBCA", assetType: "stock", symbol: "BBCA", unit: "share", quantity: 0, totalCost: 0, avgCost: 0,
  realizedGain: 0, lastTradedOn: null, currentPrice: null, priceUpdatedAt: null, marketValue: null,
  unrealizedGain: null, createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("DeleteInvestmentAccountModal", () => {
  it("requires typing the name when the account has trades, then deletes and leaves the page", async () => {
    apiDelete.mockResolvedValue(undefined);
    renderWithProviders(<DeleteInvestmentAccountModal account={account({ lastTradedOn: "2026-05-01" })} onClose={vi.fn()} />);
    const del = screen.getByRole("button", { name: /Delete/ });
    expect(del).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type “BBCA” to confirm/), "BBCA");
    await userEvent.click(del);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/investments"));
    expect(apiDelete).toHaveBeenCalledWith("/investment-accounts/3");
  });

  it("also asks for the name when only a price exists", () => {
    renderWithProviders(<DeleteInvestmentAccountModal account={account({ currentPrice: 100 })} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/to confirm/)).toBeInTheDocument();
  });

  it("needs no typing for an empty account", async () => {
    apiDelete.mockResolvedValue(undefined);
    renderWithProviders(<DeleteInvestmentAccountModal account={account()} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/to confirm/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/investments"));
  });

  it("shows the API error and stays on the page", async () => {
    apiDelete.mockRejectedValue(new ApiError(404, "Investment account not found"));
    renderWithProviders(<DeleteInvestmentAccountModal account={account()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not found");
    expect(replace).not.toHaveBeenCalled();
  });
});
