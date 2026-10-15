import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import {
  BarChart2, BookOpen, Clock, Settings, ChevronDown,
  TrendingUp, Wallet, Play, ArrowRight, CheckCircle,
  ArrowUp, ArrowDown, Crosshair, Maximize2, Camera,
  Lock, Menu, X, ExternalLink, RefreshCw, Copy, Check,
  Sliders, Shield, Zap, HelpCircle, Layers, Download
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OBLevel   { price: number; qty: number; }
interface TradeRow  { id: string; txHash: string; type: 'BUY' | 'SELL' | 'CANCEL'; price: number | null; qty: string; totalUSD: string; time: string; block: number; isNew?: boolean; }
interface Toast     { id: number; msg: string; kind: 'ok' | 'warn' | 'info' | 'err'; icon: string; }
interface UserSt    { demo: number; usd: number; escrowDemo: number; escrowUSD: number; }

// ─── Demo Steps ───────────────────────────────────────────────────────────────
const STEPS = [
  { n:1, title:'Connect & Prepare',  desc:'Wallets loaded. Ready to start the onchain demo.',
    detail: null },
  { n:2, title:'User A Sells',        desc:'Sell 1.0 DEMO at 100 tUSD. The contract escrows 1.0 DEMO.',
    detail:'📋 OrderPlaced emitted · 1.0 DEMO → escrow · SELL rests at 100.00 tUSD' },
  { n:3, title:'User B Buys',         desc:'Buy 0.4 DEMO at max 105 tUSD. 42 tUSD is escrowed.',
    detail:'📋 OrderPlaced emitted · 42 tUSD → escrow (0.4 × 105) · Crossing ask at 100' },
  { n:4, title:'Match at 100',        desc:'Resting sell price wins. A gets 40 tUSD, B gets 0.4 DEMO, 2 tUSD refunded.',
    detail:'🔥 Trade(0.4 DEMO @ 100) · A: +40 tUSD · B: +0.4 DEMO · B refund: +2 tUSD' },
  { n:5, title:'Partial Fill',        desc:'0.6 DEMO remains open on the book.',
    detail:'📊 OrderUpdated emitted · 0.6 DEMO @ 100 tUSD still resting on ask' },
  { n:6, title:'Cancel & Refund',     desc:'User A cancels remaining. 0.6 DEMO returned to wallet.',
    detail:'✅ OrderCancelled emitted · 0.6 DEMO → User A · Ask level removed' },
  { n:7, title:'Verify Onchain',      desc:'View the full execution trail on the block explorer.',
    detail:'🔗 All events & token transfers verifiable · Transparent. Trustless. Onchain.' },
];

const ASKS0: OBLevel[] = [
  { price:100, qty:1.0 },
  { price:101, qty:1.2 },
  { price:102, qty:0.5 },
  { price:103, qty:0.3 },
  { price:104, qty:0.2 },
];
const BIDS0: OBLevel[] = [
  { price:99, qty:2.0 },
  { price:98, qty:1.5 },
  { price:97, qty:1.0 },
  { price:96, qty:0.8 },
  { price:95, qty:0.5 },
];

// ─── Candle generator ─────────────────────────────────────────────────────────
interface Candle { o:number; h:number; l:number; c:number; t:number; }

function makeCandles(n: number, tf: string = '15m'): Candle[] {
  const out: Candle[] = [];
  let p = 100;
  const now = Date.now();
  const stepMs = tf === '1m' ? 60000 : tf === '5m' ? 300000 : tf === '15m' ? 900000 : tf === '1h' ? 3600000 : tf === '4h' ? 14400000 : 86400000;
  const volMultiplier = tf === '1m' ? 0.6 : tf === '1D' ? 3.5 : 1.4;

  for (let i = n; i >= 0; i--) {
    const o = p;
    const move = (Math.random() - 0.49) * volMultiplier;
    const c = Math.max(93, Math.min(108, o + move));
    const h = Math.max(o, c) + Math.random() * (volMultiplier * 0.5);
    const l = Math.min(o, c) - Math.random() * (volMultiplier * 0.5);
    out.push({ o, h, l, c, t: now - i * stepMs });
    p = c;
  }
  return out;
}

// ─── SVG Candle Chart ─────────────────────────────────────────────────────────
function CandleChart({ candles }: { candles: Candle[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 600, h: 260 });

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => {
      setSz({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = sz;
  const pad = { t: 10, b: 24, l: 4, r: 52 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const minP = Math.min(...candles.map(c => c.l)) - 0.4;
  const maxP = Math.max(...candles.map(c => c.h)) + 0.4;
  const rng  = maxP - minP || 1;
  const toY  = (p: number) => pad.t + ((maxP - p) / rng) * ch;
  const bw   = Math.max(3, (cw / candles.length) * 0.65);
  const gap  = cw / candles.length;
  const pLbls = [0, 0.25, 0.5, 0.75, 1].map(f => minP + f * rng);

  const fmtT = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const last = candles[candles.length - 1];

  return (
    <div ref={wrap} style={{ width:'100%', height:'100%' }}>
      <svg width={w} height={h} style={{ display:'block' }}>
        {pLbls.map((p, i) => {
          const y = toY(p);
          return (
            <g key={i}>
              <line x1={pad.l} x2={w-pad.r} y1={y} y2={y} stroke="#2a2d34" strokeWidth="1" strokeDasharray="4 4"/>
              <text x={w-pad.r+4} y={y+4} fontSize="9" fill="#5c6370" fontFamily="JetBrains Mono,monospace">{p.toFixed(1)}</text>
            </g>
          );
        })}

        {last && (() => {
          const y = toY(last.c);
          return (
            <>
              <line x1={pad.l} x2={w-pad.r} y1={y} y2={y} stroke="#f5c518" strokeWidth="1" strokeDasharray="3 3" opacity=".65"/>
              <rect x={w-pad.r+1} y={y-8} width={46} height={16} rx="3" fill="#f5c518"/>
              <text x={w-pad.r+24} y={y+4} fontSize="9" fill="#0a0b0d" fontFamily="JetBrains Mono,monospace" textAnchor="middle" fontWeight="700">
                {last.c.toFixed(2)}
              </text>
            </>
          );
        })()}

        {candles.map((c, i) => {
          const x = pad.l + i * gap + gap / 2;
          const up = c.c >= c.o;
          const col = up ? '#26a69a' : '#ef5350';
          const by = toY(Math.max(c.o, c.c));
          const bh = Math.max(1, toY(Math.min(c.o, c.c)) - by);
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={toY(c.h)} y2={toY(c.l)} stroke={col} strokeWidth="1"/>
              <rect x={x - bw/2} y={by} width={bw} height={bh} fill={col} opacity=".9" rx="1"/>
            </g>
          );
        })}

        {candles
          .filter((_, i) => i % Math.ceil(candles.length / 5) === 0)
          .map((c, i) => {
            const idx = i * Math.ceil(candles.length / 5);
            const x = pad.l + idx * gap + gap / 2;
            return (
              <text key={i} x={x} y={h-4} fontSize="9" fill="#5c6370"
                fontFamily="JetBrains Mono,monospace" textAnchor="middle">
                {fmtT(c.t)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

// ─── SVG Market Depth Chart ───────────────────────────────────────────────────
function DepthChart({ asks, bids }: { asks: OBLevel[]; bids: OBLevel[] }) {
  const sortedBids = [...bids].sort((a,b) => b.price - a.price);
  const sortedAsks = [...asks].sort((a,b) => a.price - b.price);

  let cumBid = 0;
  const bidPts = sortedBids.map(b => {
    cumBid += b.qty;
    return { price: b.price, cum: cumBid };
  });

  let cumAsk = 0;
  const askPts = sortedAsks.map(a => {
    cumAsk += a.qty;
    return { price: a.price, cum: cumAsk };
  });

  const maxCum = Math.max(cumBid, cumAsk, 1);
  const minP = Math.min(...bids.map(b=>b.price), 94);
  const maxP = Math.max(...asks.map(a=>a.price), 106);

  return (
    <div style={{ width: '100%', height: 180, position: 'relative' }}>
      <svg width="100%" height="180" viewBox="0 0 600 180" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0.02"/>
          </linearGradient>
          <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef5350" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#ef5350" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* Bids Area: x from 0 to 290 */}
        <polygon
          points={`0,170 ${bidPts.map((p, i) => `${(i / (bidPts.length - 1 || 1)) * 280},${170 - (p.cum / maxCum) * 140}`).join(' ')} 280,170`}
          fill="url(#bidGrad)"
        />
        <polyline
          points={bidPts.map((p, i) => `${(i / (bidPts.length - 1 || 1)) * 280},${170 - (p.cum / maxCum) * 140}`).join(' ')}
          fill="none" stroke="#26a69a" strokeWidth="2"
        />

        {/* Center line */}
        <line x1="300" y1="10" x2="300" y2="170" stroke="#2a2d34" strokeDasharray="3 3"/>
        <text x="300" y="24" fontSize="10" fill="#f5c518" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="700">
          Mid: 99.50 tUSD
        </text>

        {/* Asks Area: x from 310 to 590 */}
        <polygon
          points={`310,170 ${askPts.map((p, i) => `${310 + (i / (askPts.length - 1 || 1)) * 280},${170 - (p.cum / maxCum) * 140}`).join(' ')} 590,170`}
          fill="url(#askGrad)"
        />
        <polyline
          points={askPts.map((p, i) => `${310 + (i / (askPts.length - 1 || 1)) * 280},${170 - (p.cum / maxCum) * 140}`).join(' ')}
          fill="none" stroke="#ef5350" strokeWidth="2"
        />

        {/* Labels */}
        <text x="140" y="150" fontSize="11" fill="#26a69a" fontWeight="700" textAnchor="middle">
          BIDS: {cumBid.toFixed(2)} DEMO
        </text>
        <text x="460" y="150" fontSize="11" fill="#ef5350" fontWeight="700" textAnchor="middle">
          ASKS: {cumAsk.toFixed(2)} DEMO
        </text>
      </svg>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#f5c518"/>
      <path d="M8 10L16 6L24 10L16 14Z" fill="#0a0b0d" opacity=".9"/>
      <path d="M8 10L8 18L16 22L16 14Z" fill="#0a0b0d" opacity=".6"/>
      <path d="M24 10L24 18L16 22L16 14Z" fill="#0a0b0d" opacity=".75"/>
      <path d="M16 14L16 22L8 18L8 22L16 26L24 22L24 18Z" fill="#0a0b0d" opacity=".5"/>
    </svg>
  );
}

// ─── App Component ────────────────────────────────────────────────────────────
export default function App() {
  // Topbar and Sidebar Navigation states
  const [tab, setTab]       = useState<'spot'|'book'|'history'>('spot');
  const [nav, setNav]       = useState<'trade'|'portfolio'|'analytics'|'docs'|'settings'>('trade');
  const [sideOpen, setSideOpen] = useState(false);
  const [tf, setTf]         = useState('15m');

  // Network & Wallet dropdowns
  const [netMenuOpen, setNetMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('Starknet Sepolia');
  const [activeAccount, setActiveAccount] = useState<'A' | 'B'>('A');

  // Interactive Demo workflow
  const [step, setStep]     = useState(1);
  const [done, setDone]     = useState<number[]>([1]);

  // Order Book & Balances
  const [asks, setAsks]     = useState<OBLevel[]>(ASKS0);
  const [bids, setBids]     = useState<OBLevel[]>(BIDS0);
  const [trades, setTrades] = useState<TradeRow[]>([
    {
      id: 'tx-0',
      txHash: '0x07a4...e91c',
      type: 'BUY',
      price: 100.00,
      qty: '0.5000 DEMO',
      totalUSD: '50.00 tUSD',
      time: '14:28:10',
      block: 491204
    }
  ]);
  const [candles, setCandles] = useState(() => makeCandles(60, '15m'));

  // Balances
  const [userA, setUserA]   = useState<UserSt>({ demo: 100, usd: 0,   escrowDemo: 0, escrowUSD: 0 });
  const [userB, setUserB]   = useState<UserSt>({ demo: 0,   usd: 100, escrowDemo: 0, escrowUSD: 0 });

  // Custom Order Form state
  const [side, setSide]     = useState<'buy'|'sell'>('buy');
  const [qty, setQty]       = useState('0.4');
  const [price, setPrice]   = useState('105');

  // History Filter
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'CANCEL'>('ALL');

  // Settings state
  const [slippage, setSlippage] = useState('0.5%');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);

  const addToast = useCallback((msg: string, kind: Toast['kind'], icon: string) => {
    const id = ++tid.current;
    setToasts(t => [...t, { id, msg, kind, icon }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  const ts = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  };

  // Timeframe change handler
  const handleTfChange = (newTf: string) => {
    setTf(newTf);
    setCandles(makeCandles(60, newTf));
    addToast(`Timeframe changed to ${newTf}`, 'info', '⏱️');
  };

  // ── Run Step in Demo ──
  const runStep = useCallback(() => {
    if (step >= STEPS.length) return;

    if (step === 1) {
      setUserA(p => ({ ...p, demo: p.demo - 1.0, escrowDemo: 1.0 }));
      addToast('OrderPlaced — SELL 1.0 DEMO @ 100 tUSD · 1.0 DEMO escrowed', 'info', '📋');
      setFlashA(true); setTimeout(() => setFlashA(false), 700);
    }
    else if (step === 2) {
      setUserB(p => ({ ...p, usd: p.usd - 42, escrowUSD: 42 }));
      addToast('OrderPlaced — BUY 0.4 DEMO @ 105 tUSD · 42 tUSD escrowed', 'info', '📋');
      setFlashB(true); setTimeout(() => setFlashB(false), 700);
    }
    else if (step === 3) {
      setUserA(p => ({ ...p, usd: p.usd + 40, escrowDemo: 0.6 }));
      setUserB(p => ({ ...p, demo: p.demo + 0.4, usd: 60, escrowUSD: 0 }));
      setAsks(prev => {
        const cp = [...prev];
        if (cp[0]?.price === 100) cp[0] = { ...cp[0], qty: 0.6 };
        return cp;
      });
      setTrades(prev => [
        {
          id: `tx-${Date.now()}`,
          txHash: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random().toString(16).substring(2, 6)}`,
          type: 'BUY',
          price: 100,
          qty: '0.4000 DEMO',
          totalUSD: '40.00 tUSD',
          time: ts(),
          block: 491205,
          isNew: true
        },
        ...prev
      ]);
      addToast('Trade(0.4 DEMO @ 100) · A: +40 tUSD · B: +0.4 DEMO · B refund: +2 tUSD', 'ok', '🔥');
      setFlashA(true); setFlashB(true);
      setTimeout(() => { setFlashA(false); setFlashB(false); }, 700);
    }
    else if (step === 4) {
      addToast('OrderUpdated — 0.6 DEMO remaining @ 100 tUSD on ask', 'info', '📊');
    }
    else if (step === 5) {
      setUserA(p => ({ ...p, demo: p.demo + 0.6, escrowDemo: 0 }));
      setAsks(prev => prev.filter(a => a.price !== 100));
      setTrades(prev => [
        {
          id: `tx-${Date.now()}`,
          txHash: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random().toString(16).substring(2, 6)}`,
          type: 'CANCEL',
          price: null,
          qty: '0.6000 DEMO',
          totalUSD: '0.00 tUSD',
          time: ts(),
          block: 491206,
          isNew: true
        },
        ...prev
      ]);
      addToast('OrderCancelled — 0.6 DEMO returned to User A', 'ok', '✅');
      setFlashA(true); setTimeout(() => setFlashA(false), 700);
    }
    else if (step === 6) {
      addToast('All events & transfers verifiable · Transparent. Trustless. Onchain.', 'info', '🔗');
    }

    setDone(d => [...d.filter(x => x !== step), step]);
    setStep(s => Math.min(s + 1, STEPS.length));
  }, [step, addToast]);

  // Reset Demo State
  const handleResetDemo = () => {
    setStep(1);
    setDone([1]);
    setAsks(ASKS0);
    setBids(BIDS0);
    setUserA({ demo: 100, usd: 0, escrowDemo: 0, escrowUSD: 0 });
    setUserB({ demo: 0, usd: 100, escrowDemo: 0, escrowUSD: 0 });
    addToast('Demo state reset to initial setup', 'info', '🔄');
  };

  // Place Custom Order from form
  const handlePlaceCustomOrder = () => {
    const q = parseFloat(qty);
    const p = parseFloat(price);
    if (isNaN(q) || q <= 0 || isNaN(p) || p <= 0) {
      addToast('Please enter valid numeric quantity and price', 'warn', '⚠️');
      return;
    }

    if (side === 'buy') {
      const bestAsk = asks[0]?.price ?? 100;
      if (p >= bestAsk) {
        // Match immediately
        const execPrice = bestAsk;
        const total = q * execPrice;
        setUserB(u => ({ ...u, demo: u.demo + q, usd: Math.max(0, u.usd - total) }));
        setUserA(u => ({ ...u, usd: u.usd + total }));
        setTrades(t => [
          {
            id: `tx-${Date.now()}`,
            txHash: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random().toString(16).substring(2, 6)}`,
            type: 'BUY',
            price: execPrice,
            qty: `${q.toFixed(4)} DEMO`,
            totalUSD: `${total.toFixed(2)} tUSD`,
            time: ts(),
            block: 491207,
            isNew: true
          },
          ...t
        ]);
        addToast(`Matched BUY ${q} DEMO @ ${execPrice.toFixed(2)} tUSD (Onchain settled)`, 'ok', '🔥');
      } else {
        // Rest on bids
        setBids(b => [{ price: p, qty: q }, ...b].sort((x, y) => y.price - x.price));
        setUserB(u => ({ ...u, escrowUSD: u.escrowUSD + (q * p) }));
        addToast(`Resting BUY order placed: ${q} DEMO @ ${p} tUSD`, 'info', '📥');
      }
    } else {
      const bestBid = bids[0]?.price ?? 99;
      if (p <= bestBid) {
        // Match immediately
        const execPrice = bestBid;
        const total = q * execPrice;
        setUserA(u => ({ ...u, demo: Math.max(0, u.demo - q), usd: u.usd + total }));
        setUserB(u => ({ ...u, demo: u.demo + q }));
        setTrades(t => [
          {
            id: `tx-${Date.now()}`,
            txHash: `0x${Math.random().toString(16).substring(2, 6)}...${Math.random().toString(16).substring(2, 6)}`,
            type: 'SELL',
            price: execPrice,
            qty: `${q.toFixed(4)} DEMO`,
            totalUSD: `${total.toFixed(2)} tUSD`,
            time: ts(),
            block: 491208,
            isNew: true
          },
          ...t
        ]);
        addToast(`Matched SELL ${q} DEMO @ ${execPrice.toFixed(2)} tUSD (Onchain settled)`, 'ok', '🔥');
      } else {
        // Rest on asks
        setAsks(a => [{ price: p, qty: q }, ...a].sort((x, y) => x.price - y.price));
        setUserA(u => ({ ...u, escrowDemo: u.escrowDemo + q }));
        addToast(`Resting SELL order placed: ${q} DEMO @ ${p} tUSD`, 'info', '📤');
      }
    }
  };

  // Faucet actions in Portfolio
  const handleClaimFaucet = (token: 'DEMO' | 'tUSD') => {
    if (activeAccount === 'A') {
      if (token === 'DEMO') setUserA(u => ({ ...u, demo: u.demo + 10 }));
      else setUserA(u => ({ ...u, usd: u.usd + 1000 }));
    } else {
      if (token === 'DEMO') setUserB(u => ({ ...u, demo: u.demo + 10 }));
      else setUserB(u => ({ ...u, usd: u.usd + 1000 }));
    }
    addToast(`Claimed +${token === 'DEMO' ? '10.00 DEMO' : '1,000 tUSD'} from test faucet!`, 'ok', '🚰');
  };

  // Computed order book values
  const bestAsk    = asks[0]?.price ?? null;
  const bestBid    = bids[0]?.price ?? null;
  const spread     = bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : '—';
  const spreadPct  = bestAsk && bestBid ? (((bestAsk - bestBid) / bestAsk) * 100).toFixed(2) : '—';
  const estEscrow  = parseFloat(qty||'0') * parseFloat(price||'0');
  const crosses    = side === 'buy' && bestAsk !== null && parseFloat(price) >= bestAsk;
  const indicative = crosses ? `${bestAsk?.toFixed(2)} tUSD` : '—';
  const maxQty     = Math.max(...asks.map(a=>a.qty), ...bids.map(b=>b.qty), 1);

  const navItems = [
    { id:'trade',     label:'Trade',     Icon:BarChart2 },
    { id:'portfolio', label:'Portfolio', Icon:Wallet },
    { id:'analytics', label:'Analytics', Icon:TrendingUp },
    { id:'docs',      label:'Docs',      Icon:BookOpen },
    { id:'settings',  label:'Settings',  Icon:Settings },
  ];

  // Filtered trades for history view
  const filteredTrades = trades.filter(t => {
    if (historyFilter === 'ALL') return true;
    return t.type === historyFilter;
  });

  return (
    <div className="app">

      {/* ── TOPBAR ── */}
      <header className="topbar">
        <div className="topbar-logo" onClick={() => { setNav('trade'); setTab('spot'); }}>
          <button className="hamburger" onClick={(e) => { e.stopPropagation(); setSideOpen(o => !o); }} aria-label="menu">
            {sideOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <Logo />
          <span className="logo-text">STARKEX</span>
        </div>

        {/* Topbar Subtabs: always working */}
        <nav className="topbar-tabs">
          {(['spot','book','history'] as const).map(t => (
            <button
              key={t}
              className={`topbar-tab ${nav==='trade' && tab===t ? 'on' : ''}`}
              onClick={() => {
                setNav('trade');
                setTab(t);
              }}
            >
              {t==='spot' ? 'Spot' : t==='book' ? 'Order Book' : 'Trade History'}
            </button>
          ))}
        </nav>

        {/* Topbar Right Controls */}
        <div className="topbar-right">
          {/* Network Picker */}
          <div style={{ position: 'relative' }}>
            <button
              className={`pill-btn ${netMenuOpen ? 'active' : ''}`}
              onClick={() => { setNetMenuOpen(o => !o); setWalletMenuOpen(false); }}
            >
              <span className="net-dot"/>
              {selectedNetwork}
              <ChevronDown size={11}/>
            </button>
            {netMenuOpen && (
              <div className="topbar-dropdown">
                {['Starknet Sepolia', 'Starknet Mainnet', 'Arbitrum Sepolia', 'Local Devnet'].map(net => (
                  <button
                    key={net}
                    className={`dropdown-item ${selectedNetwork === net ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedNetwork(net);
                      setNetMenuOpen(false);
                      addToast(`Switched network to ${net}`, 'info', '🌐');
                    }}
                  >
                    <span>{net}</span>
                    {selectedNetwork === net && <Check size={12}/>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wallet Picker */}
          <div style={{ position: 'relative' }}>
            <button
              className={`pill-btn wallet ${walletMenuOpen ? 'active' : ''}`}
              onClick={() => { setWalletMenuOpen(o => !o); setNetMenuOpen(false); }}
            >
              <Wallet size={12}/>
              User {activeAccount} ({activeAccount === 'A' ? 'Seller' : 'Buyer'})
              <ChevronDown size={11}/>
            </button>
            {walletMenuOpen && (
              <div className="topbar-dropdown">
                <button
                  className={`dropdown-item ${activeAccount === 'A' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveAccount('A');
                    setWalletMenuOpen(false);
                    addToast('Active account switched to User A (Seller)', 'info', '👤');
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>User A (Seller)</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{userA.demo.toFixed(2)} DEMO · {userA.usd.toFixed(2)} tUSD</div>
                  </div>
                  {activeAccount === 'A' && <Check size={12}/>}
                </button>
                <button
                  className={`dropdown-item ${activeAccount === 'B' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveAccount('B');
                    setWalletMenuOpen(false);
                    addToast('Active account switched to User B (Buyer)', 'info', '👤');
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>User B (Buyer)</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{userB.demo.toFixed(2)} DEMO · {userB.usd.toFixed(2)} tUSD</div>
                  </div>
                  {activeAccount === 'B' && <Check size={12}/>}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY ROW ── */}
      <div className="body-row">

        {/* Sidebar overlay on mobile */}
        {sideOpen && <div className="sidebar-overlay" onClick={() => setSideOpen(false)}/>}

        {/* Sidebar */}
        <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-btn ${nav===id ? 'on' : ''}`}
              onClick={() => {
                setNav(id as typeof nav);
                setSideOpen(false);
              }}
            >
              <Icon size={15}/>
              {label}
            </button>
          ))}

          <div className="sidebar-spacer"/>
          <div className="sidebar-foot">
            <div className="tagline">Transparent Trading<br/>Onchain. Always.</div>
            <div className="grid-art"/>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ── */}
        <div className="main">

          {/* VIEW 1: TRADE VIEW */}
          {nav === 'trade' && (
            <>
              {/* SUBTAB 1A: SPOT TRADING DESK */}
              {tab === 'spot' && (
                <>
                  {/* Ticker bar */}
                  <div className="ticker">
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span className="ticker-name">DEMO / tUSD</span>
                        <ChevronDown size={13} color="var(--text-3)"/>
                      </div>
                      <div className="ticker-sub">Limit order book · Test tokens</div>
                    </div>
                    <div>
                      <div className="ticker-price">$100.00</div>
                      <div className="ticker-price-lbl">Demo execution price</div>
                    </div>
                    <div className="stat"><span className="stat-lbl">24h Change</span><span className="stat-val pos">+1.02%</span></div>
                    <div className="stat"><span className="stat-lbl">24h Volume</span><span className="stat-val">$4,280.00</span></div>
                    <div className="stat"><span className="stat-lbl">24h High</span><span className="stat-val">$104.00</span></div>
                    <div className="stat"><span className="stat-lbl">24h Low</span><span className="stat-val">$95.00</span></div>
                  </div>

                  {/* Trading row (Chart + Book + Demo) */}
                  <div className="trading-row">
                    {/* Chart */}
                    <div className="chart-col">
                      <div className="chart-tools">
                        {['1m','5m','15m','1h','4h','1D'].map(t => (
                          <button key={t} className={`tf-btn ${tf===t?'on':''}`} onClick={() => handleTfChange(t)}>{t}</button>
                        ))}
                        <div className="vsep"/>
                        <button className="tool-btn" onClick={() => addToast('Crosshair cursor enabled', 'info', '🎯')}><Crosshair size={13}/></button>
                        <button className="tool-btn" onClick={() => addToast('Volume bars overlay active', 'info', '📊')}><BarChart2 size={13}/></button>
                        <button className="tool-btn" onClick={() => addToast('Trendline indicator attached', 'info', '📈')}><TrendingUp size={13}/></button>
                        <button className="tool-btn" style={{ marginLeft:'auto' }} onClick={() => addToast('Chart snapshot copied to clipboard', 'ok', '📷')}><Camera size={13}/></button>
                        <button className="tool-btn" onClick={() => addToast('Maximized chart view', 'info', '⤢')}><Maximize2 size={13}/></button>
                      </div>
                      <div className="chart-wrap">
                        <CandleChart candles={candles}/>
                      </div>
                    </div>

                    {/* Order Book */}
                    <div className="ob-col">
                      <div className="ob-head">
                        <span className="ob-head-title">Order Book</span>
                        <span className="ob-head-sub">Price / Qty</span>
                      </div>
                      <div className="ob-cols">
                        <span>Price (tUSD)</span>
                        <span style={{ textAlign:'right' }}>Qty (DEMO)</span>
                      </div>

                      {/* Asks */}
                      <div className="ob-asks">
                        {asks.slice().reverse().map(a => (
                          <div
                            key={a.price}
                            className="ob-row ask"
                            onClick={() => {
                              setPrice(a.price.toString());
                              setQty(a.qty.toString());
                              setSide('buy');
                              addToast(`Loaded ${a.qty} DEMO @ ${a.price} into Order Form`, 'info', '⚡');
                            }}
                          >
                            <div className="ob-bar" style={{ width:`${(a.qty/maxQty)*100}%` }}/>
                            <span className="ob-p">{a.price.toFixed(2)}</span>
                            <span className={`ob-q ${a.qty > 0.8 ? 'bold' : ''}`}>{a.qty.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="ob-spread">
                        <span>Spread</span>
                        <span className="ob-spread-v">{spread} tUSD ({spreadPct}%)</span>
                      </div>

                      {/* Bids */}
                      <div className="ob-bids">
                        {bids.map(b => (
                          <div
                            key={b.price}
                            className="ob-row bid"
                            onClick={() => {
                              setPrice(b.price.toString());
                              setQty(b.qty.toString());
                              setSide('sell');
                              addToast(`Loaded ${b.qty} DEMO @ ${b.price} into Order Form`, 'info', '⚡');
                            }}
                          >
                            <div className="ob-bar" style={{ width:`${(b.qty/maxQty)*100}%` }}/>
                            <span className="ob-p">{b.price.toFixed(2)}</span>
                            <span className={`ob-q ${b.qty > 1.5 ? 'bold' : ''}`}>{b.qty.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Demo Workflow Panel */}
                    <div className="demo-col">
                      <div className="demo-head">
                        <button className="demo-play" onClick={runStep} title="Run next step">
                          <Play size={15} fill="#0a0b0d" color="#0a0b0d"/>
                        </button>
                        <div>
                          <div className="dh-title">Demo Workflow</div>
                          <div className="dh-sub">Follow the complete trading lifecycle on STARKEX</div>
                        </div>
                      </div>

                      <div className="demo-steps">
                        {STEPS.map(s => {
                          const isDone   = done.includes(s.n) && s.n !== step;
                          const isActive = s.n === step;
                          return (
                            <div
                              key={s.n}
                              className={`d-step ${isDone?'done':''} ${isActive?'active':''}`}
                              onClick={() => { if (isDone || isActive) setStep(s.n); }}
                            >
                              <div className="d-num">
                                {isDone ? <CheckCircle size={12}/> : s.n}
                              </div>
                              <div className="d-body">
                                <div className="d-title">{s.title}</div>
                                <div className="d-desc">{s.desc}</div>
                                {isActive && s.detail && (
                                  <div className="d-card slide-up">
                                    <b>{s.detail}</b>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        className="demo-next"
                        onClick={runStep}
                        disabled={step >= STEPS.length}
                      >
                        {step >= STEPS.length
                          ? <><CheckCircle size={14}/> Demo Complete</>
                          : <>Next Step <ArrowRight size={14}/></>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="bottom-row">
                    {/* User cards */}
                    <div className="users-panel">
                      <div className="ucard">
                        <div className="ucard-hd">
                          <div className="uavatar s"><ArrowUp size={12}/></div>
                          <span className="uname">User A</span>
                          <span className="urole s">Seller</span>
                        </div>
                        <div className="ubals">
                          <div>
                            <div className="bal-lbl">Avail DEMO</div>
                            <div className={`bal-val ${flashA?'flash':''}`}>{userA.demo.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="bal-lbl">Avail tUSD</div>
                            <div className={`bal-val ${flashA?'flash':''}`}>{userA.usd.toFixed(2)}</div>
                          </div>
                        </div>
                        {userA.escrowDemo > 0 && (
                          <div className="escrow-tag w">
                            <Lock size={9}/>
                            {userA.escrowDemo.toFixed(1)} DEMO in escrow
                          </div>
                        )}
                      </div>

                      <div className="ucard">
                        <div className="ucard-hd">
                          <div className="uavatar b"><ArrowDown size={12}/></div>
                          <span className="uname">User B</span>
                          <span className="urole b">Buyer</span>
                        </div>
                        <div className="ubals">
                          <div>
                            <div className="bal-lbl">Avail DEMO</div>
                            <div className={`bal-val ${flashB?'flash':''}`}>{userB.demo.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="bal-lbl">Avail tUSD</div>
                            <div className={`bal-val ${flashB?'flash':''}`}>{userB.usd.toFixed(2)}</div>
                          </div>
                        </div>
                        {userB.escrowUSD > 0 && (
                          <div className="escrow-tag w">
                            <Lock size={9}/>
                            {userB.escrowUSD.toFixed(0)} tUSD escrowed
                          </div>
                        )}
                        {step > 4 && userB.usd === 60 && (
                          <div className="escrow-tag g">
                            <CheckCircle size={9}/>
                            2.00 tUSD refunded
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trade History Preview */}
                    <div className="hist-panel">
                      <div className="hist-hd">
                        <span className="hist-title">Trade History</span>
                        <button className="view-all" onClick={() => setTab('history')}>
                          View All ({trades.length}) →
                        </button>
                      </div>
                      <table className="hist-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="hist-empty">No trades yet — run the demo →</td>
                            </tr>
                          ) : trades.slice(0, 4).map((t, i) => (
                            <tr key={i} className={t.isNew ? 'new-row' : ''}>
                              <td>
                                <span className={`t-dot ${t.type.toLowerCase()}`}/>
                                <span className={`t-type ${t.type.toLowerCase()}`}>{t.type}</span>
                              </td>
                              <td>{t.price !== null ? t.price.toFixed(2) : '—'}</td>
                              <td>{t.qty}</td>
                              <td>{t.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Order Form */}
                    <div className="form-panel">
                      <div className="fp-title">Try a custom order</div>
                      <div className="fp-sub">
                        Place a limit order that crosses or rests on the book.
                      </div>

                      <div className="bs-toggle">
                        <button className={`bs-btn buy ${side==='buy'?'on':''}`} onClick={() => setSide('buy')}>Buy</button>
                        <button className={`bs-btn sell ${side==='sell'?'on':''}`} onClick={() => setSide('sell')}>Sell</button>
                      </div>

                      <div className="f-row">
                        <div className="f-grp">
                          <label className="f-lbl">Quantity (DEMO)</label>
                          <input className="f-inp" value={qty} onChange={e => setQty(e.target.value)} placeholder="0.0"/>
                        </div>
                        <div className="f-grp">
                          <label className="f-lbl">Limit price (tUSD)</label>
                          <input className="f-inp" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.0"/>
                        </div>
                      </div>

                      <div className="f-sum">
                        <div className="f-sum-r">
                          <span className="f-sum-l">Estimated escrow</span>
                          <span className="f-sum-v g">{isNaN(estEscrow) ? '—' : `${estEscrow.toFixed(2)} tUSD`}</span>
                        </div>
                        <div className="f-sum-r">
                          <span className="f-sum-l">Order condition</span>
                          <span className={`f-sum-v ${crosses?'b':''}`}>{crosses ? 'Crosses resting ask' : 'Rests on book'}</span>
                        </div>
                        <div className="f-sum-r">
                          <span className="f-sum-l">Indicative price</span>
                          <span className="f-sum-v">{indicative}</span>
                        </div>
                      </div>

                      <button className="prev-btn" onClick={handlePlaceCustomOrder}>
                        Place Demo {side.toUpperCase()} Order
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* SUBTAB 1B: DEDICATED FULL ORDER BOOK VIEW */}
              {tab === 'book' && (
                <div className="view-container">
                  <div className="view-header">
                    <div>
                      <div className="vh-title"><Layers size={22} color="var(--gold)"/> Order Book & Market Depth</div>
                      <div className="vh-sub">Real-time Level-2 order book depth with onchain tick & lot size precision</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="action-btn" onClick={() => setTab('spot')}>← Back to Spot</button>
                      <button className="action-btn gold" onClick={runStep}>Advance Demo Step →</button>
                    </div>
                  </div>

                  <div className="cards-grid">
                    <div className="metric-card">
                      <span className="mc-lbl">Best Bid</span>
                      <span className="mc-val" style={{ color: 'var(--bid)' }}>${bestBid?.toFixed(2) ?? '—'}</span>
                      <span className="mc-sub">Highest buying price</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Best Ask</span>
                      <span className="mc-val" style={{ color: 'var(--ask)' }}>${bestAsk?.toFixed(2) ?? '—'}</span>
                      <span className="mc-sub">Lowest selling price</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Market Spread</span>
                      <span className="mc-val" style={{ color: 'var(--gold)' }}>{spread} tUSD</span>
                      <span className="mc-sub">{spreadPct}% spread difference</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Order Book Imbalance</span>
                      <span className="mc-val">58% Bids</span>
                      <span className="mc-sub">5.8 DEMO bids vs 3.2 DEMO asks</span>
                    </div>
                  </div>

                  {/* Market Depth Visual */}
                  <div className="depth-chart-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-2)' }}>
                        Cumulative Market Depth
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                        Green: Bids · Red: Asks
                      </span>
                    </div>
                    <DepthChart asks={asks} bids={bids} />
                  </div>

                  {/* Split Tables: Bids & Asks */}
                  <div className="tables-split">
                    {/* Bids Table */}
                    <div className="full-table-card">
                      <div style={{ padding: '10px 14px', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: 'var(--bid)' }}>BUY ORDERS (BIDS)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{bids.length} Levels</span>
                      </div>
                      <table className="full-ob-table">
                        <thead>
                          <tr>
                            <th>Price (tUSD)</th>
                            <th>Size (DEMO)</th>
                            <th>Total (tUSD)</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bids.map((b, i) => (
                            <tr key={i} className="full-ob-row">
                              <td style={{ color: 'var(--bid)', fontWeight: 600 }}>{b.price.toFixed(2)}</td>
                              <td>{b.qty.toFixed(4)}</td>
                              <td>{(b.price * b.qty).toFixed(2)}</td>
                              <td>
                                <button
                                  className="view-all"
                                  onClick={() => {
                                    setPrice(b.price.toString());
                                    setSide('sell');
                                    setTab('spot');
                                    addToast(`Loaded ${b.price} to Spot form`, 'info', '⚡');
                                  }}
                                >
                                  Sell At Bid
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Asks Table */}
                    <div className="full-table-card">
                      <div style={{ padding: '10px 14px', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: 'var(--ask)' }}>SELL ORDERS (ASKS)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{asks.length} Levels</span>
                      </div>
                      <table className="full-ob-table">
                        <thead>
                          <tr>
                            <th>Price (tUSD)</th>
                            <th>Size (DEMO)</th>
                            <th>Total (tUSD)</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {asks.map((a, i) => (
                            <tr key={i} className="full-ob-row">
                              <td style={{ color: 'var(--ask)', fontWeight: 600 }}>{a.price.toFixed(2)}</td>
                              <td>{a.qty.toFixed(4)}</td>
                              <td>{(a.price * a.qty).toFixed(2)}</td>
                              <td>
                                <button
                                  className="view-all"
                                  onClick={() => {
                                    setPrice(a.price.toString());
                                    setSide('buy');
                                    setTab('spot');
                                    addToast(`Loaded ${a.price} to Spot form`, 'info', '⚡');
                                  }}
                                >
                                  Buy At Ask
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 1C: DEDICATED FULL HISTORY VIEW */}
              {tab === 'history' && (
                <div className="view-container">
                  <div className="view-header">
                    <div>
                      <div className="vh-title"><Clock size={22} color="var(--gold)"/> Trade History & Activity</div>
                      <div className="vh-sub">Auditable onchain trade logs, partial fills, cancellations, and settlement records</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="action-btn" onClick={() => addToast('Exported trades to CSV format', 'ok', '📥')}>
                        <Download size={13}/> Export CSV
                      </button>
                      <button className="action-btn" onClick={() => setTab('spot')}>← Back to Spot</button>
                    </div>
                  </div>

                  <div className="cards-grid">
                    <div className="metric-card">
                      <span className="mc-lbl">Total Executed Trades</span>
                      <span className="mc-val">{trades.length}</span>
                      <span className="mc-sub">All matched onchain</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Settled Volume</span>
                      <span className="mc-val">$140.00</span>
                      <span className="mc-sub">Non-custodial escrow</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Execution Price</span>
                      <span className="mc-val" style={{ color: 'var(--gold)' }}>100.00 tUSD</span>
                      <span className="mc-sub">Maker price priority</span>
                    </div>
                    <div className="metric-card">
                      <span className="mc-lbl">Settlement Status</span>
                      <span className="mc-val" style={{ color: 'var(--green)' }}>Finalized</span>
                      <span className="mc-sub">Starknet ZK proofs verified</span>
                    </div>
                  </div>

                  {/* Filter Bar */}
                  <div className="filter-bar">
                    <div className="filter-pills">
                      {(['ALL', 'BUY', 'SELL', 'CANCEL'] as const).map(f => (
                        <button
                          key={f}
                          className={`filter-pill ${historyFilter === f ? 'active' : ''}`}
                          onClick={() => setHistoryFilter(f)}
                        >
                          {f === 'ALL' ? 'All Activity' : f}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Showing {filteredTrades.length} recorded events
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="full-table-card">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tx Hash</th>
                          <th>Type</th>
                          <th>Price</th>
                          <th>Quantity</th>
                          <th>Total Notional</th>
                          <th>Block</th>
                          <th>Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrades.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-3)' }}>
                              No transactions match the selected filter.
                            </td>
                          </tr>
                        ) : filteredTrades.map(t => (
                          <tr key={t.id}>
                            <td style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{t.txHash}</span>
                              <ExternalLink size={11} style={{ cursor: 'pointer' }} onClick={() => addToast(`Opening Starknet explorer for ${t.txHash}`, 'info', '🔗')}/>
                            </td>
                            <td>
                              <span className={`badge-tag ${t.type.toLowerCase()}`}>
                                {t.type}
                              </span>
                            </td>
                            <td>{t.price !== null ? `${t.price.toFixed(2)} tUSD` : '—'}</td>
                            <td>{t.qty}</td>
                            <td>{t.totalUSD}</td>
                            <td style={{ color: 'var(--text-3)' }}>#{t.block}</td>
                            <td>{t.time}</td>
                            <td>
                              <span className="badge-tag ok">
                                <Check size={10}/> Finalized
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* VIEW 2: PORTFOLIO VIEW */}
          {nav === 'portfolio' && (
            <div className="view-container">
              <div className="view-header">
                <div>
                  <div className="vh-title"><Wallet size={22} color="var(--gold)"/> Portfolio & Balance Manager</div>
                  <div className="vh-sub">Manage testnet wallets, inspect smart contract escrows, and claim tokens from faucets</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="action-btn" onClick={() => handleClaimFaucet('DEMO')}>+ Claim 10 DEMO</button>
                  <button className="action-btn gold" onClick={() => handleClaimFaucet('tUSD')}>+ Claim 1,000 tUSD</button>
                </div>
              </div>

              {/* User Selector Bar */}
              <div className="portfolio-user-bar">
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Active Portfolio:</span>
                <button
                  className={`user-toggle-btn ${activeAccount === 'A' ? 'active' : ''}`}
                  onClick={() => setActiveAccount('A')}
                >
                  <ArrowUp size={12} color="var(--ask)"/> User A (Seller / Maker)
                </button>
                <button
                  className={`user-toggle-btn ${activeAccount === 'B' ? 'active' : ''}`}
                  onClick={() => setActiveAccount('B')}
                >
                  <ArrowDown size={12} color="var(--bid)"/> User B (Buyer / Taker)
                </button>
              </div>

              {/* Balances Grid */}
              <div className="cards-grid">
                <div className="metric-card">
                  <span className="mc-lbl">DEMO Token Balance</span>
                  <span className="mc-val">
                    {(activeAccount === 'A' ? userA.demo : userB.demo).toFixed(4)} DEMO
                  </span>
                  <span className="mc-sub">
                    Available in wallet (~${((activeAccount === 'A' ? userA.demo : userB.demo) * 100).toFixed(2)})
                  </span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">tUSD Token Balance</span>
                  <span className="mc-val">
                    ${(activeAccount === 'A' ? userA.usd : userB.usd).toFixed(2)}
                  </span>
                  <span className="mc-sub">Ready for limit purchases</span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">Locked in Smart Contract Escrow</span>
                  <span className="mc-val" style={{ color: 'var(--gold)' }}>
                    {activeAccount === 'A'
                      ? `${userA.escrowDemo.toFixed(2)} DEMO`
                      : `${userB.escrowUSD.toFixed(2)} tUSD`}
                  </span>
                  <span className="mc-sub">Active resting orders in OrderBook.sol</span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">Total Estimated Net Worth</span>
                  <span className="mc-val" style={{ color: 'var(--green)' }}>
                    ${(
                      ((activeAccount === 'A' ? userA.demo + userA.escrowDemo : userB.demo) * 100) +
                      (activeAccount === 'A' ? userA.usd : userB.usd + userB.escrowUSD)
                    ).toFixed(2)}
                  </span>
                  <span className="mc-sub">Non-custodial Starknet balance</span>
                </div>
              </div>

              {/* Faucet Box */}
              <div className="faucet-box">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Interactive Testnet Token Faucets</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    Mint instant test tokens to simulate large buy or sell orders on the order book.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="action-btn" onClick={() => handleClaimFaucet('DEMO')}>
                    Claim 10.00 DEMO
                  </button>
                  <button className="action-btn" onClick={() => handleClaimFaucet('tUSD')}>
                    Claim 1,000.00 tUSD
                  </button>
                  <button className="action-btn gold" onClick={handleResetDemo}>
                    Reset All Balances
                  </button>
                </div>
              </div>

              {/* Active Escrow Table */}
              <div className="full-table-card">
                <div style={{ padding: '12px 16px', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>CURRENT CONTRACT ESCROW ALLOCATIONS</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Token</th>
                      <th>Escrow Amount</th>
                      <th>Contract Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>User A (Seller)</td>
                      <td>DEMO (18 dec)</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{userA.escrowDemo.toFixed(4)} DEMO</td>
                      <td>{userA.escrowDemo > 0 ? '🔒 Escrow Locked (Resting Ask @ 100)' : 'Unlocked / Idle'}</td>
                      <td>
                        {userA.escrowDemo > 0 ? (
                          <button
                            className="view-all"
                            onClick={() => {
                              setUserA(p => ({ ...p, demo: p.demo + p.escrowDemo, escrowDemo: 0 }));
                              addToast('Cancelled order & refunded DEMO escrow', 'ok', '🔓');
                            }}
                          >
                            Cancel & Unlock
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>User B (Buyer)</td>
                      <td>tUSD (6 dec)</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{userB.escrowUSD.toFixed(2)} tUSD</td>
                      <td>{userB.escrowUSD > 0 ? '🔒 Escrow Locked (Crossing Bid @ 105)' : 'Unlocked / Idle'}</td>
                      <td>
                        {userB.escrowUSD > 0 ? (
                          <button
                            className="view-all"
                            onClick={() => {
                              setUserB(p => ({ ...p, usd: p.usd + p.escrowUSD, escrowUSD: 0 }));
                              addToast('Cancelled order & refunded tUSD escrow', 'ok', '🔓');
                            }}
                          >
                            Cancel & Unlock
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: ANALYTICS VIEW */}
          {nav === 'analytics' && (
            <div className="view-container">
              <div className="view-header">
                <div>
                  <div className="vh-title"><TrendingUp size={22} color="var(--gold)"/> DEX Protocol Analytics</div>
                  <div className="vh-sub">Onchain Central Limit Order Book performance, latency, and gas efficiency statistics</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="action-btn" onClick={() => addToast('Refreshed onchain metrics from RPC', 'ok', '🔄')}>
                    <RefreshCw size={13}/> Refresh Stats
                  </button>
                </div>
              </div>

              <div className="cards-grid">
                <div className="metric-card">
                  <span className="mc-lbl">24h Trading Volume</span>
                  <span className="mc-val">$48,250.00</span>
                  <span className="mc-sub">+18.4% from previous epoch</span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">Total Value Locked (TVL)</span>
                  <span className="mc-val">$184,500</span>
                  <span className="mc-sub">Non-custodial contract pools</span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">Avg Gas Cost per Trade</span>
                  <span className="mc-val" style={{ color: 'var(--green)' }}>&lt; $0.001</span>
                  <span className="mc-sub">Starknet ZK-Rollup vs L1 ($14.20)</span>
                </div>
                <div className="metric-card">
                  <span className="mc-lbl">Order Matching Latency</span>
                  <span className="mc-val" style={{ color: 'var(--gold)' }}>12 ms</span>
                  <span className="mc-sub">100% Onchain FIFO execution</span>
                </div>
              </div>

              {/* Architecture comparison */}
              <div className="docs-section">
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  ⚡ Why STARKEX: Onchain CLOB vs Offchain Order Books & AMMs
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>STARKEX (Onchain CLOB)</th>
                      <th>Offchain Relayers (dYdX / 0x)</th>
                      <th>AMMs (Uniswap)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Custody & Escrow</td>
                      <td style={{ color: 'var(--green)' }}>Smart contract escrow only</td>
                      <td>Centralized or hybrid server</td>
                      <td>Smart contract pool</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Order Priority</td>
                      <td style={{ color: 'var(--green)' }}>Strict FIFO price-time</td>
                      <td>Sequencer discretion</td>
                      <td>Miner / MEV extractable</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Slippage</td>
                      <td style={{ color: 'var(--green)' }}>Zero slippage for makers</td>
                      <td>Low</td>
                      <td style={{ color: 'var(--ask)' }}>High slippage on size</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Refund of Improvement</td>
                      <td style={{ color: 'var(--green)' }}>Automatic price improvement refund</td>
                      <td>Varies by relayer</td>
                      <td>None</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: DOCS VIEW */}
          {nav === 'docs' && (
            <div className="view-container">
              <div className="view-header">
                <div>
                  <div className="vh-title"><BookOpen size={22} color="var(--gold)"/> Smart Contract Documentation</div>
                  <div className="vh-sub">Technical specifications, Cairo/Solidity interfaces, and execution invariants</div>
                </div>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="action-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={13}/> GitHub Repo
                </a>
              </div>

              <div className="docs-section">
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                  1. Exact Integer Math & Units Invariant
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  To guarantee absolute zero rounding dust and prevent calculation exploits, STARKEX enforces:
                  <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li><strong>LOT_SIZE</strong> = 1e15 (Minimum base quantity step = 0.001 DEMO)</li>
                    <li><strong>TICK_SIZE</strong> = 1e4 (Minimum price step = 0.01 tUSD)</li>
                    <li><strong>quoteAmount(qty, price)</strong> = (qty * price) / 1e18 (Always an exact integer!)</li>
                  </ul>
                </div>
              </div>

              <div className="docs-section">
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                  2. Cairo / Solidity Contract Interface
                </div>
                <pre className="docs-code">
{`// SPDX-License-Identifier: MIT
contract OrderBook is ReentrancyGuard {
    // Places a limit order with bounded execution loop
    function placeOrder(
        bool isBuy,
        uint32 tick,
        uint128 qty,
        uint8 maxFills
    ) external nonReentrant returns (uint64 orderId, uint128 filled);

    // O(1) order cancellation using FIFO linked-list
    function cancelOrder(uint64 orderId) external nonReentrant;

    // Emitted on resting and crossing matches
    event OrderPlaced(uint64 indexed orderId, address indexed trader, bool isBuy, uint32 tick, uint128 qty);
    event Trade(uint64 indexed orderId, address indexed maker, address indexed taker, uint32 price, uint128 qty);
    event OrderCancelled(uint64 indexed orderId, address indexed trader, uint128 refundedQty);
}`}
                </pre>
              </div>

              <div className="docs-section">
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                  3. The 6-Step Escrow & Settlement Lifecycle
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  1. <strong>Seller escrows base:</strong> User A calls <code>placeOrder(SELL, 100, 1.0 DEMO)</code>. Contract pulls 1.0 DEMO into escrow.<br/>
                  2. <strong>Buyer escrows limit quote:</strong> User B calls <code>placeOrder(BUY, 105, 0.4 DEMO)</code>. Contract pulls 42 tUSD (0.4 × 105).<br/>
                  3. <strong>Maker price execution:</strong> Contract matches at 100 tUSD (maker price). Seller receives 40 tUSD, Buyer receives 0.4 DEMO, and Buyer is refunded 2 tUSD in the same atomic transaction.<br/>
                  4. <strong>Partial fill rests:</strong> 0.6 DEMO remains open at the top of the ask side.<br/>
                  5. <strong>Cancellation:</strong> Seller cancels remaining order; 0.6 DEMO is instantly unlocked and returned.
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: SETTINGS VIEW */}
          {nav === 'settings' && (
            <div className="view-container">
              <div className="view-header">
                <div>
                  <div className="vh-title"><Settings size={22} color="var(--gold)"/> Platform Settings</div>
                  <div className="vh-sub">Configure network endpoints, slippage thresholds, and demo simulation parameters</div>
                </div>
                <button className="action-btn gold" onClick={handleResetDemo}>
                  <RefreshCw size={13}/> Reset Demo Data
                </button>
              </div>

              <div className="settings-group">
                <div className="settings-row">
                  <div>
                    <div className="sr-title">Default Network Target</div>
                    <div className="sr-desc">Select which Starknet / EVM environment to interact with</div>
                  </div>
                  <select
                    className="f-inp"
                    style={{ width: 180 }}
                    value={selectedNetwork}
                    onChange={e => {
                      setSelectedNetwork(e.target.value);
                      addToast(`Target network updated to ${e.target.value}`, 'info', '🌐');
                    }}
                  >
                    <option value="Starknet Sepolia">Starknet Sepolia (Testnet)</option>
                    <option value="Starknet Mainnet">Starknet Mainnet</option>
                    <option value="Arbitrum Sepolia">Arbitrum Sepolia</option>
                    <option value="Local Devnet">Local Katana Devnet</option>
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="sr-title">Max Allowed Slippage Tolerance</div>
                    <div className="sr-desc">Reject orders if price improvement exceeds slippage bounds</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['0.1%', '0.5%', '1.0%', '3.0%'].map(s => (
                      <button
                        key={s}
                        className={`filter-pill ${slippage === s ? 'active' : ''}`}
                        onClick={() => {
                          setSlippage(s);
                          addToast(`Slippage set to ${s}`, 'info', '⚙️');
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="sr-title">Sound Effects & Execution Chimes</div>
                    <div className="sr-desc">Play audio cue when onchain order matches or settles</div>
                  </div>
                  <button
                    className={`user-toggle-btn ${soundEnabled ? 'active' : ''}`}
                    onClick={() => {
                      setSoundEnabled(e => !e);
                      addToast(`Sound effects ${!soundEnabled ? 'enabled' : 'disabled'}`, 'info', '🔔');
                    }}
                  >
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="sr-title">Order Book Auto-Scroll</div>
                    <div className="sr-desc">Automatically center order book view on the mid-market spread</div>
                  </div>
                  <button
                    className={`user-toggle-btn ${autoScroll ? 'active' : ''}`}
                    onClick={() => {
                      setAutoScroll(a => !a);
                      addToast(`Auto-scroll ${!autoScroll ? 'enabled' : 'disabled'}`, 'info', '📜');
                    }}
                  >
                    {autoScroll ? 'Active' : 'Manual'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>{/* end main */}
      </div>{/* end body-row */}

      {/* ── STATUS BAR ── */}
      <div className="status-bar">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="demo-badge">
            <span className="demo-badge-dot"/>
            Demo Mode Active
          </div>
          <span>Fully Onchain Order Book · {selectedNetwork} · Connected: User {activeAccount}</span>
        </div>
        <span>Built with <strong style={{ color:'var(--gold)' }}>STARKEX</strong> · Onchain. Transparent. Powerful.</span>
      </div>

      {/* ── TOASTS ── */}
      <div className="toast-zone">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="t-icon">{t.icon}</span>
            {t.msg}
          </div>
        ))}
      </div>

    </div>
  );
}
