// ─────────────────────────────────────────────
// BuyerIQ — Dashboard Tab v4.7
// ─────────────────────────────────────────────
// Major upgrade from v4.6:
//  - Quick Action bar (Quote / Buyers / Trade / Market)
//  - Dynamic pitch window countdown to July + Oct
//  - This Week's Priority Buyers with [Quote] CTA
//  - Pipeline estimate from tracked buyers
//  - India trend chart with CAGR annotation
//  - Score breakdown ring in buyer tiers card
//  - Split KPI groups: Market data | Sales data
// ─────────────────────────────────────────────
import { useMemo } from 'react';
import { useData } from "../../context/DataContext.jsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Target, Users,
  ArrowUpRight, DollarSign, Globe,
  ShoppingBag, ChevronRight, Award,
  FileText, BarChart2, Radio, Package,
  Clock, Flame,
} from 'lucide-react';
import { C, TIERS } from '../../data/theme.js';
import { Card, DataSourceTag, ttStyle } from '../ui/Primitives.jsx';
import { useAPI } from '../../hooks/useAPI.js';
import { fetchOpportunities } from '../../services/api.js';

// ── Helpers ────────────────────────────────────
const fmt = (v) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
  : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K`
  : `$${v}`;

// Pitch window: days until next key date
const getPitchWindow = () => {
  const now  = new Date();
  const yr   = now.getFullYear();
  const july = new Date(yr, 6, 1);   // July 1
  const oct  = new Date(yr, 9, 1);   // Oct 1
  if (now < july) {
    const days = Math.ceil((july - now) / 86400000);
    return { days, label: 'until July pitch window', phase: 'prep', color: C.blue,   Icon: Clock };
  } else if (now < oct) {
    const days = Math.ceil((oct - now) / 86400000);
    return { days, label: 'until October peak',       phase: 'active', color: C.gold, Icon: Flame };
  } else {
    const nextJuly = new Date(yr + 1, 6, 1);
    const days = Math.ceil((nextJuly - now) / 86400000);
    return { days, label: 'until next pitch window',  phase: 'wrap',  color: C.muted, Icon: Clock };
  }
};

// Contextual action per buyer
const getBuyerAction = (buyer) => {
  const q = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
  const s = buyer.seasonal?.[q] || 0;
  if (buyer.alerts?.some(a => a.urgency === 'critical'))
    return { text: 'Respond to open alert',          color: C.red    };
  if (s >= 40)
    return { text: `Peak ${q} — pitch now`,           color: C.gold   };
  if (buyer.scores.growth >= 80)
    return { text: 'High growth — send catalog',      color: C.green  };
  if (buyer.scores.pay >= 80 && buyer.scores.margin >= 75)
    return { text: 'Premium payer — push margin SKUs',color: C.purple };
  if (buyer.tier === 'mega_volume' || buyer.tier === 'MEGA')
    return { text: 'Volume RFQ — follow up',          color: C.blue   };
  const avg = (buyer.scores.vol + buyer.scores.margin + buyer.scores.pay + buyer.scores.growth) / 4;
  if (avg >= 70)
    return { text: 'Strong scorer — schedule review', color: C.gold   };
  return { text: 'Nurture with market update',        color: C.muted  };
};

// Estimate FOB pipeline for a buyer: midFOB × MOQ lower bound
const estimatePipeline = (buyer) => {
  const fMinRaw = parseFloat(buyer.fob_min ?? buyer.fob?.min);
  const fMaxRaw = parseFloat(buyer.fob_max ?? buyer.fob?.max);
  const fMin = isNaN(fMinRaw) ? 0 : fMinRaw;
  const fMax = isNaN(fMaxRaw) ? 0 : fMaxRaw;
  const fobMid = fMin > 0 ? (fMin + fMax) / 2 : 0;
  let moqEst = 1000;
  if (buyer.moq) {
    const nums = buyer.moq.replace(/,/g, '').match(/\d+/g);
    if (nums && nums.length >= 2) moqEst = (parseInt(nums[0]) + parseInt(nums[1])) / 2;
    else if (nums && nums.length === 1) moqEst = parseInt(nums[0]);
  }
  return fobMid * moqEst;
};

// ── KPI Card ────────────────────────────────────
const KpiCard = ({ icon: Icon, value, label, sub, accent = C.gold, trend, onClick }) => (
  <div onClick={onClick} style={{
    background: 'linear-gradient(135deg,#161616 0%,#111111 100%)',
    border: `1px solid ${accent}25`,
    borderRadius: 10,
    padding: '14px 16px',
    cursor: onClick ? 'pointer' : 'default',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color={accent} strokeWidth={2} />
      </div>
      {trend != null && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
          background: trend >= 0 ? C.green + '18' : C.red + '18',
          color: trend >= 0 ? C.green : C.red,
        }}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div style={{ fontSize: 20, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10, color: C.text, fontWeight: 600, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);

// ── Quick Action Button ────────────────────────
const QBtn = ({ icon: Icon, label, accent, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    background: accent + '12', border: `1px solid ${accent}30`,
    color: accent, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }}
    onMouseEnter={e => { e.currentTarget.style.background = accent + '22'; e.currentTarget.style.borderColor = accent + '60'; }}
    onMouseLeave={e => { e.currentTarget.style.background = accent + '12'; e.currentTarget.style.borderColor = accent + '30'; }}
  >
    <Icon size={12} strokeWidth={2.5} />
    {label}
  </button>
);

const TabDashboard = ({ go, rates }) => {
  const { BUYERS, tradeStats, alerts: dbAlerts, shipments, counts } = useData();

  // Follow-up tracker
  const followups = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return BUYERS.flatMap(b => {
      const crm = (() => { try { return JSON.parse(localStorage.getItem('crm_' + b.id) || '{}'); } catch { return {}; } })();
      if (!crm.next_followup) return [];
      const due = new Date(crm.next_followup); due.setHours(0,0,0,0);
      const diff = Math.round((due - today) / 86400000);
      if (diff > 7) return [];
      return [{ buyer: b, diff, overdue: diff < 0, dueToday: diff === 0, stage: crm.stage }];
    }).sort((a,b) => a.diff - b.diff);
  }, [BUYERS]);
  const { data: opportunities, source: oppSource } = useAPI(
    () => fetchOpportunities({ limit: 5, min_score: 40 }),
    null,
    { cacheKey: 'dashboard-opps' }
  );

  // ── Live KPIs from Census DB ──────────────────
  const liveKPIs = useMemo(() => {
    if (!tradeStats || tradeStats.length === 0) return null;
    const census = tradeStats.filter(r => r.data_source === 'census_bureau');
    if (census.length === 0) return null;

    const allYears = [...new Set(census.map(r => String(r.year)))].sort();
    // Exclude partial years (2026 = Jan-Feb only)
    const fullYears  = allYears.filter(y => y !== '2026');
    const latestYr   = fullYears[fullYears.length - 1];
    const prevYr     = fullYears[fullYears.length - 2];
    const firstYr    = fullYears[0];

    const byYr   = (yr) => census.filter(r => String(r.year) === yr);
    const sumVal = (arr) => arr.reduce((s, r) => s + (parseFloat(r.trade_value_usd) || 0), 0);

    const latestAll        = byYr(latestYr);
    const totalUS          = sumVal(latestAll);
    const indiaTotalLatest = sumVal(latestAll.filter(r => r.partner_country === 'IND'));
    const indiaPrev        = sumVal(byYr(prevYr).filter(r => r.partner_country === 'IND'));
    const indiaFirst       = sumVal(byYr(firstYr).filter(r => r.partner_country === 'IND'));
    const chinaTotalLatest = sumVal(latestAll.filter(r => r.partner_country === 'CHN'));

    const indiaShare = totalUS > 0 ? Math.round((indiaTotalLatest / totalUS) * 100) : 0;
    const indiaYoY   = indiaPrev > 0 ? Math.round(((indiaTotalLatest - indiaPrev) / indiaPrev) * 100) : null;
    const nYears     = fullYears.length - 1;
    const cagr       = indiaFirst > 0 && nYears > 0
      ? Math.round((Math.pow(indiaTotalLatest / indiaFirst, 1 / nYears) - 1) * 100) : null;
    const opportunityGap = chinaTotalLatest - indiaTotalLatest;

    // For CAGR trendline on chart
    const indiaByYear = fullYears.map((yr, i) => {
      const val = Math.round(sumVal(byYr(yr).filter(r => r.partner_country === 'IND')) / 1e6);
      const cagrLine = cagr != null
        ? Math.round((indiaFirst / 1e6) * Math.pow(1 + cagr / 100, i))
        : null;
      return { year: yr, value: val, cagrLine };
    });

    return {
      latestYr, firstYr, totalUS, indiaTotalLatest, chinaTotalLatest,
      indiaShare, indiaYoY, cagr, opportunityGap, indiaByYear,
    };
  }, [tradeStats]);

  // ── Derived values ────────────────────────────
  const today    = new Date();
  const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateStr  = `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
  const inrRate  = rates ? (rates.INR || rates.inr || 83.5) : 83.5;
  const currentQ = `Q${Math.floor(today.getMonth() / 3) + 1}`;
  const pitch    = getPitchWindow();

  const tierData = Object.entries(TIERS).map(([k, v]) => ({
    name: v.label,
    value: BUYERS.filter(b =>
      b.tier === k ||
      b.tier === k.toLowerCase() ||
      b.tier === k.toLowerCase().replace('mid','mid_range').replace('mega','mega_volume')
    ).length,
    color: v.color,
  })).filter(d => d.value > 0);

  const critAlerts = (() => {
  // Live DB alerts (when buyers loaded from API — alerts not included in list endpoint)
  if (dbAlerts && dbAlerts.length > 0) {
    return dbAlerts
      .filter(a => a.urgency === 'critical')
      .map(a => ({
        ...a,
        buyer: BUYERS.find(b => b.id === a.buyer_id || b.dbId === a.buyer_id)?.name || a.buyer_name || '—',
        bid:   a.buyer_id,
      }));
  }
  // Static fallback (buyers from fallbacks.js have alerts embedded)
  return BUYERS.flatMap(b =>
    (b.alerts || []).filter(a => a.urgency === 'critical').map(a => ({ ...a, buyer: b.name, bid: b.id }))
  );
})();
  

  // Top 5 buyers by composite score
  const topBuyers = useMemo(() => {
    if (opportunities && Array.isArray(opportunities) && opportunities.length > 0) {
      return opportunities.slice(0, 5).map(o => ({
        name: o.market_country || o.market_country_code,
        score: o.opportunity_score, insight: o.insight_text, isLive: true,
      }));
    }
    return [...BUYERS]
      .sort((a, b) => {
        const sa = (a.scores.vol + a.scores.margin + a.scores.pay + a.scores.growth) / 4;
        const sb = (b.scores.vol + b.scores.margin + b.scores.pay + b.scores.growth) / 4;
        return sb - sa;
      })
      .slice(0, 5)
      .map(b => ({
        id: b.id, name: b.name,
        score: Math.round((b.scores.vol + b.scores.margin + b.scores.growth) / 3),
        tier: b.tier, action: getBuyerAction(b),
        fobRange: b.fob ? `$${b.fob.min}–$${b.fob.max}` : null,
        country: b.country || '',
      }));
  }, [opportunities, BUYERS]);

  // This week's priority: seasonal + critical alerts first
  const thisWeek = useMemo(() =>
    [...BUYERS]
      .map(b => ({
        ...b,
        priority: (b.alerts?.some(a => a.urgency === 'critical') ? 1000 : 0)
          + (b.seasonal?.[currentQ] || 0)
          + ((b.scores.vol + b.scores.margin + b.scores.pay + b.scores.growth) / 4) * 0.5,
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3),
  [BUYERS, currentQ]);

  // Pipeline estimate across top 10 buyers
  const pipelineTotal = useMemo(() =>
    [...BUYERS]
      .sort((a, b) => {
        const sa = (a.scores.vol + a.scores.margin + a.scores.pay + a.scores.growth) / 4;
        const sb = (b.scores.vol + b.scores.margin + b.scores.pay + b.scores.growth) / 4;
        return sb - sa;
      })
      .slice(0, 10)
      .reduce((sum, b) => sum + estimatePipeline(b), 0),
  [BUYERS]);

  const latestYr  = liveKPIs?.latestYr || '2024';
  const indiaDisp = liveKPIs ? fmt(liveKPIs.indiaTotalLatest) : '$663M';
  const chinaDisp = liveKPIs ? fmt(liveKPIs.chinaTotalLatest) : '$7.3B';
  const shareDisp = liveKPIs ? `${liveKPIs.indiaShare}%`      : '9%';
  const cagrDisp  = liveKPIs?.cagr != null ? `${liveKPIs.cagr}%` : '6%';
  const oppDisp   = liveKPIs ? fmt(liveKPIs.opportunityGap)    : '$4.3B';
  const yoyTrend  = liveKPIs?.indiaYoY ?? 6;

  return (
    <div>

      {/* ── Header + Quick Actions ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>Senses Lifestyle</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {dateStr} · Wood Kitchenware Export Intelligence
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: C.muted, padding: '3px 8px', border: `1px solid ${C.border}`, borderRadius: 6 }}>
              ₹{inrRate.toFixed(2)} / USD
            </span>
            <DataSourceTag source={tradeStats?.length > 0 ? 'api' : 'static'} />
          </div>
        </div>

        {/* Quick Action Bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <QBtn icon={FileText}  label="Generate Quote" accent={C.gold}   onClick={() => go(null, 'quote-builder')} />
          <QBtn icon={Users}     label="View Buyers"    accent={C.blue}   onClick={() => go(null, 'buyers')} />
          <QBtn icon={BarChart2} label="Trade Intel"    accent={C.purple} onClick={() => go(null, 'trade-intel')} />
          <QBtn icon={Radio}     label="Live Market"    accent={C.green}  onClick={() => go(null, 'live-market')} />
        </div>
      </div>

      {/* ── Pitch Window Banner ── */}
      <div style={{
        background: `linear-gradient(90deg, ${pitch.color}14 0%, ${pitch.color}06 100%)`,
        border: `1px solid ${pitch.color}35`, borderRadius: 10,
        padding: '10px 16px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8, background: pitch.color + '18', flexShrink: 0,
        }}>
          <pitch.Icon size={18} color={pitch.color} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: pitch.color, lineHeight: 1 }}>
              {pitch.days}
            </span>
            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>days {pitch.label}</span>
            {pitch.phase === 'active' && (
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: C.gold + '20', color: C.gold, fontWeight: 700, border: `1px solid ${C.gold}40` }}>
                PITCH ACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            {pitch.phase === 'prep'   && 'Start reaching out in July · October is peak buying month ($242.8M)'}
            {pitch.phase === 'active' && 'Buyers are ordering now · Send quotes, confirm MOQ, push for PO'}
            {pitch.phase === 'wrap'   && 'Post-peak · Review Q4 orders and plan next July pitch cycle'}
            <span style={{ color: C.green, fontWeight: 600 }}>
              {' · '}India 18% vs China 30% — 12pp tariff advantage
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI Grid — split: Market | Sales ── */}
      <div style={{ marginBottom: 18 }}>
        {/* Label row */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1px 3fr', gap: 0, marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
            Market Intelligence
          </div>
          <div />
          <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 14 }}>
            Sales Coverage
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2px 1fr 1fr 1fr', gap: 10, alignItems: 'stretch' }}>
          <KpiCard icon={DollarSign}   value={indiaDisp} label={`India → US (${latestYr})`} sub="Census CIF · All 11 HS"       accent={C.green}  trend={yoyTrend} />
          <KpiCard icon={Globe}        value={chinaDisp} label={`China → US (${latestYr})`} sub="30% tariff · Census CIF"       accent={C.red} />
          <KpiCard icon={Target}       value={oppDisp}   label="Opportunity Gap"             sub="China share not yet captured"  accent={C.purple} />
          {/* Divider */}
          <div style={{ background: C.border, borderRadius: 1, margin: '4px 0' }} />
          <KpiCard icon={Users} value={counts.buyers || BUYERS.length} label="Active Buyers" sub={`${critAlerts.length} critical · 13 countries`} accent={C.blue} onClick={() => go(null, 'alerts')} />
          <KpiCard icon={TrendingUp}   value={cagrDisp}        label="India CAGR"       sub={`Census ${liveKPIs?.firstYr||'2020'}–${latestYr}`}     accent={C.gold} />
          <KpiCard icon={ArrowUpRight} value={shareDisp}       label="India US Share"   sub={`vs China 72%`}                                  accent={C.gold} />
        </div>
      </div>

      {/* ── Critical Alerts ── */}
      {critAlerts.length > 0 && (
        <Card style={{ marginBottom: 14, borderLeft: `3px solid ${C.red}`, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={13} color={C.red} strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 900, color: C.red }}>Critical Alerts</span>
            <span style={{ fontSize: 9, color: C.muted, marginLeft: 'auto' }}>{critAlerts.length} open</span>
          </div>
          {critAlerts.map((a, i) => (
            <div key={i} onClick={() => go(a.bid, 'buyers')} style={{
              padding: '8px 10px', marginBottom: 4, background: C.red + '08',
              borderRadius: 7, cursor: 'pointer', border: `1px solid ${C.red}15`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>{a.buyer}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{a.message || a.msg || a.title || ''}</div>
              </div>
              <ChevronRight size={12} color={C.muted} />
            </div>
          ))}
        </Card>
      )}

      {/* ── THIS WEEK + TOP OPPORTUNITIES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Follow-up Tracker */}
        {followups.length > 0 && (
          <Card style={{ padding:'14px 16px', borderColor: followups.some(f=>f.overdue) ? C.red+'40' : C.amber+'40', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:13 }}>📅</span>
              <span style={{ fontSize:12, fontWeight:900, color: followups.some(f=>f.overdue) ? C.red : C.amber }}>
                Follow-ups Due
              </span>
              <span style={{ fontSize:9, background: followups.some(f=>f.overdue) ? C.red+'20' : C.amber+'20', color: followups.some(f=>f.overdue) ? C.red : C.amber, padding:'2px 8px', borderRadius:20, fontWeight:700, marginLeft:'auto' }}>
                {followups.length} pending
              </span>
            </div>
            {followups.map(({buyer:b, diff, overdue, dueToday, stage}) => (
              <div key={b.id} onClick={() => go(b.id, 'buyers')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#0d0d0d', borderRadius:7, marginBottom:6, cursor:'pointer', border:`1px solid ${overdue ? C.red+'30' : '#1a1a1a'}` }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.text }}>{b.name}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:1, textTransform:'capitalize' }}>{stage || 'cold'} · {b.tier}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:800, color: overdue ? C.red : dueToday ? C.amber : C.green, background: (overdue ? C.red : dueToday ? C.amber : C.green)+'15', padding:'3px 8px', borderRadius:20 }}>
                  {overdue ? `⚠ ${Math.abs(diff)}d overdue` : dueToday ? '🔥 Today' : `${diff}d left`}
                </span>
              </div>
            ))}
          </Card>
        )}

        {/* This Week's Priority Buyers */}
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Flame size={13} color={C.gold} strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 900, color: C.gold }}>This Week's Priority</span>
            <span style={{ fontSize: 9, color: C.muted, marginLeft: 'auto' }}>{currentQ}</span>
          </div>
          {thisWeek.map(b => {
            const action = getBuyerAction(b);
            const fobMid = b.fob ? ((b.fob.min + b.fob.max) / 2).toFixed(0) : null;
            return (
              <div key={b.id} style={{ marginBottom: 8 }}>
                <div style={{
                  padding: '10px 12px', background: '#0d0d0d', borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.name}</div>
                      <div style={{ fontSize: 9, color: action.color, fontWeight: 600, marginTop: 2 }}>{action.text}</div>
                    </div>
                    {fobMid && (
                      <span style={{ fontSize: 9, color: C.muted, background: '#161616', padding: '2px 6px', borderRadius: 4, border: `1px solid ${C.border}` }}>
                        ~${fobMid} FOB
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => go(b.id, 'quote-builder')} style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: C.gold, border: `1px solid ${C.gold}`, color: '#0a0a0a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      <FileText size={10} strokeWidth={2.5} /> Generate Quote
                    </button>
                    <button onClick={() => go(b.id, 'buyers')} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
                    }}>
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Top Opportunities + Pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card style={{ padding: '14px 16px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Award size={13} color={C.blue} strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 900, color: C.text }}>
                {oppSource === 'api' ? 'AI Opportunities' : 'Top Buyers'}
              </span>
              <DataSourceTag source={oppSource} />
            </div>
            {topBuyers.slice(0, 4).map((opp, i) => (
              <div key={i} onClick={() => opp.id && go(opp.id, 'buyers')} style={{
                padding: '7px 10px', marginBottom: 5, background: '#0d0d0d', borderRadius: 7,
                border: `1px solid ${C.border}`, cursor: opp.id ? 'pointer' : 'default',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{opp.name}</div>
                  {opp.action && (
                    <div style={{ fontSize: 9, color: opp.action.color, marginTop: 2, fontWeight: 600 }}>
                      {opp.action.text}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 900, minWidth: 36, textAlign: 'right',
                  color: opp.score >= 70 ? C.green : opp.score >= 50 ? C.gold : C.muted,
                }}>
                  {opp.score}
                </div>
              </div>
            ))}
          </Card>

          {/* Pipeline Estimate card */}
          <div style={{
            padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#161616,#111)',
            border: `1px solid ${C.purple}25`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Package size={12} color={C.purple} strokeWidth={2} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Pipeline Estimate
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.purple }}>
              {fmt(pipelineTotal)}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
              FOB potential · top 10 buyers · 1 order each
            </div>
          </div>
        </div>
      </div>

      {/* ── India Trend + Tier Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>

        {/* India trend with CAGR annotation */}
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={13} color={C.green} strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 900, color: C.text }}>India → USA Export Trend</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {liveKPIs?.cagr != null && (
                <span style={{ fontSize: 9, color: C.green, fontWeight: 700 }}>
                  {liveKPIs.cagr}% CAGR
                </span>
              )}
              <span style={{ fontSize: 9, color: C.muted }}>Census · $M CIF</span>
            </div>
          </div>
          {liveKPIs?.indiaByYear?.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={liveKPIs.indiaByYear} barSize={26} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip {...ttStyle} formatter={(v) => [`$${v}M`, 'India → US']} />
                <Bar dataKey="value" fill={C.green} radius={[4, 4, 0, 0]} opacity={0.85} />
                {/* CAGR trendline as ReferenceLine on last bar */}
                {liveKPIs.cagr != null && (
                  <ReferenceLine
                    y={liveKPIs.indiaByYear[liveKPIs.indiaByYear.length - 1]?.value}
                    stroke={C.gold} strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: `${liveKPIs.cagr}% CAGR`, position: 'insideTopRight', fill: C.gold, fontSize: 9 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Loading Census data…</span>
            </div>
          )}
        </Card>

        {/* Buyer Tiers + score legend */}
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ShoppingBag size={13} color={C.text} strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 900, color: C.text }}>Buyer Breakdown</span>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={tierData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={48} innerRadius={26}
                paddingAngle={3} strokeWidth={0}>
                {tierData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...ttStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 8 }}>
            {tierData.map(d => {
              const buyersInTier = BUYERS.filter(b =>
                b.tier === Object.keys(TIERS).find(k => TIERS[k].label === d.name) ||
                b.tier === Object.keys(TIERS).find(k => TIERS[k].label === d.name)?.toLowerCase() ||
                b.tier === Object.keys(TIERS).find(k => TIERS[k].label === d.name)?.toLowerCase()
                  .replace('mid','mid_range').replace('mega','mega_volume')
              );
              const fobBuyers = buyersInTier.filter(b => b.fob?.min > 0 && b.fob?.max > 0);
              const avgFob = fobBuyers.length > 0 ? fobBuyers.reduce((s, b) => s + (b.fob.min + b.fob.max) / 2, 0) / fobBuyers.length : 0;
              return (
                <div key={d.name} style={{ padding: '5px 7px', borderRadius: 6, background: d.color + '10', border: `1px solid ${d.color}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: d.color, fontWeight: 700 }}>{d.name}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: C.text, marginTop: 2 }}>{d.value}</div>
                  {avgFob > 0 && <div style={{ fontSize: 8, color: C.muted }}>~${avgFob.toFixed(0)} avg FOB</div>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Senses Export Activity ── */}
      {(() => {
        const sensesShips = (shipments || []).filter(s => s.raw_data?.is_senses);
        if (!sensesShips.length) return null;
        const totalKg = sensesShips.reduce((s, r) => s + (parseFloat(r.weight_kg) || 0), 0);
        const totalQty = sensesShips.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
        const knownBuyers = [...new Set(sensesShips.map(s => s.buyer_name_raw).filter(b => b && b !== 'Unknown'))];
        const products = {};
        sensesShips.forEach(s => {
          const pt = s.raw_data?.product_type || 'Other';
          products[pt] = (products[pt] || 0) + 1;
        });
        const topProds = Object.entries(products).sort((a, b) => b[1] - a[1]);
        const recent = [...sensesShips].sort((a, b) => (b.ship_date || '').localeCompare(a.ship_date || '')).slice(0, 6);
        return (
          <Card style={{ marginBottom: 14, borderColor: C.green + '30' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={13} color={C.green} strokeWidth={2.5} />
                <span style={{ fontSize: 12, fontWeight: 900, color: C.green }}>Senses Export Activity</span>
                <span style={{ fontSize: 9, color: C.muted, background: '#161616', padding: '2px 7px', borderRadius: 5, border: `1px solid ${C.border}` }}>
                  Feb–Apr 2026 · US Customs (ImportKey)
                </span>
              </div>
              <DataSourceTag source="api" />
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Shipments', val: sensesShips.length, color: C.green },
                { label: 'Total Weight', val: `${(totalKg / 1000).toFixed(0)}T`, color: C.blue },
                { label: 'Total Units', val: `${Math.round(totalQty).toLocaleString()}`, color: C.gold },
                { label: 'Confirmed Buyers', val: knownBuyers.length, color: C.purple },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: '#0e0e0e', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1.2 }}>{val}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Product mix */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Product Mix</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {topProds.map(([prod, count]) => (
                    <div key={prod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, color: C.text, flex: 1 }}>{prod}</div>
                      <div style={{ width: 60, height: 5, background: '#1a1a1a', borderRadius: 3 }}>
                        <div style={{ width: `${(count / sensesShips.length) * 100}%`, height: '100%', background: C.green, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.green, minWidth: 16, textAlign: 'right' }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent shipments */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Recent Shipments</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recent.map((s, i) => {
                    const buyer = s.buyer_name_raw;
                    const isKnown = buyer && buyer !== 'Unknown';
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 50px', gap: 6, fontSize: 10, padding: '5px 8px', background: '#0a0a0a', borderRadius: 5 }}>
                        <div style={{ color: C.muted }}>{String(s.ship_date || '').slice(0, 10)}</div>
                        <div style={{ color: isKnown ? C.blue : '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isKnown ? buyer : 'Confidential'}
                        </div>
                        <div style={{ color: C.green, textAlign: 'right' }}>
                          {s.weight_kg ? `${(parseFloat(s.weight_kg) / 1000).toFixed(1)}T` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Confirmed buyers */}
            {knownBuyers.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Confirmed Buyers</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {knownBuyers.map(b => (
                    <span key={b} onClick={() => go(null, 'buyers')} style={{ background: C.green + '15', color: C.green, fontSize: 10, padding: '3px 10px', borderRadius: 7, fontWeight: 600, cursor: 'pointer' }}>{b}</span>
                  ))}
                  {sensesShips.filter(s => !s.buyer_name_raw || s.buyer_name_raw === 'Unknown').length > 0 && (
                    <span style={{ background: '#161616', color: '#555', fontSize: 10, padding: '3px 10px', borderRadius: 7 }}>
                      + {sensesShips.filter(s => !s.buyer_name_raw || s.buyer_name_raw === 'Unknown').length} confidential
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* ── Market Context Footer ── */}
      <div style={{
        background: '#111', border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
      }}>
        {[
          { label: 'US Market Size',        value: liveKPIs ? fmt(liveKPIs.totalUS) : '$7.9B', sub: `All 11 HS · Census ${latestYr}`, color: C.text  },
          { label: 'China Vulnerability',   value: '72%',      sub: '30% tariff — actively switching',  color: C.red   },
          { label: 'India Tariff Edge',     value: '12pp',     sub: '$12 cheaper per $100 vs China',    color: C.green },
          { label: 'Peak Buying Month',     value: 'October',  sub: '$242.8M · Pitch starts July',     color: C.gold  },
          { label: 'India US Market Share', value: shareDisp,  sub: `vs China 72% — growing`,          color: C.blue  },
        ].map(d => (
          <div key={d.label} onClick={() => go(null, 'trade-intel')} style={{ borderLeft: `2px solid ${d.color}40`, paddingLeft: 10, cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: d.color }}>{d.value}</div>
            <div style={{ fontSize: 9, color: C.text, fontWeight: 600, marginTop: 2 }}>{d.label}</div>
            <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{d.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabDashboard;
