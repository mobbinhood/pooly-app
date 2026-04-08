'use client';

import { useState, useMemo } from 'react';
import { Calculator, Droplets, ChevronDown, ChevronUp, FlaskConical, Gauge } from 'lucide-react';

type ChemicalReading = {
  ph_level?: number;
  chlorine_level?: number;
  alkalinity?: number;
  cya?: number;
  calcium?: number;
  salt_level?: number;
};

type Dosage = {
  chemical: string;
  action: string;
  amount: string;
  unit: string;
  note?: string;
};

const TARGET = {
  ph: { min: 7.2, max: 7.6, ideal: 7.4 },
  chlorine: { min: 1.0, max: 3.0, ideal: 2.0 },
  alkalinity: { min: 80, max: 120, ideal: 100 },
  cya: { min: 30, max: 50, ideal: 40 },
  calcium: { min: 200, max: 400, ideal: 300 },
  salt: { min: 2700, max: 3400, ideal: 3200 },
};

function calculateDosages(gallons: number, readings: ChemicalReading): Dosage[] {
  const dosages: Dosage[] = [];
  const factor = gallons / 10000;

  // Chlorine (liquid chlorine 12.5% sodium hypochlorite)
  // ~10 fl oz per 10k gallons raises FC by 1 ppm
  if (readings.chlorine_level != null && readings.chlorine_level < TARGET.chlorine.min) {
    const deficit = TARGET.chlorine.ideal - readings.chlorine_level;
    const ozNeeded = Math.round(deficit * 10 * factor * 10) / 10;
    dosages.push({
      chemical: 'Liquid Chlorine (12.5%)',
      action: `Raise from ${readings.chlorine_level} to ${TARGET.chlorine.ideal} ppm`,
      amount: ozNeeded.toString(),
      unit: 'fl oz',
      note: 'Add to deep end with pump running',
    });
  } else if (readings.chlorine_level != null && readings.chlorine_level > 5) {
    dosages.push({
      chemical: 'No chemical needed',
      action: `Chlorine high at ${readings.chlorine_level} ppm - let it burn off`,
      amount: '0',
      unit: '',
      note: 'Run pump, uncover pool, sunlight breaks down chlorine',
    });
  }

  // pH adjustment
  if (readings.ph_level != null) {
    if (readings.ph_level > TARGET.ph.max) {
      // Lower pH with muriatic acid (31.45%)
      // ~14.5 fl oz per 10k gallons lowers pH by 0.2
      const excess = readings.ph_level - TARGET.ph.ideal;
      const doses = excess / 0.2;
      const ozNeeded = Math.round(doses * 14.5 * factor * 10) / 10;
      dosages.push({
        chemical: 'Muriatic Acid (31.45%)',
        action: `Lower pH from ${readings.ph_level} to ${TARGET.ph.ideal}`,
        amount: ozNeeded.toString(),
        unit: 'fl oz',
        note: 'Pour slowly near return jet, pump running',
      });
    } else if (readings.ph_level < TARGET.ph.min) {
      // Raise pH with soda ash
      // ~6 oz per 10k gallons raises pH by 0.2
      const deficit = TARGET.ph.ideal - readings.ph_level;
      const doses = deficit / 0.2;
      const ozNeeded = Math.round(doses * 6 * factor * 10) / 10;
      dosages.push({
        chemical: 'Soda Ash (Sodium Carbonate)',
        action: `Raise pH from ${readings.ph_level} to ${TARGET.ph.ideal}`,
        amount: ozNeeded.toString(),
        unit: 'oz',
        note: 'Pre-dissolve in bucket, broadcast across surface',
      });
    }
  }

  // Alkalinity (baking soda)
  // ~1.5 lbs per 10k gallons raises TA by 10 ppm
  if (readings.alkalinity != null && readings.alkalinity < TARGET.alkalinity.min) {
    const deficit = TARGET.alkalinity.ideal - readings.alkalinity;
    const lbsNeeded = Math.round((deficit / 10) * 1.5 * factor * 10) / 10;
    dosages.push({
      chemical: 'Baking Soda (Sodium Bicarbonate)',
      action: `Raise alkalinity from ${readings.alkalinity} to ${TARGET.alkalinity.ideal} ppm`,
      amount: lbsNeeded.toString(),
      unit: 'lbs',
      note: 'Broadcast across surface, pump running',
    });
  } else if (readings.alkalinity != null && readings.alkalinity > 140) {
    dosages.push({
      chemical: 'Muriatic Acid (31.45%)',
      action: `Lower alkalinity from ${readings.alkalinity} ppm`,
      amount: Math.round(16 * factor * 10 / 10).toString(),
      unit: 'fl oz',
      note: 'Add in deep end, aerating will help lower TA faster',
    });
  }

  // CYA (cyanuric acid / stabilizer)
  // ~13 oz per 10k gallons raises CYA by 10 ppm
  if (readings.cya != null && readings.cya < TARGET.cya.min) {
    const deficit = TARGET.cya.ideal - readings.cya;
    const ozNeeded = Math.round((deficit / 10) * 13 * factor * 10) / 10;
    dosages.push({
      chemical: 'Cyanuric Acid (Stabilizer)',
      action: `Raise CYA from ${readings.cya} to ${TARGET.cya.ideal} ppm`,
      amount: ozNeeded.toString(),
      unit: 'oz',
      note: 'Add to skimmer basket with pump running, or dissolve in sock',
    });
  } else if (readings.cya != null && readings.cya > 80) {
    dosages.push({
      chemical: 'Dilution needed',
      action: `CYA high at ${readings.cya} ppm - partial drain & refill`,
      amount: Math.round(((readings.cya - TARGET.cya.ideal) / readings.cya) * 100).toString(),
      unit: '% water replacement',
      note: 'Only way to lower CYA is dilution',
    });
  }

  // Calcium hardness
  // ~1.25 lbs per 10k gallons raises CH by 10 ppm
  if (readings.calcium != null && readings.calcium < TARGET.calcium.min) {
    const deficit = TARGET.calcium.ideal - readings.calcium;
    const lbsNeeded = Math.round((deficit / 10) * 1.25 * factor * 10) / 10;
    dosages.push({
      chemical: 'Calcium Chloride',
      action: `Raise calcium from ${readings.calcium} to ${TARGET.calcium.ideal} ppm`,
      amount: lbsNeeded.toString(),
      unit: 'lbs',
      note: 'Pre-dissolve in bucket, add slowly near return',
    });
  }

  // Salt (for salt water pools)
  // ~25 lbs per 10k gallons raises salt by ~300 ppm
  if (readings.salt_level != null && readings.salt_level < TARGET.salt.min) {
    const deficit = TARGET.salt.ideal - readings.salt_level;
    const lbsNeeded = Math.round((deficit / 300) * 25 * factor);
    dosages.push({
      chemical: 'Pool Salt (NaCl)',
      action: `Raise salt from ${readings.salt_level} to ${TARGET.salt.ideal} ppm`,
      amount: lbsNeeded.toString(),
      unit: 'lbs',
      note: 'Broadcast across surface, brush to dissolve',
    });
  }

  return dosages;
}

// Inline calculator for service log modal
export function InlineDosingCalculator({
  readings,
  poolSizeGallons,
  waterTemp,
  tds,
}: {
  readings: ChemicalReading;
  poolSizeGallons?: number | null;
  waterTemp?: number;
  tds?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [manualGallons, setManualGallons] = useState('');

  const gallons = poolSizeGallons || (manualGallons ? parseInt(manualGallons) : 0);
  const hasReadings = readings.ph_level != null || readings.chlorine_level != null || readings.alkalinity != null;

  const dosages = useMemo(() => {
    if (!gallons || !hasReadings) return [];
    return calculateDosages(gallons, readings);
  }, [gallons, readings, hasReadings]);

  if (!hasReadings) return null;

  return (
    <div className="border border-[#0066FF]/15 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#0066FF]/5 hover:bg-[#0066FF]/8 transition"
      >
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-[#0066FF]" />
          <span className="text-sm font-medium text-[#0066FF]">
            Dosing Calculator
            {dosages.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#0066FF] text-white px-1.5 py-0.5 rounded-full">
                {dosages.length}
              </span>
            )}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#0066FF]" /> : <ChevronDown size={14} className="text-[#0066FF]" />}
      </button>

      {expanded && (
        <div className="p-3.5 space-y-3">
          {!poolSizeGallons && (
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Pool Size (gallons)</label>
              <input
                type="number"
                value={manualGallons}
                onChange={(e) => setManualGallons(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              />
            </div>
          )}

          {gallons > 0 && dosages.length > 0 ? (
            <div className="space-y-2">
              {dosages.map((d, i) => (
                <div key={i} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E]">{d.chemical}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">{d.action}</p>
                    </div>
                    {d.amount !== '0' && (
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-[#0066FF] tabular-nums">{d.amount}</p>
                        <p className="text-[10px] text-[#64748B] uppercase">{d.unit}</p>
                      </div>
                    )}
                  </div>
                  {d.note && (
                    <p className="text-[10px] text-[#94A3B8] mt-1.5 italic">{d.note}</p>
                  )}
                </div>
              ))}
            </div>
          ) : gallons > 0 && hasReadings ? (
            <div className="text-center py-4">
              <Droplets className="w-6 h-6 text-[#10B981] mx-auto mb-1.5" />
              <p className="text-sm text-[#10B981] font-medium">Readings look good!</p>
              <p className="text-xs text-[#64748B] mt-0.5">All levels within target range</p>
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8] text-center py-3">
              Enter pool size to see dosing recommendations
            </p>
          )}

          {/* LSI Calculator */}
          {readings.ph_level && readings.calcium && readings.alkalinity && waterTemp ? (() => {
            const lsi = calculateLSI(
              readings.ph_level,
              waterTemp,
              readings.calcium,
              readings.alkalinity,
              tds || 1000
            );
            const status = getLSIStatus(lsi);
            return (
              <div className="rounded-lg border p-3" style={{ borderColor: `${status.color}30`, backgroundColor: `${status.color}08` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Gauge size={12} className="text-[#64748B]" />
                    <span className="text-[10px] font-medium text-[#64748B] uppercase">LSI</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: status.color }}>
                    {lsi > 0 ? '+' : ''}{lsi.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</span>
                </div>
                <p className="text-[10px] text-[#64748B]">{status.description}</p>
                {/* Mini scale */}
                <div className="mt-2">
                  <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#EF4444] via-[#10B981] to-[#EF4444] overflow-hidden">
                    <div
                      className="absolute top-0 w-1 h-full bg-white border border-[#1A1A2E] rounded-full"
                      style={{ left: `${Math.min(Math.max((lsi + 1) / 2 * 100, 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-[#94A3B8]">-1.0</span>
                    <span className="text-[8px] text-[#10B981] font-medium">0</span>
                    <span className="text-[8px] text-[#94A3B8]">+1.0</span>
                  </div>
                </div>
              </div>
            );
          })() : null}

          {gallons > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded-full">
                Pool: {gallons.toLocaleString()} gal
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full">
                pH: {TARGET.ph.min}-{TARGET.ph.max}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full">
                Cl: {TARGET.chlorine.min}-{TARGET.chlorine.max}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full">
                Alk: {TARGET.alkalinity.min}-{TARGET.alkalinity.max}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// LSI (Langelier Saturation Index) Calculator
// LSI = pH + TF + CF + AF - 12.1
// TF = Temperature Factor, CF = Calcium Hardness Factor, AF = Alkalinity Factor
function calculateLSI(pH: number, tempF: number, calcium: number, alkalinity: number, tds: number): number {
  // Temperature factor (TF) from lookup table approximation
  const TF = Math.log10(tempF - 32 + 0.01) * 0.85 - 0.2;
  // Calcium factor
  const CF = Math.log10(calcium) - 0.4;
  // Alkalinity factor
  const AF = Math.log10(alkalinity);
  // TDS factor correction
  const TDSf = tds > 1000 ? 12.27 : 12.1;

  return Math.round((pH + TF + CF + AF - TDSf) * 100) / 100;
}

function getLSIStatus(lsi: number): { label: string; color: string; description: string } {
  if (lsi < -0.5) return { label: 'Corrosive', color: '#EF4444', description: 'Water is aggressive — will corrode metal, etch plaster, and dissolve grout.' };
  if (lsi < -0.3) return { label: 'Slightly Corrosive', color: '#F97316', description: 'Mildly aggressive — may cause slow surface damage over time.' };
  if (lsi <= 0.3) return { label: 'Balanced', color: '#10B981', description: 'Water is balanced — ideal range for pool surfaces and equipment.' };
  if (lsi <= 0.5) return { label: 'Slightly Scaling', color: '#F97316', description: 'Mild scale tendency — monitor and adjust if needed.' };
  return { label: 'Scale Forming', color: '#EF4444', description: 'Water will deposit calcium scale on surfaces, heater, and tile.' };
}

// Standalone calculator for dashboard access
export function StandaloneDosingCalculator() {
  const [gallons, setGallons] = useState('');
  const [readings, setReadings] = useState<ChemicalReading>({});
  const [waterTemp, setWaterTemp] = useState('');
  const [tds, setTds] = useState('1000');
  const [showLSI, setShowLSI] = useState(false);

  const dosages = useMemo(() => {
    const g = parseInt(gallons);
    if (!g) return [];
    return calculateDosages(g, readings);
  }, [gallons, readings]);

  const hasReadings = readings.ph_level != null || readings.chlorine_level != null || readings.alkalinity != null;

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <div className="space-y-5">
      {/* Pool Size */}
      <div>
        <label className="block text-xs font-medium text-[#64748B] mb-1.5">Pool Size (gallons)</label>
        <input
          type="number"
          value={gallons}
          onChange={(e) => setGallons(e.target.value)}
          placeholder="e.g. 15000"
          className={inputClass}
        />
        <div className="flex gap-2 mt-2">
          {[10000, 15000, 20000, 25000].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setGallons(size.toString())}
              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition ${
                gallons === size.toString()
                  ? 'bg-[#0066FF] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              }`}
            >
              {(size / 1000)}k
            </button>
          ))}
        </div>
      </div>

      {/* Current Readings */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical size={14} className="text-[#0066FF]" />
          <span className="text-xs font-medium text-[#64748B]">Current Readings</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">pH Level</label>
            <input
              type="number"
              step="0.1"
              placeholder="7.2-7.8"
              onChange={(e) => setReadings(r => ({ ...r, ph_level: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Chlorine</label>
            <input
              type="number"
              step="0.1"
              placeholder="1.0-3.0"
              onChange={(e) => setReadings(r => ({ ...r, chlorine_level: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Alkalinity</label>
            <input
              type="number"
              placeholder="80-120"
              onChange={(e) => setReadings(r => ({ ...r, alkalinity: e.target.value ? parseInt(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Extended readings */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">CYA</label>
            <input
              type="number"
              placeholder="30-50"
              onChange={(e) => setReadings(r => ({ ...r, cya: e.target.value ? parseInt(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Calcium</label>
            <input
              type="number"
              placeholder="200-400"
              onChange={(e) => setReadings(r => ({ ...r, calcium: e.target.value ? parseInt(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Salt</label>
            <input
              type="number"
              placeholder="2700-3400"
              onChange={(e) => setReadings(r => ({ ...r, salt_level: e.target.value ? parseInt(e.target.value) : undefined }))}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {parseInt(gallons) > 0 && hasReadings && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={14} className="text-[#0066FF]" />
            <span className="text-xs font-medium text-[#64748B]">Recommended Dosages</span>
          </div>

          {dosages.length > 0 ? (
            <div className="space-y-2">
              {dosages.map((d, i) => (
                <div key={i} className="bg-[#F8FAFC] rounded-lg p-3.5 border border-[#E2E8F0]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E]">{d.chemical}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">{d.action}</p>
                    </div>
                    {d.amount !== '0' && (
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-[#0066FF] tabular-nums">{d.amount}</p>
                        <p className="text-[10px] text-[#64748B] uppercase">{d.unit}</p>
                      </div>
                    )}
                  </div>
                  {d.note && (
                    <p className="text-[10px] text-[#94A3B8] mt-2 italic">{d.note}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-[#10B981]/5 rounded-lg border border-[#10B981]/15">
              <Droplets className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
              <p className="text-sm text-[#10B981] font-medium">All readings in range!</p>
              <p className="text-xs text-[#64748B] mt-1">No chemical adjustments needed</p>
            </div>
          )}
        </div>
      )}

      {/* LSI Calculator */}
      <div className="border border-[#0066FF]/15 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLSI(!showLSI)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0066FF]/5 hover:bg-[#0066FF]/8 transition"
        >
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-[#0066FF]" />
            <span className="text-sm font-medium text-[#0066FF]">LSI Calculator</span>
          </div>
          {showLSI ? <ChevronUp size={14} className="text-[#0066FF]" /> : <ChevronDown size={14} className="text-[#0066FF]" />}
        </button>

        {showLSI && (
          <div className="p-4 space-y-4">
            <p className="text-xs text-[#64748B]">
              The Langelier Saturation Index predicts whether water will deposit scale or corrode surfaces. Target: -0.3 to +0.3.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Water Temp (&deg;F)</label>
                <input
                  type="number"
                  value={waterTemp}
                  onChange={(e) => setWaterTemp(e.target.value)}
                  placeholder="e.g. 82"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">TDS (ppm)</label>
                <input
                  type="number"
                  value={tds}
                  onChange={(e) => setTds(e.target.value)}
                  placeholder="1000"
                  className={inputClass}
                />
              </div>
            </div>

            <p className="text-[10px] text-[#94A3B8]">
              pH, Calcium, and Alkalinity from readings above are used automatically.
            </p>

            {readings.ph_level && readings.calcium && readings.alkalinity && waterTemp ? (() => {
              const lsi = calculateLSI(
                readings.ph_level,
                parseFloat(waterTemp),
                readings.calcium,
                readings.alkalinity,
                parseInt(tds) || 1000
              );
              const status = getLSIStatus(lsi);
              return (
                <div className="rounded-lg border p-4" style={{ borderColor: `${status.color}30`, backgroundColor: `${status.color}08` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#64748B]">LSI Value</span>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: status.color }}>
                      {lsi > 0 ? '+' : ''}{lsi.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-sm font-semibold" style={{ color: status.color }}>{status.label}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">{status.description}</p>

                  {/* LSI visual scale */}
                  <div className="mt-3">
                    <div className="relative h-2 rounded-full bg-gradient-to-r from-[#EF4444] via-[#10B981] to-[#EF4444] overflow-hidden">
                      <div
                        className="absolute top-0 w-1 h-full bg-white border border-[#1A1A2E] rounded-full"
                        style={{ left: `${Math.min(Math.max((lsi + 1) / 2 * 100, 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-[#94A3B8]">-1.0</span>
                      <span className="text-[9px] text-[#10B981] font-medium">0</span>
                      <span className="text-[9px] text-[#94A3B8]">+1.0</span>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {(lsi < -0.3 || lsi > 0.3) && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: `${status.color}20` }}>
                      <p className="text-[10px] font-medium text-[#64748B] mb-1">Adjust by:</p>
                      <ul className="text-[10px] text-[#64748B] space-y-0.5">
                        {lsi < -0.3 && (
                          <>
                            <li>• Raise pH (soda ash)</li>
                            <li>• Raise calcium hardness (calcium chloride)</li>
                            <li>• Raise alkalinity (baking soda)</li>
                          </>
                        )}
                        {lsi > 0.3 && (
                          <>
                            <li>• Lower pH (muriatic acid)</li>
                            <li>• Lower alkalinity (acid + aeration)</li>
                            <li>• Reduce water temperature if possible</li>
                          </>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="text-center py-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <Gauge className="w-6 h-6 text-[#94A3B8] mx-auto mb-1.5" />
                <p className="text-xs text-[#94A3B8]">
                  Enter pH, Calcium, Alkalinity, and Water Temp to calculate LSI
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
