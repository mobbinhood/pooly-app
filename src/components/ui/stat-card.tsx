'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan';
  trend?: { value: number; label: string };
  delay?: number;
}

const colorMap = {
  blue: { bg: 'bg-blue-500/10', icon: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600', border: 'border-emerald-100' },
  purple: { bg: 'bg-purple-500/10', icon: 'text-purple-600', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-500/10', icon: 'text-orange-600', border: 'border-orange-100' },
  cyan: { bg: 'bg-cyan-500/10', icon: 'text-cyan-600', border: 'border-cyan-100' },
};

export function StatCard({ label, value, icon: Icon, color, trend, delay = 0 }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border ${c.border} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </motion.div>
  );
}
