'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Users, MapPin, Settings, Tag, LogOut, Droplets } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardTab } from '@/components/tabs/dashboard-tab';
import { CustomersTab } from '@/components/tabs/customers-tab';
import { RoutesTab } from '@/components/tabs/routes-tab';
import { DiscountsTab } from '@/components/tabs/discounts-tab';
import { SettingsTab } from '@/components/tabs/settings-tab';

type Tab = 'home' | 'customers' | 'routes' | 'discounts' | 'settings';

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { name?: string } } | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (dbUser?.organization_id) {
        setOrgId(dbUser.organization_id);
      } else {
        const { data: org } = await supabase
          .from('organizations')
          .insert({ name: user.user_metadata?.name ? `${user.user_metadata.name}'s Company` : 'My Company' })
          .select()
          .single();

        if (org) {
          await supabase.from('users').insert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || 'Admin',
            role: 'admin',
            organization_id: org.id,
          });
          setOrgId(org.id);
        }
      }
      setLoading(false);
    };
    init();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Droplets className="w-10 h-10 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'home' as Tab, icon: Home, label: 'Home' },
    { id: 'customers' as Tab, icon: Users, label: 'Customers' },
    { id: 'routes' as Tab, icon: MapPin, label: 'Routes' },
    { id: 'discounts' as Tab, icon: Tag, label: 'Discounts' },
    { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="animated-gradient text-white px-4 pt-4 pb-6 shadow-lg sm:rounded-b-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Pooly</h1>
                <p className="text-blue-100 text-xs">
                  {user?.user_metadata?.name || user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-4 pb-24 -mt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'home' && <DashboardTab orgId={orgId!} onNavigate={(tab) => setActiveTab(tab as Tab)} />}
              {activeTab === 'customers' && <CustomersTab orgId={orgId!} />}
              {activeTab === 'routes' && <RoutesTab orgId={orgId!} />}
              {activeTab === 'discounts' && <DiscountsTab orgId={orgId!} />}
              {activeTab === 'settings' && <SettingsTab orgId={orgId!} onLogout={handleLogout} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 px-2 py-1 safe-area-inset-bottom z-40">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center py-2 px-4 rounded-xl transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-blue-50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon
                  size={22}
                  className={`relative z-10 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <span className={`relative z-10 text-[10px] mt-0.5 font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
