import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecimalInput } from "./decimal-input";

afterEach(cleanup);

function Harness({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState("");
  return <DecimalInput id="q" value={value} maxDecimals={6} onChange={(v) => { setValue(v); onValue(v); }} />;
}

describe("DecimalInput", () => {
  it("shows thousand separators while keeping a plain value", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "1250000");
    expect(input).toHaveValue("1.250.000");
    expect(onValue).toHaveBeenLastCalledWith("1250000");
  });

  it("accepts a comma as the decimal separator", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "1250,5");
    expect(input).toHaveValue("1.250,5");
    expect(onValue).toHaveBeenLastCalledWith("1250.5");
  });
});
