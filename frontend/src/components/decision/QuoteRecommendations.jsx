// ─────────────────────────────────────────────
// BuyerIQ Decision Layer — Quote Recommendations
// ─────────────────────────────────────────────
// Provides pricing suggestions per buyer:
// recommended FOB, competitor context, win %
// ─────────────────────────────────────────────
import { useMemo } from "react";
import { Calculator } from "lucide-react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, TierBadge } from "../ui/Primitives.jsx";

// Competitive benchmark data (from scraping config)
const COMPETITOR_PRICING = {
  china: { min: 2.50, max: 7.00, avg: 4.50, label: "China", flag: "🇨🇳" },
  vietnam: { min: 3.00, max: 8.00, avg: 5.50, label: "Vietnam", flag: "🇻🇳" },
  indonesia: { min: 3.50, max: 9.00, avg: 6.00, label: "Indonesia", flag: "🇮🇩" },
  india_rival: { min: 3.50, max: 9.00, avg: 5.50, label: "India (Rival)", flag: "🇮🇳" },
};

export default function QuoteRecommendations({ go, onQuote }) {
  const { BUYERS, PRODUCTS } = useData();

  const recommendations = useMemo(() => {
    // Get top buyers by composite score
    const topBuyers = [...BUYERS]
      .map(b => {
        const s = b.scores || {};
        const composite = Math.round((s.pay || 0) * 0.25 + (s.vol || 0) * 0.3 + (s.margin || 0) * 0.15 + (s.growth || 0) * 0.2 + (s.ease || 0) * 0.1);
        return { ...b, composite };
      })
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 6);

    return topBuyers.map(b => {
      const fobMin = b.fob?.min || 4;
      const fobMax = b.fob?.max || 12;
      const fobMid = (fobMin + fobMax) / 2;

      // Recommended FOB: 15% above competitor average, within buyer's range
      const chinaAvg = COMPETITOR_PRICING.china.avg;
      const recommendedFOB = Math.max(fobMin, Math.min(fobMax, chinaAvg * 1.15));

      // Win probability based on: price fit + payment score + ease score
      const priceFit = recommendedFOB <= fobMid ? 90 : recommendedFOB <= fobMax * 0.8 ? 70 : 50;
      const payFit = Math.min(100, (b.scores?.pay || 50));
      const easeFit = Math.min(100, (b.scores?.ease || 50));
      const winProbability = Math.round((priceFit * 0.4 + payFit * 0.3 + easeFit * 0.3));

      // Top products for this buyer
      const buyerProducts = (b.products || []).slice(0, 3);
      const bestProduct = buyerProducts[0] || "Cutting Board";
      const matchedProduct = PRODUCTS.find(p => p.name?.toLowerCase().includes(bestProduct?.toLowerCase()?.split(" ")[0]));

      // Price positioning analysis
      const vsChina = ((recommendedFOB - chinaAvg) / chinaAvg * 100).toFixed(0);
      const positioning = parseFloat(vsChina) <= 10 ? "competitive" : parseFloat(vsChina) <= 25 ? "quality_premium" : "premium";

      return {
        buyer: b,
        composite: b.composite,
        recommendedFOB: parseFloat(recommendedFOB.toFixed(2)),
        fobRange: { min: fobMin, max: fobMax, sweet: b.fob?.sweet },
        winProbability,
        bestProduct,
        matchedProduct,
        vsChina: parseFloat(vsChina),
        positioning,
        strategy: positioning === "competitive"
          ? `Price at $${recommendedFOB.toFixed(2)} — competitive with China. Emphasize quality + compliance advantage.`
          : positioning === "quality_premium"
          ? `Price at $${recommendedFOB.toFixed(2)} — quality premium justified. Highlight FSC certification + artisan finish.`
          : `Price at $${recommendedFOB.toFixed(2)} — premium positioning. Lead with design exclusivity + brand story.`,
      };
    });
  }, [BUYERS, PRODUCTS]);

  if (recommendations.length === 0) {
    return (
      <Card style={{ marginBottom: 16, border: `1px solid ${C.amber}25`, textAlign: "center", padding: 30 }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Calculator size={28} color={C.amber} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No quote recommendations available</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Add buyer data and product catalog to generate pricing suggestions.</div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16, border: `1px solid ${C.amber}25` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.amber, display: "flex", alignItems: "center", gap: 6 }}><Calculator size={15} color={C.amber} strokeWidth={2} /> Quote Recommendations</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>AI-suggested FOB pricing for top buyers</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {recommendations.map((r, i) => {
          const winColor = r.winProbability >= 75 ? C.green : r.winProbability >= 55 ? C.amber : C.red;
          return (
            <div key={r.buyer.id} style={{
              padding: "14px", borderRadius: 10, background: "#ffffff04",
              border: `1px solid ${i < 2 ? C.gold + "30" : "#ffffff10"}`,
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text, cursor: "pointer" }}
                    onClick={() => go?.(r.buyer.id, "buyers")}>{r.buyer.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{r.buyer.country} · <TierBadge tier={r.buyer.tier} /></div>
                </div>
                {/* Win probability circle */}
                <div style={{ width: 46, height: 46, borderRadius: "50%", border: `3px solid ${winColor}`, display: "grid", placeItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: winColor, lineHeight: 1 }}>{r.winProbability}%</div>
                    <div style={{ fontSize: 7, color: C.muted, textAlign: "center" }}>win</div>
                  </div>
                </div>
              </div>

              {/* Recommended FOB */}
              <div style={{ background: C.gold + "10", borderRadius: 8, padding: "10px 12px", marginBottom: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Recommended FOB</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>${r.recommendedFOB}</div>
                <div style={{ fontSize: 10, color: C.muted }}>Range: ${r.fobRange.min} – ${r.fobRange.max} · Sweet: {r.fobRange.sweet || "—"}</div>
              </div>

              {/* Competitor comparison */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6 }}>vs Competitors:</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(COMPETITOR_PRICING).map(([key, comp]) => {
                    const diff = ((r.recommendedFOB - comp.avg) / comp.avg * 100).toFixed(0);
                    const isBelow = parseFloat(diff) <= 0;
                    return (
                      <span key={key} style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                        background: isBelow ? C.green + "15" : "#ffffff08",
                        color: isBelow ? C.green : C.muted,
                      }}>
                        {comp.flag} {diff > 0 ? "+" : ""}{diff}%
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Strategy */}
              <div style={{ fontSize: 11, color: C.green, fontWeight: 600, lineHeight: 1.4, marginBottom: 10 }}>
                → {r.strategy}
              </div>

              {/* Confidence indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber }} />
                <span style={{ fontSize: 9, color: C.muted }}>Confidence: <span style={{ color: C.amber, fontWeight: 700 }}>Industry estimate</span> — verify with live pricing data</span>
              </div>

              {/* Product + Action */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.muted }}>Best for: {r.bestProduct}</span>
                <button onClick={() => onQuote ? onQuote(r.buyer.id) : go?.(r.buyer.id, "quote-builder")}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.gold}40`, background: "transparent",
                    color: C.gold, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}>
                  Generate Quote →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
