'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Questionnaire from '@/components/Questionnaire';
import { motion } from 'framer-motion';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        // Not logged in -> Redirect to Login
        router.push('/login');
        return;
      }

      setUser(authUser);

      // Logged in -> Check if profile exists
      const { data: profile } = await supabase
        .from('user_profile')
        .select('plan')
        .eq('id', authUser.id)
        .single();

      if (profile?.plan) {
        // Has profile -> Go to session
        router.push('/sesion');
      } else {
        // No profile -> Show Questionnaire
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-[#7B9CFF] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#7B9CFF] font-light animate-pulse tracking-widest text-xs uppercase">Sincronizando...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Questionnaire />
    </main>
  );
}
