'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Users, MapPin, Settings, Tag, LogOut, Droplets, FileText, Package, Wrench, MoreHorizontal, X, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardTab } from '@/components/tabs/dashboard-tab';
import { CustomersTab } from '@/components/tabs/customers-tab';
import { RoutesTab } from '@/components/tabs/routes-tab';
import { DiscountsTab } from '@/components/tabs/discounts-tab';
import { SettingsTab } from '@/components/tabs/settings-tab';
import { InvoicesTab } from '@/components/tabs/invoices-tab';
import { InventoryTab } from '@/components/tabs/inventory-tab';
import { WorkOrdersTab } from '@/components/tabs/work-orders-tab';
import { BroadcastTab } from '@/components/tabs/broadcast-tab';

type Tab = 'home' | 'customers' | 'routes' | 'discounts' | 'settings' | 'invoices' | 'inventory' | 'work-orders' | 'broadcast';

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showMore, setShowMore] = useState(false);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Droplets className="w-8 h-8 text-[#0066FF]" />
        </motion.div>
      </div>
    );
  }

  const bottomTabs = [
    { id: 'home' as Tab, icon: Home, label: 'Home' },
    { id: 'customers' as Tab, icon: Users, label: 'Customers' },
    { id: 'routes' as Tab, icon: MapPin, label: 'Routes' },
    { id: 'invoices' as Tab, icon: FileText, label: 'Invoices' },
  ];

  const moreMenuTabs = [
    { id: 'work-orders' as Tab, icon: Wrench, label: 'Work Orders' },
    { id: 'inventory' as Tab, icon: Package, label: 'Inventory' },
    { id: 'broadcast' as Tab, icon: Send, label: 'Broadcast' },
    { id: 'discounts' as Tab, icon: Tag, label: 'Discounts' },
    { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ];

  const isMoreTab = moreMenuTabs.some(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="bg-white border-b border-[#E2E8F0] px-5 pt-4 pb-4 sm:rounded-b-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#0066FF] rounded-lg flex items-center justify-center">
                <Droplets className="text-white" size={18} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A2E]">Pooly</h1>
                <p className="text-[#64748B] text-xs">
                  {user?.user_metadata?.name || user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-[#F8FAFC] rounded-lg transition text-[#64748B]"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-5 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'home' && <DashboardTab orgId={orgId!} onNavigate={(tab) => setActiveTab(tab as Tab)} />}
              {activeTab === 'customers' && <CustomersTab orgId={orgId!} />}
              {activeTab === 'routes' && <RoutesTab orgId={orgId!} />}
              {activeTab === 'invoices' && <InvoicesTab orgId={orgId!} />}
              {activeTab === 'inventory' && <InventoryTab orgId={orgId!} />}
              {activeTab === 'work-orders' && <WorkOrdersTab orgId={orgId!} />}
              {activeTab === 'broadcast' && <BroadcastTab orgId={orgId!} />}
              {activeTab === 'discounts' && <DiscountsTab orgId={orgId!} />}
              {activeTab === 'settings' && <SettingsTab orgId={orgId!} onLogout={handleLogout} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed bottom-[72px] left-4 right-4 max-w-lg mx-auto bg-white rounded-xl shadow-lg border border-[#E2E8F0] z-50 overflow-hidden safe-area-inset-bottom"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
                <span className="text-sm font-semibold text-[#1A1A2E]">More</span>
                <button onClick={() => setShowMore(false)} className="p-1 hover:bg-[#F8FAFC] rounded-lg transition">
                  <X size={16} className="text-[#94A3B8]" />
                </button>
              </div>
              {moreMenuTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setShowMore(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition ${isActive ? 'bg-[#0066FF]/5' : 'hover:bg-[#F8FAFC]'}`}
                  >
                    <tab.icon size={18} className={isActive ? 'text-[#0066FF]' : 'text-[#94A3B8]'} />
                    <span className={`text-sm font-medium ${isActive ? 'text-[#0066FF]' : 'text-[#1A1A2E]'}`}>{tab.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-2 py-1.5 safe-area-inset-bottom z-40">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {bottomTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowMore(false); }}
                className="relative flex flex-col items-center py-1.5 px-4 rounded-lg transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-[#0066FF]/5 rounded-lg"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon
                  size={20}
                  className={`relative z-10 transition-colors ${isActive ? 'text-[#0066FF]' : 'text-[#94A3B8]'}`}
                />
                <span className={`relative z-10 text-[10px] mt-0.5 font-medium transition-colors ${isActive ? 'text-[#0066FF]' : 'text-[#94A3B8]'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="relative flex flex-col items-center py-1.5 px-4 rounded-lg transition-all"
          >
            {isMoreTab && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-[#0066FF]/5 rounded-lg"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <MoreHorizontal
              size={20}
              className={`relative z-10 transition-colors ${isMoreTab || showMore ? 'text-[#0066FF]' : 'text-[#94A3B8]'}`}
            />
            <span className={`relative z-10 text-[10px] mt-0.5 font-medium transition-colors ${isMoreTab || showMore ? 'text-[#0066FF]' : 'text-[#94A3B8]'}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
