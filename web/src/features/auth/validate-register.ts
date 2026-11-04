export interface RegisterForm {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirm: string;
}

export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  if (!f.firstName.trim()) e.firstName = "First name is required";
  if (!f.lastName.trim()) e.lastName = "Last name is required";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email";
  if (f.password.length < 8) e.password = "Password must be at least 8 characters";
  if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  return e;
}
