import type { Metadata } from 'next';
import { AuthHero } from '@/components/auth-hero';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div className="d-flex flex-wrap min-vh-100">
      <AuthHero title="Know where every dollar goes.">
        <p className="hero-copy m-0">
          Track accounts, record income and expenses, and see your month at a glance — or just tell
          the assistant what happened.
        </p>
      </AuthHero>
      <main className="auth-form">
        <div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
