import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountWithBalance } from "@financialtracker/shared";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";
import { DeleteAccountModal } from "./delete-account-modal";

const { apiDelete, replace } = vi.hoisted(() => ({ apiDelete: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), apiDelete }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const account = (lastTransactionAt: string | null): AccountWithBalance => ({
  id: 4, name: "BCA", description: "", initialBalance: 0, createdAt: "2026-01-01T00:00:00.000Z",
  balance: 100, lastTransactionAt,
});

describe("DeleteAccountModal", () => {
  it("requires typing the name when the account has transactions, then deletes and leaves the page", async () => {
    apiDelete.mockResolvedValue(undefined);
    renderWithProviders(<DeleteAccountModal account={account("2026-05-01T00:00:00.000Z")} onClose={vi.fn()} />);
    const del = screen.getByRole("button", { name: /Delete/ });
    expect(del).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type “BCA” to confirm/), "BC");
    expect(del).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type “BCA” to confirm/), "A");
    expect(del).toBeEnabled();
    await userEvent.click(del);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/accounts"));
    expect(apiDelete).toHaveBeenCalledWith("/accounts/4");
  });

  it("needs no typing when the account is empty", async () => {
    apiDelete.mockResolvedValue(undefined);
    renderWithProviders(<DeleteAccountModal account={account(null)} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/to confirm/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/accounts"));
  });

  it("shows the API error and stays on the page", async () => {
    apiDelete.mockRejectedValue(new ApiError(404, "Account not found"));
    renderWithProviders(<DeleteAccountModal account={account(null)} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Account not found");
    expect(replace).not.toHaveBeenCalled();
  });
});
