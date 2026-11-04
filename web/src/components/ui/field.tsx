import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full border-2 border-ink bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-muted focus:border-primary";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, error, children, htmlFor }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-[13px] text-expense-text">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, ...rest }: TextFieldProps) {
  const inputId = id ?? rest.name;
  return (
    <Field label={label} error={error} htmlFor={inputId}>
      <input id={inputId} className={inputClass} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}
