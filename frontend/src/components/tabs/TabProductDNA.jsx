// ─────────────────────────────────────────────
// BuyerIQ — Product DNA Tab v5.1
// UI/UX Skill compliant — hover states, transitions,
// useMemo derived values, Lucide icons only
// ─────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, DataSourceTag } from "../ui/Primitives.jsx";
import { ttStyle } from "../ui/Primitives.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Mail, ChevronDown, ChevronUp, TrendingUp, Package, Zap, ArrowRight } from "lucide-react";

// ── Hover Button (skill: cursor-pointer + hover feedback + 150-300ms transition) ──
function Btn({ children, onClick, color = C.gold, style: s = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? color + "30" : color + "15",
        border: `1px solid ${color}${hov ? "60" : "30"}`,
        color, fontSize: 10, padding: "4px 10px", borderRadius: 6,
        cursor: "pointer", fontWeight: 700,
        display: "flex", alignItems: "center", gap: 4,
        transition: "all 0.18s ease", ...s,
      }}
    >
      {children}
    </button>
  );
}

// ── Normalizers ──────────────────────────────
function normalizeProduct(p) {
  if (!p) return null;
  const s = String(p).toLowerCase();
  if (s.includes("cutting") || s.includes("chopping"))                                        return "Cutting Boards";
  if (s.includes("serving board") || s.includes("serving tray") || s.includes("serving platter") || s.includes("serving boards")) return "Serving Boards/Trays";
  if (s.includes("cheese") || s.includes("charcuterie"))                                      return "Cheese Boards";
  if (s.includes("bowl"))                                                                      return "Bowls";
  if (s.includes("utensil") || s.includes("spoon") || s.includes("spatula") || s.includes("kitchen tool")) return "Utensils & Kitchen Tools";
  if (s.includes("kitchen accessor") || s.includes("kitchen island"))                         return "Kitchen Accessories";
  if (s.includes("iron+wood") || s.includes("iron + wood") || s.includes("metal+wood") || s.includes("wood+iron")) return "Iron+Wood Combo";
  if (s.includes("handicraft") || s.includes("carved") || s.includes("handcraft"))            return "Handicraft Wood";
  if (s.includes("decorat") || s.includes("home accent") || s.includes("wall decor"))         return "Decorative Items";
  if (s.includes("tray"))                                                                      return "Serving Boards/Trays";
  if (s.includes("frame") || s.includes("mirror") || s.includes("shelf") || s.includes("wall art")) return "Frames & Wall Decor";
  if (s.includes("bakeware") || s.includes("rolling pin"))                                    return "Bakeware";
  if (s.includes("storage") || s.includes("food storage"))                                    return "Storage";
  if (s.includes("coaster"))                                                                   return "Coasters";
  if (s.includes("lazy susan"))                                                                return "Lazy Susans";
  if (s.includes("mortar") || s.includes("pestle"))                                           return "Mortar & Pestle";
  return p.split("(")[0].trim();
}

function normalizeWood(w) {
  if (!w) return null;
  const s = String(w).toLowerCase();
  if (s.includes("acacia"))     return "Acacia";
  if (s.includes("mango"))      return "Mango";
  if (s.includes("sheesham"))   return "Sheesham";
  if (s.includes("teak"))       return "Teak";
  if (s.includes("rubberwood")) return "Rubberwood";
  if (s.includes("bamboo"))     return "Bamboo";
  if (s.includes("reclaim"))    return "Reclaimed";
  if (s.includes("pine"))       return "Pine";
  if (s.includes("walnut"))     return "Walnut";
  if (s.includes("oak"))        return "Oak";
  if (s.includes("iron") || s.includes("metal")) return "Iron+Wood";
  if (s.includes("mdf"))        return "MDF/Veneer";
  if (s.includes("birch"))      return "Birch";
  if (s.includes("poplar"))     return "Poplar";
  if (s.includes("olive"))      return "Olive Wood";
  return w.split("(")[0].trim();
}

function normalizeFinish(f) {
  if (!f) return null;
  const s = String(f).toLowerCase();
  if (s.includes("natural oil") || s.includes("food-safe oil")) return "Natural Oil";
  if (s.includes("natural") && !s.includes("oil") && !s.includes("bamboo")) return "Natural";
  if (s.includes("walnut") || s.includes("dark walnut")) return "Walnut/Dark";
  if (s.includes("honey"))      return "Honey";
  if (s.includes("wax"))        return "Wax";
  if (s.includes("paint"))      return "Painted";
  if (s.includes("distress"))   return "Distressed";
  if (s.includes("food-safe") || s.includes("food safe")) return "Food-Safe";
  if (s.includes("minimalist") || s.includes("functional")) return "Minimalist";
  if (s.includes("metallic"))   return "Metallic";
  return f.split("(")[0].trim();
}

const TIER_COLOR = (t) => {
  const u = String(t || "").toUpperCase();
  if (u === "MEGA")    return C.pink;
  if (u === "PREMIUM") return C.gold;
  if (u === "MID")     return C.blue;
  return C.green;
};

const WOOD_COLORS = {
  "Acacia":"#d4a05a","Mango":"#f59e0b","Sheesham":"#b45309","Teak":"#92400e",
  "Rubberwood":"#78716c","Bamboo":"#4ade80","Reclaimed":"#6b7280","Pine":"#a3805b",
  "Walnut":"#7c3aed","Oak":"#b45309","Iron+Wood":"#ec4899","MDF/Veneer":"#94a3b8",
  "Birch":"#fde68a","Poplar":"#d1d5db","Olive Wood":"#84cc16",
};

// ── KPI Card ──────────────────────────────────
function KPICard({ kpi: k }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 16px", borderRadius: 10, textAlign: "center",
        background: hov ? k.color + "12" : k.color + "08",
        border: `1px solid ${hov ? k.color + "40" : k.color + "20"}`,
        transition: "all 0.18s ease",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.val}</div>
      <div style={{ fontSize: 10, color: C.text, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
    </div>
  );
}

// ── Buyer Card ────────────────────────────────
function BuyerCard({ buyer: b, go }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        background: hov ? "#1a1a1a" : "#111",
        borderRadius: 8,
        border: `1px solid ${hov ? "#2a2a2a" : "#1c1c1c"}`,
        transition: "all 0.18s ease",
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{b.name}</div>
        <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
          <span style={{ color: TIER_COLOR(b.tier) }}>{b.tier}</span>
          {b.country_code && ` · ${b.country_code}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {go && <Btn onClick={() => go(b.id, "buyers")} color={C.gold}>View</Btn>}
        {go && (
          <Btn onClick={() => go(b.id, "buyers", "email")} color={C.blue}>
            <Mail size={9} /> Email
          </Btn>
        )}
      </div>
    </div>
  );
}

// ── Buyer Chip ────────────────────────────────
function BuyerChip({ buyer: b, go }) {
  const [hov, setHov] = useState(false);
  return (
    <span
      onClick={() => go && go(b.id, "buyers")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#2a2a2a" : "#1a1a1a",
        border: "1px solid #2a2a2a", color: C.text,
        fontSize: 10, padding: "3px 10px", borderRadius: 20,
        cursor: go ? "pointer" : "default", fontWeight: 600,
        transition: "background 0.15s ease",
      }}
    >
      {b.name}
    </span>
  );
}

// ── Product Row ───────────────────────────────
function ProductRow({ prod, buyerList, isOpen, onToggle }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: isOpen ? C.gold + "08" : hov ? "#161616" : "#111",
        cursor: "pointer",
        transition: "background 0.18s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Package size={12} color={C.gold} strokeWidth={2} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{prod}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: C.green + "20", color: C.green, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>
          {buyerList.length} buyer{buyerList.length > 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {buyerList.slice(0, 6).map(b => (
            <div key={b.id} title={b.name} style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_COLOR(b.tier) }} />
          ))}
          {buyerList.length > 6 && <span style={{ fontSize: 9, color: C.muted }}>+{buyerList.length - 6}</span>}
        </div>
        {isOpen
          ? <ChevronUp size={12} color={C.muted} strokeWidth={2} />
          : <ChevronDown size={12} color={C.muted} strokeWidth={2} />
        }
      </div>
    </div>
  );
}

// ── Wood Row ──────────────────────────────────
function WoodRow({ wood, buyerList, color, isOpen, onToggle, go }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${isOpen ? color + "40" : "#1c1c1c"}`, overflow: "hidden", transition: "border-color 0.18s ease" }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px",
          background: isOpen ? color + "08" : hov ? "#161616" : "transparent",
          cursor: "pointer",
          transition: "background 0.18s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{wood}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: color + "20", color, fontSize: 10, padding: "1px 8px", borderRadius: 20, fontWeight: 700 }}>{buyerList.length}</span>
          {isOpen ? <ChevronUp size={10} color={C.muted} /> : <ChevronDown size={10} color={C.muted} />}
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${color}20`, background: "#0a0a0a" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {buyerList.map(b => <BuyerChip key={b.id} buyer={b} go={go} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Strategy Card ─────────────────────────────
function StrategyCard({ opportunity: o, color }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#161616" : "#111",
        borderRadius: 10, padding: "12px 14px",
        border: `1px solid ${hov ? color + "40" : color + "20"}`,
        transition: "all 0.18s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{o.product}</span>
        <span style={{ background: color + "20", color, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700, whiteSpace: "nowrap" }}>
          {o.marketPct}% market
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: "center", background: "#0d0d0d", borderRadius: 6, padding: "6px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.amber }}>{o.retailCount.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: C.muted }}>retail products</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", background: "#0d0d0d", borderRadius: 6, padding: "6px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.blue }}>{o.buyerCount}</div>
          <div style={{ fontSize: 9, color: C.muted }}>buyers want this</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>{o.hint}</div>
    </div>
  );
}

// ── Buyer-Product Matrix ──────────────────────
function ProductMatrixSection({ buyers, go }) {
  const [expanded, setExpanded] = useState(null);

  const matrix = useMemo(() => {
    const map = {};
    buyers.forEach(b => {
      (b.top_products || []).forEach(raw => {
        const prod = normalizeProduct(raw);
        if (!prod) return;
        if (!map[prod]) map[prod] = [];
        if (!map[prod].find(x => x.id === b.id)) map[prod].push(b);
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 14);
  }, [buyers]);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Users size={14} color={C.gold} strokeWidth={2} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>Buyer–Product Matrix</div>
        <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>
          {buyers.length} buyers · click product to expand
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {matrix.map(([prod, buyerList]) => {
          const isOpen = expanded === prod;
          return (
            <div key={prod} style={{ borderRadius: 10, border: `1px solid ${isOpen ? C.gold + "50" : "#1c1c1c"}`, overflow: "hidden", transition: "border-color 0.2s ease" }}>
              <ProductRow prod={prod} buyerList={buyerList} isOpen={isOpen} onToggle={() => setExpanded(isOpen ? null : prod)} />
              {isOpen && (
                <div style={{ padding: "12px 14px", background: "#0a0a0a", borderTop: "1px solid #1c1c1c" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8, marginBottom: 10 }}>
                    {buyerList.map(b => <BuyerCard key={b.id} buyer={b} go={go} />)}
                  </div>
                  {go && (
                    <div style={{ paddingTop: 10, borderTop: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: C.muted }}>Quick action:</span>
                      <Btn onClick={() => go(buyerList[0]?.id, "quote-builder")} color={C.green}>
                        <ArrowRight size={10} /> Generate Quote for {prod}
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Wood Preferences ─────────────────────────
function WoodSection({ buyers, go }) {
  const [expanded, setExpanded] = useState(null);

  const woodMap = useMemo(() => {
    const map = {};
    buyers.forEach(b => {
      (b.wood_preferences || b.wood || []).forEach(raw => {
        const wood = normalizeWood(raw);
        if (!wood) return;
        if (!map[wood]) map[wood] = [];
        if (!map[wood].find(x => x.id === b.id)) map[wood].push(b);
      });
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [buyers]);

  const chartData = useMemo(() =>
    woodMap.map(([name, list]) => ({ name, buyers: list.length })),
  [woodMap]);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={14} color={C.gold} strokeWidth={2} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>Wood Preferences · Live Buyer Data</div>
        <span style={{ fontSize: 10, color: C.muted }}>{buyers.length} buyers</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ResponsiveContainer width="100%" height={Math.max(200, woodMap.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 90, right: 30 }}>
            <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip {...ttStyle} />
            <Bar dataKey="buyers" fill={C.gold} radius={[0, 6, 6, 0]} barSize={16} name="Buyers"
              label={{ position: "right", fill: C.muted, fontSize: 10, formatter: v => `${v}` }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {woodMap.map(([wood, buyerList]) => (
            <WoodRow
              key={wood} wood={wood} buyerList={buyerList}
              color={WOOD_COLORS[wood] || C.gold}
              isOpen={expanded === wood}
              onToggle={() => setExpanded(expanded === wood ? null : wood)}
              go={go}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Finish Preferences ────────────────────────
function FinishSection({ buyers }) {
  const finishMap = useMemo(() => {
    const map = {};
    buyers.forEach(b => {
      (b.finish_preferences || b.finish || []).forEach(raw => {
        const f = normalizeFinish(raw);
        if (!f) return;
        map[f] = (map[f] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [buyers]);

  const total = buyers.length || 1;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.gold, marginBottom: 14 }}>Finish Preferences · Buyer Profiles</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {finishMap.map(([finish, count]) => (
          <div key={finish} style={{ background: "#111", borderRadius: 8, padding: "10px 14px", border: "1px solid #1c1c1c" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{finish}</span>
              <span style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>{count}</span>
            </div>
            <div style={{ background: "#1c1c1c", borderRadius: 4, height: 4 }}>
              <div style={{ background: C.blue, borderRadius: 4, height: 4, width: `${Math.round((count / total) * 100)}%`, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{Math.round((count / total) * 100)}% of buyers</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Market Demand ─────────────────────────────
function MarketSection({ retail }) {
  const { categoryData, total } = useMemo(() => {
    const map = {};
    (retail || []).forEach(r => {
      if (r.category) {
        const cat = r.category.split(">").pop().trim();
        if (cat) map[cat] = (map[cat] || 0) + 1;
      }
    });
    const data = Object.entries(map)
      .sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([name, count]) => ({ name, count }));
    return { categoryData: data, total: retail?.length || 1 };
  }, [retail]);

  if (!categoryData.length) return null;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Zap size={14} color={C.amber} strokeWidth={2} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>Market Demand · {total.toLocaleString()} Products Tracked</div>
        <span style={{ fontSize: 10, color: C.muted }}>Amazon + Walmart</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 28)}>
        <BarChart data={categoryData} layout="vertical" margin={{ left: 160, right: 60 }}>
          <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
          <Tooltip {...ttStyle} formatter={v => [`${v} products (${Math.round((v / total) * 100)}%)`, "Market"]} />
          <Bar dataKey="count" fill={C.amber} radius={[0, 6, 6, 0]} barSize={16} name="Products"
            label={{ position: "right", fill: C.muted, fontSize: 10, formatter: v => `${Math.round((v / total) * 100)}%` }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Catalog Strategy ──────────────────────────
function StrategySection({ buyers, retail }) {
  const opportunities = useMemo(() => {
    const retailMap = {};
    (retail || []).forEach(r => {
      if (r.category) {
        const cat = r.category.split(">").pop().trim();
        if (cat) retailMap[cat] = (retailMap[cat] || 0) + 1;
      }
    });
    const buyerMap = {};
    buyers.forEach(b => {
      (b.top_products || []).forEach(raw => {
        const prod = normalizeProduct(raw);
        if (prod) buyerMap[prod] = (buyerMap[prod] || 0) + 1;
      });
    });
    const totalRetail = retail?.length || 1;
    return [
      { product: "Cutting Boards",          retailKey: "Cutting & Chopping Boards",   hint: "Highest market demand — defend this category"        },
      { product: "Utensils & Kitchen Tools", retailKey: "Spoons & Utensils",           hint: "Strong market, good buyer interest"                  },
      { product: "Serving Boards/Trays",     retailKey: "Serving Trays & Platters",    hint: "Growing category — multiple buyer targets"           },
      { product: "Cheese Boards",            retailKey: "Cheese & Charcuterie Boards", hint: "Premium segment — high margin opportunity"           },
      { product: "Bowls",                    retailKey: "Wood Bowls",                  hint: "Niche but consistent demand"                         },
      { product: "Iron+Wood Combo",          retailKey: "Wood + Iron Combo",           hint: "Senses specialty — differentiation play"             },
      { product: "Coasters",                 retailKey: "Coasters & Trivets",          hint: "Low India competition — explore"                     },
      { product: "Mortar & Pestle",          retailKey: "Mortar & Pestle",             hint: "Underserved — potential opportunity"                 },
    ].map(g => ({
      ...g,
      retailCount: retailMap[g.retailKey] || 0,
      buyerCount:  buyerMap[g.product] || 0,
      marketPct:   Math.round(((retailMap[g.retailKey] || 0) / totalRetail) * 100),
    })).sort((a, b) => b.retailCount - a.retailCount);
  }, [buyers, retail]);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={14} color={C.green} strokeWidth={2} />
        <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Catalog Strategy · Market vs Buyer Demand</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
        {opportunities.map(o => (
          <StrategyCard key={o.product} opportunity={o}
            color={o.marketPct >= 15 ? C.green : o.marketPct >= 8 ? C.amber : C.muted}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Main Tab ──────────────────────────────────
const TabProductDNA = ({ go }) => {
  const { buyers, retail, source } = useData();

  const activeBuyers = useMemo(() =>
    (buyers || []).filter(b => b.is_active !== false),
  [buyers]);

  const hasRetail = (retail || []).length > 0;

  // skill: derive KPI values, don't store in state
  const kpis = useMemo(() => {
    const prodSet = new Set();
    const woodSet = new Set();
    activeBuyers.forEach(b => {
      (b.top_products || []).forEach(p => { const n = normalizeProduct(p); if (n) prodSet.add(n); });
      (b.wood_preferences || b.wood || []).forEach(w => { const n = normalizeWood(w); if (n) woodSet.add(n); });
    });
    return [
      { label: "Active Buyers",       val: activeBuyers.length,                   color: C.gold  },
      { label: "Product Categories",  val: prodSet.size,                          color: C.green },
      { label: "Wood Types",          val: woodSet.size,                          color: C.amber },
      { label: "Retail Products",     val: (retail||[]).length.toLocaleString(),  color: C.blue  },
    ];
  }, [activeBuyers, retail]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Heading
          sub={`Live data · ${activeBuyers.length} buyers · ${(retail||[]).length.toLocaleString()} retail products`}
          badge={hasRetail ? "V" : "I"}
        >
          Product DNA
        </Heading>
        <DataSourceTag source={hasRetail ? "api" : source} />
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 18, background: "#111", borderRadius: 8, padding: "8px 14px", borderLeft: `3px solid ${C.gold}` }}>
        <b style={{ color: C.gold }}>Strategy Engine:</b> Live buyer preferences + market demand + catalog gaps — scales automatically as buyers are added.
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => <KPICard key={k.label} kpi={k} />)}
      </div>

      <ProductMatrixSection buyers={activeBuyers} go={go} />
      {hasRetail && <MarketSection retail={retail} />}
      {hasRetail && <StrategySection buyers={activeBuyers} retail={retail} />}
      <WoodSection buyers={activeBuyers} go={go} />
      <FinishSection buyers={activeBuyers} />
    </div>
  );
};

export default TabProductDNA;
