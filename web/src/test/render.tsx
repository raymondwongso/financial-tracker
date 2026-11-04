import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { makeQueryClient } from "@/lib/query-client";

export function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}
