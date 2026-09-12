import { supabase } from './supabase';

// Shared localStorage state for journal + settings

export interface TradeEntry {
  id: string;
  ts: number;
  instrument: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp?: number;
  lotSize: number;
  riskUsd: number;
  slPips: number;
  tpPips?: number;
  profit?: number;
  rr?: number;
  outcome?: 'WIN' | 'LOSS' | 'BE';
}

export interface Settings {
  accountBalance: number;
  defaultRiskPct: number;
  defaultRiskUsd: number;
  defaultMaxLot: number;
  defaultInstrument: string;
}

export const DEFAULT_SETTINGS: Settings = {
  accountBalance: 10000,
  defaultRiskPct: 1,
  defaultRiskUsd: 100,
  defaultMaxLot: 50,
  defaultInstrument: 'XAU/USD',
};

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let userIdPromise: Promise<string | null> | null = null;

export type AuthUser = { id: string; email?: string };

async function getUserId() {
  if (!supabase) return null;
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return session.user.id;
      const { data, error } = await supabase.auth.signInAnonymously();
      return error ? null : data.user?.id ?? null;
    })();
  }
  return userIdPromise;
}

async function sync() {
  const userId = await getUserId();
  if (!userId) return;
  await supabase!.from('app_state').upsert({
    user_id: userId,
    settings: load('psc_settings', DEFAULT_SETTINGS),
    journal: load<TradeEntry[]>('psc_journal', []),
    updated_at: new Date().toISOString(),
  });
}

export const store = {
  getSettings: (): Settings => load('psc_settings', DEFAULT_SETTINGS),
  saveSettings: (s: Settings) => { save('psc_settings', s); void sync(); },
  getJournal: (): TradeEntry[] => load('psc_journal', []),
  addTrade: (t: TradeEntry) => {
    const j = load<TradeEntry[]>('psc_journal', []);
    save('psc_journal', [t, ...j]);
    void sync();
  },
  updateOutcome: (id: string, outcome: TradeEntry['outcome']) => {
    const j = load<TradeEntry[]>('psc_journal', []);
    save('psc_journal', j.map(t => t.id === id ? { ...t, outcome } : t));
    void sync();
  },
  deleteTrade: (id: string) => {
    const j = load<TradeEntry[]>('psc_journal', []);
    save('psc_journal', j.filter(t => t.id !== id));
    void sync();
  },
  hydrate: async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data, error } = await supabase!.from('app_state')
      .select('settings, journal').eq('user_id', userId).maybeSingle();
    if (error) return;
    if (!data) {
      await sync();
      return;
    }
    if (data.settings) save('psc_settings', data.settings);
    if (Array.isArray(data.journal)) save('psc_journal', data.journal);
  },
  getAuthUser: async (): Promise<AuthUser | null> => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user && !user.is_anonymous ? { id: user.id, email: user.email } : null;
  },
  signIn: async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    userIdPromise = Promise.resolve(data.user.id);
    await sync();
    return { id: data.user.id, email: data.user.email } satisfies AuthUser;
  },
  signUp: async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session && data.user) {
      userIdPromise = Promise.resolve(data.user.id);
      await sync();
    }
    return Boolean(data.session);
  },
  signOut: async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    userIdPromise = null;
  },
};
