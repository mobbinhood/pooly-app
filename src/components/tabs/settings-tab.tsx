'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTechnicians } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Building2, Users, CreditCard, Bell, LogOut, Plus, Trash2, Shield, Loader2, Save, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function SettingsTab({ orgId, onLogout }: { orgId: string; onLogout: () => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = [
    { id: 'company', label: 'Company Profile', icon: Building2, desc: 'Name and business info' },
    { id: 'team', label: 'Team Members', icon: Users, desc: 'Manage technicians' },
    { id: 'billing', label: 'Billing & Stripe', icon: CreditCard, desc: 'Payment configuration' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alerts and reminders' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#1A1A2E]">Settings</h2>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {sections.map((section, i) => (
          <motion.button
            key={section.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveSection(section.id)}
            className="w-full px-4 py-3.5 flex items-center gap-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition text-left"
          >
            <div className="w-9 h-9 bg-[#F1F5F9] rounded-lg flex items-center justify-center">
              <section.icon size={16} className="text-[#64748B]" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[#1A1A2E] text-sm">{section.label}</p>
              <p className="text-xs text-[#94A3B8]">{section.desc}</p>
            </div>
            <ChevronRight size={14} className="text-[#CBD5E1]" />
          </motion.button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <button
          onClick={onLogout}
          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[#EF4444]/5 transition text-left"
        >
          <div className="w-9 h-9 bg-[#EF4444]/8 rounded-lg flex items-center justify-center">
            <LogOut size={16} className="text-[#EF4444]" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-[#EF4444] text-sm">Sign Out</p>
            <p className="text-xs text-[#94A3B8]">Log out of your account</p>
          </div>
        </button>
      </div>

      {activeSection === 'company' && <CompanyProfileModal orgId={orgId} onClose={() => setActiveSection(null)} />}
      {activeSection === 'team' && <TeamMembersModal orgId={orgId} onClose={() => setActiveSection(null)} />}
      {activeSection === 'billing' && <BillingModal orgId={orgId} onClose={() => setActiveSection(null)} />}
      {activeSection === 'notifications' && <NotificationsModal onClose={() => setActiveSection(null)} />}
    </div>
  );
}

const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

function CompanyProfileModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('organizations').select('name').eq('id', orgId).single().then(({ data }) => {
      if (data) setName(data.name);
    });
  }, [orgId, supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('organizations').update({ name }).eq('id', orgId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Company profile updated'); onClose(); }
  };

  return (
    <Modal open onClose={onClose} title="Company Profile" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Company Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>
    </Modal>
  );
}

function TeamMembersModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const { data: technicians } = useTechnicians(orgId);
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName || !newEmail) return;
    setAdding(true);
    const { error } = await supabase.from('users').insert({
      email: newEmail,
      name: newName,
      role: 'technician' as const,
      organization_id: orgId,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Technician added');
      setShowAdd(false);
      setNewName('');
      setNewEmail('');
      queryClient.invalidateQueries({ queryKey: ['technicians', orgId] });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('users').delete().eq('id', deleteTarget);
    if (error) toast.error(error.message);
    else {
      toast.success('Team member removed');
      queryClient.invalidateQueries({ queryKey: ['technicians', orgId] });
    }
    setDeleteTarget(null);
  };

  return (
    <Modal open onClose={onClose} title="Team Members" size="md">
      <div className="space-y-4">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-full py-2.5 border-2 border-dashed border-[#E2E8F0] rounded-lg text-sm text-[#64748B] hover:border-[#0066FF]/40 hover:text-[#0066FF] transition flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Add Team Member
        </button>

        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-[#F8FAFC] rounded-lg p-4 space-y-3"
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className={inputClass} />
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email address" type="email" className={inputClass} />
            <button
              onClick={handleAdd}
              disabled={adding || !newName || !newEmail}
              className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding && <Loader2 size={14} className="animate-spin" />}
              Add Technician
            </button>
          </motion.div>
        )}

        <div className="divide-y divide-[#F1F5F9]">
          {technicians?.map(tech => (
            <div key={tech.id} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-[#0066FF]/8 text-[#0066FF] flex items-center justify-center font-semibold text-sm">
                {tech.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1A1A2E]">{tech.name}</p>
                <p className="text-xs text-[#94A3B8]">{tech.email} · {tech.role}</p>
              </div>
              {tech.role !== 'admin' && (
                <button
                  onClick={() => setDeleteTarget(tech.id)}
                  className="p-1.5 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {!technicians?.length && (
            <p className="text-sm text-[#94A3B8] text-center py-4">No team members yet</p>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Remove Team Member"
          message="This will remove the team member from your organization."
          confirmLabel="Remove"
        />
      </div>
    </Modal>
  );
}

function BillingModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const supabase = createClient();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('organizations').select('stripe_account_id').eq('id', orgId).single().then(({ data }) => {
      setStripeAccountId(data?.stripe_account_id ?? null);
      setLoading(false);
    });
  }, [orgId, supabase]);

  const isConnected = !!stripeAccountId;

  return (
    <Modal open onClose={onClose} title="Billing & Stripe" size="md">
      <div className="space-y-4">
        <div className="bg-[#0066FF]/5 rounded-lg p-4 border border-[#0066FF]/10">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-[#0066FF]" />
            <p className="font-medium text-[#1A1A2E] text-sm">Stripe Integration</p>
          </div>
          <p className="text-sm text-[#64748B]">
            Connect your Stripe account to process payments and manage subscriptions for your customers.
          </p>
        </div>
        <div className="bg-[#F8FAFC] rounded-lg p-4">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#94A3B8]" />
              <span className="text-sm text-[#64748B]">Checking status...</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#64748B]">
                Status:{' '}
                <span className={`font-medium ${isConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </p>
              {isConnected && (
                <p className="text-xs text-[#94A3B8] mt-1">Account: {stripeAccountId}</p>
              )}
              <button className="mt-3 px-4 py-2 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition">
                {isConnected ? 'Manage Stripe Account' : 'Connect Stripe Account'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

const NOTIFICATION_DEFAULTS: { key: string; label: string; desc: string; default: boolean }[] = [
  { key: 'route_reminders', label: 'Route reminders', desc: 'Morning notifications for daily routes', default: true },
  { key: 'service_alerts', label: 'Service alerts', desc: 'When chemical readings are out of range', default: true },
  { key: 'new_customer', label: 'New customer', desc: 'When a customer signs up via onboarding', default: false },
  { key: 'payment_received', label: 'Payment received', desc: 'Confirmation of subscription payments', default: true },
];

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('notification_prefs');
    if (saved) return JSON.parse(saved);
    return Object.fromEntries(NOTIFICATION_DEFAULTS.map(n => [n.key, n.default]));
  });

  const toggle = (key: string) => {
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('notification_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <Modal open onClose={onClose} title="Notifications" size="sm">
      <div className="space-y-1">
        {NOTIFICATION_DEFAULTS.map((notif) => {
          const enabled = prefs[notif.key] ?? notif.default;
          return (
            <div key={notif.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[#1A1A2E]">{notif.label}</p>
                <p className="text-xs text-[#94A3B8]">{notif.desc}</p>
              </div>
              <button
                onClick={() => toggle(notif.key)}
                className={`w-10 h-5.5 rounded-full transition-colors relative ${enabled ? 'bg-[#0066FF]' : 'bg-[#CBD5E1]'}`}
              >
                <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
