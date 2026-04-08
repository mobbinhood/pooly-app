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
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {sections.map((section, i) => (
          <motion.button
            key={section.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveSection(section.id)}
            className="w-full px-4 py-4 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition text-left"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <section.icon size={18} className="text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{section.label}</p>
              <p className="text-xs text-gray-500">{section.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </motion.button>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={onLogout}
          className="w-full px-4 py-4 flex items-center gap-3 hover:bg-red-50/50 transition text-left"
        >
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-600 text-sm">Sign Out</p>
            <p className="text-xs text-gray-500">Log out of your account</p>
          </div>
        </button>
      </div>

      {/* Company Profile */}
      {activeSection === 'company' && (
        <CompanyProfileModal orgId={orgId} onClose={() => setActiveSection(null)} />
      )}

      {/* Team Members */}
      {activeSection === 'team' && (
        <TeamMembersModal orgId={orgId} onClose={() => setActiveSection(null)} />
      )}

      {/* Billing */}
      {activeSection === 'billing' && (
        <BillingModal orgId={orgId} onClose={() => setActiveSection(null)} />
      )}

      {/* Notifications */}
      {activeSection === 'notifications' && (
        <NotificationsModal onClose={() => setActiveSection(null)} />
      )}
    </div>
  );
}

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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
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
          className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Add Team Member
        </button>

        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-50 rounded-xl p-4 space-y-3"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName || !newEmail}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding && <Loader2 size={14} className="animate-spin" />}
              Add Technician
            </button>
          </motion.div>
        )}

        <div className="divide-y divide-gray-100">
          {technicians?.map(tech => (
            <div key={tech.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {tech.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{tech.name}</p>
                <p className="text-xs text-gray-500">{tech.email} · {tech.role}</p>
              </div>
              {tech.role !== 'admin' && (
                <button
                  onClick={() => setDeleteTarget(tech.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {!technicians?.length && (
            <p className="text-sm text-gray-400 text-center py-4">No team members yet</p>
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
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-blue-600" />
            <p className="font-medium text-blue-900 text-sm">Stripe Integration</p>
          </div>
          <p className="text-sm text-blue-700">
            Connect your Stripe account to process payments and manage subscriptions for your customers.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Checking status...</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Status:{' '}
                <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-orange-600'}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </p>
              {isConnected && (
                <p className="text-xs text-gray-500 mt-1">Account: {stripeAccountId}</p>
              )}
              <button className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition">
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
      <div className="space-y-4">
        {NOTIFICATION_DEFAULTS.map((notif) => {
          const enabled = prefs[notif.key] ?? notif.default;
          return (
            <div key={notif.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{notif.label}</p>
                <p className="text-xs text-gray-500">{notif.desc}</p>
              </div>
              <button
                onClick={() => toggle(notif.key)}
                className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
