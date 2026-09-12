import { useState, useMemo, useRef } from 'react';
import { store, type TradeEntry } from '../lib/store';

// ─── Instrument config ────────────────────────────────────────────────────────
interface Instrument {
  label: string;
  pipSize: number;
  defaultPipValue: number;
  decimals: number;
  isGold?: boolean;
  placeholder: [string, string, string]; // entry, sl, tp
}

const INSTRUMENTS: Instrument[] = [
  { label: 'XAU/USD', pipSize: 0.10,   defaultPipValue: 10.0, decimals: 2, isGold: true, placeholder: ['2350.00','2330.00','2390.00'] },
  { label: 'EUR/USD', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['1.08500','1.08000','1.09500'] },
  { label: 'GBP/USD', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['1.27000','1.26500','1.28000'] },
  { label: 'AUD/USD', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['0.65000','0.64500','0.66000'] },
  { label: 'NZD/USD', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['0.60000','0.59500','0.61000'] },
  { label: 'USD/JPY', pipSize: 0.01,   defaultPipValue: 9.09, decimals: 3, placeholder: ['149.500','149.000','150.500'] },
  { label: 'USD/CHF', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['0.89000','0.88500','0.90000'] },
  { label: 'USD/CAD', pipSize: 0.0001, defaultPipValue: 10.0, decimals: 5, placeholder: ['1.36000','1.35500','1.37000'] },
];

function roundLot(n: number) { return Math.round(n * 100) / 100; }
function toPips(priceDistance: number, pipSize: number) {
  return Math.round((priceDistance / pipSize) * 10) / 10;
}
function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

// ─── Tiny UI atoms ────────────────────────────────────────────────────────────
function FieldLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 mb-1.5">
      <span className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e] select-none">{children}</span>
      {note && <span className="text-[10px] text-[#38384a] select-none">{note}</span>}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, step = '0.01', prefix, large }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  step?: string; prefix?: string; large?: boolean;
}) {
  const base = `font-mono bg-[#0f0f14] border border-[#1f1f2a] text-[#e0dfd8]
    focus:outline-none focus:border-[#c4a25a]/60 focus:bg-[#0f0f14]
    hover:border-[#2a2a38] transition-all duration-150 placeholder:text-[#38384a] w-full`;
  return (
    <div className="flex items-stretch">
      {prefix && (
        <span className="font-mono flex items-center px-3 bg-[#141419] border border-r-0 border-[#1f1f2a] text-[#6a6a7e] text-sm select-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        step={step}
        className={`${base} ${large ? 'text-xl px-4 py-3.5' : 'text-sm px-3 py-2.5'}`}
        style={{ borderRadius: 0 }}
      />
    </div>
  );
}

// ─── Calculator page ──────────────────────────────────────────────────────────
export default function Calculator() {
  const settings = store.getSettings();

  const [instrIdx, setInstrIdx] = useState(() => {
    const i = INSTRUMENTS.findIndex(x => x.label === settings.defaultInstrument);
    return i >= 0 ? i : 0;
  });
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [risk, setRisk] = useState(String(settings.defaultRiskUsd));
  const [advOpen, setAdvOpen] = useState(false);
  const [customPipValue, setCustomPipValue] = useState('');
  const [maxLot, setMaxLot] = useState(settings.defaultMaxLot > 0 ? String(settings.defaultMaxLot) : '');
  const [saved, setSaved] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const instrument = INSTRUMENTS[instrIdx];

  const calc = useMemo(() => {
    const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp), r = parseFloat(risk);
    const pv = parseFloat(customPipValue) || instrument.defaultPipValue;
    const ml = parseFloat(maxLot) || Infinity;
    if (!e || !s || !r || r <= 0 || isNaN(r)) return null;
    const slDiff = Math.abs(e - s);
    if (slDiff === 0) return null;
    const slPips = toPips(slDiff, instrument.pipSize);
    const rawLot = r / (slPips * pv);
    const lot = roundLot(rawLot);
    const actualRisk = lot * slPips * pv;
    const isLong = s < e;
    let tpPips: number | null = null, profit: number | null = null, rr: number | null = null;
    if (t && !isNaN(t)) {
      tpPips = toPips(Math.abs(t - e), instrument.pipSize);
      profit = lot * tpPips * pv;
      rr = tpPips / slPips;
    }
    const warnings: string[] = [];
    if (isLong ? s >= e : s <= e) warnings.push('Stop loss is on the wrong side of entry.');
    if (t && !isNaN(t) && (isLong ? t <= e : t >= e)) warnings.push('Take profit is on the wrong side of entry.');
    if (lot > ml) warnings.push(`Lot size ${fmt(lot)} exceeds broker max (${ml}).`);
    return { lot, slPips, tpPips, actualRisk, profit, rr, pipVal: pv, warnings, isLong };
  }, [entry, sl, tp, risk, customPipValue, maxLot, instrIdx, instrument]);

  function saveTrade() {
    if (!calc) return;
    const t: TradeEntry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      instrument: instrument.label,
      direction: calc.isLong ? 'LONG' : 'SHORT',
      entry: parseFloat(entry),
      sl: parseFloat(sl),
      tp: tp ? parseFloat(tp) : undefined,
      lotSize: calc.lot,
      riskUsd: calc.actualRisk,
      slPips: calc.slPips,
      tpPips: calc.tpPips ?? undefined,
      profit: calc.profit ?? undefined,
      rr: calc.rr ?? undefined,
    };
    store.addTrade(t);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const RISK_PRESETS = [50, 100, 200, 500];

  return (
    <div className="flex flex-col lg:flex-row h-full page-enter">
      {/* ── Inputs panel ── */}
      <div className="lg:w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1f1f2a] bg-[#09090c]">

        {/* Page header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#1f1f2a]">
          <div className="flex items-center justify-between">
            <h1 className="text-[13px] font-medium text-[#e0dfd8] tracking-wide">Position Calculator</h1>
            <div className="w-1.5 h-1.5 rounded-full bg-[#4a9e72] opacity-70" title="Live" />
          </div>
        </div>

        {/* Instrument selector */}
        <div className="px-6 pt-4 pb-4 border-b border-[#1f1f2a]">
          <FieldLabel>Instrument</FieldLabel>
          <div
            ref={selectorRef}
            className="flex overflow-x-auto gap-px"
            style={{ scrollbarWidth: 'none' }}
          >
            {INSTRUMENTS.map((inst, i) => (
              <button
                key={inst.label}
                onClick={() => setInstrIdx(i)}
                className={`font-mono text-[10px] tracking-wide px-2.5 py-1.5 flex-shrink-0 border transition-all duration-150 select-none
                  ${i === instrIdx
                    ? 'bg-[#c4a25a]/10 border-[#c4a25a]/50 text-[#c4a25a]'
                    : 'bg-[#0f0f14] border-[#1f1f2a] text-[#6a6a7e] hover:text-[#aaa] hover:border-[#2a2a38]'
                  }`}
                style={{ borderRadius: 0 }}
              >
                {inst.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price inputs */}
        <div className="px-6 py-5 border-b border-[#1f1f2a]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Entry', val: entry, set: setEntry, ph: instrument.placeholder[0] },
              { label: 'Stop Loss', val: sl, set: setSl, ph: instrument.placeholder[1] },
              { label: 'Take Profit', val: tp, set: setTp, ph: instrument.placeholder[2], optional: true },
            ].map(({ label, val, set, ph, optional }) => (
              <div key={label}>
                <FieldLabel note={optional ? '(optional)' : undefined}>{label}</FieldLabel>
                <NumInput
                  value={val}
                  onChange={set}
                  placeholder={ph}
                  step={instrument.isGold ? '0.01' : '0.0001'}
                />
              </div>
            ))}
          </div>

          {/* Direction badge */}
          {calc && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border
                ${calc.isLong
                  ? 'border-[#4a9e72]/40 text-[#4a9e72] bg-[#4a9e72]/5'
                  : 'border-[#b84040]/40 text-[#b84040] bg-[#b84040]/5'
                }`}
                style={{ borderRadius: 0 }}>
                {calc.isLong ? '▲ LONG' : '▼ SHORT'}
              </span>
              <span className="font-mono text-[10px] text-[#38384a]">{instrument.label}</span>
            </div>
          )}
        </div>

        {/* Risk input */}
        <div className="px-6 py-5 border-b border-[#1f1f2a]">
          <FieldLabel>Risk Amount</FieldLabel>
          <NumInput value={risk} onChange={setRisk} placeholder="100" prefix="$" large />
          <div className="flex gap-1.5 mt-2.5">
            {RISK_PRESETS.map(v => (
              <button
                key={v}
                onClick={() => setRisk(String(v))}
                className={`font-mono text-[10px] px-2.5 py-1.5 border transition-all duration-100 select-none
                  ${risk === String(v)
                    ? 'border-[#c4a25a]/50 text-[#c4a25a] bg-[#c4a25a]/8'
                    : 'border-[#1f1f2a] text-[#6a6a7e] hover:border-[#2a2a38] hover:text-[#aaa] bg-[#0f0f14]'
                  }`}
                style={{ borderRadius: 0 }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced */}
        <div className="border-b border-[#1f1f2a]">
          <button
            onClick={() => setAdvOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-[#0f0f14] transition-colors"
          >
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e]">Advanced</span>
            <span className="font-mono text-xs text-[#38384a] select-none transition-transform duration-200"
              style={{ display: 'inline-block', transform: advOpen ? 'rotate(45deg)' : 'none' }}>
              +
            </span>
          </button>
          {advOpen && (
            <div className="px-6 pb-5 grid grid-cols-2 gap-4">
              <div>
                <FieldLabel note={`default: $${instrument.defaultPipValue}`}>Pip Value / Lot</FieldLabel>
                <NumInput value={customPipValue} onChange={setCustomPipValue} placeholder={String(instrument.defaultPipValue)} />
              </div>
              <div>
                <FieldLabel>Max Lot Size</FieldLabel>
                <NumInput value={maxLot} onChange={setMaxLot} placeholder="50" step="1" />
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* ── Results panel ── */}
      <div className="flex-1 bg-[#0b0b0f] relative scanlines flex flex-col">
        {/* Top accent rule */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#c4a25a]/30 to-transparent" />

        {!calc ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="w-12 h-12 border border-[#1f1f2a] flex items-center justify-center opacity-50">
              <div className="w-4 h-4 border border-[#c4a25a]/30" />
            </div>
            <p className="font-mono text-[11px] text-[#38384a] tracking-wider leading-relaxed max-w-[240px]">
              Enter entry + stop loss<br />to calculate position size
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 lg:p-8 gap-5 overflow-y-auto">

            {/* Warnings */}
            {calc.warnings.length > 0 && (
              <div className="border border-[#c47c40]/25 bg-[#c47c40]/5 px-4 py-3 flex flex-col gap-2">
                {calc.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="font-mono text-[#c47c40] text-xs mt-px">!</span>
                    <span className="text-xs text-[#c47c40] leading-relaxed">{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hero */}
            <div>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e] mb-2 select-none">
                Position Size
              </div>
              <div className="flex items-end gap-3">
                <span
                  className="font-mono font-semibold leading-none brass-glow"
                  style={{
                    fontSize: 'clamp(3.5rem, 10vw, 6rem)',
                    color: '#c4a25a',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {fmt(calc.lot, 2)}
                </span>
                <div className="flex flex-col pb-2 gap-0.5">
                  <span className="font-mono text-xs text-[#6a6a7e]">lots</span>
                  <span className={`font-mono text-[10px] ${calc.isLong ? 'text-[#4a9e72]' : 'text-[#b84040]'}`}>
                    {calc.isLong ? 'LONG' : 'SHORT'}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-[#1f1f2a] via-[#2a2a38]/50 to-transparent" />

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-px bg-[#1f1f2a]">
              {[
                { label: 'SL Distance', value: `${fmt(calc.slPips, 1)} pips`, color: 'text-[#e0dfd8]' },
                { label: '$ at Risk', value: `$${fmt(calc.actualRisk, 2)}`, color: Math.abs(calc.actualRisk - parseFloat(risk)) > 5 ? 'text-[#c47c40]' : 'text-[#e0dfd8]' },
                ...(calc.tpPips !== null ? [{ label: 'TP Distance', value: `${fmt(calc.tpPips, 1)} pips`, color: 'text-[#e0dfd8]' }] : []),
                ...(calc.profit !== null ? [{ label: 'Potential Profit', value: `$${fmt(calc.profit, 2)}`, color: 'text-[#4a9e72]' }] : []),
                ...(calc.rr !== null ? [{ label: 'Risk : Reward', value: `1 : ${fmt(calc.rr, 2)}`, color: calc.rr >= 2 ? 'text-[#4a9e72]' : calc.rr >= 1 ? 'text-[#c4a25a]' : 'text-[#b84040]' }] : []),
                { label: 'Pip Value', value: `$${fmt(calc.pipVal, 2)}/lot`, color: 'text-[#6a6a7e]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0b0b0f] px-4 py-3.5 flex flex-col gap-1">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e]">{label}</span>
                  <span className={`font-mono text-sm ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* R:R bar */}
            {calc.rr !== null && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[#38384a]">Risk/Reward Quality</span>
                  <span className={`font-mono text-[10px] tracking-wider ${calc.rr >= 2 ? 'text-[#4a9e72]' : calc.rr >= 1 ? 'text-[#c4a25a]' : 'text-[#b84040]'}`}>
                    {calc.rr >= 2 ? '● GOOD' : calc.rr >= 1 ? '● MARGINAL' : '● POOR'}
                  </span>
                </div>
                <div className="h-[2px] bg-[#1f1f2a]">
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, (calc.rr / 3) * 100)}%`,
                      background: calc.rr >= 2
                        ? 'linear-gradient(90deg, #4a9e72, #6ab888)'
                        : calc.rr >= 1
                        ? 'linear-gradient(90deg, #c4a25a, #d4b87a)'
                        : '#b84040',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Save to journal */}
            <div className="mt-auto pt-2">
              <button
                onClick={saveTrade}
                className={`w-full font-mono text-xs tracking-widest uppercase py-3 border transition-all duration-150 select-none
                  ${saved
                    ? 'border-[#4a9e72]/50 text-[#4a9e72] bg-[#4a9e72]/5'
                    : 'border-[#2a2a38] text-[#6a6a7e] hover:border-[#c4a25a]/40 hover:text-[#c4a25a] bg-[#0f0f14]'
                  }`}
                style={{ borderRadius: 0 }}
              >
                {saved ? '✓ Saved to Journal' : '+ Log Trade'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
