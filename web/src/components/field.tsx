import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

/** Labelled Bootstrap input with inline validation message. */
export function Field({ label, name, error, hint, className, ...input }: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="form-label fw-bold small mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`form-control${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error ? (
        <div id={`${name}-error`} className="invalid-feedback">
          {error}
        </div>
      ) : hint ? (
        <div id={`${name}-hint`} className="form-text">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
