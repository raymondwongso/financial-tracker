import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountBarChart } from "./account-bar-chart";

afterEach(cleanup);

describe("AccountBarChart", () => {
  it("renders a row per account with abbreviated labels, tooltips and a nice axis", () => {
    render(
      <AccountBarChart
        accounts={[
          { accountId: 1, accountName: "BCA", income: 18_500_000, expense: 3_300_000 },
          { accountId: 2, accountName: "Cash", income: 0, expense: 50_000 },
        ]}
      />,
    );
    expect(screen.getByText("BCA")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("18,5 Mio")).toBeInTheDocument();
    expect(screen.getByTitle("Income Rp 18.500.000")).toBeInTheDocument();
    expect(screen.getByTitle("Expense Rp 50.000")).toBeInTheDocument();
    // axis 0..20 Mio in 5 Mio steps
    expect(screen.getByText("20 Mio")).toBeInTheDocument();
    expect(screen.getByText("5 Mio")).toBeInTheDocument();
  });
});
