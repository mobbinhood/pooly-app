'use client';

import { useState } from 'react';
import { useCustomers } from '@/lib/hooks';
import { Send, Mail, MessageSquare, Tag, Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type Channel = 'email' | 'sms';

export function BroadcastTab({ orgId }: { orgId: string }) {
  const { data: customers } = useCustomers(orgId);
  const [channel, setChannel] = useState<Channel>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const allTags = Array.from(new Set(customers?.flatMap(c => c.tags ?? []) ?? [])).sort();

  const recipientCount = customers?.filter(c => {
    const hasContact = channel === 'email' ? !!c.email : !!c.phone;
    const matchesTag = selectedTags.length === 0 || (c.tags ?? []).some(t => selectedTags.includes(t));
    return hasContact && matchesTag;
  }).length ?? 0;

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Message is required'); return; }
    if (channel === 'email' && !subject.trim()) { toast.error('Subject is required for email'); return; }
    if (recipientCount === 0) { toast.error('No recipients match your criteria'); return; }

    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          subject: subject.trim(),
          message: message.trim(),
          filter_tags: selectedTags.length > 0 ? selectedTags : undefined,
          channel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(`Broadcast sent to ${data.sent} ${channel === 'email' ? 'emails' : 'phones'}`);
        setSubject('');
        setMessage('');
        setSelectedTags([]);
      } else {
        toast.error(data.error || 'Failed to send broadcast');
      }
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Broadcast Message</h2>
      </div>

      {/* Channel Toggle */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-1 flex gap-1">
        <button
          onClick={() => setChannel('email')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${channel === 'email' ? 'bg-[#0066FF] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
        >
          <Mail size={14} />
          Email
        </button>
        <button
          onClick={() => setChannel('sms')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${channel === 'sms' ? 'bg-[#0066FF] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
        >
          <MessageSquare size={14} />
          SMS
        </button>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-[#64748B]" />
            <span className="text-xs font-medium text-[#64748B]">Filter by tags (optional)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${selectedTags.includes(tag) ? 'bg-[#0066FF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipients Count */}
      <div className="bg-[#F8FAFC] rounded-lg px-4 py-3 flex items-center gap-2 border border-[#E2E8F0]">
        <Users size={14} className="text-[#64748B]" />
        <span className="text-sm text-[#64748B]">
          <strong className="text-[#1A1A2E]">{recipientCount}</strong> {recipientCount === 1 ? 'recipient' : 'recipients'} will receive this {channel}
        </span>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
        {channel === 'email' && (
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
              placeholder="Important update from your pool service..."
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${inputClass} min-h-[120px] resize-y`}
            placeholder={channel === 'email' ? 'Write your email message...' : 'Write your SMS message (160 char recommended)...'}
          />
          {channel === 'sms' && (
            <p className="text-xs text-[#94A3B8] mt-1">{message.length}/160 characters</p>
          )}
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={sending || recipientCount === 0}
        className="w-full py-3 bg-[#0066FF] text-white rounded-xl font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {sending ? 'Sending...' : `Send ${channel === 'email' ? 'Email' : 'SMS'} to ${recipientCount} recipients`}
      </button>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#10B981]" />
            <span className="text-sm font-medium text-[#1A1A2E]">Broadcast Complete</span>
          </div>
          <div className="text-sm text-[#64748B] space-y-1">
            <p>Sent: <strong className="text-[#10B981]">{result.sent}</strong></p>
            {result.failed > 0 && (
              <p className="flex items-center gap-1">
                <AlertCircle size={12} className="text-[#EF4444]" />
                Failed: <strong className="text-[#EF4444]">{result.failed}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
