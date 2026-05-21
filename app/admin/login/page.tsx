import { SignInForm } from '@/components/admin/SignInForm';

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <h1 className="font-serif italic text-[36px] text-ink mb-2">digital-card</h1>
      <p className="text-[12px] uppercase tracking-[0.12em] mb-8" style={{ color: '#686A6C' }}>Admin</p>
      <SignInForm from={from} />
    </main>
  );
}
