import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentAccount } from "@financialtracker/shared";
import { renderWithProviders } from "@/test/render";
import { AddInvestmentTransactionModal } from "./add-investment-transaction-modal";
import { CreateInvestmentAccountModal } from "./create-investment-account-modal";
import { InvestmentsView } from "./investments-view";
import { toIsoDate } from "@/lib/date-range";
import { InvestmentDetailView } from "./investment-detail-view";
import { PriceHistoryModal } from "./price-history-modal";
import { UpdatePriceModal } from "./update-price-modal";

const { apiGet, apiPost, apiPut } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet,
  apiPost,
  apiPut,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const account = (o: Partial<InvestmentAccount> = {}): InvestmentAccount => ({
  id: 1, name: "BBCA", assetType: "stock", symbol: "BBCA", unit: "share", quantity: 200, totalCost: 1_100_000,
  avgCost: 5500, realizedGain: 0, lastTradedOn: "2026-05-10", currentPrice: null, priceUpdatedAt: null,
  marketValue: null, unrealizedGain: null, createdAt: "2026-01-01T00:00:00.000Z", ...o,
});

describe("InvestmentsView", () => {
  it("shows average price, value and gain, and dashes when there is no price", async () => {
    apiGet.mockResolvedValue({
      items: [
        account({ currentPrice: 6500, priceUpdatedAt: "2026-06-01T00:00:00.000Z", marketValue: 1_300_000, unrealizedGain: 200_000 }),
        account({ id: 2, name: "Antam", assetType: "gold", symbol: "GOLD", unit: "gram", quantity: 2.5, totalCost: 100, avgCost: 40 }),
      ],
      summary: { totalCost: 1_100_100, totalValue: null, unrealizedGain: null },
    });
    renderWithProviders(<InvestmentsView />);
    expect((await screen.findAllByText("BBCA")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 5.500").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+Rp 200\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Antam").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows an empty state", async () => {
    apiGet.mockResolvedValue({ items: [], summary: { totalCost: 0, totalValue: 0, unrealizedGain: 0 } });
    renderWithProviders(<InvestmentsView />);
    expect(await screen.findByText(/No investment accounts yet/)).toBeInTheDocument();
  });
});

describe("InvestmentsView sorting", () => {
  const list = { items: [account()], summary: { totalCost: 1_100_000, totalValue: null, unrealizedGain: null } };
  const lastUrl = () => apiGet.mock.calls.at(-1)?.[0];

  it("loads unsorted by default", async () => {
    apiGet.mockResolvedValue(list);
    renderWithProviders(<InvestmentsView />);
    await screen.findAllByText("BBCA");
    expect(apiGet).toHaveBeenCalledWith("/investment-accounts");
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "none");
  });

  it("clicking a header sorts ascending, clicking it again descending, and shows aria-sort", async () => {
    apiGet.mockResolvedValue(list);
    const user = userEvent.setup();
    renderWithProviders(<InvestmentsView />);
    await screen.findAllByText("BBCA");

    await user.click(screen.getByRole("button", { name: "Name" }));
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=name&order=asc"));
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending");

    await user.click(screen.getByRole("button", { name: "Name" }));
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=name&order=desc"));
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "descending");
  });

  it("Value and Gain / loss headers request their own sort and reset to ascending", async () => {
    apiGet.mockResolvedValue(list);
    const user = userEvent.setup();
    renderWithProviders(<InvestmentsView />);
    await screen.findAllByText("BBCA");

    await user.click(screen.getByRole("button", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Name" })); // name desc
    await user.click(screen.getByRole("button", { name: "Value" }));
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=value&order=asc"));
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "none");

    await user.click(screen.getByRole("button", { name: "Gain / loss" }));
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=gain&order=asc"));
  });

  it("the mobile control picks the field and flips the direction", async () => {
    apiGet.mockResolvedValue(list);
    const user = userEvent.setup();
    renderWithProviders(<InvestmentsView />);
    await screen.findAllByText("BBCA");

    await user.selectOptions(screen.getByLabelText("Sort by"), "value");
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=value&order=asc"));

    await user.click(screen.getByRole("button", { name: /switch to descending/ }));
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=value&order=desc"));

    await user.selectOptions(screen.getByLabelText("Sort by"), "gain");
    await waitFor(() => expect(lastUrl()).toBe("/investment-accounts?sortBy=gain&order=desc"));

    // Back to the default: the unsorted list is already cached from the first load, so no new request.
    const calls = apiGet.mock.calls.length;
    await user.selectOptions(screen.getByLabelText("Sort by"), "");
    expect(screen.getByLabelText("Sort by")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /switch to/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "none");
    expect(apiGet.mock.calls).toHaveLength(calls);
  });
});

describe("CreateInvestmentAccountModal", () => {
  it("requires a ticker for stocks and sends it", async () => {
    apiPost.mockResolvedValue(account());
    const user = userEvent.setup();
    renderWithProviders(<CreateInvestmentAccountModal onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "BCA");
    await user.click(screen.getByRole("button", { name: "Create investment account" }));
    expect(await screen.findByText("Ticker is required")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Ticker"), "BBCA");
    await user.click(screen.getByRole("button", { name: "Create investment account" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0]).toEqual(["/investment-accounts", { name: "BCA", assetType: "stock", symbol: "BBCA" }]);
  });

  it("hides the ticker for gold", async () => {
    apiPost.mockResolvedValue(account());
    const user = userEvent.setup();
    renderWithProviders(<CreateInvestmentAccountModal onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("Type"), "gold");
    expect(screen.queryByLabelText("Ticker")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Antam");
    await user.click(screen.getByRole("button", { name: "Create investment account" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0]![1]).toEqual({ name: "Antam", assetType: "gold", symbol: undefined });
  });
});

describe("AddInvestmentTransactionModal", () => {
  it("posts a buy with decimal quantity and price", async () => {
    apiPost.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<AddInvestmentTransactionModal account={account({ lastTradedOn: null })} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Quantity/), "2,5");
    await user.type(screen.getByLabelText(/price per share/), "5500");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [path, body] = apiPost.mock.calls[0]!;
    expect(path).toBe("/investment-accounts/1/transactions");
    expect(body).toMatchObject({ side: "buy", quantity: 2.5, unitPrice: 5500 });
  });

  it("blocks selling more than is held", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddInvestmentTransactionModal account={account({ quantity: 10, lastTradedOn: null })} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Sell" }));
    await user.type(screen.getByLabelText(/Quantity/), "11");
    await user.type(screen.getByLabelText(/price per share/), "100");
    await user.click(screen.getByRole("button", { name: "Save transaction" }));
    expect(await screen.findByText("You only hold 10 share")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("limits the date to between the last transaction and today", () => {
    renderWithProviders(<AddInvestmentTransactionModal account={account({ lastTradedOn: "2026-05-10" })} onClose={() => {}} />);
    expect(screen.getByLabelText("Date")).toHaveAttribute("min", "2026-05-10");
    expect(screen.getByLabelText("Date")).toHaveAttribute("max");
  });
});

describe("UpdatePriceModal", () => {
  it("rejects an empty price and saves a valid one", async () => {
    apiPut.mockResolvedValue(account());
    const user = userEvent.setup();
    renderWithProviders(<UpdatePriceModal account={account()} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Save price" }));
    expect(await screen.findByText("Price must be greater than zero")).toBeInTheDocument();
    expect(apiPut).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Current price/), "6500");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith("/investment-accounts/1/price", { price: 6500, date: toIsoDate(new Date()) }),
    );
  });

  it("defaults the date to today, caps it at today, and sends a picked past date", async () => {
    apiPut.mockResolvedValue(account());
    const user = userEvent.setup();
    renderWithProviders(<UpdatePriceModal account={account()} onClose={() => {}} />);
    const today = toIsoDate(new Date());
    const date = screen.getByLabelText("Date") as HTMLInputElement;
    expect(date.value).toBe(today);
    expect(date.max).toBe(today);
    await user.clear(date);
    await user.type(date, "2026-05-01");
    await user.type(screen.getByLabelText(/Current price/), "6000");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/investment-accounts/1/price", { price: 6000, date: "2026-05-01" }),
    );
  });
});

describe("PriceHistoryModal", () => {
  const points = [
    { date: "2026-05-01", price: 5000 },
    { date: "2026-05-10", price: 6500 },
  ];

  it("plots the points, shows the latest price and the average buy price line", async () => {
    apiGet.mockResolvedValue(points);
    renderWithProviders(<PriceHistoryModal account={account()} onClose={() => {}} />);
    expect(await screen.findByRole("img", { name: "Price history, 2 entries" })).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/investment-accounts/1/price-history");
    expect(screen.getAllByText("Rp 6.500").length).toBeGreaterThan(0);
    expect(screen.getByText(/Avg buy price Rp 5\.500/)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows the exact price and date in a tooltip when a point is hovered", async () => {
    apiGet.mockResolvedValue([{ date: "2026-05-01", price: 5150 }, { date: "2026-05-10", price: 6500 }]);
    const user = userEvent.setup();
    renderWithProviders(<PriceHistoryModal account={account()} onClose={() => {}} />);
    await screen.findByRole("img", { name: "Price history, 2 entries" });
    expect(screen.queryByTestId("price-tooltip")).not.toBeInTheDocument();
    await user.hover(screen.getByTestId("point-2026-05-01"));
    const tip = await screen.findByTestId("price-tooltip");
    expect(tip).toHaveTextContent("Rp 5.150");
    expect(tip).toHaveTextContent("1 May 2026");
    await user.unhover(screen.getByTestId("point-2026-05-01"));
    await user.hover(screen.getByTestId("point-2026-05-10"));
    expect(screen.getByTestId("price-tooltip")).toHaveTextContent("Rp 6.500");
  });

  it("hides the average line when nothing is held", async () => {
    apiGet.mockResolvedValue(points);
    renderWithProviders(<PriceHistoryModal account={account({ quantity: 0, totalCost: 0, avgCost: 0 })} onClose={() => {}} />);
    await screen.findByRole("img", { name: "Price history, 2 entries" });
    expect(screen.queryByText(/Avg buy price/)).not.toBeInTheDocument();
  });

  it("renders a single entry as a lone point", async () => {
    apiGet.mockResolvedValue([points[0]]);
    renderWithProviders(<PriceHistoryModal account={account()} onClose={() => {}} />);
    expect(await screen.findByRole("img", { name: "Price history, 1 entry" })).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    apiGet.mockResolvedValue([]);
    renderWithProviders(<PriceHistoryModal account={account()} onClose={() => {}} />);
    expect(await screen.findByText(/No price history yet/)).toBeInTheDocument();
  });
});

describe("InvestmentDetailView price history", () => {
  it("opens the chart from the icon beside the ticker", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path.endsWith("/price-history")) return [{ date: "2026-05-01", price: 5000 }];
      if (path.endsWith("/transactions")) return [];
      return account();
    });
    renderWithProviders(<InvestmentDetailView accountId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Price history" }));
    expect(await screen.findByRole("dialog", { name: /Price history/ })).toBeInTheDocument();
  });
});
