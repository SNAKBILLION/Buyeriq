// ─────────────────────────────────────────────
// BuyerIQ — Quote Builder v5.1
// Skill-compliant: labels, onBlur validation,
// useMemo, hover states, material-aware UI
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, TierBadge } from "../ui/Primitives.jsx";
import { saveQuote, fetchQuotes } from "../../services/api.js";
import {
  Loader2, AlertCircle, FileDown, CheckCircle2,
  History, Calculator, TrendingUp, Package,
  Zap, Shield, Info, ArrowRight,
} from "lucide-react";
import { exportQuotePDF } from "../../utils/pdfExport.js";

// ── Hover Button ──────────────────────────────
function Btn({ children, onClick, color = C.gold, style: s = {}, disabled = false, id }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? "#1a1a1a" : hov ? color + "30" : color + "18",
        border: `1px solid ${disabled ? "#2a2a2a" : color + (hov ? "60" : "30")}`,
        color: disabled ? C.muted : color,
        fontSize: 12, padding: "10px 18px", borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700,
        display: "flex", alignItems: "center", gap: 6,
        transition: "all 0.18s ease", width: "100%",
        justifyContent: "center", ...s,
      }}
    >{children}</button>
  );
}

// ── Labeled Field (skill: htmlFor) ───────────
function Field({ label, htmlFor, children, hint }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const SEL = (extra = {}) => ({
  width: "100%", background: "#161616",
  border: "1px solid #2a2a2a", borderRadius: 8,
  padding: "10px 12px", color: C.text, fontSize: 13,
  cursor: "pointer", outline: "none",
  transition: "border-color 0.18s ease", ...extra,
});

// ── Material config ───────────────────────────
const MAT = {
  wood:             { label: "Wood",         color: "#d4a05a", showWood: true,  woodLabel: "Wood Type"     },
  bamboo:           { label: "Bamboo",       color: "#4ade80", showWood: false, note: "Bamboo construction" },
  glass:            { label: "Glass",        color: "#60a5fa", showWood: false, note: "Glass construction"  },
  ceramic:          { label: "Ceramic",      color: "#fbbf24", showWood: false, note: "Ceramic construction" },
  steel:            { label: "Steel",        color: "#94a3b8", showWood: false, note: "Stainless steel"     },
  iron:             { label: "Iron",         color: "#78716c", showWood: false, note: "Cast iron"           },
  copper:           { label: "Copper",       color: "#f59e0b", showWood: false, note: "Copper construction" },
  aluminum:         { label: "Aluminum",     color: "#a78bfa", showWood: false, note: "Aluminum alloy"      },
  combo_wood_metal: { label: "Wood + Metal", color: "#f472b6", showWood: true,  woodLabel: "Wood Component",
                      note: "Metal frame/handle included — specify wood for wood parts" },
  combo:            { label: "Combo",        color: "#a78bfa", showWood: false, note: "Mixed material" },
};

// ── China tariff ──────────────────────────────
const CHINA_TARIFF = {
  US: 30, GB: 10, DE: 20, FR: 20, NL: 20,
  SE: 20, DK: 20, ES: 20, AU: 10, CA: 25, JP: 2.4, ZA: 20,
};

const TARIFF_KEY = {
  US: "tariff_usa", GB: "tariff_uk",
  DE: "tariff_eu", FR: "tariff_eu", NL: "tariff_eu",
  SE: "tariff_eu", DK: "tariff_eu", ES: "tariff_eu",
};

// ── Wood normalizer ───────────────────────────
function getWoodOptions(buyer) {
  const prefs = buyer?.wood_preferences || buyer?.wood || [];
  const result = new Set();
  prefs.forEach(w => {
    const s = String(w).toLowerCase();
    if (s.includes("acacia"))     result.add("Acacia");
    if (s.includes("mango"))      result.add("Mango");
    if (s.includes("sheesham"))   result.add("Sheesham");
    if (s.includes("teak"))       result.add("Teak");
    if (s.includes("rubberwood")) result.add("Rubberwood");
    if (s.includes("bamboo"))     result.add("Bamboo");
    if (s.includes("walnut"))     result.add("Walnut");
    if (s.includes("pine"))       result.add("Pine");
    if (s.includes("olive"))      result.add("Olive Wood");
    if (s.includes("birch"))      result.add("Birch");
  });
  return result.size > 0 ? [...result] : ["Acacia", "Mango", "Sheesham", "Teak"];
}

// ── FOB validation (skill: onBlur) ───────────
function validateFOB(fob, buyer) {
  if (!fob || !buyer) return null;
  const min = parseFloat(buyer.fob?.min || buyer.fob_min || 0);
  const max = parseFloat(buyer.fob?.max || buyer.fob_max || 0);
  if (!min || !max) return null;
  if (fob < min) return { type: "low",  msg: `Below ${buyer.name}'s typical range ($${min}–$${max}) — verify pricing` };
  if (fob > max) return { type: "high", msg: `Above ${buyer.name}'s typical range ($${min}–$${max}) — justify premium` };
  return { type: "ok", msg: `Within ${buyer.name}'s estimated range ✓` };
}

// ── Season helper ─────────────────────────────
function getPeakQ(buyer) {
  if (!buyer) return null;
  const q = [
    buyer.seasonal?.Q1 ?? buyer.seasonal_q1 ?? 25,
    buyer.seasonal?.Q2 ?? buyer.seasonal_q2 ?? 25,
    buyer.seasonal?.Q3 ?? buyer.seasonal_q3 ?? 25,
    buyer.seasonal?.Q4 ?? buyer.seasonal_q4 ?? 25,
  ];
  const max = Math.max(...q);
  const peak = q.indexOf(max) + 1;
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);
  return { peak, pct: max, isNow: currentQ === peak };
}

// ── Buyer Intelligence Strip ──────────────────
function BuyerStrip({ buyer }) {
  if (!buyer) return null;
  const season = getPeakQ(buyer);
  const fobMin = parseFloat(buyer.fob?.min || buyer.fob_min || 0);
  const fobMax = parseFloat(buyer.fob?.max || buyer.fob_max || 0);
  const sweet  = buyer.fob?.sweet || buyer.fob_sweet_spot || "";
  const woods  = getWoodOptions(buyer).slice(0, 4);
  const indiaT = ["US"].includes(buyer.country_code) ? "18%" : ["GB"].includes(buyer.country_code) ? "0%" : ["DE","FR","NL","SE","DK"].includes(buyer.country_code) ? "0%" : "18%";
  const chinaT = `${CHINA_TARIFF[buyer.country_code] || 30}%`;

  return (
    <div style={{ marginBottom: 14, padding: "12px 16px", background: C.gold + "08", border: `1px solid ${C.gold}20`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Info size={12} color={C.gold} strokeWidth={2} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.gold }}>{buyer.name} — Buyer Intelligence</span>
        <TierBadge tier={buyer.tier} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 8, fontSize: 11 }}>
        {fobMin > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: C.muted }}>Est. FOB:</span>
            <span style={{ color: C.text, fontWeight: 700 }}>${fobMin}–${fobMax}{sweet ? ` · Sweet: ${sweet}` : ""}</span>
          </div>
        )}
        {season && (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: C.muted }}>Peak:</span>
            <span style={{ color: season.isNow ? C.green : C.text, fontWeight: 700 }}>
              Q{season.peak} ({season.pct}%){season.isNow ? " ← NOW" : ""}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ color: C.muted }}>Tariff:</span>
          <span style={{ color: C.green, fontWeight: 700 }}>India {indiaT} vs China {chinaT}</span>
        </div>
        {woods.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: C.muted }}>Prefers:</span>
            {woods.map(w => (
              <span key={w} style={{ background: C.gold + "20", color: C.gold, fontSize: 9, padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{w}</span>
            ))}
          </div>
        )}
        {buyer.negotiation_style && (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: C.muted }}>Negotiation:</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{buyer.negotiation_style.split("—")[0].trim()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Competitor Brief ──────────────────────────
function CompetitorBrief({ buyer, shipments }) {
  const brief = useMemo(() => {
    if (!buyer || !shipments?.length) return null;
    const bn = buyer.name?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const relevant = shipments.filter(s => {
      const raw = (s.buyer_name_raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return bn && raw && (bn.includes(raw.slice(0,8)) || raw.includes(bn.slice(0,8)));
    });
    if (!relevant.length) return null;
    const map = {};
    relevant.forEach(s => {
      const sup = s.supplier_name_raw || "Unknown";
      if (!map[sup]) map[sup] = { count: 0, country: s.origin_country || "?" };
      map[sup].count++;
    });
    return Object.entries(map).sort((a,b) => b[1].count - a[1].count).slice(0, 4);
  }, [buyer, shipments]);

  if (!brief?.length) return null;

  const FLAGS = { IND:"🇮🇳", CHN:"🇨🇳", VNM:"🇻🇳" };
  const COLS  = { IND: C.red, CHN: C.amber, VNM: C.blue };

  return (
    <Card style={{ marginBottom: 16, borderLeft: `3px solid ${C.amber}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <AlertCircle size={14} color={C.amber} strokeWidth={2} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>Competitor Activity — {buyer.name}</div>
        <span style={{ fontSize: 10, color: C.muted }}>US Customs verified</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {brief.map(([sup, d]) => (
          <div key={sup} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d0d0d", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{FLAGS[d.country] || "🌍"}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{sup}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ background: (COLS[d.country]||C.muted)+"20", color: COLS[d.country]||C.muted, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{d.country}</span>
              <span style={{ background: C.green+"20", color: C.green, fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{d.count} ships</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
        Differentiate on compliance docs, design, and India tariff advantage.
      </div>
    </Card>
  );
}

// ── Main Tab ──────────────────────────────────
const TabQuoteBuilder = ({ rates, sel, go }) => {
  const { buyers, products, complianceRules, shipments, retail } = useData();

  const activeBuyers = useMemo(() =>
    (buyers || []).filter(b => b.is_active !== false), [buyers]);

  const activeProducts = useMemo(() =>
    (products || []).filter(p => p.name), [products]);

  // Retail price benchmark by platform
  const RETAIL_CAT_MAP = {
    'Cutting Board': 'Cutting & Chopping Boards',
    'Bowls':         'Wood Bowls',
    'Serving Tray':  'Serving Trays & Platters',
    'Serving':       'Serving Trays & Platters',
    'Coasters':      'Coasters & Trivets',
    'Utensils':      'Spoons & Utensils',
    'Bakeware':      'General Wood Kitchenware',
    'Storage':       'General Wood Kitchenware',
    'Cookware':      'General Wood Kitchenware',
    'Dinnerware':    'General Wood Kitchenware',
    'Drinkware':     'General Wood Kitchenware',
  };


  const [buyerId, setBuyerId]     = useState(sel || "");
  const [productId, setProductId] = useState("");
  const [wood, setWood]           = useState("");
  const [qty, setQty]             = useState(3000);
  const [customFOB, setCustomFOB] = useState("");
  const [fobTouched, setFobTouched] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [quoteHistory, setQuoteHistory] = useState([]);

  useEffect(() => { if (sel) setBuyerId(sel); }, [sel]);

  const buyer   = useMemo(() => activeBuyers.find(b => b.id === buyerId || b.slug === buyerId || b.dbId === buyerId), [activeBuyers, buyerId]);
  const product = useMemo(() => activeProducts.find(p => p.id === productId || p.slug === productId), [activeProducts, productId]);

  const inrRate  = rates ? (rates.INR || rates.inr || 83.5) : 83.5;
  const matCfg   = useMemo(() => MAT[product?.material_primary] || MAT.wood, [product]);
  const pFobMin  = parseFloat(product?.fob_range_min || 0);
  const pFobMax  = parseFloat(product?.fob_range_max || 0);

  const retailBenchmark = useMemo(() => {
    if (!product?.category || !retail?.length) return null;
    const retCat = RETAIL_CAT_MAP[product.category] || 'General Wood Kitchenware';
    const woodFilter = wood || '';
    const matching = retail.filter(r => {
      if (r.category !== retCat) return false;
      if (parseFloat(r.price || 0) <= 0) return false;
      if (!woodFilter) return true;
      const title = (r.product_title || '').toLowerCase();
      return title.includes(woodFilter.toLowerCase());
    });
    const allMatching = retail.filter(r => r.category === retCat && parseFloat(r.price || 0) > 0);
    const useMatching = matching.length >= 10 ? matching : allMatching;
    if (!useMatching.length) return null;
    const platforms = ['amazon', 'amazon_uk', 'amazon_de', 'walmart', 'amazon_fr', 'amazon_ca', 'amazon_au', 'amazon_jp'];
    const labels    = { amazon: 'Amazon US', amazon_uk: 'Amazon UK', amazon_de: 'Amazon DE', walmart: 'Walmart', amazon_fr: 'Amazon FR', amazon_ca: 'Amazon CA', amazon_au: 'Amazon AU', amazon_jp: 'Amazon JP' };
    const colors    = { amazon: '#ff9900', amazon_uk: '#ff9900', amazon_de: '#e47911', walmart: '#0071ce', amazon_fr: '#e47911', amazon_ca: '#ff9900', amazon_au: '#ff9900', amazon_jp: '#c0392b' };
    const currencies = { amazon: '$', amazon_uk: '£', amazon_de: '€', walmart: '$', amazon_fr: '€', amazon_ca: 'CA$', amazon_au: 'A$', amazon_jp: '¥' };
    const result = platforms.map(pl => {
    const woodItems = useMatching.filter(r => r.marketplace === pl);
    const items = woodItems.length > 0 ? woodItems : allMatching.filter(r => r.marketplace === pl);
             if (!items.length) return null;
      const prices = items.map(r => parseFloat(r.price || 0)).filter(x => x > 0);
      const avg    = prices.reduce((a, b) => a + b, 0) / prices.length;
      const curFob = customFOB ? parseFloat(customFOB) : (pFobMin && pFobMax ? (pFobMin+pFobMax)/2 : 0);
      const margin = curFob > 0 ? Math.round(((avg - curFob) / avg) * 100) : 0;
      return { pl, label: labels[pl], avg: avg.toFixed(2), margin, color: colors[pl], cur: currencies[pl], count: items.length };
    }).filter(Boolean);
    const woodLabel = matching.length >= 10 ? woodFilter : '';
    return result.length > 0 ? { cat: retCat, platforms: result, woodFiltered: !!woodLabel, woodLabel } : null;
  }, [product, retail, customFOB, pFobMin, pFobMax, wood]);

  const fob      = customFOB ? parseFloat(customFOB) : pFobMin && pFobMax ? parseFloat(((pFobMin+pFobMax)/2).toFixed(2)) : 0;

  // Alibaba scraper se real data aayega — tab populate karenge
  const chinaFOB   = 0;
  const vietnamFOB = 0;

  const tariffKey   = TARIFF_KEY[buyer?.country_code] || "tariff_usa";
  const indiaRate   = parseFloat(product?.[tariffKey] ?? 18);
  const chinaRate   = CHINA_TARIFF[buyer?.country_code] ?? 30;
  const indiaLanded = fob ? parseFloat((fob*(1+indiaRate/100)).toFixed(2)) : 0;
  const chinaLanded = chinaFOB ? parseFloat((chinaFOB*(1+chinaRate/100)).toFixed(2)) : 0;
  const tariffSaving = chinaLanded > 0 && indiaLanded > 0 ? parseFloat((chinaLanded-indiaLanded).toFixed(2)) : 0;

  const totalUSD = useMemo(() => fob * qty, [fob, qty]);
  const totalINR = useMemo(() => totalUSD * inrRate, [totalUSD, inrRate]);
  const pWeight  = parseFloat(product?.weight_kg || 0.3);
  const weightKg = pWeight * qty;
  const cbm      = parseFloat((weightKg * 0.003).toFixed(2));
  const containers20 = Math.ceil(cbm / 28) || 1;

  const retailMult    = parseFloat(product?.retail_multiple_avg || 0);
  const retailPrice   = parseFloat(product?.avg_retail_price || 0);
  const impliedRetail = retailMult > 0 && fob ? parseFloat((fob * retailMult).toFixed(2)) : retailPrice;
  const marginPct     = fob && impliedRetail ? Math.round(((impliedRetail-fob)/impliedRetail)*100) : 0;

  const payment     = buyer?.payment_terms || buyer?.payment || "Net 30–45 days";
  const leadTime    = buyer?.lead_time || buyer?.leadTime || "75–90 days";
  const moq         = buyer?.moq || "500–2,000 pcs";
  const negotiation = (buyer?.negotiation_style || "").split("—")[0] || "Standard";

  const woodOptions = useMemo(() => getWoodOptions(buyer), [buyer]);

  const fobValidation = useMemo(() => fobTouched ? validateFOB(fob, buyer) : null, [fob, buyer, fobTouched]);

  const applicableLaws = useMemo(() => {
    if (!buyer || !complianceRules?.length) return [];
    return complianceRules
      .filter(r => (r.affected_buyer_slugs||[]).includes(buyer.slug||buyer.id))
      .map(r => r.name);
  }, [buyer, complianceRules]);

  // Grouped products for optgroup
  const groupedProducts = useMemo(() => {
    return activeProducts.reduce((acc, p) => {
      const cat = p.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [activeProducts]);

  useEffect(() => {
    if (!buyer?.dbId) { setQuoteHistory([]); return; }
    const uuid = buyer?.dbId || (buyerId && /^[0-9a-f]{8}-/.test(buyerId) ? buyerId : null);
    if (!uuid) { setQuoteHistory([]); return; }
    fetchQuotes({ buyer_id: uuid, limit: 5, sort_by: "created_at", sort_order: "desc" })
      .then(res => setQuoteHistory(res?.data || []))
      .catch(() => setQuoteHistory([]));
  }, [buyer?.dbId]);

  const handleGenerate = async () => {
    setSaved(false); setSaveError(""); setSaveWarning("");
    if (!buyerId || !productId) { setSaveError("Please select both a Buyer and a Product."); return; }
    setGenerated(true); setSaving(true);
    try {
      await saveQuote({
        buyer_id: buyer?.dbId || buyerId, product_id: productId,
        product_name: product?.name || "Custom",
        wood_type: wood || (matCfg.showWood ? woodOptions[0] : product?.material_primary) || "",
        quantity: qty, fob_per_unit: fob, fob_currency: "USD",
        total_usd: totalUSD, exchange_rate: inrRate, total_inr: totalINR,
        est_weight_kg: weightKg, est_cbm: cbm, est_containers: containers20,
        status: "draft",
      });
      setSaved(true);
    } catch (err) {
      const msg = err.message || "Failed";
      if (msg.includes("401") || msg.includes("No token")) setSaveWarning("Quote generated locally — log in to save.");
      else setSaveError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <Heading sub="Live buyers · DB products · competitor FOB · tariff intelligence · buyer preferences" badge="V">
        Quote Builder
      </Heading>

      {/* Quote History */}
      {quoteHistory.length > 0 && (
        <Card style={{ marginBottom: 16, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <History size={13} color={C.muted} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>Recent Quotes — {buyer?.name}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {quoteHistory.map((q, i) => (
              <div key={q.id||i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d0d0d", borderRadius: 8, fontSize: 11 }}>
                <div>
                  <span style={{ color: C.text, fontWeight: 700 }}>{q.product_name}</span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>{q.wood_type}</span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>× {q.quantity?.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: C.gold, fontWeight: 700 }}>${parseFloat(q.fob_per_unit||0).toFixed(2)}/pc</span>
                  <span style={{ color: C.green }}>${parseFloat(q.total_usd||0).toLocaleString()}</span>
                  <span style={{ color: C.muted, fontSize: 10 }}>{new Date(q.created_at).toLocaleDateString()}</span>
                  <span style={{ background: q.status==="sent" ? C.green+"20":"#1a1a1a", color: q.status==="sent" ? C.green:C.muted, padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700 }}>
  {q.status||"draft"}
</span>
<button onClick={() => { setProductId(q.product_id||""); setWood(q.wood_type||""); setQty(q.quantity||3000); setCustomFOB(q.fob_per_unit||""); setGenerated(false); }}
  style={{ background:C.blue+"18", border:`1px solid ${C.blue}30`, color:C.blue, fontSize:10, padding:"2px 8px", borderRadius:6, cursor:"pointer", fontWeight:700 }}>
  Reuse
</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Configure */}
      <Card style={{ marginBottom: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Calculator size={14} color={C.gold} strokeWidth={2} />
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>Configure Quote</div>
          <span style={{ fontSize: 10, color: C.muted }}>{activeBuyers.length} buyers · {activeProducts.length} products</span>
        </div>

        <BuyerStrip buyer={buyer} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 14 }}>
          <Field label="Buyer" htmlFor="qb-buyer">
            <select id="qb-buyer" value={buyerId}
              onChange={e => { const b = activeBuyers.find(x => x.id === e.target.value || x.slug === e.target.value); setBuyerId(b?.dbId || e.target.value); setWood(""); setGenerated(false); }}
              style={SEL()}>
              <option value="">Select Buyer</option>
              {activeBuyers.map(b => <option key={b.id} value={b.dbId || b.id}>{b.name} ({b.country_code})</option>)}
            </select>
          </Field>

          <Field label="Product" htmlFor="qb-product">
            <select id="qb-product" value={productId}
              onChange={e => { setProductId(e.target.value); setCustomFOB(""); setWood(""); setGenerated(false); }}
              style={SEL()}>
              <option value="">Select Product</option>
              {Object.entries(groupedProducts).map(([cat, prods]) => (
                <optgroup key={cat} label={cat}>
                  {prods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ${p.fob_range_min}–${p.fob_range_max}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          {/* Material-aware: wood/combo → dropdown, others → label */}
          {product && (
            matCfg.showWood ? (
              <Field label={matCfg.woodLabel} htmlFor="qb-wood" hint={matCfg.note}>
                <select id="qb-wood" value={wood} onChange={e => setWood(e.target.value)} style={SEL()}>
                  <option value="">Select {matCfg.woodLabel}</option>
                  {woodOptions.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Material" htmlFor="qb-mat">
                <div id="qb-mat" style={{ padding: "10px 12px", background: "#161616", border: `1px solid ${matCfg.color}30`, borderRadius: 8, fontSize: 13, color: matCfg.color, fontWeight: 700 }}>
                  {matCfg.label}
                  {matCfg.note && <div style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginTop: 2 }}>{matCfg.note}</div>}
                </div>
              </Field>
            )
          )}

          <Field label="Quantity (pcs)" htmlFor="qb-qty">
            <input id="qb-qty" type="number" value={qty}
              onChange={e => setQty(Number(e.target.value))}
              style={SEL({ color: C.text, fontWeight: 700 })} />
          </Field>

          <Field label="Your FOB ($/pc)" htmlFor="qb-fob"
            hint={pFobMin ? `Typical range: $${pFobMin}–$${pFobMax}` : "Enter your cost + margin"}>
            <input id="qb-fob" type="number" step="0.5" value={customFOB}
              onChange={e => setCustomFOB(e.target.value)}
              onBlur={() => setFobTouched(true)}
              placeholder={pFobMin ? ((pFobMin+pFobMax)/2).toFixed(2) : "0.00"}
              style={SEL({
                color: C.gold, fontWeight: 700,
                borderColor: fobValidation?.type === "ok" ? C.green+"60"
                  : fobValidation?.type === "high" ? C.amber+"60"
                  : fobValidation?.type === "low" ? C.red+"60" : "#2a2a2a",
              })} />
            {fobValidation && (
              <div style={{ fontSize: 10, marginTop: 4, color: fobValidation.type==="ok" ? C.green : fobValidation.type==="high" ? C.amber : C.red }}>
                {fobValidation.msg}
              </div>
            )}
          </Field>

          <Field label="Action" htmlFor="qb-gen">
            <Btn id="qb-gen" onClick={handleGenerate} color={C.gold} disabled={saving}>
              {saving ? <><Loader2 size={12} strokeWidth={2} /> Saving...</> : <><ArrowRight size={12} /> Generate Quote</>}
            </Btn>
          </Field>
        </div>

        {saveError && !generated && (
          <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, background: C.red+"10", border: `1px solid ${C.red}30`, fontSize: 12, color: C.red, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={13} color={C.red} strokeWidth={2} /> {saveError}
          </div>
        )}
      </Card>

      {/* Empty State */}
      {!generated && (
        <Card style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Calculator size={40} color={C.muted} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>Select Buyer + Product to Generate Quote</div>
          <div style={{ fontSize: 12, color: C.muted }}>FOB · Competitor FOB benchmarks · Tariff advantage · Buyer preferences · Compliance</div>
        </Card>
      )}

      {/* Quote Output */}
      {generated && buyer && product && (
        <div>
          {saved && (
            <div style={{ marginBottom: 12, padding: "10px 16px", borderRadius: 8, background: C.green+"10", border: `1px solid ${C.green}30`, fontSize: 12, color: C.green, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display:"flex", alignItems:"center", gap:6 }}><CheckCircle2 size={12} strokeWidth={2} /> Quote saved — Draft</span>
              <button onClick={() => exportQuotePDF({ buyer, product, wood, qty, fob, inrRate, totalUSD, totalINR, weightKg, cbm, containers20, retailBenchmark })}
                style={{ background: C.green, color:"#000", border:"none", padding:"4px 12px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                <FileDown size={11} strokeWidth={2} /> PDF
              </button>
            </div>
          )}
          {saveWarning && <div style={{ marginBottom:12, padding:"10px 16px", borderRadius:8, background:C.amber+"10", border:`1px solid ${C.amber}30`, fontSize:12, color:C.amber }}>{saveWarning}</div>}

          {/* Summary */}
          <Card style={{ marginBottom: 16, borderLeft: `3px solid ${C.gold}`, padding: "20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{buyer.name} — {product.name}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
                  <span style={{ background:matCfg.color+"20", color:matCfg.color, fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>
                    {matCfg.label}{wood ? ` · ${wood}` : ""}
                  </span>
                  <span style={{ fontSize:12, color:C.muted }}>{qty.toLocaleString()} pcs · {buyer.country_code}</span>
                  {product.food_safe && <span style={{ background:C.green+"20", color:C.green, fontSize:9, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>Food Safe</span>}
                </div>
              </div>
              <TierBadge tier={buyer.tier} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
              {[
                { label:"FOB/piece",   val:`$${fob.toFixed(2)}`,               sub:`₹${(fob*inrRate).toFixed(0)}`,       color:C.gold  },
                { label:"Total Order", val:`$${totalUSD.toLocaleString()}`,     sub:`₹${(totalINR/100000).toFixed(1)}L`,  color:C.green },
                { label:"Weight",      val:`${(weightKg/1000).toFixed(1)}MT`,   sub:`~${cbm.toFixed(0)} CBM`,             color:C.amber },
                { label:"Containers",  val:`${containers20} × 20'`,            sub:`${Math.ceil(containers20/2)} × 40'`, color:C.pink  },
              ].map(s => (
                <div key={s.label} style={{ padding:"12px 14px", borderRadius:10, background:s.color+"08", border:`1px solid ${s.color}20` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:12 }}>
              {[["Payment",payment],["Lead Time",leadTime],["MOQ",moq],["Negotiation",negotiation]].map(([k,v]) => (
                <div key={k} style={{ padding:"10px 14px", background:"#0d0d0d", borderRadius:8 }}>
                  <span style={{ color:C.muted }}>{k}:</span>
                  <span style={{ color:C.text, fontWeight:700, marginLeft:6 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Competitor FOB */}
          {(chinaFOB > 0 || vietnamFOB > 0) && (
            <Card style={{ marginBottom:16, borderLeft:`3px solid ${C.green}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <TrendingUp size={14} color={C.green} strokeWidth={2} />
                <div style={{ fontSize:14, fontWeight:800, color:C.green }}>Competitor FOB Benchmark</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:10, marginBottom: tariffSaving > 0 ? 12 : 0 }}>
                <div style={{ padding:"14px", borderRadius:10, background:C.green+"10", border:`2px solid ${C.green}40` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>🇮🇳 Senses FOB</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.green }}>${fob.toFixed(2)}</div>
                  <div style={{ fontSize:10, color:C.green, marginTop:4 }}>{indiaRate}% tariff → ${indiaLanded.toFixed(2)} landed</div>
                </div>
                {chinaFOB > 0 && (
                  <div style={{ padding:"14px", borderRadius:10, background:C.red+"10", border:`1px solid ${C.red}25` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>🇨🇳 China FOB (est.)</div>
                    <div style={{ fontSize:22, fontWeight:900, color:C.red }}>${chinaFOB.toFixed(2)}</div>
                    <div style={{ fontSize:10, color:C.red, marginTop:4 }}>{chinaRate}% tariff → ${chinaLanded.toFixed(2)} landed</div>
                  </div>
                )}
                {vietnamFOB > 0 && (
                  <div style={{ padding:"14px", borderRadius:10, background:C.blue+"10", border:`1px solid ${C.blue}25` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>🇻🇳 Vietnam FOB (est.)</div>
                    <div style={{ fontSize:22, fontWeight:900, color:C.blue }}>${vietnamFOB.toFixed(2)}</div>
                    <div style={{ fontSize:10, color:C.blue, marginTop:4 }}>0% US tariff</div>
                  </div>
                )}
                {tariffSaving > 0 && (
                  <div style={{ padding:"14px", borderRadius:10, background:C.gold+"10", border:`1px solid ${C.gold}25` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Landed Advantage</div>
                    <div style={{ fontSize:22, fontWeight:900, color:C.gold }}>${tariffSaving.toFixed(2)}</div>
                    <div style={{ fontSize:10, color:C.gold, marginTop:4 }}>cheaper/pc vs China</div>
                  </div>
                )}
              </div>
              {tariffSaving > 0 && (
                <div style={{ padding:"10px 14px", borderRadius:8, background:C.green+"08", border:`1px solid ${C.green}20`, fontSize:11, color:C.muted, lineHeight:1.7 }}>
                  <b style={{ color:C.green }}>Buyer Pitch:</b>{" "}
                  "India ${fob.toFixed(2)} + {indiaRate}% = ${indiaLanded.toFixed(2)} landed vs China ${chinaFOB.toFixed(2)} + {chinaRate}% = ${chinaLanded.toFixed(2)} landed.{" "}
                  <b style={{ color:C.gold }}>You save ${tariffSaving.toFixed(2)}/piece = ${(tariffSaving*qty).toLocaleString()} on this order.</b>"
                </div>
              )}
            </Card>
          )}

          {/* Market Context */}
          {(retailBenchmark || product.demand_score > 0) && (
            <Card style={{ marginBottom:16, borderLeft:`3px solid ${C.purple}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <Package size={14} color={C.purple} strokeWidth={2} />
                <div style={{ fontSize:14, fontWeight:800, color:C.purple }}>Market Context</div>
                {retailBenchmark && <span style={{ fontSize:10, color:C.muted }}>{retailBenchmark.cat} · {retailBenchmark.platforms.reduce((s,p)=>s+p.count,0).toLocaleString()} products</span>}
              </div>

              {/* Platform-wise retail prices */}
              {retailBenchmark && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8 }}>Live Retail Prices by Platform</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
                    {retailBenchmark.platforms.map(p => (
                      <div key={p.pl} style={{ padding:"12px 14px", borderRadius:10, background:p.color+"10", border:`1px solid ${p.color}30` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{p.label}</span>
                          <span style={{ fontSize:9, color:C.muted }}>{p.count.toLocaleString()} products</span>
                        </div>
                        <div style={{ fontSize:22, fontWeight:900, color:p.color }}>{p.cur}{p.avg}</div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                          <span style={{ fontSize:10, color:C.muted }}>avg retail</span>
                          {p.margin > 0 && fob > 0 && (
                            <span style={{ background:C.green+"20", color:C.green, fontSize:10, padding:"1px 8px", borderRadius:20, fontWeight:700 }}>
                              {p.margin}% margin
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {fob > 0 && (
                    <div style={{ marginTop:10, padding:"10px 14px", borderRadius:8, background:C.gold+"08", border:`1px solid ${C.gold}20`, fontSize:11, color:C.muted, lineHeight:1.7 }}>
                      <b style={{ color:C.gold }}>Pitch:</b> "At ${fob.toFixed(2)} FOB, your retail margin is{" "}
                      <b style={{ color:C.green }}>{retailBenchmark.platforms[0]?.margin}%</b> on {retailBenchmark.platforms[0]?.label}.
                      {retailBenchmark.platforms.length > 1 && ` Across all platforms avg ${Math.round(retailBenchmark.platforms.reduce((s,p)=>s+p.margin,0)/retailBenchmark.platforms.length)}% margin.`}"
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
                {product.demand_score > 0 && (
                  <div style={{ padding:"12px 14px", borderRadius:10, background:C.amber+"10", border:`1px solid ${C.amber}20` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Demand Score</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.amber }}>{product.demand_score}/100</div>
                    <div style={{ fontSize:10, color:C.muted }}>{product.competition_level||"medium"} competition</div>
                  </div>
                )}
                {product.section_301_china > 0 && (
                  <div style={{ padding:"12px 14px", borderRadius:10, background:C.red+"10", border:`1px solid ${C.red}20` }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>China Section 301</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.red }}>{product.section_301_china}%</div>
                    <div style={{ fontSize:10, color:C.red }}>extra on China imports</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Competitor Brief */}
          <CompetitorBrief buyer={buyer} shipments={shipments} />

          {/* Tariff */}
          <Card style={{ marginBottom:16, borderLeft:`3px solid ${C.blue}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <Zap size={14} color={C.blue} strokeWidth={2} />
              <div style={{ fontSize:14, fontWeight:800, color:C.blue }}>Tariff — {buyer.name} ({buyer.country_code})</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
              {[
                { label:"India Rate",   val:`${indiaRate}%`,               color:C.green, sub:"Preferential"      },
                { label:"China Rate",   val:`${chinaRate}%`,               color:C.red,   sub:"Incl. Section 301" },
                { label:"India Landed", val:`$${indiaLanded.toFixed(2)}`,  color:C.gold,  sub:"Per piece"         },
                { label:"Tariff Gap",   val:`+${chinaRate-indiaRate}%`,    color:C.green, sub:"India advantage"   },
              ].map(s => (
                <div key={s.label} style={{ padding:"12px 14px", borderRadius:10, background:s.color+"10", border:`1px solid ${s.color}20` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Compliance */}
          {applicableLaws.length > 0 && (
            <Card style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <Shield size={14} color={C.gold} strokeWidth={2} />
                <div style={{ fontSize:14, fontWeight:800, color:C.gold }}>Compliance — {buyer.name}</div>
              <button onClick={() => go(null, 'compliance')} style={{ marginLeft:'auto', background:'none', border:`1px solid ${C.gold}30`, color:C.gold, fontSize:10, padding:'3px 10px', borderRadius:6, cursor:'pointer' }}>View All</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                {applicableLaws.map(law => (
                  <div key={law} style={{ padding:"8px 12px", borderRadius:8, background:"#0d0d0d", fontSize:12, display:"flex", alignItems:"center", gap:8 }}>
                    <CheckCircle2 size={12} color={C.green} strokeWidth={2} />
                    <span style={{ color:C.text }}>{law}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* PDF */}
          {!saved && (
            <Card style={{ textAlign:"center", padding:"16px" }}>
              <button
                onClick={() => exportQuotePDF({ buyer, product, wood, qty, fob, inrRate, totalUSD, totalINR, weightKg, cbm, containers20, retailBenchmark })}
                style={{ background:C.blue, color:"#fff", border:"none", padding:"8px 20px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}>
                <FileDown size={11} strokeWidth={2} /> Download PDF
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default TabQuoteBuilder;
