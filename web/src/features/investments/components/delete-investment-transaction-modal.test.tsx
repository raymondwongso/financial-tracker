import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentTransaction } from "@financialtracker/shared";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";
import { DeleteInvestmentTransactionModal } from "./delete-investment-transaction-modal";

const { apiDelete } = vi.hoisted(() => ({ apiDelete: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), apiDelete }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t: InvestmentTransaction = {
  id: 9, investmentAccountId: 3, side: "sell", tradedOn: "2026-05-03", quantity: 50, unitPrice: 7000,
  note: null, createdAt: "2026-05-03T00:00:00.000Z",
};

describe("DeleteInvestmentTransactionModal", () => {
  it("warns about the recalculation and deletes on confirm", async () => {
    apiDelete.mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(<DeleteInvestmentTransactionModal transaction={t} onClose={onClose} />);
    expect(screen.getByText("The position and realized gain will be recalculated.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiDelete).toHaveBeenCalledWith("/investment-accounts/3/transactions/9");
  });

  it("shows the API's rejection reason and stays open", async () => {
    apiDelete.mockRejectedValue(new ApiError(400, "Can't delete this transaction: cannot sell more than the quantity held"));
    const onClose = vi.fn();
    renderWithProviders(<DeleteInvestmentTransactionModal transaction={t} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("quantity held");
    expect(onClose).not.toHaveBeenCalled();
  });
});
