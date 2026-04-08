'use client';

import { useState, useRef } from 'react';
import { useServiceLogs, useCustomers, useRevenueData } from '@/lib/hooks';
import { FileDown, Loader2, FileText, Beaker, DollarSign, Printer } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/lib/supabase';

type ReportType = 'service-history' | 'chemical-readings' | 'revenue';

type ServiceLog = Database['public']['Tables']['service_logs']['Row'] & {
  customers: { name: string };
  users: { name: string } | null;
};

export function ReportsTab({ orgId }: { orgId: string }) {
  const { data: serviceLogs } = useServiceLogs();
  const { data: customers } = useCustomers(orgId);
  const { data: revenue } = useRevenueData(orgId);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return format(d, 'yyyy-MM-dd');
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const printRef = useRef<HTMLDivElement>(null);

  const reports = [
    { id: 'service-history' as ReportType, label: 'Service History', desc: 'All service logs with dates, technicians and notes', icon: FileText, color: '#0066FF' },
    { id: 'chemical-readings' as ReportType, label: 'Chemical Readings', desc: 'pH, chlorine, alkalinity, CYA and more', icon: Beaker, color: '#10B981' },
    { id: 'revenue' as ReportType, label: 'Revenue Summary', desc: 'Monthly revenue, customer breakdown', icon: DollarSign, color: '#F59E0B' },
  ];

  const filteredLogs = (serviceLogs ?? []).filter(log =>
    log.service_date >= dateFrom && log.service_date <= dateTo
  );

  const handleExport = () => {
    if (!printRef.current) return;
    setGenerating(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setGenerating(false);
      return;
    }

    const content = printRef.current.innerHTML;
    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<title>Pooly Report - ${selectedReport}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1A1A2E; padding: 24px; font-size: 12px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin-bottom: 12px; color: #64748B; font-weight: 500; }
  .subtitle { color: #64748B; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; padding: 8px; background: #F8FAFC; border-bottom: 2px solid #E2E8F0; font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
  .section { margin-bottom: 24px; }
  .stat { display: inline-block; margin-right: 24px; }
  .stat-label { font-size: 10px; text-transform: uppercase; color: #94A3B8; }
  .stat-value { font-size: 18px; font-weight: 700; }
  .good { color: #10B981; }
  .warn { color: #F59E0B; }
  .bad { color: #EF4444; }
  .header { border-bottom: 2px solid #0066FF; padding-bottom: 12px; margin-bottom: 20px; }
  @media print { body { padding: 0; } }
</style>
</head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      setGenerating(false);
    };
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  const phStatus = (v: number | null) => {
    if (v === null) return '';
    return v >= 7.2 && v <= 7.8 ? 'good' : 'warn';
  };
  const clStatus = (v: number | null) => {
    if (v === null) return '';
    return v >= 1.0 && v <= 3.0 ? 'good' : 'warn';
  };
  const alkStatus = (v: number | null) => {
    if (v === null) return '';
    return v >= 80 && v <= 120 ? 'good' : 'warn';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#1A1A2E]">Export Reports</h2>

      {/* Report Type Selection */}
      <div className="space-y-2">
        {reports.map(report => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition text-left ${
              selectedReport === report.id ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
            }`}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${report.color}12` }}>
              <report.icon size={16} style={{ color: report.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1A1A2E]">{report.label}</p>
              <p className="text-xs text-[#94A3B8]">{report.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {selectedReport && (
        <>
          {/* Date Range */}
          {selectedReport !== 'revenue' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <label className="block text-xs font-medium text-[#64748B] mb-2">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">{filteredLogs.length} records found</p>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={generating}
            className="w-full py-3 bg-[#0066FF] text-white rounded-xl font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {generating ? 'Generating...' : 'Export to PDF'}
          </button>
        </>
      )}

      {/* Hidden Printable Content */}
      <div className="hidden">
        <div ref={printRef}>
          {selectedReport === 'service-history' && (
            <ServiceHistoryReport logs={filteredLogs as ServiceLog[]} dateFrom={dateFrom} dateTo={dateTo} />
          )}
          {selectedReport === 'chemical-readings' && (
            <ChemicalReadingsReport logs={filteredLogs as ServiceLog[]} dateFrom={dateFrom} dateTo={dateTo} phStatus={phStatus} clStatus={clStatus} alkStatus={alkStatus} />
          )}
          {selectedReport === 'revenue' && (
            <RevenueReport revenue={revenue} customerCount={customers?.length ?? 0} />
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceHistoryReport({ logs, dateFrom, dateTo }: {
  logs: ServiceLog[];
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <div>
      <div className="header">
        <h1>Service History Report</h1>
        <p className="subtitle">{format(new Date(dateFrom + 'T12:00:00'), 'MMM d, yyyy')} — {format(new Date(dateTo + 'T12:00:00'), 'MMM d, yyyy')} · {logs.length} services</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Technician</th>
            <th>pH</th>
            <th>Cl</th>
            <th>Alk</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{format(new Date(log.service_date + 'T12:00:00'), 'MM/dd/yy')}</td>
              <td>{log.customers?.name ?? '—'}</td>
              <td>{log.users?.name ?? '—'}</td>
              <td>{log.ph_level?.toFixed(1) ?? '—'}</td>
              <td>{log.chlorine_level?.toFixed(1) ?? '—'}</td>
              <td>{log.alkalinity ?? '—'}</td>
              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '10px', color: '#94A3B8' }}>Generated by Pooly on {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
    </div>
  );
}

function ChemicalReadingsReport({ logs, dateFrom, dateTo, phStatus, clStatus, alkStatus }: {
  logs: ServiceLog[];
  dateFrom: string;
  dateTo: string;
  phStatus: (v: number | null) => string;
  clStatus: (v: number | null) => string;
  alkStatus: (v: number | null) => string;
}) {
  return (
    <div>
      <div className="header">
        <h1>Chemical Readings Report</h1>
        <p className="subtitle">{format(new Date(dateFrom + 'T12:00:00'), 'MMM d, yyyy')} — {format(new Date(dateTo + 'T12:00:00'), 'MMM d, yyyy')} · {logs.length} readings</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>pH</th>
            <th>Chlorine</th>
            <th>Alkalinity</th>
            <th>CYA</th>
            <th>Calcium</th>
            <th>Salt</th>
            <th>TDS</th>
            <th>Temp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{format(new Date(log.service_date + 'T12:00:00'), 'MM/dd/yy')}</td>
              <td>{log.customers?.name ?? '—'}</td>
              <td className={phStatus(log.ph_level)}>{log.ph_level?.toFixed(1) ?? '—'}</td>
              <td className={clStatus(log.chlorine_level)}>{log.chlorine_level?.toFixed(1) ?? '—'}</td>
              <td className={alkStatus(log.alkalinity)}>{log.alkalinity ?? '—'}</td>
              <td>{log.cya ?? '—'}</td>
              <td>{log.calcium ?? '—'}</td>
              <td>{log.salt_level ?? '—'}</td>
              <td>{log.tds ?? '—'}</td>
              <td>{log.water_temp ? `${log.water_temp}°` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="section" style={{ fontSize: '10px', color: '#94A3B8' }}>
        <p>Ideal ranges — pH: 7.2–7.8 · Chlorine: 1.0–3.0 ppm · Alkalinity: 80–120 ppm · CYA: 30–50 ppm · Calcium: 200–400 ppm</p>
        <p style={{ marginTop: '8px' }}>Generated by Pooly on {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
      </div>
    </div>
  );
}

function RevenueReport({ revenue, customerCount }: {
  revenue: { monthlyProjected: number; perCustomer: { customerName: string; monthlyCents: number }[]; monthlyData: { label: string; services: number; revenueCents: number }[]; totalCustomers: number } | null | undefined;
  customerCount: number;
}) {
  if (!revenue) return <p>No revenue data available</p>;

  const fmtCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="header">
        <h1>Revenue Summary</h1>
        <p className="subtitle">Generated {format(new Date(), 'MMM d, yyyy')}</p>
      </div>

      <div className="section">
        <div className="stat">
          <div className="stat-label">Monthly Projected</div>
          <div className="stat-value">{fmtCents(revenue.monthlyProjected)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Annual Projected</div>
          <div className="stat-value">{fmtCents(revenue.monthlyProjected * 12)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active Subscribers</div>
          <div className="stat-value">{revenue.totalCustomers}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Customers</div>
          <div className="stat-value">{customerCount}</div>
        </div>
      </div>

      <h2>Monthly Breakdown (Last 6 Months)</h2>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Services</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {revenue.monthlyData.map(m => (
            <tr key={m.label}>
              <td>{m.label}</td>
              <td>{m.services}</td>
              <td>{fmtCents(m.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {revenue.perCustomer.length > 0 && (
        <>
          <h2>Revenue by Customer</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Monthly</th>
                <th>Annual</th>
              </tr>
            </thead>
            <tbody>
              {revenue.perCustomer.map(c => (
                <tr key={c.customerName}>
                  <td>{c.customerName}</td>
                  <td>{fmtCents(c.monthlyCents)}</td>
                  <td>{fmtCents(c.monthlyCents * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ fontSize: '10px', color: '#94A3B8' }}>Generated by Pooly on {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
    </div>
  );
}
