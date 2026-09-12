import { useEffect, useState } from 'react';
import { store, DEFAULT_SETTINGS, type Settings } from '../lib/store';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTRUMENTS = ['XAU/USD','EUR/USD','GBP/USD','AUD/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD'];

function FieldLabel({ children, desc }: { children: React.ReactNode; desc?: string }) {
  return (
    <div className="mb-1.5">
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#6a6a7e]">{children}</div>
      {desc && <div className="text-[11px] text-[#38384a] mt-0.5">{desc}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...store.getSettings(),
  }));
  const [saved, setSaved] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(!isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    void Promise.all([
      store.hydrate(),
      store.getAuthUser().then(user => setUserEmail(user?.email ?? null)),
    ]).then(() => {
      setS({ ...DEFAULT_SETTINGS, ...store.getSettings() });
      setAuthLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserEmail(user && !user.is_anonymous ? user.email ?? null : null);
      setAuthLoaded(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setInstallMessage('Use your browser menu and choose Install XSFX or Add to Home Screen.');
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallMessage(choice.outcome === 'accepted' ? 'XSFX was installed.' : 'Installation was cancelled.');
    setInstallPrompt(null);
  }

  async function submitAuth() {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (authMode === 'signIn') {
        const user = await store.signIn(email, password);
        setUserEmail(user.email ?? email);
        setPassword('');
        setAuthMessage('Signed in. Your settings and journal are synced.');
      } else {
        const hasSession = await store.signUp(email, password);
        setAuthMessage(hasSession ? 'Account created and synced.' : 'Check your email to confirm your account.');
        if (hasSession) setUserEmail(email);
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await store.signOut();
    setUserEmail(null);
    setAuthMessage('Signed out. Local storage remains available on this device.');
  }

  function upd<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function save() {
    store.saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function reset() {
    setS(DEFAULT_SETTINGS);
    setSaved(false);
  }

  const inputCls = `font-mono w-full bg-[#0f0f14] border border-[#1f1f2a] text-[#e0dfd8]
    text-sm px-3 py-2.5 focus:outline-none focus:border-[#c4a25a]/60 hover:border-[#2a2a38]
    transition-all placeholder:text-[#38384a]`;

  const riskPct = s.accountBalance > 0 ? (s.defaultRiskUsd / s.accountBalance) * 100 : 0;

  return (
    <div className="flex flex-col h-full page-enter overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[#1f1f2a] bg-[#09090c] flex-shrink-0">
        <h1 className="text-[13px] font-medium text-[#e0dfd8] tracking-wide">Settings</h1>
        <p className="text-xs text-[#38384a] mt-0.5">Defaults applied to every new calculation.</p>
      </div>

      <div className="flex-1 px-6 py-6 max-w-[560px] flex flex-col gap-8">

        {/* App installation */}
        <section>
          <div className="font-mono text-[10px] tracking-widest uppercase text-[#c4a25a] mb-4 pb-2 border-b border-[#1f1f2a]">
            Install App
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-[#e0dfd8]">XSFX on your device</div>
              <div className="text-[11px] text-[#38384a] mt-1">Open XSFX fullscreen from your home screen or desktop.</div>
            </div>
            <button onClick={() => void installApp()} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border border-[#c4a25a]/40 text-[#c4a25a] hover:bg-[#c4a25a]/8" style={{ borderRadius: 0 }}>
              Install XSFX
            </button>
          </div>
          {installMessage && <p className="text-[11px] text-[#6a6a7e] mt-3">{installMessage}</p>}
        </section>

        {/* Account sync */}
        <section>
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#c4a25a] mb-4 pb-2 border-b border-[#1f1f2a]">
              Cloud Account
            </div>
            {!isSupabaseConfigured ? (
              <p className="text-[11px] text-[#6a6a7e] leading-relaxed">
                Cloud login is not configured for this deployment. Add the Supabase environment variables in Vercel to enable account sync.
              </p>
            ) : !authLoaded ? (
              <p className="text-[11px] text-[#6a6a7e]">Checking account status...</p>
            ) : userEmail ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-[#e0dfd8]">{userEmail}</div>
                  <div className="text-[11px] text-[#38384a] mt-1">Settings and journal sync across devices.</div>
                </div>
                <button onClick={signOut} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border border-[#1f1f2a] text-[#6a6a7e] hover:border-[#2a2a38] hover:text-[#aaa]" style={{ borderRadius: 0 }}>
                  Sign Out
                </button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); void submitAuth(); }} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required className={inputCls} style={{ borderRadius: 0 }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (6+ characters)" minLength={6} required className={inputCls} style={{ borderRadius: 0 }} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={authBusy} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border border-[#c4a25a]/40 text-[#c4a25a] hover:bg-[#c4a25a]/8 disabled:opacity-50" style={{ borderRadius: 0 }}>
                    {authBusy ? 'Please wait' : authMode === 'signIn' ? 'Sign In' : 'Create Account'}
                  </button>
                  <button type="button" onClick={() => setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn')} className="font-mono text-[10px] text-[#6a6a7e] hover:text-[#aaa]">
                    {authMode === 'signIn' ? 'Create an account' : 'Already have an account? Sign in'}
                  </button>
                </div>
                {authMessage && <p className="text-[11px] text-[#6a6a7e]">{authMessage}</p>}
              </form>
            )}
        </section>

        {/* Account */}
        <section>
          <div className="font-mono text-[10px] tracking-widest uppercase text-[#c4a25a] mb-4 pb-2 border-b border-[#1f1f2a]">
            Account
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel desc="Used to compute risk %">Account Balance</FieldLabel>
              <div className="flex items-stretch">
                <span className="font-mono flex items-center px-3 bg-[#141419] border border-r-0 border-[#1f1f2a] text-[#6a6a7e] text-sm select-none">$</span>
                <input
                  type="number"
                  value={s.accountBalance}
                  onChange={e => upd('accountBalance', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                  style={{ borderRadius: 0 }}
                  placeholder="10000"
                />
              </div>
            </div>
            <div>
              <FieldLabel desc={`= ${riskPct.toFixed(2)}% of account`}>Default Risk ($)</FieldLabel>
              <div className="flex items-stretch">
                <span className="font-mono flex items-center px-3 bg-[#141419] border border-r-0 border-[#1f1f2a] text-[#6a6a7e] text-sm select-none">$</span>
                <input
                  type="number"
                  value={s.defaultRiskUsd}
                  onChange={e => upd('defaultRiskUsd', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                  style={{ borderRadius: 0 }}
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* Risk % quick-set */}
          <div className="mt-3">
            <FieldLabel>Quick set risk by %</FieldLabel>
            <div className="flex gap-1.5">
              {[0.5, 1, 1.5, 2, 3].map(pct => (
                <button
                  key={pct}
                  onClick={() => upd('defaultRiskUsd', Math.round(s.accountBalance * pct / 100))}
                  className="font-mono text-[10px] px-2.5 py-1.5 border border-[#1f1f2a] text-[#6a6a7e] hover:border-[#2a2a38] hover:text-[#c4a25a] transition-colors bg-[#0f0f14] select-none"
                  style={{ borderRadius: 0 }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Trading defaults */}
        <section>
          <div className="font-mono text-[10px] tracking-widest uppercase text-[#c4a25a] mb-4 pb-2 border-b border-[#1f1f2a]">
            Trading Defaults
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Default Instrument</FieldLabel>
              <div className="relative">
                <select
                  value={s.defaultInstrument}
                  onChange={e => upd('defaultInstrument', e.target.value)}
                  className={`${inputCls} cursor-pointer`}
                  style={{ borderRadius: 0 }}
                >
                  {INSTRUMENTS.map(i => (
                    <option key={i} value={i} className="bg-[#0f0f14]">{i}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[#6a6a7e] text-xs">▾</span>
              </div>
            </div>
            <div>
              <FieldLabel desc="0 = no limit">Max Lot Size</FieldLabel>
              <input
                type="number"
                value={s.defaultMaxLot || ''}
                onChange={e => upd('defaultMaxLot', parseFloat(e.target.value) || 0)}
                placeholder="50"
                className={inputCls}
                style={{ borderRadius: 0 }}
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <div className="font-mono text-[10px] tracking-widest uppercase text-[#c4a25a] mb-4 pb-2 border-b border-[#1f1f2a]">
            About
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#1f1f2a]">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'Storage', value: isSupabaseConfigured ? 'Cloud' : 'Local' },
              { label: 'Theme', value: 'Dark' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#09090c] px-4 py-3">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#38384a] block mb-1">{label}</span>
                <span className="font-mono text-xs text-[#6a6a7e]">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 px-6 py-4 border-t border-[#1f1f2a] bg-[#09090c] flex gap-3 flex-shrink-0">
        <button
          onClick={save}
          className={`flex-1 font-mono text-xs tracking-widest uppercase py-3 border transition-all duration-150 select-none
            ${saved
              ? 'border-[#4a9e72]/50 text-[#4a9e72] bg-[#4a9e72]/5'
              : 'border-[#c4a25a]/40 text-[#c4a25a] hover:bg-[#c4a25a]/8'
            }`}
          style={{ borderRadius: 0 }}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
        <button
          onClick={reset}
          className="font-mono text-xs tracking-widest uppercase px-5 py-3 border border-[#1f1f2a] text-[#38384a] hover:text-[#6a6a7e] hover:border-[#2a2a38] transition-colors select-none"
          style={{ borderRadius: 0 }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
