import Questionnaire from '@/components/Questionnaire';
import { supabase, FIXED_USER_ID } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function Home() {
  // Check if profile exists
  const { data: profile } = await supabase
    .from('user_profile')
    .select('plan')
    .eq('id', FIXED_USER_ID)
    .single();

  // If user already has a plan, redirect to session (or dashboard)
  if (profile?.plan) {
    redirect('/sesion'); 
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Questionnaire />
    </main>
  );
}
