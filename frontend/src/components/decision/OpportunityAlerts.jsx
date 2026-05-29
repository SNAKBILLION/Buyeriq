// ─────────────────────────────────────────────
// BuyerIQ Decision Layer — Opportunity Alerts
// ─────────────────────────────────────────────
// Transforms raw trade/demand data into
// actionable opportunity signals using:
// • demand_score (from AI demand detection)
// • growth_rate (from COMTRADE trade data)
// • opportunity_score (from AI market opportunity)
// ─────────────────────────────────────────────
import { useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card } from "../ui/Primitives.jsx";
import { useAPI } from "../../hooks/useAPI.js";
import { fetchOpportunities, fetchDemandTrends } from "../../services/api.js";
import { Bot, BarChart2, TrendingUp, Flag, RefreshCw, DollarSign } from "lucide-react";

export default function OpportunityAlerts({ go }) {
  const { BUYERS, TRADE_DATA, retail, tradeStats } = useData();

  const { data: liveOpps, loading: oppsLoading, source: oppsSource } = useAPI(
    () => fetchOpportunities({ limit: 10 }), null, { cacheKey: "decision-opps", enabled: true }
  );
  const { data: liveDemand, loading: demandLoading, source: demandSource } = useAPI(
    () => fetchDemandTrends({ limit: 10 }), null, { cacheKey: "decision-demand", enabled: true }
  );

  const opportunities = useMemo(() => {
    const opps = [];

    // ── 1. AI-detected opportunities (demand_score + opportunity_score) ──
    if (Array.isArray(liveOpps) && liveOpps.length > 0) {
      const seenOpps = new Set();
      liveOpps
        .filter(o => o.market_country || o.market)
        .filter(o => {
          const key = o.market_country || o.market || String(o.opportunity_score);
          if (seenOpps.has(key)) return false;
          seenOpps.add(key); return true;
        })
        .slice(0, 4).forEach(o => {
        opps.push({
          type: "ai_opportunity",
          Icon: Bot,
          urgency: (o.opportunity_score || 0) >= 70 ? "high" : "medium",
          confidence: "high",
          title: o.market_country
            ? `${o.market_country} — Opportunity detected (Score: ${o.opportunity_score}/100)`
            : o.market
            ? `${o.market} — Opportunity detected (Score: ${o.opportunity_score}/100)`
            : `Opportunity Score: ${o.opportunity_score}/100`,
          insight: `Demand score: ${o.demand_score || "—"}, Growth rate: ${o.growth_rate || "—"}%, Buyer activity: ${o.buyer_activity_score || "—"}.`,
          action: o.recommendation || "Review this market for entry potential. Identify top importers.",
          metric: `${o.opportunity_score || 0}`,
          metricLabel: "Opp Score",
        });
      });
    }

    // ── 2. AI demand trends (demand_score + growth_rate) ──
    if (Array.isArray(liveDemand) && liveDemand.length > 0) {
      liveDemand
        .filter(d => (d.demand_score || 0) >= 60 || (d.growth_rate || 0) >= 20)
        .slice(0, 3)
        .forEach(d => {
          const hasGrowth = (d.growth_rate || 0) > 0;
          opps.push({
            type: "demand_signal",
            Icon: BarChart2,
            urgency: (d.demand_score || 0) >= 75 ? "high" : "medium",
            confidence: "high",
            title: `${d.product_category || d.hs_code || "Category"} — Demand ${hasGrowth ? "surging" : "detected"} (Score: ${d.demand_score || "—"})`,
            insight: `Growth rate: ${d.growth_rate || 0}%. Trade demand signals: ${d.trade_demand_signals || "—"}. Marketplace signals: ${d.marketplace_demand_signals || "—"}.`,
            action: hasGrowth
              ? `Increase production capacity for this category. Target buyers actively importing this product.`
              : `Monitor this category. Prepare samples for upcoming buyer inquiries.`,
            metric: `${d.demand_score || 0}`,
            metricLabel: "Demand",
          });
        });
    }

    // ── 3. Market growth from static trade data (fallback) ──
    const destinations = TRADE_DATA?.destinations || [];
    destinations.forEach(d => {
      if (d.growth > 15) {
        // Skip if AI already covers this market
        const alreadyCovered = opps.some(o => o.title?.includes(d.country));
        if (alreadyCovered) return;

        const buyersInMarket = BUYERS.filter(b => {
          const cMap = { US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France", NL: "Netherlands", AU: "Australia", CA: "Canada", JP: "Japan" };
          return Object.entries(cMap).some(([code, name]) => d.country?.includes(code) && b.country?.includes(name));
        });

        opps.push({
          type: "market_growth",
          Icon: TrendingUp,
          urgency: d.growth > 25 ? "high" : "medium",
          confidence: "verified",
          title: `${d.country} — ${d.growth}% import growth detected`,
          insight: `Wood kitchenware imports growing ${d.growth}% year-over-year. India's current share: ${d.indiaShare || "~15%"}.`,
          action: buyersInMarket.length > 0
            ? `Target ${buyersInMarket.slice(0, 2).map(b => b.name).join(", ")} with competitive pricing.`
            : `Research top importers in ${d.country}. Run buyer discovery scan.`,
          metric: `${d.growth}%`,
          metricLabel: "YoY Growth",
          buyers: buyersInMarket.slice(0, 3),
        });
      }
    });

    // ── 4. India tariff advantage ──
    const indiaValue = TRADE_DATA?.yearTrend?.find(t => t.country === "India")?.value;
    const chinaValue = TRADE_DATA?.yearTrend?.find(t => t.country === "China")?.value;
    if (indiaValue && chinaValue) {
      const indiaShare = ((indiaValue / (indiaValue + chinaValue)) * 100).toFixed(1);
      opps.push({
        type: "competitive",
        Icon: Flag,
        urgency: "medium",
        confidence: "verified",
        title: `India's market share: ${indiaShare}% vs China — Tariff advantage active`,
        insight: `India exports $${(indiaValue / 1e6).toFixed(0)}M vs China's $${(chinaValue / 1e6).toFixed(0)}M in HS 4419. India gets 18% vs China 30% (India advantage!).`,
        action: `Highlight "Made in India" + zero-tariff advantage in buyer presentations. Use EUDR compliance as differentiator.`,
        metric: `${indiaShare}%`,
        metricLabel: "India Share",
      });
    }

    // ── 5. Buyer sourcing shift (from competitor count) ──
    BUYERS.filter(b => (b.competitors || []).length >= 3).slice(0, 2).forEach(b => {
      const alreadyCovered = opps.some(o => o.title?.includes(b.name));
      if (alreadyCovered) return;
      opps.push({
        type: "buyer_shift",
        Icon: RefreshCw,
        urgency: "high",
        confidence: "estimated",
        title: `${b.name} — Actively diversifying suppliers`,
        insight: `${b.competitors?.length || 0} Indian competitors detected in their supply chain.`,
        action: `Send capability deck + samples immediately. Emphasize ${(b.wood || []).slice(0, 2).join(", ")} expertise.`,
        metric: `${b.competitors?.length || 0}`,
        metricLabel: "Competitors",
        buyers: [b],
      });
    });

    // ── 6. Price opportunity ──
    BUYERS.filter(b => (b.scores?.margin || 0) >= 70 && (b.fob?.min || 99) <= 8).slice(0, 2).forEach(b => {
      opps.push({
        type: "price_opp",
        Icon: DollarSign,
        urgency: "medium",
        confidence: "estimated",
        title: `${b.name} — High margin at $${b.fob?.min}-$${b.fob?.max} FOB`,
        insight: `Margin score ${b.scores?.margin}/100. Sweet spot: ${b.fob?.sweet || "—"}. Senses can compete profitably.`,
        action: `Prepare quote at FOB $${((b.fob?.min || 0) * 1.1).toFixed(2)} — 10% above floor to maximize margin.`,
        metric: `$${(((b.fob?.min || 0) + (b.fob?.max || 0)) / 2).toFixed(0)}`,
        metricLabel: "Avg FOB",
      });
    });

    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return opps.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]).slice(0, 8);
  }, [BUYERS, TRADE_DATA, liveOpps, liveDemand, retail, tradeStats]);

  // ── LOADING STATE ──
  if (oppsLoading && demandLoading && opportunities.length === 0) {
    return (
      <Card style={{ marginBottom: 16, border: `1px solid ${C.green}25`, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.green, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}><TrendingUp size={15} color={C.green} strokeWidth={2} /> Opportunity Signals</div>
        <div style={{ fontSize: 11, color: C.amber }}>Loading intelligence data...</div>
      </Card>
    );
  }

  // ── EMPTY STATE ──
  if (opportunities.length === 0) {
    return (
      <Card style={{ marginBottom: 16, border: `1px solid ${C.green}25`, textAlign: "center", padding: 30 }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><TrendingUp size={28} color={C.green} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No opportunities detected yet</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Start scraping to generate market intelligence and opportunity signals.</div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16, border: `1px solid ${C.green}25` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.green, display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={15} color={C.green} strokeWidth={2} /> Opportunity Signals</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {oppsSource === "api" && <SourceDot color={C.green} label="AI Live" />}
          {demandSource === "api" && <SourceDot color={C.blue} label="Demand Live" />}
          {oppsSource !== "api" && demandSource !== "api" && <SourceDot color={C.muted} label="Estimated" />}
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{opportunities.length} actionable opportunities from {oppsSource === "api" ? "AI engine + " : ""}trade data</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
        {opportunities.map((o, i) => (
          <div key={i} style={{
            padding: "14px", borderRadius: 10,
            background: o.urgency === "high" ? "#ef444408" : "#ffffff04",
            border: `1px solid ${o.urgency === "high" ? "#ef444425" : "#ffffff10"}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {o.Icon && <o.Icon size={16} color={o.urgency === "high" ? C.red : C.amber} strokeWidth={2} />}
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800,
                  background: o.urgency === "high" ? C.red + "20" : C.amber + "20",
                  color: o.urgency === "high" ? C.red : C.amber,
                }}>{o.urgency?.toUpperCase()}</span>
                {/* Confidence indicator */}
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700,
                  background: o.confidence === "high" || o.confidence === "verified" ? C.green + "15" : o.confidence === "medium" ? C.amber + "15" : "#ffffff08",
                  color: o.confidence === "high" || o.confidence === "verified" ? C.green : o.confidence === "medium" ? C.amber : C.muted,
                }}>
                  {o.confidence === "verified" ? "Verified" : o.confidence === "high" ? "● AI" : o.confidence === "medium" ? "~ Estimated" : "~ AI Estimate"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.gold }}>{o.metric}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{o.metricLabel}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{o.title}</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>{o.insight}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, lineHeight: 1.4 }}>→ {o.action}</div>
            {o.buyers?.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {o.buyers.map(b => (
                  <span key={b.id} onClick={(e) => { e.stopPropagation(); go?.(b.id, "buyers"); }}
                    style={{ padding: "2px 8px", borderRadius: 6, background: C.gold + "15", color: C.gold, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    {b.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SourceDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: color + "10" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 8, fontWeight: 700, color }}>{label}</span>
    </div>
  );
}
