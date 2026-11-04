import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@financialtracker/shared";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";
import { DeleteTransactionModal } from "./delete-transaction-modal";

const { apiDelete } = vi.hoisted(() => ({ apiDelete: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), apiDelete }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t: Transaction = {
  id: 7, accountId: 1, categoryId: 1, categoryName: "Food", type: "expense", amount: 250000,
  description: "Lunch", createdAt: "2026-10-26T12:00:00",
};

describe("DeleteTransactionModal", () => {
  it("shows the details and deletes on confirm", async () => {
    apiDelete.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(<DeleteTransactionModal transaction={t} onClose={onClose} onDeleted={onDeleted} />);
    expect(screen.getByText(/Rp 250\.000 · Food/)).toBeInTheDocument();
    expect(screen.getByText("This changes the account balance.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiDelete).toHaveBeenCalledWith("/transactions/7");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("Cancel closes without calling the API", async () => {
    const onClose = vi.fn();
    renderWithProviders(<DeleteTransactionModal transaction={t} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the error when the API fails", async () => {
    apiDelete.mockRejectedValue(new ApiError(404, "Transaction not found"));
    const onClose = vi.fn();
    renderWithProviders(<DeleteTransactionModal transaction={t} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Transaction not found");
    expect(onClose).not.toHaveBeenCalled();
  });
});
