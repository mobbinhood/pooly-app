import type { EquipmentStatus } from './supabase';

type ServiceReportData = {
  customerName: string;
  serviceDate: string;
  technicianName: string;
  phLevel: number | null;
  chlorineLevel: number | null;
  alkalinity: number | null;
  equipmentStatus: EquipmentStatus | null;
  notes: string | null;
  photos: string[];
  orgName: string;
};

function chemStatus(value: number | null, low: number, high: number): 'green' | 'amber' | 'none' {
  if (value === null || value === undefined) return 'none';
  return value >= low && value <= high ? 'green' : 'amber';
}

function statusColor(status: 'green' | 'amber' | 'none'): string {
  if (status === 'green') return '#10B981';
  if (status === 'amber') return '#F59E0B';
  return '#94A3B8';
}

function statusDot(status: 'green' | 'amber' | 'none'): string {
  const color = statusColor(status);
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>`;
}

function equipLabel(status: string | undefined): { text: string; color: string } {
  switch (status) {
    case 'good': return { text: 'Good', color: '#10B981' };
    case 'needs_attention': return { text: 'Needs Attention', color: '#F59E0B' };
    case 'needs_cleaning': return { text: 'Needs Cleaning', color: '#F59E0B' };
    case 'not_working': return { text: 'Not Working', color: '#EF4444' };
    case 'off': return { text: 'Off', color: '#94A3B8' };
    default: return { text: 'N/A', color: '#94A3B8' };
  }
}

export function buildServiceReportHtml(data: ServiceReportData): string {
  const phStatus = chemStatus(data.phLevel, 7.2, 7.8);
  const clStatus = chemStatus(data.chlorineLevel, 1.0, 3.0);
  const alkStatus = chemStatus(data.alkalinity, 80, 120);

  const formattedDate = new Date(data.serviceDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const equipmentRows = data.equipmentStatus
    ? Object.entries(data.equipmentStatus)
        .filter(([, v]) => v)
        .map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const s = equipLabel(value);
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#475569;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:${s.color};font-weight:600;">${s.text}</td>
          </tr>`;
        })
        .join('')
    : '';

  const photoThumbnails = data.photos.length > 0
    ? data.photos
        .map(url => `<a href="${url}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;"><img src="${url}" alt="Service photo" width="80" height="80" style="border-radius:8px;object-fit:cover;border:1px solid #E2E8F0;" /></a>`)
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Pool Service Report</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Satoshi',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr>
    <td style="background:#0066FF;padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">
        🏊 ${data.orgName || 'Pooly'}
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Pool Service Report</div>
    </td>
  </tr>

  <!-- Service Info -->
  <tr>
    <td style="padding:24px 32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:12px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;font-weight:600;">Service Date</div>
            <div style="font-size:15px;color:#1A1A2E;font-weight:600;margin-top:2px;">${formattedDate}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;font-weight:600;">Technician</div>
            <div style="font-size:15px;color:#1A1A2E;font-weight:600;margin-top:2px;">${data.technicianName}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;font-weight:600;">Customer</div>
            <div style="font-size:15px;color:#1A1A2E;font-weight:600;margin-top:2px;">${data.customerName}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Divider -->
  <tr><td style="padding:0 32px;"><div style="border-top:1px solid #F1F5F9;"></div></td></tr>

  <!-- Water Chemistry -->
  <tr>
    <td style="padding:20px 32px;">
      <div style="font-size:13px;font-weight:700;color:#1A1A2E;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px;">Water Chemistry</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #F1F5F9;width:40%;font-size:13px;color:#64748B;">pH Level</td>
          <td style="padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:15px;font-weight:700;color:#1A1A2E;">
            ${statusDot(phStatus)}${data.phLevel !== null ? data.phLevel.toFixed(1) : '—'}
            <span style="font-size:11px;font-weight:500;color:${statusColor(phStatus)};margin-left:4px;">${phStatus === 'green' ? 'Ideal' : phStatus === 'amber' ? 'Adjust' : ''}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#64748B;">Chlorine</td>
          <td style="padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:15px;font-weight:700;color:#1A1A2E;">
            ${statusDot(clStatus)}${data.chlorineLevel !== null ? data.chlorineLevel.toFixed(1) : '—'} <span style="font-size:11px;color:#94A3B8;">ppm</span>
            <span style="font-size:11px;font-weight:500;color:${statusColor(clStatus)};margin-left:4px;">${clStatus === 'green' ? 'Ideal' : clStatus === 'amber' ? 'Adjust' : ''}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:#64748B;">Alkalinity</td>
          <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#1A1A2E;">
            ${statusDot(alkStatus)}${data.alkalinity !== null ? data.alkalinity : '—'} <span style="font-size:11px;color:#94A3B8;">ppm</span>
            <span style="font-size:11px;font-weight:500;color:${statusColor(alkStatus)};margin-left:4px;">${alkStatus === 'green' ? 'Ideal' : alkStatus === 'amber' ? 'Adjust' : ''}</span>
          </td>
        </tr>
      </table>
      <div style="margin-top:8px;font-size:11px;color:#94A3B8;">Ideal ranges — pH: 7.2–7.8 · Chlorine: 1.0–3.0 ppm · Alkalinity: 80–120 ppm</div>
    </td>
  </tr>

  ${equipmentRows ? `
  <!-- Equipment Status -->
  <tr><td style="padding:0 32px;"><div style="border-top:1px solid #F1F5F9;"></div></td></tr>
  <tr>
    <td style="padding:20px 32px;">
      <div style="font-size:13px;font-weight:700;color:#1A1A2E;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px;">Equipment Status</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:10px;overflow:hidden;">
        ${equipmentRows}
      </table>
    </td>
  </tr>
  ` : ''}

  ${data.notes ? `
  <!-- Notes -->
  <tr><td style="padding:0 32px;"><div style="border-top:1px solid #F1F5F9;"></div></td></tr>
  <tr>
    <td style="padding:20px 32px;">
      <div style="font-size:13px;font-weight:700;color:#1A1A2E;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Service Notes</div>
      <div style="font-size:14px;color:#475569;line-height:1.6;background:#F8FAFC;border-radius:10px;padding:14px 16px;">${data.notes.replace(/\n/g, '<br />')}</div>
    </td>
  </tr>
  ` : ''}

  ${photoThumbnails ? `
  <!-- Photos -->
  <tr><td style="padding:0 32px;"><div style="border-top:1px solid #F1F5F9;"></div></td></tr>
  <tr>
    <td style="padding:20px 32px;">
      <div style="font-size:13px;font-weight:700;color:#1A1A2E;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Photos</div>
      <div>${photoThumbnails}</div>
    </td>
  </tr>
  ` : ''}

  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px 24px;text-align:center;border-top:1px solid #F1F5F9;">
      <div style="font-size:12px;color:#94A3B8;">Sent by ${data.orgName || 'Pooly'} · Powered by Pooly</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
