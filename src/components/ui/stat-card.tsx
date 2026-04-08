'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'red';
  delay?: number;
}

const colorMap = {
  blue: { bg: 'bg-[#0066FF]/8', icon: 'text-[#0066FF]' },
  green: { bg: 'bg-[#10B981]/8', icon: 'text-[#10B981]' },
  amber: { bg: 'bg-[#F59E0B]/8', icon: 'text-[#F59E0B]' },
  red: { bg: 'bg-[#EF4444]/8', icon: 'text-[#EF4444]' },
};

export function StatCard({ label, value, icon: Icon, color = 'blue', delay = 0 }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl p-4 border border-[#E2E8F0]"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#64748B]">{label}</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1 tabular-nums">{value}</p>
        </div>
        <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
    </motion.div>
  );
}
