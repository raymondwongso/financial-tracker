import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTransactionFab } from "./create-transaction-fab";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/dashboard" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("./create-transaction-modal", () => ({
  CreateTransactionModal: ({ onClose, defaultAccountId }: { onClose: () => void; defaultAccountId?: number }) => (
    <div role="dialog" data-account={defaultAccountId ?? ""}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  pathname.value = "/dashboard";
});

describe("CreateTransactionFab", () => {
  it("shows the button and opens/closes the modal", async () => {
    const user = userEvent.setup();
    render(<CreateTransactionFab />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New transaction" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["/dashboard", "/accounts", "/investments", "/investments/5"])(
    "has no default account on %s",
    async (path) => {
      pathname.value = path;
      const user = userEvent.setup();
      render(<CreateTransactionFab />);
      await user.click(screen.getByRole("button", { name: "New transaction" }));
      expect(screen.getByRole("dialog")).toHaveAttribute("data-account", "");
    },
  );

  it("defaults to the account on the account detail page", async () => {
    pathname.value = "/accounts/5";
    const user = userEvent.setup();
    render(<CreateTransactionFab />);
    await user.click(screen.getByRole("button", { name: "New transaction" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-account", "5");
  });
});
