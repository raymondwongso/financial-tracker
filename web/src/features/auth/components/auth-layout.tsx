import type { ReactNode } from "react";

export function AuthLayout({ title, banner, children }: { title: string; banner?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        {banner && (
          <p role="status" className="mb-5 bg-ink px-4 py-3 font-semibold text-bg">
            {banner}
          </p>
        )}
        <h1 className="border-b-2 border-ink pb-5 text-4xl font-extrabold tracking-[-0.02em]">{title}</h1>
        {children}
      </div>
    </main>
  );
}
