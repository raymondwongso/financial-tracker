import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
const apiPost = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiGet: vi.fn(),
}));

import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

beforeEach(() => {
  replace.mockReset();
  apiPost.mockReset();
  search = new URLSearchParams();
});
afterEach(cleanup);

describe("LoginForm", () => {
  it("shows banners and prefills the email after registration", () => {
    search = new URLSearchParams("registered=1&email=a%40b.co");
    renderWithProviders(<LoginForm />);
    expect(screen.getByText("Registration successful. Log in to continue.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.co");
  });

  it("shows the logged-out banner", () => {
    search = new URLSearchParams("loggedout=1");
    renderWithProviders(<LoginForm />);
    expect(screen.getByText("You have been logged out.")).toBeInTheDocument();
  });

  it("shows a generic error on bad credentials", async () => {
    apiPost.mockRejectedValue(new ApiError(401, "Email or password is incorrect."));
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("goes to the dashboard on success", async () => {
    apiPost.mockResolvedValue({ id: 1, email: "a@b.co", firstName: "A", lastName: "B" });
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(apiPost).toHaveBeenCalledWith("/auth/login", { email: "a@b.co", password: "password1" });
  });
});

describe("RegisterForm", () => {
  it("validates on submit and clears an error when the field is edited", async () => {
    renderWithProviders(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: /register/i }));
    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("First name"), "A");
    expect(screen.queryByText("First name is required")).not.toBeInTheDocument();
  });

  it("reports an already-registered email", async () => {
    apiPost.mockRejectedValue(new ApiError(409, "Email already registered"));
    renderWithProviders(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("First name"), "A");
    await userEvent.type(screen.getByLabelText("Last name"), "B");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));
    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
  });

  it("redirects to login with the email on success", async () => {
    apiPost.mockResolvedValue({ id: 1 });
    renderWithProviders(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("First name"), "A");
    await userEvent.type(screen.getByLabelText("Last name"), "B");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?registered=1&email=a%40b.co"));
  });
});
