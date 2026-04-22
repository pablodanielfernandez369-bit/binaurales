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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else if (session.user) {
        checkProfile(session.user);
      }
    });

    async function checkProfile(authUser: any) {
      setUser(authUser);
      const { data: profile } = await supabase
        .from('user_profile')
        .select('plan')
        .eq('id', authUser.id)
        .single();

      if (profile?.plan) {
        router.push('/sesion');
      } else {
        setLoading(false);
      }
    }

    // Initial check
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) {
        router.push('/login');
      } else {
        checkProfile(authUser);
      }
    });

    return () => subscription.unsubscribe();
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
