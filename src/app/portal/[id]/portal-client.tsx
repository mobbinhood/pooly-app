'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Send, Loader2, CheckCircle2, MessageSquare, Star, Share2, Check } from 'lucide-react';

export function CollapsibleSection({ title, icon, badge, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 mb-3 text-left"
      >
        <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2 flex-1">
          {icon}
          {title}
          {badge}
        </h3>
        {open ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
      </button>
      {open && children}
    </section>
  );
}

export function ServiceRequestForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, title: title.trim(), description: description.trim() || undefined, priority }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTitle('');
        setDescription('');
        setPriority('normal');
        setTimeout(() => { setSubmitted(false); setOpen(false); }, 3000);
      }
    } catch { /* silently fail */ }
    finally { setSubmitting(false); }
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Request Submitted</p>
          <p className="text-xs text-emerald-600 mt-0.5">Your service team will review it shortly.</p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 bg-[#0066FF] text-white rounded-xl text-sm font-medium hover:bg-[#0052CC] transition flex items-center justify-center gap-2"
      >
        <MessageSquare size={16} />
        Request Service
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
          <MessageSquare size={16} className="text-[#0066FF]" />
          Request Service
        </h3>
        <button onClick={() => setOpen(false)} className="text-xs text-[#94A3B8] hover:text-[#64748B]">Cancel</button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">What do you need?</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Filter repair, Green water, Equipment check"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Details (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={inputClass + ' resize-none'}
            rows={3}
            placeholder="Describe the issue or what you need..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Urgency</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high', 'urgent'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition border ${
                  priority === p
                    ? p === 'urgent' ? 'bg-red-50 border-red-300 text-red-600'
                      : p === 'high' ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : p === 'normal' ? 'bg-blue-50 border-blue-300 text-[#0066FF]'
                      : 'bg-slate-50 border-slate-300 text-slate-600'
                    : 'bg-white border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit Request
        </button>
      </form>
    </div>
  );
}

export function SharePortalButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Pool Portal', url });
        return;
      } catch { /* user cancelled or not supported */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0066FF] transition"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Share2 size={12} />}
      {copied ? 'Link copied!' : 'Share this portal'}
    </button>
  );
}

const EMOJI_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'] as const;

export function ServiceFeedbackWidget({ customerId, serviceLogId }: { customerId: string; serviceLogId: string }) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          service_log_id: serviceLogId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch { /* silently fail */ }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Thanks for your feedback!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Your rating helps us improve our service.</p>
        </div>
      </div>
    );
  }

  const displayRating = hoveredStar || rating;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9]">
        <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
          <Star size={16} className="text-amber-500" />
          Rate Your Last Service
        </h3>
        <p className="text-xs text-[#64748B] mt-0.5">How was your recent pool service?</p>
      </div>
      <div className="p-4 space-y-3">
        {/* Star Rating */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className={`transition-colors ${
                    star <= displayRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-[#E2E8F0]'
                  }`}
                />
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p className="text-xs font-medium text-[#64748B]">
              {EMOJI_LABELS[displayRating - 1]}
            </p>
          )}
        </div>

        {/* Optional Comment */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Comments (optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className={inputClass + ' resize-none'}
            rows={2}
            placeholder="Any feedback about your service..."
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit Feedback
        </button>
      </div>
    </div>
  );
}
