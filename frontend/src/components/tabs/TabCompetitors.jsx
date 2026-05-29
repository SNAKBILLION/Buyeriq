// ─────────────────────────────────────────────
// BuyerIQ — Competitor Intel Tab v4.9
// Full data detail view — all valid fields shown
// ─────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, DataSourceTag } from "../ui/Primitives.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ttStyle } from "../ui/Primitives.jsx";
import { Shield, Calendar, TrendingUp, AlertTriangle, Package, Anchor, MapPin } from "lucide-react";

const THREAT_COLORS = { high: C.red, medium: C.amber, low: C.green };
const TC = THREAT_COLORS;

const COUNTRY_CFG = {
  IND: {
    label: "India", flag: "🇮🇳", color: C.red,
    threat: "medium", threatLabel: "Direct Overlap",
    threatReason: "Same Moradabad cluster — competing for same buyers and products",
    strategy: [
      { head: "Your edge", body: "Multi-material (Iron+Wood) + stronger finishing + compliance documentation. Same cluster but differentiated." },
      { head: "Action", body: "FSC CoC, faster sampling, food-safe lab testing — these buyers compare you directly." },
      { head: "Critical accounts", body: "ANURAJ (33 ships → TJ Maxx), GEE GEE (19 ships → Ross). These are YOUR accounts — defend them." },
    ],
  },
  CHN: {
    label: "China", flag: "🇨🇳", color: C.amber,
    threat: "high", threatLabel: "High Pressure",
    threatReason: "72% US market share, lowest cost — but 30% Section 301 tariff = India's structural advantage",
    strategy: [
      { head: "Lead with tariff", body: "India 18% vs China 30% = $12 cheaper per $100 FOB. Every buyer knows this." },
      { head: "Compliance edge", body: "Lacey Act Phase VII + EUDR readiness — China factories face higher documentation risk." },
      { head: "Product gap", body: "China dominates cutting boards and bamboo basics. Senses wins on Iron+Wood artisan designs." },
    ],
  },
  VNM: {
    label: "Vietnam", flag: "🇻🇳", color: C.blue,
    threat: "medium", threatLabel: "Growing Fast",
    threatReason: "No Section 301 tariffs, +15.9% CAGR — rapidly building US supplier base",
    strategy: [
      { head: "Design advantage", body: "India has deeper wood variety (acacia/mango/sheesham) + stronger multi-material capability." },
      { head: "Watch Wayfair", body: "VIEN LAM CO shipping heavily to Wayfair. If Wayfair is your target, Vietnam is direct competition." },
      { head: "Limited data", body: "Vietnam data is only 2 months — they may be more active than shown. Monitor closely." },
    ],
  },
};

function classifyThreat(count) {
  if (count >= 20) return { level: "high",   label: "Very Active" };
  if (count >= 10) return { level: "high",   label: "Active" };
  if (count >= 5)  return { level: "medium", label: "Moderate" };
  return               { level: "low",    label: "Low Activity" };
}

function fmtDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

function fmtDateRange(dates) {
  const valid = (dates || []).filter(Boolean).map(d => String(d).slice(0,10)).sort();
  if (!valid.length) return "—";
  return valid[0] === valid[valid.length-1] ? valid[0] : `${valid[0]} → ${valid[valid.length-1]}`;
}

function cleanPort(port) {
  if (!port) return "—";
  // Remove leading port code numbers like "53306 Mundra, India"
  return String(port).replace(/^\d+\s+/, "").trim().split(",")[0].trim();
}

// ── Detail View ────────────────────────────────────────────────
function DetailView({ supplier, country, byCountry, onBack, go, BUYERS }) {
  const [showAll, setShowAll] = useState(false);
  const cfg   = COUNTRY_CFG[country] || COUNTRY_CFG.IND;
  const comps = byCountry[country] || [];
  const entry = comps.find(([s]) => s === supplier)?.[1];
  if (!entry) return null;

  const threat    = classifyThreat(entry.shipments.length);
  const dateRange = fmtDateRange(entry.dates);
  const buyers    = [...(entry.buyers || new Set())];

  // All shipments sorted by date desc
  const allShips = [...entry.shipments].sort((a, b) => {
    const da = String(a.ship_date || a.arrival_date || "");
    const db = String(b.ship_date || b.arrival_date || "");
    return db.localeCompare(da);
  });

  const displayShips = showAll ? allShips : allShips.slice(0, 10);

  // Aggregates
  const totalKg  = entry.shipments.reduce((s,r) => s + (parseFloat(r.weight_kg)||0), 0);
  const totalQty = entry.shipments.reduce((s,r) => s + (parseFloat(r.quantity)||0), 0);
  const lastShip = allShips[0];
  const firstShip = allShips[allShips.length - 1];

  // Buyer breakdown
  const buyerBreakdown = {};
  entry.shipments.forEach(s => {
    const b = s.buyer_name_raw;
    if (!b || b === "Unknown") return;
    if (!buyerBreakdown[b]) buyerBreakdown[b] = { count:0, kg:0, qty:0 };
    buyerBreakdown[b].count++;
    buyerBreakdown[b].kg += parseFloat(s.weight_kg)||0;
    buyerBreakdown[b].qty += parseFloat(s.quantity)||0;
  });
  const buyerRows = Object.entries(buyerBreakdown).sort((a,b) => b[1].count - a[1].count);

  // Product breakdown
  const topProds = Object.entries(entry.products||{}).sort((a,b) => b[1]-a[1]).slice(0,6);

  // Ports used
  const originPorts = [...new Set(
    entry.shipments.map(s => cleanPort(s.origin_port)).filter(p => p && p !== "—")
  )].slice(0,4);

  const destPorts = [...new Set(
    entry.shipments.map(s => cleanPort(s.dest_port)).filter(p => p && p !== "—")
  )].slice(0,4);

  // HS codes
  const hsCodes = [...new Set(
    entry.shipments.map(s => s.hs_code).filter(Boolean)
  )].slice(0,6);

  // Vessels used
  const vessels = [...new Set(
    entry.shipments.map(s => s.vessel_name).filter(Boolean)
  )].slice(0,4);

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"1px solid #333", color:C.gold, padding:"7px 16px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600, marginBottom:18 }}>
        ← All Competitors
      </button>

      {/* ── HEADER ── */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:14 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:22 }}>{cfg.flag}</span>
              <h2 style={{ fontSize:20, color:C.text, margin:0, fontWeight:800 }}>{supplier}</h2>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <span style={{ background:TC[threat.level]+"20", color:TC[threat.level], fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{threat.label}</span>
              <span style={{ background:cfg.color+"20", color:cfg.color, fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{cfg.label}</span>
              <span style={{ background:C.green+"20", color:C.green, fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{entry.shipments.length} shipments</span>
            </div>
          </div>
          <div style={{ fontSize:10, color:C.muted, textAlign:"right", lineHeight:1.9 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}>
              <Calendar size={10} /> {dateRange}
            </div>
            <div>US Customs · ImportKey</div>
          </div>
        </div>

        {/* Why they matter */}
        <div style={{ background:"#0e0e0e", borderRadius:8, padding:"10px 14px", marginBottom:8, borderLeft:`3px solid ${TC[threat.level]}` }}>
          <div style={{ fontSize:12, color:"#bbb" }}><b style={{ color:C.text }}>Why they matter: </b>{cfg.threatReason}</div>
        </div>
        {/* Shared buyers alert */}
        {BUYERS && (() => {
          const shared = buyers.filter(rb => BUYERS.some(b => (() => { const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,""); const rbn = rb.toLowerCase().replace(/[^a-z0-9]/g,""); return bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8))); })()));
          if (!shared.length) return null;
          return (
            <div style={{ background:C.red+"10", border:`1px solid ${C.red}30`, borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.red, marginBottom:6 }}>⚠ Direct Threat — {shared.length} shared buyer{shared.length>1?"s":""} with Senses</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {shared.map(rb => {
                  const matched = BUYERS.find(b => {
                    const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,'');
                    const rbn = rb.toLowerCase().replace(/[^a-z0-9]/g,'');
                    return bn && rbn && (bn.includes(rbn.slice(0,6)) || rbn.includes(bn.slice(0,6)));
                  });
                  return (
                    <div key={rb} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span onClick={() => go && matched && go(matched.id, "buyers")}
                        style={{ background:C.red+"15", color:C.red, fontSize:10, padding:"3px 10px", borderRadius:20, fontWeight:700, cursor: go ? "pointer" : "default" }}>
                        {rb} {go ? "→" : ""}
                      </span>
                      {go && matched && (
                        <button onClick={() => go(matched.id, "buyers", "email")}
                          style={{ background:C.gold+"20", color:C.gold, fontSize:9, padding:"2px 8px", borderRadius:20, fontWeight:700, border:`1px solid ${C.gold}40`, cursor:"pointer" }}>
                          ✉ Draft Email
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* KPI grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:0 }}>
          {[
            { label:"Shipments",     val: entry.shipments.length,                      color:C.green  },
            { label:"Buyers",        val: buyers.length,                               color:C.gold   },
            { label:"Total Weight",  val: `${(totalKg/1000).toFixed(1)}T`,             color:C.blue   },
            { label:"Total Qty",     val: `${Math.round(totalQty).toLocaleString()}`,  color:C.purple },
            { label:"First Ship",    val: fmtDate(firstShip?.ship_date||firstShip?.arrival_date), color:C.muted },
            { label:"Last Ship",     val: fmtDate(lastShip?.ship_date||lastShip?.arrival_date),   color:C.amber },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background:"#0e0e0e", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1.2 }}>{val}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── BUYER BREAKDOWN ── */}
      {buyerRows.length > 0 && (
        <Card style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.gold, marginBottom:12 }}>Buyer Breakdown</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {buyerRows.map(([buyer, data]) => {
                const isInSenses = BUYERS && (() => {
                  const bn_list = BUYERS.map(b => b.name?.toLowerCase().replace(/[^a-z0-9]/g,""));
                  const rbn = buyer.toLowerCase().replace(/[^a-z0-9]/g,"");
                  return bn_list.some(bn => bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8))));
                })();
                return (
              <div key={buyer} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: isInSenses ? "#0e0e0e" : C.green+"08", borderRadius:8, padding:"10px 14px", cursor: go ? "pointer" : "default", border: isInSenses ? "none" : `1px solid ${C.green}20` }}
                onClick={() => {
                  if (!go || !BUYERS) return;
                  const matched = BUYERS.find(b => (() => { const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,""); const rbn = buyer.toLowerCase().replace(/[^a-z0-9]/g,""); return bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8))); })());
                  if (matched) go(matched.id, "buyers");
                }}
              >
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color: go ? C.blue : C.text }}>{buyer}{go && " →"}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                    {(data.kg/1000).toFixed(1)}T · {Math.round(data.qty).toLocaleString()} units
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {/* shipment count bar */}
                  <div style={{ width:80, height:6, background:"#1a1a1a", borderRadius:3 }}>
                    <div style={{ width:`${Math.min(100,(data.count/entry.shipments.length)*100)}%`, height:"100%", background:cfg.color, borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:800, color:cfg.color, minWidth:24, textAlign:"right" }}>{data.count}</span>
                </div>
              </div>
            );
            })}
          </div>
        </Card>
      )}

      {/* ── PRODUCT MIX + PORTS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>

        {/* Product mix */}
        {topProds.length > 0 && (
          <Card>
            <div style={{ fontSize:12, fontWeight:800, color:C.gold, marginBottom:10 }}>Product Mix</div>
            <ResponsiveContainer width="100%" height={Math.max(80, topProds.length * 28)}>
              <BarChart data={topProds.map(([name,count]) => ({ name, count }))} layout="vertical" margin={{ left:140, right:20 }}>
                <XAxis type="number" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill:C.text, fontSize:10 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip {...ttStyle} formatter={v => [`${v} ships`, ""]} />
                <Bar dataKey="count" fill={cfg.color} radius={[0,6,6,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Ports + HS + Vessels */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Ports */}
          {(originPorts.length > 0 || destPorts.length > 0) && (
            <Card style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:800, color:C.gold, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                <MapPin size={12} color={C.gold} /> Port Routes
              </div>
              {originPorts.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Origin Ports</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {originPorts.map(p => (
                      <span key={p} style={{ background:"#1a1a1a", color:C.text, fontSize:10, padding:"3px 8px", borderRadius:6 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {destPorts.length > 0 && (
                <div>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Destination Ports</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {destPorts.map(p => (
                      <span key={p} style={{ background:"#1a1a1a", color:C.text, fontSize:10, padding:"3px 8px", borderRadius:6 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* HS Codes */}
          {hsCodes.length > 0 && (
            <Card style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:800, color:C.gold, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <Package size={12} color={C.gold} /> HS Codes
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {hsCodes.map(h => (
                  <span key={h} style={{ background:C.amber+"15", color:C.amber, fontSize:10, padding:"3px 8px", borderRadius:6, fontWeight:600 }}>{h}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Vessels */}
          {vessels.length > 0 && (
            <Card style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:800, color:C.gold, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <Anchor size={12} color={C.gold} /> Vessels Used
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {vessels.map(v => (
                  <div key={v} style={{ fontSize:10, color:"#aaa" }}>{v}</div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── FULL SHIPMENT TABLE ── */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.gold }}>
            Shipment History ({entry.shipments.length} total)
          </div>
          <span style={{ fontSize:10, color:C.muted }}>Most recent first · US Customs verified</span>
        </div>

        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 120px 60px 60px 80px", gap:8, padding:"6px 10px", borderBottom:`1px solid #1a1a1a`, marginBottom:4 }}>
          {["Date","Buyer","Product","Weight","Qty","Port"].map(h => (
            <div key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {displayShips.map((s, i) => {
          const buyer   = s.buyer_name_raw;
          const prod    = s.raw_data?.product_type || "—";
          const wt      = s.weight_kg ? `${(parseFloat(s.weight_kg)/1000).toFixed(1)}T` : "—";
          const qty     = s.quantity ? `${Math.round(s.quantity)} ${s.quantity_unit||""}` : "—";
          const port    = cleanPort(s.origin_port);
          const date    = fmtDate(s.ship_date || s.arrival_date);
          const isKnown = buyer && buyer !== "Unknown";

          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"90px 1fr 120px 60px 60px 80px", gap:8, padding:"8px 10px", borderRadius:6, background: i%2===0 ? "#0a0a0a" : "transparent" }}>
              <div style={{ fontSize:10, color:C.muted }}>{date}</div>
              <div
                onClick={() => {
                  if (!go || !BUYERS || !isKnown) return;
                  const mb = BUYERS.find(b => {
                    const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,"");
                    const rbn = buyer.toLowerCase().replace(/[^a-z0-9]/g,"");
                    return bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8)));
                  });
                  if (mb) go(mb.id, "buyers");
                }}
                style={{ fontSize:10, color: isKnown ? (go ? C.blue : C.text) : "#444", fontWeight: isKnown ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor: isKnown && go ? "pointer" : "default" }}>
                {isKnown ? buyer : "Unknown buyer"}
              </div>
              <div style={{ fontSize:10, color:cfg.color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prod}</div>
              <div style={{ fontSize:10, color:C.muted }}>{wt}</div>
              <div style={{ fontSize:10, color:C.muted }}>{qty}</div>
              <div style={{ fontSize:10, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{port}</div>
            </div>
          );
        })}

        {/* Show more */}
        {allShips.length > 10 && !showAll && (
          <button onClick={() => setShowAll(true)} style={{ width:"100%", marginTop:10, padding:"8px", background:"#111", border:"1px solid #222", color:C.muted, borderRadius:8, cursor:"pointer", fontSize:11 }}>
            Show all {allShips.length} shipments ↓
          </button>
        )}
      </Card>

      {/* ── COUNTER STRATEGY ── */}
      <Card style={{ borderColor:C.gold+"30" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <Shield size={13} color={C.gold} strokeWidth={2} />
          <div style={{ fontSize:13, fontWeight:800, color:C.gold }}>Senses Lifestyle — Counter Strategy</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {cfg.strategy.map((s, i) => (
            <div key={i} style={{ background:"#0e0e0e", borderRadius:8, padding:"10px 14px", borderLeft:`2px solid ${cfg.color}40` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:3 }}>{s.head}</div>
              <div style={{ fontSize:11, color:"#aaa", lineHeight:1.6 }}>{s.body}</div>
            </div>
          ))}
          {/* Data-driven insight from product mix */}
          {topProds.length > 0 && (
            <div style={{ background:C.gold+"08", borderRadius:8, padding:"10px 14px", borderLeft:`2px solid ${C.gold}40` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:3 }}>Product Intelligence</div>
              <div style={{ fontSize:11, color:"#aaa", lineHeight:1.6 }}>
                This competitor focuses on <b style={{color:C.text}}>{topProds[0]?.[0]}</b>
                {topProds[1] ? <> and <b style={{color:C.text}}>{topProds[1]?.[0]}</b></> : ""}.
                {topProds[0]?.[0]?.includes("Handicraft") ? " Senses can differentiate with FSC certification and multi-material designs." : ""}
                {topProds[0]?.[0]?.includes("Iron") ? " Senses already strong in Iron+Wood — emphasize finishing quality." : ""}
                {topProds[0]?.[0]?.includes("Cutting") ? " China dominates cutting boards on price — compete on compliance and artisan quality." : ""}
                {topProds[0]?.[0]?.includes("Bowl") ? " Wood bowls — emphasize mango/acacia natural grain vs generic bamboo." : ""}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Main List View ──────────────────────────────────────────────
const TabCompetitors = ({ go }) => {
  const { shipments, BUYERS } = useData();
  const [selected, setSelected] = useState(null);
  const [showAllCHN, setShowAllCHN] = useState(false);
  const [showAllVNM, setShowAllVNM] = useState(true);
  const [showAllIND, setShowAllIND] = useState(false);

  const { byCountry, hasLiveData } = useMemo(() => {
    if (!shipments || shipments.length === 0) return { byCountry:{}, hasLiveData:false };

    const maps = { IND:{}, CHN:{}, VNM:{} };

    shipments.forEach(s => {
      const supplier = s.supplier_name_raw;
      if (!supplier) return;
      if (s.raw_data?.is_senses) return;
      if (supplier.toUpperCase().includes("SENSES")) return;

      const country = s.origin_country;
      if (!maps[country]) return;

      if (!maps[country][supplier]) {
        maps[country][supplier] = { shipments:[], buyers:new Set(), products:{}, dates:[] };
      }
      const e = maps[country][supplier];
      e.shipments.push(s);
      e.dates.push(s.ship_date || s.arrival_date);
      if (s.buyer_name_raw && s.buyer_name_raw !== "Unknown") e.buyers.add(s.buyer_name_raw);
      const pt = s.raw_data?.product_type || "—";
      e.products[pt] = (e.products[pt]||0)+1;
    });

    const sorted = {};
    Object.entries(maps).forEach(([c,m]) => {
      sorted[c] = Object.entries(m).sort((a,b) => b[1].shipments.length - a[1].shipments.length);
    });

    return { byCountry:sorted, hasLiveData:Object.values(sorted).some(a => a.length > 0) };
  }, [shipments]);

  if (selected) {
    return <DetailView supplier={selected.supplier} country={selected.country} byCountry={byCountry} onBack={() => setSelected(null)} go={go} BUYERS={BUYERS} />;
  }

  const counts = { IND:byCountry.IND?.length||0, CHN:byCountry.CHN?.length||0, VNM:byCountry.VNM?.length||0 };
  const ships  = {
    IND:(byCountry.IND||[]).reduce((s,[,d])=>s+d.shipments.length,0),
    CHN:(byCountry.CHN||[]).reduce((s,[,d])=>s+d.shipments.length,0),
    VNM:(byCountry.VNM||[]).reduce((s,[,d])=>s+d.shipments.length,0),
  };

  return (
    <div>
      <Heading sub="Live US Customs data — India, China, Vietnam competitors tracked" badge="V">
        Competitor Intel
      </Heading>

      <div style={{ marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ fontSize:11, color:C.muted, background:"#111", borderRadius:8, padding:"8px 14px", borderLeft:`3px solid ${C.amber}`, lineHeight:1.9 }}>
          <b style={{ color:C.amber }}>Data Source:</b> US Customs import records (ImportKey) ·
          India <span style={{ color:C.red }}>Sep 2023 – Apr 2026</span> ·
          China <span style={{ color:C.amber }}>Jul 2025 – Apr 2026</span> ·
          Vietnam <span style={{ color:C.blue }}>Feb 2026 – Apr 2026</span>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:220, background:C.amber+"12", border:`1px solid ${C.amber}40`, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"flex-start", gap:10 }}>
            <span style={{ fontSize:18, lineHeight:1 }}>⚠</span>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:C.amber, marginBottom:3 }}>China Data — 9 Months Old</div>
              <div style={{ fontSize:10, color:"#aaa", lineHeight:1.6 }}>Last record: Jul 2025. New suppliers may have entered. Use as directional signal only — verify before quoting against Chinese competitors.</div>
            </div>
          </div>
          <div style={{ flex:1, minWidth:220, background:C.blue+"10", border:`1px solid ${C.blue}30`, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"flex-start", gap:10 }}>
            <span style={{ fontSize:18, lineHeight:1 }}>ℹ</span>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:C.blue, marginBottom:3 }}>Vietnam Data — 2 Months Only</div>
              <div style={{ fontSize:10, color:"#aaa", lineHeight:1.6 }}>Coverage from Feb 2026. Vietnam activity likely higher than shown — monitor closely, especially for Wayfair accounts.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px,1fr))", gap:10, marginBottom:22 }}>
        {[
          { label:"India Rivals",  val:counts.IND, sub:`${ships.IND} shipments`,  color:C.red    },
          { label:"China Comps",   val:counts.CHN, sub:`${ships.CHN} shipments`,  color:C.amber  },
          { label:"Vietnam Comps", val:counts.VNM, sub:`${ships.VNM} shipments`,  color:C.blue   },
          { label:"Total Tracked", val:counts.IND+counts.CHN+counts.VNM, sub:`${ships.IND+ships.CHN+ships.VNM} total`, color:C.gold },
        ].map(s => (
          <div key={s.label} onClick={() => { const el = document.getElementById(`section-${s.label.toLowerCase().replace(/\s+/g,"-")}`); if(el) el.scrollIntoView({behavior:"smooth"}); }}
            style={{ padding:"14px 16px", borderRadius:10, background:s.color+"08", border:`1px solid ${s.color}20`, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10, color:C.text, fontWeight:600, marginTop:2 }}>{s.label}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {hasLiveData ? (
        ["IND","CHN","VNM"].map(country => {
          const cfg   = COUNTRY_CFG[country];
          const comps = byCountry[country]||[];
          if (!comps.length) return null;
          const dateRange = fmtDateRange(comps.flatMap(([,d]) => d.dates));

          return (
            <div key={country} id={`section-${country === "IND" ? "india-rivals" : country === "CHN" ? "china-comps" : "vietnam-comps"}`} style={{ marginBottom:26, ...(country==="IND" ? { background:C.red+"05", borderRadius:12, padding:"16px", border:`1px solid ${C.red}20` } : {}) }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
                <div style={{ fontSize: country==="IND" ? 16 : 14, fontWeight:800, color:cfg.color, display:"flex", alignItems:"center", gap:6 }}>
                  <span>{cfg.flag}</span> {cfg.label} Competitors
                  <span style={{ background:cfg.color+"20", color:cfg.color, fontSize:11, padding:"2px 10px", borderRadius:20 }}>{comps.length}</span>
                </div>
                <DataSourceTag source="api" />
                <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.muted, background:"#161616", padding:"3px 8px", borderRadius:6, border:"1px solid #222" }}>
                  <Calendar size={10} color={C.muted} /> {dateRange}
                </span>
                <span style={{ fontSize:10, padding:"3px 8px", borderRadius:6, fontWeight:700, background:TC[cfg.threat]+"15", color:TC[cfg.threat] }}>
                  {cfg.threatLabel}
                </span>
              </div>

              {(() => {
                const showAll = country === "CHN" ? showAllCHN : country === "VNM" ? showAllVNM : country === "IND" ? showAllIND : true;
                const filtered = showAll ? comps : country === "CHN" ? comps.slice(0, 5) : comps.filter(([,d]) => d.shipments.length >= 5);
                const hiddenCount = comps.length - filtered.length;
                return (<>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:10 }}>
                {filtered.map(([supplier, data]) => {
                  const threat   = classifyThreat(data.shipments.length);
                  const topProd  = Object.entries(data.products).sort((a,b) => b[1]-a[1])[0];
                  const dateRng  = fmtDateRange(data.dates);
                  const buyerList = [...data.buyers].slice(0,2);
                  const totalKg  = data.shipments.reduce((s,r) => s+(parseFloat(r.weight_kg)||0), 0);
                  const sharedBuyers = BUYERS ? [...data.buyers].filter(rb =>
                    BUYERS.some(b => (() => { const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,""); const rbn = rb.toLowerCase().replace(/[^a-z0-9]/g,""); return bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8))); })())
                  ) : [];
                  const isDirect = sharedBuyers.length > 0;

                  return (
                    <Card key={supplier} onClick={() => setSelected({ supplier, country })} style={{ padding:14, cursor:"pointer", borderColor: isDirect ? C.red+"60" : undefined, borderWidth: isDirect ? 2 : 1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:800, color:C.text, flex:1, paddingRight:8, lineHeight:1.4 }}>{supplier}</span>
                        <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                          {isDirect && <span style={{ background:C.red+"20", color:C.red, fontSize:9, padding:"2px 7px", borderRadius:20, fontWeight:800 }}>⚠ {sharedBuyers.length} shared</span>}
                          <span style={{ background:TC[threat.level]+"20", color:TC[threat.level], fontSize:9, padding:"2px 7px", borderRadius:20, fontWeight:700 }}>{threat.label}</span>
                          <span style={{ background:C.green+"20", color:C.green, fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700 }}>{data.shipments.length}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:12, fontSize:11, color:C.muted, marginBottom:6 }}>
                        <span>{data.buyers.size} buyers</span>
                        {totalKg > 0 && <span>{(totalKg/1000).toFixed(1)}T</span>}
                      </div>
                      {buyerList.length > 0 && (
                        <div style={{ fontSize:10, color:"#888", marginBottom:6 }}>
                          {buyerList.join(" · ")}{data.buyers.size > 2 ? ` +${data.buyers.size-2}` : ""}
                        </div>
                      )}
                      {topProd && (
                        <span style={{ background:cfg.color+"12", color:cfg.color, fontSize:10, padding:"2px 8px", borderRadius:6, display:"inline-block", marginBottom:6 }}>
                          {topProd[0]}
                        </span>
                      )}
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:"#444" }}>
                          <Calendar size={9} color="#444" /> {dateRng}
                        </div>
                        <span style={{ fontSize:9, color:"#444", fontStyle:"italic" }}>Full details →</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
              {comps.length > (country === "IND" ? 5 : 5) && (
                <button
                  onClick={() => country === "CHN" ? setShowAllCHN(p=>!p) : country === "VNM" ? setShowAllVNM(p=>!p) : setShowAllIND(p=>!p)}
                  style={{ marginTop:10, padding:"7px 16px", background:"#111", border:"1px solid #222", color:C.muted, borderRadius:8, cursor:"pointer", fontSize:11 }}
                >
                  {(country === "CHN" ? showAllCHN : country === "VNM" ? showAllVNM : showAllIND)
                    ? `Show active only ↑`
                    : `Show all ${comps.length} competitors ↓`}
                </button>
              )}
              </>);})()}
            </div>
          );
        })
      ) : (
        <Card style={{ textAlign:"center", padding:30 }}>
          <TrendingUp size={28} color={C.muted} strokeWidth={1.5} />
          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginTop:8 }}>No live shipment data</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Insert script chalao to load competitor data</div>
        </Card>
      )}

      {(() => {
        const topIND = (byCountry.IND || []).slice(0, 4)
          .map(([s, d]) => `${s} (${d.shipments.length})`).join(" · ") || "No data";
        const topCHN = (byCountry.CHN || []).slice(0, 3)
          .map(([s, d]) => `${s} (${d.shipments.length})`).join(" · ") || "No data";
        const topVNM = (byCountry.VNM || []).slice(0, 3)
          .map(([s, d]) => `${s} (${d.shipments.length})`).join(" · ") || "No data";

        const mergeProducts = (key) => {
          const acc = {};
          (byCountry[key] || []).forEach(([, d]) =>
            Object.entries(d.products || {}).forEach(([p, c]) => { acc[p] = (acc[p] || 0) + c; })
          );
          return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p).join(", ") || "—";
        };
        const prodsIND = mergeProducts("IND");
        const prodsCHN = mergeProducts("CHN");
        const prodsVNM = mergeProducts("VNM");

        const directThreats = (byCountry.IND || []).filter(([, d]) =>
          BUYERS && [...d.buyers].some(rb =>
            BUYERS.some(b => { const bn = b.name?.toLowerCase().replace(/[^a-z0-9]/g,""); const rbn = rb.toLowerCase().replace(/[^a-z0-9]/g,""); return bn && rbn && (bn.includes(rbn.slice(0,8)) || rbn.includes(bn.slice(0,8))); })
          )
        ).length;

        const indDR = fmtDateRange((byCountry.IND||[]).flatMap(([,d])=>d.dates));
        const chnDR = fmtDateRange((byCountry.CHN||[]).flatMap(([,d])=>d.dates));
        const vnmDR = fmtDateRange((byCountry.VNM||[]).flatMap(([,d])=>d.dates));

        return (
          <Card style={{ borderColor:C.gold+"30" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <AlertTriangle size={12} color={C.gold} strokeWidth={2} />
              <div style={{ fontSize:12, fontWeight:800, color:C.gold }}>Competitive Landscape Summary</div>
              {directThreats > 0 && (
                <span style={{ background:C.red+"20", color:C.red, fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700, marginLeft:4 }}>
                  ⚠ {directThreats} direct threats
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:"#bbb", lineHeight:2.1 }}>
              <div>• <b style={{ color:C.red }}>India (direct rivals):</b> <b style={{ color:C.text }}>{counts.IND}</b> exporters · {ships.IND} shipments · {topIND}{prodsIND !== "—" ? ` · ${prodsIND}` : ""} · {indDR}</div>
              <div>• <b style={{ color:C.amber }}>China (dominant):</b> <b style={{ color:C.text }}>{counts.CHN}</b> exporters · {ships.CHN} shipments · {topCHN}{prodsCHN !== "—" ? ` · ${prodsCHN}` : ""} · 30% tariff drag · {chnDR}</div>
              <div>• <b style={{ color:C.blue }}>Vietnam (rising):</b> <b style={{ color:C.text }}>{counts.VNM}</b> exporters · {ships.VNM} shipments · {topVNM}{prodsVNM !== "—" ? ` · ${prodsVNM}` : ""} · no Section 301 · {vnmDR}</div>
              <div>• <b style={{ color:C.green }}>India edge:</b> 18% tariff vs China 30% + craft quality + compliance = structural advantage</div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
};

export default TabCompetitors;
