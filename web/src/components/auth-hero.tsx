import type { ReactNode } from 'react';
import { BrandMark } from './icons';

export function AuthHero({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="auth-hero" aria-label="About Financial Tracker">
      <div className="d-flex align-items-center gap-2 fw-bolder fs-5">
        <BrandMark size={32} inverted />
        Financial Tracker
      </div>
      <div className="d-flex flex-column gap-3" style={{ maxWidth: 460 }}>
        <p className="hero-title m-0">{title}</p>
        {children}
      </div>
      <p className="m-0 small" style={{ color: '#C9D4E8' }}>
        Your data is private to your login.
      </p>
    </section>
  );
}
