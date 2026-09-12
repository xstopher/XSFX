import { useState, useEffect } from 'react';
import { store, type TradeEntry } from '../lib/store';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const OUTCOME_CONFIG = {
  WIN:  { label: 'WIN',  color: 'text-[#4a9e72]', border: 'border-[#4a9e72]/30', bg: 'bg-[#4a9e72]/5' },
  LOSS: { label: 'LOSS', color: 'text-[#b84040]', border: 'border-[#b84040]/30', bg: 'bg-[#b84040]/5' },
  BE:   { label: 'B/E',  color: 'text-[#6a6a7e]', border: 'border-[#6a6a7e]/30', bg: 'bg-[#6a6a7e]/5' },
  PARTIAL: { label: 'PARTIAL', color: 'text-[#c4a25a]', border: 'border-[#c4a25a]/30', bg: 'bg-[#c4a25a]/5' },
} as const;

export default function Journal() {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BE' | 'PARTIAL' | 'OPEN'>('ALL');
  const [profitDrafts, setProfitDrafts] = useState<Record<string, string>>({});

  function refresh() { setTrades(store.getJournal()); }
  useEffect(() => {
    void store.hydrate().then(refresh);
  }, []);

  function setOutcome(id: string, outcome: TradeEntry['outcome']) {
    store.updateOutcome(id, outcome);
    refresh();
  }
  function deleteTrade(id: string) {
    store.deleteTrade(id);
    refresh();
  }

  function setPartialProfit(id: string) {
    const value = Number(profitDrafts[id]);
    if (!Number.isFinite(value)) return;
    store.updateTrade(id, { outcome: 'PARTIAL', profit: value });
    refresh();
  }

  const filtered = trades.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return !t.outcome;
    return t.outcome === filter;
  });

  // Stats
  const closed = trades.filter(t => t.outcome);
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const profitable = closed.filter(t => (t.profit ?? 0) > 0);
  const totalRisk = trades.reduce((s, t) => s + t.riskUsd, 0);
  const profitableRate = closed.length > 0 ? (profitable.length / closed.length) * 100 : null;
  const partials = trades.filter(t => t.outcome === 'PARTIAL');
  const netPnl = wins.reduce((s, t) => s + (t.profit ?? 0), 0)
    + partials.reduce((s, t) => s + (t.profit ?? 0), 0)
    - losses.reduce((s, t) => s + t.riskUsd, 0);

  const FILTERS: Array<typeof filter> = ['ALL', 'OPEN', 'WIN', 'LOSS', 'PARTIAL', 'BE'];

  return (
    <div className="flex flex-col h-full page-enter">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[#1f1f2a] bg-[#09090c] flex-shrink-0">
        <h1 className="text-[13px] font-medium text-[#e0dfd8] tracking-wide mb-4">Trade Journal</h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1f1f2a]">
          {[
            { label: 'Total Trades', value: String(trades.length), color: 'text-[#e0dfd8]' },
            { label: 'Profitable Rate', value: profitableRate !== null ? `${fmt(profitableRate, 1)}%` : '—', color: profitableRate !== null && profitableRate >= 50 ? 'text-[#4a9e72]' : 'text-[#e0dfd8]' },
            { label: 'Total Risked', value: `$${fmt(totalRisk)}`, color: 'text-[#e0dfd8]' },
            {
              label: 'Net P&L',
              value: closed.length ? (netPnl >= 0 ? `+$${fmt(netPnl)}` : `-$${fmt(Math.abs(netPnl))}`) : '—',
              color: netPnl >= 0 && closed.length ? 'text-[#4a9e72]' : 'text-[#b84040]',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#09090c] px-4 py-3 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e]">{label}</span>
              <span className={`font-mono text-base ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 py-3 border-b border-[#1f1f2a] bg-[#09090c] flex-shrink-0 flex gap-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border transition-all duration-100 select-none
              ${filter === f
                ? 'border-[#c4a25a]/50 text-[#c4a25a] bg-[#c4a25a]/8'
                : 'border-[#1f1f2a] text-[#6a6a7e] hover:border-[#2a2a38] hover:text-[#aaa] bg-transparent'
              }`}
            style={{ borderRadius: 0 }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Trade list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-10 h-10 border border-[#1f1f2a] flex items-center justify-center">
              <div className="w-3 h-3 border border-[#38384a]" />
            </div>
            <p className="font-mono text-[11px] text-[#38384a] tracking-wider">
              {filter === 'ALL' ? 'No trades logged yet.' : `No ${filter} trades.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1f1f2a]">
            {filtered.map(trade => {
              const cfg = trade.outcome ? OUTCOME_CONFIG[trade.outcome] : null;
              const partialIsProfit = trade.outcome === 'PARTIAL' && (trade.profit ?? 0) > 0;
              const partialIsLoss = trade.outcome === 'PARTIAL' && (trade.profit ?? 0) < 0;
              const outcomeLabel = partialIsProfit ? 'PARTIAL WIN' : partialIsLoss ? 'PARTIAL LOSS' : cfg?.label;
              return (
                <div key={trade.id} className="px-6 py-4 hover:bg-[#0f0f14] transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: instrument + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="font-mono text-sm text-[#e0dfd8]">{trade.instrument}</span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 border
                          ${trade.direction === 'LONG'
                            ? 'border-[#4a9e72]/30 text-[#4a9e72] bg-[#4a9e72]/5'
                            : 'border-[#b84040]/30 text-[#b84040] bg-[#b84040]/5'
                          }`}
                          style={{ borderRadius: 0 }}>
                          {trade.direction === 'LONG' ? '▲' : '▼'} {trade.direction}
                        </span>
                        {cfg ? (
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${cfg.border} ${cfg.color} ${cfg.bg}`}
                            style={{ borderRadius: 0 }}>
                            {outcomeLabel}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 border border-[#2a2a38] text-[#38384a]"
                            style={{ borderRadius: 0 }}>
                            OPEN
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 mb-3">
                        {[
                          { label: 'Entry', value: fmt(trade.entry, 2) },
                          { label: 'Lots', value: fmt(trade.lotSize, 2) },
                          { label: 'SL Pips', value: fmt(trade.slPips, 1) },
                          { label: 'Risk', value: `$${fmt(trade.riskUsd)}` },
                          ...(trade.tpPips ? [{ label: 'TP Pips', value: fmt(trade.tpPips, 1) }] : []),
                          ...(trade.rr ? [{ label: 'R:R', value: `1:${fmt(trade.rr, 2)}` }] : []),
                          ...(trade.profit !== undefined ? [{ label: trade.outcome === 'PARTIAL' ? 'Realized P&L' : 'Target $', value: `${trade.profit >= 0 ? '+' : '-'}$${fmt(Math.abs(trade.profit))}` }] : []),
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <span className="font-mono text-[9px] tracking-widest uppercase text-[#38384a] block">{label}</span>
                            <span className="font-mono text-xs text-[#6a6a7e]">{value}</span>
                          </div>
                        ))}
                      </div>

                      <span className="font-mono text-[10px] text-[#38384a]">{fmtDate(trade.ts)}</span>
                    </div>

                    {/* Right: outcome controls */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {!trade.outcome ? (
                        <>
                          {(['WIN', 'LOSS', 'BE', 'PARTIAL'] as const).map(o => (
                            <button
                              key={o}
                              onClick={() => setOutcome(trade.id, o)}
                              className={`font-mono text-[10px] px-2.5 py-1 border transition-colors select-none
                                ${o === 'WIN' ? 'border-[#4a9e72]/30 text-[#4a9e72] hover:bg-[#4a9e72]/10'
                                  : o === 'LOSS' ? 'border-[#b84040]/30 text-[#b84040] hover:bg-[#b84040]/10'
                                  : o === 'PARTIAL' ? 'border-[#c4a25a]/30 text-[#c4a25a] hover:bg-[#c4a25a]/10'
                                  : 'border-[#2a2a38] text-[#6a6a7e] hover:bg-[#1f1f2a]'}`}
                              style={{ borderRadius: 0 }}
                            >
                              {o === 'BE' ? 'B/E' : o}
                            </button>
                          ))}
                          <button
                            onClick={() => setProfitDrafts(drafts => ({ ...drafts, [trade.id]: drafts[trade.id] ?? '' }))}
                            className="font-mono text-[10px] px-2.5 py-1 border border-[#c4a25a]/30 text-[#c4a25a] hover:bg-[#c4a25a]/10 transition-colors"
                            style={{ borderRadius: 0 }}
                          >
                            PARTIAL
                          </button>
                          {Object.prototype.hasOwnProperty.call(profitDrafts, trade.id) && (
                            <div className="flex flex-col gap-1 mt-1">
                              <input
                                type="number"
                                step="0.01"
                                value={profitDrafts[trade.id]}
                                onChange={event => setProfitDrafts(drafts => ({ ...drafts, [trade.id]: event.target.value }))}
                                placeholder="Profit made"
                                className="font-mono text-[10px] w-24 px-2 py-1 bg-[#0f0f14] border border-[#c4a25a]/30 text-[#e0dfd8] focus:outline-none"
                                style={{ borderRadius: 0 }}
                              />
                              <button
                                onClick={() => setPartialProfit(trade.id)}
                                className="font-mono text-[10px] px-2.5 py-1 border border-[#c4a25a]/30 text-[#c4a25a] hover:bg-[#c4a25a]/10"
                                style={{ borderRadius: 0 }}
                              >
                                Save $ 
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {trade.outcome === 'PARTIAL' && (
                            <button
                              onClick={() => setProfitDrafts(drafts => ({ ...drafts, [trade.id]: String(trade.profit ?? '') }))}
                              className="font-mono text-[10px] px-2.5 py-1 border border-[#c4a25a]/30 text-[#c4a25a] hover:bg-[#c4a25a]/10 transition-colors"
                              style={{ borderRadius: 0 }}
                            >
                              Edit P&L
                            </button>
                          )}
                          <button
                            onClick={() => setOutcome(trade.id, undefined)}
                            className="font-mono text-[10px] px-2.5 py-1 border border-[#1f1f2a] text-[#38384a] hover:text-[#6a6a7e] hover:border-[#2a2a38] transition-colors"
                            style={{ borderRadius: 0 }}
                          >
                            Reopen
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteTrade(trade.id)}
                        className="font-mono text-[10px] px-2.5 py-1 border border-transparent text-[#38384a] hover:text-[#b84040] hover:border-[#b84040]/20 transition-colors"
                        style={{ borderRadius: 0 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
