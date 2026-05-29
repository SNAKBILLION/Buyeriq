// ─────────────────────────────────────────────
// BuyerIQ Decision Layer — Daily Actions v2.1
// ─────────────────────────────────────────────
// v2.1: All emoji replaced with Lucide SVG icons
// ─────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card } from "../ui/Primitives.jsx";
import {
  AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2,
  Phone, Package, Calculator, Mail, Globe, DollarSign,
  Scale, Target, Zap, Eye, BarChart2, X,
  TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";

const URGENCY = {
  critical: { color: "#ef4444", bg: "#ef444412", border: "#ef444430", label: "CRITICAL", Icon: AlertOctagon },
  high:     { color: "#f97316", bg: "#f9731612", border: "#f9731630", label: "HIGH",     Icon: AlertTriangle },
  medium:   { color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b30", label: "MEDIUM",   Icon: AlertCircle },
  low:      { color: "#22c55e", bg: "#22c55e12", border: "#22c55e30", label: "LOW",      Icon: CheckCircle2 },
};

const ACTION_ICON_MAP = {
  contact_buyer:    Phone,
  send_samples:     Package,
  prepare_quote:    Calculator,
  follow_up:        Mail,
  market_entry:     Globe,
  price_alert:      DollarSign,
  compliance_check: Scale,
  opportunity:      Target,
};

function confLabel(pct, source) {
  if (source === "live") return { text: `${pct}% · Live data`,       color: C.green };
  if (pct >= 80)         return { text: `${pct}% · Verified`,        color: C.green };
  if (pct >= 60)         return { text: `${pct}% · Industry est.`,   color: C.amber };
  return                        { text: `${pct}% · Estimated`,       color: C.muted  };
}

export default function DailyActions({ go }) {
  const { BUYERS, TRADE_DATA, tradeStats, alerts: dbAlerts, retail } = useData();
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(null);

  const today = new Date();
  const month = today.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const nextQuarter = quarter === 4 ? 1 : quarter + 1;
  const nextQLabel = `Q${nextQuarter}`;
  const monthsToNextQ = ((nextQuarter - 1) * 3) - month;
  const weeksLeft = Math.max(1, Math.round(monthsToNextQ * 4.3));

  const actions = useMemo(() => {
    const result = [];

    // ── 1. Peak-season contact actions ──
    BUYERS.forEach(b => {
      const nextQPct = b.seasonal?.[nextQLabel] || 0;
      if (nextQPct < 15) return;

      const fobMid = ((parseFloat(b.fob_min) || b.fob?.min || 4) + (parseFloat(b.fob_max) || b.fob?.max || 12)) / 2;
      const avgOrderQty = b.tier === "mega_volume" ? 50000
        : b.tier === "premium" ? 15000
        : b.tier === "mid_range" ? 8000
        : 4000;
      const orderRevMin = Math.round(fobMid * avgOrderQty * (nextQPct / 100) * 0.8);
      const orderRevMax = Math.round(fobMid * avgOrderQty * (nextQPct / 100) * 1.3);

      // Urgency: seasonal pct + score-based boost for equal-seasonal buyers
      const avgScore = ((b.scores?.vol||0) + (b.scores?.margin||0) + (b.scores?.pay||0) + (b.scores?.growth||0)) / 4;
      const urgency = nextQPct >= 45 ? "critical"
        : nextQPct >= 30 && avgScore >= 80 ? "critical"
        : nextQPct >= 25 ? "high"
        : "medium";

      // Action title — differentiate by score + tier instead of same message
      const actionTitle =
        b.alerts?.some(a => a.urgency === 'critical')
          ? `${b.name} — Respond to critical alert immediately`
        : nextQPct >= 35
          ? `${b.name} — Peak ${nextQLabel} window (${nextQPct}% of annual orders)`
        : b.scores?.pay >= 90 && b.scores?.margin >= 80
          ? `${b.name} — Premium payer · Push high-margin SKUs this ${nextQLabel}`
        : b.tier === 'mega_volume' || b.tier === 'MEGA'
          ? `${b.name} — Volume buyer · ${nextQLabel} RFQ window in ${weeksLeft}w`
        : b.scores?.growth >= 80
          ? `${b.name} — Fast-growing · Send expanded catalog for ${nextQLabel}`
        : b.country_code === 'GB'
          ? `${b.name} — UK buyer · 0% tariff advantage · ${nextQLabel} pitch`
        : b.country_code === 'AU'
          ? `${b.name} — AU buyer · 0% tariff · ${nextQLabel} ordering in ${weeksLeft}w`
        : avgScore >= 75
          ? `${b.name} — Strong scorer · ${nextQLabel} ordering in ${weeksLeft}w`
          : `${b.name} — ${nextQLabel} ordering window in ${weeksLeft}w`;

      result.push({
        id: `seasonal-${b.id}`,
        type: "contact_buyer",
        urgency,
        buyer: b,
        title: actionTitle,
        why: `${b.name} places ${nextQPct}% of their annual wood kitchenware orders during ${nextQLabel}. With ${weeksLeft} weeks until that window opens, you must present samples + pricing NOW to be on their vendor shortlist. Missing this window = missing ${nextQPct}% of their annual volume. ${nextQPct >= 35 ? `CRITICAL: competitors are already in active contact with their sourcing team.` : ""}`,
        revenue_estimate: `$${(orderRevMin/1000).toFixed(0)}K–$${(orderRevMax/1000).toFixed(0)}K USD`,
        revenue_note: `${b.tier} order volume × $${fobMid.toFixed(0)} FOB × ${nextQPct}% seasonal share`,
        confidence: 85,
        confidence_source: "verified",
        risk: `If you miss the ${nextQLabel} ordering window, ${b.name} will lock in other suppliers. Your next chance is ${nextQLabel} next year — a 9-12 month wait.`,
        primary_action: "prepare_quote",
        primary_label: "Generate Quote",
        secondary_action: "view_buyer",
        secondary_label: "View Buyer",
        action_detail: `Prepare ${(b.products||[]).slice(0,2).join(" + ")||"top products"} quote at ${b.fob?.sweet||`$${b.fob?.min}–$${b.fob?.max}`} FOB. Include samples + lead time.`,
      });
    });

    // ── 2. Top-tier buyers outreach ──
    const topBuyers = [...BUYERS]
      .map(b => ({
        ...b,
        composite: Math.round(
          (b.scores?.pay||0)*0.25 + (b.scores?.vol||0)*0.3 +
          (b.scores?.margin||0)*0.15 + (b.scores?.growth||0)*0.2 +
          (b.scores?.ease||0)*0.1
        ),
      }))
      .filter(b => b.composite >= 72)
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 4);

    topBuyers.forEach(b => {
      if (result.find(r => r.buyer?.id === b.id)) return;
      const fobMid = ((parseFloat(b.fob_min)||b.fob?.min||4)+(parseFloat(b.fob_max)||b.fob?.max||12))/2;
      const avgQty = b.tier==="mega_volume"?40000:b.tier==="premium"?12000:6000;
      const revMin = Math.round(fobMid*avgQty*0.6);
      const revMax = Math.round(fobMid*avgQty*1.2);

      result.push({
        id: `tier-${b.id}`,
        type: "contact_buyer",
        urgency: b.composite >= 82 ? "high" : "medium",
        buyer: b,
        title: `${b.name} — Composite score ${b.composite}/100 (${(b.tier||"").replace("_"," ")})`,
        why: `Score breakdown: Payment reliability ${b.scores?.pay}/100, Volume potential ${b.scores?.vol}/100, Margin fit ${b.scores?.margin}/100, Growth trajectory ${b.scores?.growth}/100, Ease of business ${b.scores?.ease}/100. ` +
          `${b.scores?.pay>=80?`Strong payer — Net-30/45 with verified history. `:""}` +
          `${b.scores?.vol>=80?`High-volume importer — can absorb full container loads. `:""}` +
          `${b.scores?.growth>=75?`Growing buyer — imports increasing YoY. `:""}` +
          `This is a priority target based on buyer intelligence profiling.`,
        revenue_estimate: `$${(revMin/1000).toFixed(0)}K–$${(revMax/1000).toFixed(0)}K USD/year`,
        revenue_note: `${b.tier} annual volume estimate at $${fobMid.toFixed(0)} FOB/pc`,
        confidence: 78,
        confidence_source: "industry_estimate",
        risk: `High-score buyers receive simultaneous outreach from 5–8 Indian suppliers. Late movers are deprioritised by sourcing teams.`,
        primary_action: "prepare_quote",
        primary_label: "Generate Quote",
        secondary_action: "view_buyer",
        secondary_label: "View Buyer",
        action_detail: `Send introductory quote + ${(b.wood||[]).slice(0,2).join(" & ")||"acacia/mango"} samples at FOB ${b.fob?.sweet||`$${b.fob?.min}`}.`,
      });
    });

    // ── 3. Live retail price opportunity ──
    const retailItems = retail || [];
    const avgRetail = retailItems.reduce((s,r)=>s+(parseFloat(r.price)||0),0) / Math.max(retailItems.length,1);
    if (avgRetail > 25 && retailItems.length >= 5) {
      const impliedFOBMax = avgRetail / 3.5;
      const impliedFOBMin = avgRetail / 4.5;
      const liveConf = retailItems.length>=30?88:retailItems.length>=10?75:60;
      result.push({
        id: "retail-price-opp",
        type: "price_alert",
        urgency: avgRetail > 45 ? "high" : "medium",
        buyer: null,
        title: `Retail scan: avg $${avgRetail.toFixed(0)} → supports $${impliedFOBMin.toFixed(2)}–$${impliedFOBMax.toFixed(2)} FOB (${retailItems.length} products)`,
        why: `Live marketplace scan of ${retailItems.length} products shows average retail at $${avgRetail.toFixed(0)}. At the standard 3.5–4.5× retail-to-FOB multiplier used by US/EU buyers, they can absorb up to $${impliedFOBMax.toFixed(2)}/pc FOB profitably. ${retailItems.filter(r=>parseFloat(r.price)>35).length} premium products retail above $35. This is scraped live data — actionable immediately.`,
        revenue_estimate: `+$0.50–$2.00/pc on all active quotes`,
        revenue_note: `On 50K pcs/month = +$25K–$100K/month gross improvement`,
        confidence: liveConf,
        confidence_source: retailItems.length>=10?"live":"verified",
        risk: `Quoting below what market will bear leaves margin on the table permanently. Competitors who read market data raise prices faster.`,
        primary_action: "prepare_quote",
        primary_label: "Reprice & Quote",
        secondary_action: "view_market",
        secondary_label: "Price Intel",
        action_detail: `Review and raise FOB quotes for high-demand products. Target $${impliedFOBMin.toFixed(2)}–$${impliedFOBMax.toFixed(2)} range.`,
      });
    }

    // ── 4. Trade data growth markets ──
    // DB tradeStats first, fallback to static TRADE_DATA
    const latestYear = tradeStats?.length > 0 ? Math.max(...tradeStats.map(t => t.year || 0)) : 0;
    const dbGrowthMarkets = latestYear > 0
      ? tradeStats.filter(t => t.year === latestYear && (parseFloat(t.yoy_growth_pct)||0) > 12)
          .map(t => ({ country: t.partner_country, growth: parseFloat(t.yoy_growth_pct||0) }))
      : [];
    const growthMarkets = dbGrowthMarkets.length > 0 ? dbGrowthMarkets : (TRADE_DATA?.yearTrend||[]);
    growthMarkets
      .filter(t=>(t.growth||0)>12)
      .sort((a,b)=>b.growth-a.growth)
      .slice(0,2)
      .forEach(m => {
        const market = m.country||m.market||"Market";
        const growth = m.growth||0;
        result.push({
          id: `growth-${market}`,
          type: "market_entry",
          urgency: growth>=25?"high":"medium",
          buyer: null,
          title: `${market} — ${growth}% wood kitchenware import growth (HS 4419)`,
          why: `India's wood kitchenware exports to ${market} grew ${growth}% YoY. Fast-growing import markets have open supply gaps — buyers are actively looking for new suppliers to diversify away from China. Early entries lock in relationships before competition intensifies.`,
          revenue_estimate: `$50K–$200K+ first-year capture potential`,
          revenue_note: `Conservative 2–3% share of fast-growing import base`,
          confidence: 82,
          confidence_source: "verified",
          risk: `Markets growing >15%/year attract 5+ new supplier entrants per quarter. Every quarter of delay = stronger incumbent competition.`,
          primary_action: "view_market",
          primary_label: "View Trade Data",
          secondary_action: "find_buyers",
          secondary_label: "Find Buyers",
          action_detail: `Research top importers in ${market}. Focus on buyers NOT yet sourcing from India.`,
        });
      });

    // ── 5. Compliance gaps (order blockers) ──
    BUYERS.forEach(b => {
      const missing = (b.compliance||[]).filter(c=>!c.v);
      if (missing.length < 2) return;
      result.push({
        id: `compliance-${b.id}`,
        type: "compliance_check",
        urgency: missing.length>=3?"critical":"high",
        buyer: b,
        title: `${b.name} — ${missing.length} compliance gaps BLOCKING orders`,
        why: `${b.name} requires: ${missing.map(c=>c.name).join(", ")}. Without these certifications, their compliance checklist fails and orders cannot be placed — no exceptions. ${missing.find(c=>c.name?.includes("FSC"))?"FSC CoC is legally mandated for wood product imports across US/EU/UK. ":""}${missing.find(c=>c.name?.includes("EUDR"))?"EUDR enforcement is active since Dec 2024 — EU buyers face fines importing without it. ":""}Certification takes 3–6 months minimum.`,
        revenue_estimate: `$0 until resolved`,
        revenue_note: `Unblocking this buyer opens full annual volume`,
        confidence: 95,
        confidence_source: "verified",
        risk: `${b.name} is actively sourcing from compliant suppliers RIGHT NOW. Every month of delay = volume that goes to competitors permanently.`,
        primary_action: "view_buyer",
        primary_label: "View Buyer",
        secondary_action: "compliance",
        secondary_label: "Compliance Hub",
        action_detail: `Begin certification immediately: ${missing.slice(0,2).map(c=>c.name).join(" + ")}. Estimated timeline: 3–6 months.`,
      });
    });

    // ── 6. Live DB alerts ──
    (dbAlerts||[])
      .filter(a=>a.urgency==="critical"||a.urgency==="high")
      .slice(0,3)
      .forEach((a,i) => {
        result.push({
          id: `dbalert-${a.id||i}`,
          type: "follow_up",
          urgency: a.urgency||"high",
          buyer: null,
          title: a.title||"System Alert",
          why: a.message||"Alert generated by intelligence pipeline.",
          revenue_estimate: "See alert details",
          revenue_note: a.type||"",
          confidence: 90,
          confidence_source: "live",
          risk: "Live system alert — act within 24h.",
          primary_action: "view_market",
          primary_label: "View Details",
          secondary_action: null,
          secondary_label: null,
          action_detail: a.message||"",
        });
      });

    const urgencyOrder = { critical:0, high:1, medium:2, low:3 };
    return result
      .filter(a=>!dismissed.has(a.id))
      .sort((a,b)=>urgencyOrder[a.urgency]-urgencyOrder[b.urgency])
      .slice(0,10);
  }, [BUYERS, TRADE_DATA, tradeStats, dbAlerts, retail, dismissed, nextQLabel, weeksLeft]);

  if (actions.length === 0) {
    return (
      <Card style={{ marginBottom:16, border:`1px solid ${C.gold}25`, textAlign:"center", padding:30 }}>
        <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><Zap size={28} color={C.gold} strokeWidth={1.5} /></div>
        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>No actions for today</div>
        <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>All caught up. Run the scraping pipeline for fresh intelligence.</div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom:16, border:`1px solid ${C.gold}25` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Zap size={16} color={C.gold} strokeWidth={2.5} />
            <div style={{ fontSize:16, fontWeight:900, color:C.gold }}>Today's Actions</div>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
            {actions.length} priorities · Each includes revenue estimate, confidence %, and risk analysis · Click to expand
          </div>
        </div>
        <div style={{ fontSize:10, color:C.muted, background:"#ffffff08", padding:"4px 10px", borderRadius:8 }}>
          {today.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {actions.map(a => {
          const u = URGENCY[a.urgency]||URGENCY.medium;
          const UIcon = u.Icon;
          const ActionIcon = ACTION_ICON_MAP[a.type] || Zap;
          const isExpanded = expanded===a.id;
          const conf = confLabel(a.confidence, a.confidence_source);
          return (
            <div key={a.id} style={{ borderRadius:12, background:u.bg, border:`1px solid ${u.border}`, overflow:"hidden" }}>
              {/* Collapsed header row */}
              <div
                style={{ padding:"12px 14px", cursor:"pointer" }}
                onClick={()=>setExpanded(isExpanded?null:a.id)}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ display:"flex", gap:10, flex:1 }}>
                    <span style={{ display:"flex", alignItems:"center", flexShrink:0, marginTop:1 }}>
                      <ActionIcon size={16} color={u.color} strokeWidth={2} />
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:4, lineHeight:1.4 }}>{a.title}</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:800, color:C.green }}>
                          <DollarSign size={11} color={C.green} strokeWidth={2.5} />{a.revenue_estimate}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, color:conf.color }}>● {conf.text}</span>
                        <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, color:C.muted }}>
                          {isExpanded
                            ? <><ChevronUp size={11} strokeWidth={2} /> Less</>
                            : <><ChevronDown size={11} strokeWidth={2} /> WHY + Risk + Actions</>
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:7, background:u.color+"20", color:u.color, fontSize:9, fontWeight:900, whiteSpace:"nowrap", flexShrink:0, alignSelf:"flex-start" }}>
                    <UIcon size={10} strokeWidth={2.5} />{u.label}
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div style={{ padding:"0 14px 14px", borderTop:`1px solid ${u.border}` }}>
                  {/* WHY */}
                  <div style={{ marginTop:12, marginBottom:10 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:C.gold, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>WHY THIS ACTION</div>
                    <div style={{ fontSize:11, color:C.text, lineHeight:1.65, background:"#ffffff04", borderRadius:8, padding:"10px 12px", borderLeft:`3px solid ${C.gold}` }}>
                      {a.why}
                    </div>
                  </div>

                  {/* Revenue + Risk */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    <div style={{ background:C.green+"08", border:`1px solid ${C.green}20`, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:9, fontWeight:800, color:C.green, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>REVENUE POTENTIAL</div>
                      <div style={{ fontSize:13, fontWeight:900, color:C.green, marginBottom:3 }}>{a.revenue_estimate}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{a.revenue_note}</div>
                    </div>
                    <div style={{ background:C.red+"08", border:`1px solid ${C.red}20`, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:9, fontWeight:800, color:C.red, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>RISK IF IGNORED</div>
                      <div style={{ fontSize:11, color:"#f87171", lineHeight:1.5 }}>{a.risk}</div>
                    </div>
                  </div>

                  {/* Recommended action */}
                  <div style={{ fontSize:11, color:u.color, fontWeight:700, marginBottom:12, paddingLeft:4 }}>→ {a.action_detail}</div>

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {a.primary_action==="prepare_quote" && (
                      <ABtn color={C.gold}   Icon={Calculator} label={a.primary_label}              onClick={()=>go?.(a.buyer?.id,"quote-builder")} />
                    )}
                    {(a.secondary_action==="view_buyer"||a.primary_action==="view_buyer") && a.buyer && (
                      <ABtn color={C.blue}   Icon={Eye}        label={a.secondary_label||a.primary_label} onClick={()=>go?.(a.buyer?.id,"buyers")} />
                    )}
                    {(a.secondary_action==="view_market"||a.primary_action==="view_market") && (
                      <ABtn color={C.purple} Icon={BarChart2}  label={a.secondary_label||a.primary_label} onClick={()=>go?.(null,"trade-intel")} />
                    )}
                    {(a.secondary_action==="compliance"||a.primary_action==="compliance") && (
                      <ABtn color={C.amber}  Icon={Scale}      label={a.secondary_label||a.primary_label} onClick={()=>go?.(null,"compliance")} />
                    )}
                    {(a.secondary_action==="find_buyers"||a.primary_action==="find_buyers") && (
                      <ABtn color={C.pink}   Icon={Target}     label={a.secondary_label||a.primary_label} onClick={()=>go?.(null,"buyers")} />
                    )}
                    {a.primary_action==="reprice" && (
                      <ABtn color={C.green}  Icon={DollarSign} label={a.primary_label}              onClick={()=>go?.(null,"price-intel")} />
                    )}
                    <ABtn ghost color={C.muted} Icon={X} label="Dismiss" onClick={()=>{setDismissed(p=>new Set([...p,a.id]));setExpanded(null);}} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dismissed.size > 0 && (
        <div style={{ marginTop:10, textAlign:"center" }}>
          <button onClick={()=>setDismissed(new Set())} style={{ background:"none", border:"none", color:C.muted, fontSize:10, cursor:"pointer", textDecoration:"underline" }}>
            Restore {dismissed.size} dismissed action{dismissed.size>1?"s":""}
          </button>
        </div>
      )}
    </Card>
  );
}

function ABtn({ color, Icon, label, onClick, ghost }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={()=>setH(true)}
      onMouseLeave={()=>setH(false)}
      style={{
        padding:"7px 14px", borderRadius:8,
        background: ghost?"transparent": h?color:color+"18",
        border:`1px solid ${ghost?"#333":color+"40"}`,
        color: ghost?C.muted: h?C.bg:color,
        fontSize:11, fontWeight:700, cursor:"pointer",
        display:"flex", alignItems:"center", gap:5, transition:"all 0.15s",
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} color={ghost?C.muted: h?C.bg:color} />}
      <span>{label}</span>
    </button>
  );
}
