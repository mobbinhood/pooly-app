import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#94A3B8]" />
      </div>
      <h3 className="text-base font-semibold text-[#1A1A2E] mb-1">{title}</h3>
      <p className="text-sm text-[#64748B] max-w-xs mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
