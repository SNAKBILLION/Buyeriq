// ─────────────────────────────────────────────
// BuyerIQ Decision Layer — Buyer Hit List
// ─────────────────────────────────────────────
// Ranks buyers by composite scoring including:
// • buyer_score (payment, volume, margin, growth, ease)
// • shipment activity (real shipment data)
// • sourcing gaps (China dependence → India opportunity)
// ─────────────────────────────────────────────
import { useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C, TIERS, CONFIDENCE } from "../../data/theme.js";
import { Card, TierBadge } from "../ui/Primitives.jsx";
import { useAPI } from "../../hooks/useAPI.js";
import { fetchBuyerSignals } from "../../services/api.js";
import { Flame, TrendingUp, Target } from "lucide-react";

export default function BuyerHitList({ go }) {
  const { BUYERS, shipments } = useData();

  // Live buyer signals from AI engine
  const { data: liveSignals, loading, source: signalSource } = useAPI(
    () => fetchBuyerSignals({ limit: 20 }),
    null,
    { cacheKey: "hitlist-signals" }
  );

  const hitList = useMemo(() => {
    // Build shipment activity index from real data
    const shipmentIndex = {};
    (shipments || []).forEach(s => {
      const name = (s.buyer_name_raw || "").toLowerCase();
      if (!name) return;
      if (!shipmentIndex[name]) shipmentIndex[name] = { count: 0, totalKg: 0, totalUsd: 0, lastDate: null };
      shipmentIndex[name].count++;
      shipmentIndex[name].totalKg += parseFloat(s.weight_kg || 0);
      shipmentIndex[name].totalUsd += parseFloat(s.estimated_value_usd || 0);
      const d = s.ship_date;
      if (d && (!shipmentIndex[name].lastDate || d > shipmentIndex[name].lastDate)) {
        shipmentIndex[name].lastDate = d;
      }
    });

    return BUYERS.map(b => {
      const s = b.scores || {};

      // ── 1. Buyer score (weighted composite) ──
      const buyerScore = Math.round(
        (s.pay || 0) * 0.25 +
        (s.vol || 0) * 0.3 +
        (s.margin || 0) * 0.15 +
        (s.growth || 0) * 0.2 +
        (s.ease || 0) * 0.1
      );

      // ── 2. Shipment activity score (from real data) ──
      const nameKey = (b.name || "").toLowerCase();
      const shipData = shipmentIndex[nameKey] || null;
      // Also check partial match
      const partialMatch = !shipData ? Object.entries(shipmentIndex).find(([k]) => k.includes(nameKey.slice(0, 8)) || nameKey.includes(k.slice(0, 8))) : null;
      const activity = shipData || (partialMatch ? partialMatch[1] : null);

      let shipmentScore = 0;
      let shipmentLabel = "No data";
      if (activity) {
        shipmentScore = Math.min(100, activity.count * 10 + (activity.totalKg > 5000 ? 20 : activity.totalKg > 1000 ? 10 : 0));
        shipmentLabel = `${activity.count} shipments · ${(activity.totalKg / 1000).toFixed(1)}T`;
      }

      // ── 3. Sourcing gap (China → India opportunity) ──
      // raw_data sourcing_intel not in DB — use country-based estimates
      const si = b.raw_data?.sourcing_intel;
      const indiaShare = si?.sources?.find(s => s.origin?.includes("India"))?.share ||
  (b.country_code === "US" ? 12 : b.country_code === "GB" ? 8 :
  ["DE","NL","FR","SE","DK","ES","IE"].includes(b.country_code) ? 7 :
  b.country_code === "AU" ? 10 : 8);
      // Country-based China dependence estimate
      const chinaShare = si?.sources?.find(s => s.origin?.includes("China"))?.share ||
        (b.country_code === 'US' ? 65 :
         b.country_code === 'GB' ? 55 :
         ['DE','NL','FR','SE','DK','ES','IE'].includes(b.country_code) ? 50 :
         b.country_code === 'AU' ? 60 :
         b.country_code === 'CA' ? 58 :
         b.country_code === 'JP' ? 45 :
         b.country_code === 'ZA' ? 40 : 50);
      const gapScore = chinaShare > 40 ? 90 : chinaShare > 25 ? 70 : chinaShare > 10 ? 40 : 20;
      const gapLabel = chinaShare > 40 ? "High — heavy China dependence"
        : chinaShare > 25 ? "Medium — diversifying"
        : "Low — already diversified";

      // ── Live signal enrichment ──
      const signal = Array.isArray(liveSignals)
        ? liveSignals.find(ls => ls.company_name?.toLowerCase().includes(nameKey.slice(0, 10)))
        : null;

      // ── FINAL: Weighted composite ──
      const composite = Math.round(buyerScore * 0.5 + shipmentScore * 0.25 + gapScore * 0.25);

      // Seasonal urgency
      const quarter = Math.floor(new Date().getMonth() / 3) + 1;
      const nextQ = quarter === 4 ? 1 : quarter + 1;
      const nextQPct = b.seasonal?.[`Q${nextQ}`] || 0;
      const seasonalUrgency = nextQPct >= 30 ? "peak" : nextQPct >= 20 ? "moderate" : "low";

      // FOB fit
      const fobMin = parseFloat(b.fob_min || b.fob?.min) || 0;
      const fobMax = parseFloat(b.fob_max || b.fob?.max) || 0;
      const fobMid = (fobMin + fobMax) / 2;
      const priceMatch = fobMid >= 4 && fobMid <= 15 ? "strong" : fobMid > 15 ? "premium" : fobMid > 0 ? "tight" : "—";

      // Confidence
      const confidence = activity ? "high" : signal ? "medium" : "estimated";

      return {
        ...b, composite, buyerScore, shipmentScore, shipmentLabel, gapScore, gapLabel,
        chinaShare, indiaShare, seasonalUrgency, priceMatch, fobMid, signal, confidence,
        decision: composite >= 75 ? "Priority target — allocate resources"
          : composite >= 55 ? "Strong prospect — include in outreach"
          : composite >= 40 ? "Monitor — engage when opportunity arises"
          : "Low priority — focus elsewhere",
      };
    })
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 10);
  }, [BUYERS, liveSignals, shipments]);

  // ── EMPTY STATE ──
  if (hitList.length === 0) {
    return (
      <Card style={{ marginBottom: 16, border: `1px solid ${C.blue}25`, textAlign: "center", padding: 30 }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Target size={28} color={C.blue} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No buyer data available</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Run scraping pipeline to populate buyer intelligence.</div>
      </Card>
    );
  }

  // ── LOADING STATE ──
  const isLoading = loading;

  return (
    <Card style={{ marginBottom: 16, border: `1px solid ${C.blue}25` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.blue, display: "flex", alignItems: "center", gap: 6 }}><Target size={15} color={C.blue} strokeWidth={2} /> Buyer Hit List</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Top 10 buyers ranked by score + shipment activity + sourcing gaps
            {isLoading && <span style={{ color: C.amber }}> · Loading live signals...</span>}
          </div>
        </div>
        <ConfidenceBadge source={signalSource} hasShipments={shipments?.length > 0} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid #222` }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: "left" }}>Buyer</th>
              <th style={th}>Score</th>
              <th style={th}>Shipments</th>
              <th style={th}>Sourcing Gap</th>
              <th style={th}>FOB Fit</th>
              <th style={th}>Season</th>
              <th style={th}>Conf.</th>
              <th style={{ ...th, textAlign: "left" }}>→ Decision</th>
            </tr>
          </thead>
          <tbody>
            {hitList.map((b, i) => {
              const scoreColor = b.composite >= 75 ? C.green : b.composite >= 55 ? C.gold : b.composite >= 40 ? C.amber : C.muted;
              const confColor = b.confidence === "high" ? C.green : b.confidence === "medium" ? C.amber : C.muted;
              return (
                <tr key={b.id} style={{ borderBottom: `1px solid #1a1a1a`, cursor: "pointer" }}
                  onClick={() => go?.(b.id, "buyers")}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff06"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={td}>
                    <span style={{ fontWeight: 900, color: i < 3 ? C.gold : C.muted, fontSize: 13 }}>{i + 1}</span>
                  </td>
                  <td style={{ ...td, textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{b.country} · {b.stores || ""}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 900, color: scoreColor, fontSize: 14 }}>{b.composite}</span>
                    <span style={{ color: C.muted, fontSize: 9 }}>/100</span>
                    <div style={{ fontSize: 8, color: C.muted }}>B:{b.buyerScore} S:{b.shipmentScore} G:{b.gapScore}</div>
                  </td>
                  <td style={td}>
                    <div style={{ color: b.shipmentScore > 0 ? C.green : C.muted, fontWeight: 600, fontSize: 10 }}>
                      {b.shipmentLabel}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ color: b.gapScore >= 70 ? C.green : b.gapScore >= 40 ? C.amber : C.muted, fontWeight: 700, fontSize: 10 }}>
                      {b.chinaShare}% China → {b.indiaShare}% India
                    </div>
                    <div style={{ fontSize: 8, color: C.muted }}>{b.gapLabel}</div>
                  </td>
                  <td style={td}>
                    {b.fobMid > 0 ? (
                      <span style={{ color: b.priceMatch === "strong" ? C.green : b.priceMatch === "premium" ? C.gold : C.red, fontWeight: 600 }}>
                        ${b.fobMid?.toFixed(0)} {b.priceMatch === "strong" ? "OK" : b.priceMatch === "premium" ? "HI" : "LO"}
                      </span>
                    ) : (
                      <span style={{ color: C.muted, fontSize: 10 }}>No data</span>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                      background: b.seasonalUrgency === "peak" ? C.red + "20" : b.seasonalUrgency === "moderate" ? C.amber + "20" : "#ffffff08",
                      color: b.seasonalUrgency === "peak" ? C.red : b.seasonalUrgency === "moderate" ? C.amber : C.muted,
                    }}>
                      {b.seasonalUrgency === "peak"
                        ? <><Flame size={9} strokeWidth={2.5} style={{ marginRight: 3 }} />PEAK</>
                        : b.seasonalUrgency === "moderate"
                          ? <><TrendingUp size={9} strokeWidth={2.5} style={{ marginRight: 3 }} />Active</>
                          : "—"
                      }
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700, background: confColor + "15", color: confColor, textTransform: "uppercase" }}>
                      {b.confidence}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "left" }}>
                    <span style={{ color: b.composite >= 75 ? C.green : b.composite >= 55 ? C.gold : C.muted, fontWeight: 600, fontSize: 10 }}>
                      {b.decision}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ConfidenceBadge({ source, hasShipments }) {
  const level = source === "api" && hasShipments ? "high" : source === "api" ? "medium" : "estimated";
  const color = level === "high" ? C.green : level === "medium" ? C.amber : C.muted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: color + "10", border: `1px solid ${color}20` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>
        {level === "high" ? "Live data" : level === "medium" ? "AI signals" : "Estimated"}
      </span>
    </div>
  );
}

const th = { padding: "8px 10px", color: "#888", fontWeight: 700, fontSize: 10, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 };
const td = { padding: "10px 10px", textAlign: "center" };
