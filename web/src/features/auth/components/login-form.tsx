"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useLogin } from "../hooks";
import { AuthLayout } from "./auth-layout";

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const banner = params.get("registered")
    ? "Registration successful. Log in to continue."
    : params.get("loggedout")
      ? "You have been logged out."
      : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    login.mutate(
      { email, password },
      {
        onSuccess: () => router.replace("/dashboard"),
        onError: () => setError("Email or password is incorrect."),
      },
    );
  }

  return (
    <AuthLayout title="Log in" banner={banner}>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <TextField label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} error={error} />
        <PrimaryButton type="submit" block icon={<ArrowRight size={18} />} disabled={login.isPending}>
          Log in
        </PrimaryButton>
      </form>
      <p className="mt-6 text-muted">
        No account yet?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
