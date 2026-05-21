'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logoutAction(): Promise<void> {
  (await cookies()).delete('admin_session');
  redirect('/admin/login');
}
