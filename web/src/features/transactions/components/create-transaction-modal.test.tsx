import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { toIsoDate } from "@/lib/date-range";
import { CreateTransactionModal } from "./create-transaction-modal";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet,
  apiPost,
}));

beforeEach(() => {
  apiGet.mockImplementation(async (path: string) =>
    path.startsWith("/accounts")
      ? [{ id: 1, name: "Cash", balance: 0 }]
      : [{ id: 7, name: "Food" }],
  );
  apiPost.mockResolvedValue({ id: 1, accountId: 1, amount: 5000 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText("Category"));
  await user.click(await screen.findByRole("button", { name: /Food/ }));
  await user.type(screen.getByLabelText("Amount"), "5000");
}

describe("CreateTransactionModal date", () => {
  it("defaults to today and cannot pick a future day", () => {
    renderWithProviders(<CreateTransactionModal onClose={() => {}} defaultAccountId={1} />);
    const today = toIsoDate(new Date());
    const input = screen.getByLabelText("Date");
    expect(input).toHaveValue(today);
    expect(input).toHaveAttribute("max", today);
  });

  it("omits occurredAt when the date is today", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateTransactionModal onClose={() => {}} defaultAccountId={1} />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0]![1].occurredAt).toBeUndefined();
  });

  it("sends occurredAt for a past date", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateTransactionModal onClose={() => {}} defaultAccountId={1} />);
    await fillRequired(user);
    const input = screen.getByLabelText("Date");
    await user.clear(input);
    await user.type(input, "2026-01-15");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0]![1].occurredAt).toBe(new Date(2026, 0, 15, 12).toISOString());
  });

  it("blocks a future date", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateTransactionModal onClose={() => {}} defaultAccountId={1} />);
    await fillRequired(user);
    const input = screen.getByLabelText("Date");
    await user.clear(input);
    await user.type(input, "2999-01-01");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    expect(await screen.findByText("Date cannot be in the future")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
