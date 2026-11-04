import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@financialtracker/shared";
import { percent } from "./pie-panel";
import { TransactionsTable } from "./transactions-table";

afterEach(cleanup);

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 1, accountId: 1, categoryId: 1, categoryName: "Food", type: "expense", amount: 250000,
  description: "Lunch", createdAt: "2026-10-26T12:00:00", ...over,
});

describe("TransactionsTable", () => {
  it("shows the empty state", () => {
    render(<TransactionsTable items={[]} />);
    expect(screen.getByText("No transactions in this period.")).toBeInTheDocument();
  });

  it("puts the amount in the matching column only", () => {
    render(<TransactionsTable items={[tx({}), tx({ id: 2, type: "income", amount: 8000000, categoryName: "Salary" })]} />);
    expect(screen.getAllByText("Rp 250.000")).toHaveLength(1);
    expect(screen.getByText("Rp 8.000.000")).toHaveClass("text-income-text");
    expect(screen.getByText("Rp 250.000")).toHaveClass("text-expense-text");
    expect(screen.getAllByText("26 Oct 2026")).toHaveLength(2);
  });
});

describe("TransactionsTable delete", () => {
  it("has no delete buttons without an onDelete handler", () => {
    render(<TransactionsTable items={[tx({})]} />);
    expect(screen.queryAllByLabelText("Delete transaction")).toHaveLength(0);
  });

  it("calls onDelete with the clicked transaction", async () => {
    const onDelete = vi.fn();
    const items = [tx({}), tx({ id: 2, categoryName: "Salary" })];
    render(<TransactionsTable items={items} onDelete={onDelete} />);
    // each row renders a desktop and a mobile button
    const buttons = screen.getAllByLabelText("Delete transaction");
    expect(buttons).toHaveLength(4);
    await userEvent.click(buttons[2]!);
    expect(onDelete).toHaveBeenCalledWith(items[1]);
  });
});

describe("percent", () => {
  it("uses one decimal with a comma", () => {
    expect(percent(1, 3)).toBe("33,3%");
    expect(percent(0, 0)).toBe("0,0%");
  });
});
