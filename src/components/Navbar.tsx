'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlayCircle, User, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't show navbar on questionnaire or login (clean landing)
  if (pathname === '/' || pathname === '/login') return null;

  const navItems = session 
    ? [
        { name: 'Sesión', href: '/sesion', icon: PlayCircle },
        { name: 'Clínico', href: '/neurologo', icon: Activity },
        { name: 'Perfil', href: '/perfil', icon: User },
      ]
    : [
        { name: 'Entrar', href: '/login', icon: User },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0E1A]/80 backdrop-blur-lg border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-colors duration-200",
                isActive ? "text-[#7B9CFF]" : "text-gray-400 hover:text-gray-200"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{item.name}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-[#7B9CFF] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
