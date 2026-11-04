"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { useRegister } from "../hooks";
import { validateRegister, type RegisterErrors, type RegisterForm as Form } from "../validate-register";
import { AuthLayout } from "./auth-layout";

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const [form, setForm] = useState<Form>({ email: "", firstName: "", lastName: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<RegisterErrors>({});

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateRegister(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    register.mutate(
      { email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), password: form.password },
      {
        onSuccess: () => router.replace(`/login?registered=1&email=${encodeURIComponent(form.email.trim())}`),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setErrors({ email: "Email already registered" });
          else setErrors({ email: err.message });
        },
      },
    );
  }

  return (
    <AuthLayout title="Register">
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <TextField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
          <TextField label="First name" name="firstName" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
          <TextField label="Last name" name="lastName" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
        </div>
        <TextField label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={set("password")} error={errors.password} />
        <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />
        <PrimaryButton type="submit" block icon={<ArrowRight size={18} />} disabled={register.isPending}>
          Register
        </PrimaryButton>
      </form>
      <p className="mt-6 text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
