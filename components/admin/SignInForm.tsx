'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/app/admin/login/actions';

type State = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 rounded-pill bg-ink text-white font-semibold uppercase tracking-wider-12 text-[14px] disabled:opacity-50"
    >
      {pending ? 'Signing in…' : 'SIGN IN'}
    </button>
  );
}

export function SignInForm({ from }: { from?: string }) {
  const [state, action] = useFormState<State, FormData>(loginAction, {});
  return (
    <form action={action} className="w-full max-w-[360px] flex flex-col gap-4">
      {from && <input type="hidden" name="from" value={from} />}
      <label className="flex flex-col gap-2">
        <span className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 px-4 border border-ink rounded-pill text-ink"
        />
      </label>
      {state.error && <p className="text-[12px]" style={{ color: '#b00020' }}>{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
