import type { Metadata } from 'next';
import { AuthHero } from '@/components/auth-hero';
import { CheckIcon } from '@/components/icons';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create account' };

const FEATURES = [
  'Multiple accounts and currencies',
  'Monthly summaries by account and category',
  'An assistant that records things for you',
];

export default function RegisterPage() {
  return (
    <div className="d-flex flex-wrap min-vh-100">
      <AuthHero title="Start tracking in under a minute.">
        <ul className="list-unstyled m-0 d-flex flex-column gap-2" style={{ color: '#DCE3EE' }}>
          {FEATURES.map((f) => (
            <li key={f} className="d-flex align-items-center gap-2">
              <CheckIcon stroke="#BFD3FF" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
      </AuthHero>
      <main className="auth-form">
        <div>
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
