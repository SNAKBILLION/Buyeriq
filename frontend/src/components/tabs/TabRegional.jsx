// ─────────────────────────────────────────────
// BuyerIQ — Regional Map Tab v2.0
// ─────────────────────────────────────────────
// Upgraded from basic country cards to:
//  - SVG world map with buyer hotspots
//  - Per-country market intelligence
//  - Tariff rates, FOB ranges, tier distribution
//  - Quick actions per market
// ─────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C, TIERS } from "../../data/theme.js";
import { Card, TierBadge } from "../ui/Primitives.jsx";
import {
  MapPin, Users, TrendingUp, DollarSign,
  ChevronRight, Globe, FileText, BarChart2,
} from "lucide-react";

// Country metadata
const META = {
  US: { name:"United States",   tariff:"18%",  tariffNote:"Feb 2026 deal",   tariffColor:"#22c55e", region:"North America",  x:200, y:220 },
  GB: { name:"United Kingdom",  tariff:"0%",   tariffNote:"UK DCTS",         tariffColor:"#22c55e", region:"Europe",         x:460, y:160 },
  DE: { name:"Germany",         tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:490, y:170 },
  NL: { name:"Netherlands",     tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:480, y:165 },
  FR: { name:"France",          tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:473, y:178 },
  SE: { name:"Sweden",          tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:498, y:148 },
  DK: { name:"Denmark",         tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:490, y:155 },
  ES: { name:"Spain",           tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:463, y:185 },
  IE: { name:"Ireland",         tariff:"0%",   tariffNote:"EU GSP+",         tariffColor:"#22c55e", region:"Europe",         x:450, y:160 },
  CA: { name:"Canada",          tariff:"0%",   tariffNote:"MFN",             tariffColor:"#22c55e", region:"North America",  x:195, y:185 },
  AU: { name:"Australia",       tariff:"0%",   tariffNote:"AI-ECTA",         tariffColor:"#22c55e", region:"Asia-Pacific",   x:720, y:370 },
  JP: { name:"Japan",           tariff:"2.4%", tariffNote:"CEPA",            tariffColor:"#f59e0b", region:"Asia-Pacific",   x:760, y:210 },
  ZA: { name:"South Africa",    tariff:"0%",   tariffNote:"SACU",            tariffColor:"#22c55e", region:"Africa",         x:510, y:370 },
  AE: { name:"UAE",             tariff:"0%",   tariffNote:"CEPA",            tariffColor:"#22c55e", region:"Middle East",    x:595, y:250 },
  SA: { name:"Saudi Arabia",    tariff:"5%",   tariffNote:"MFN",             tariffColor:"#f59e0b", region:"Middle East",    x:580, y:255 },
};

// Tier normalization
const normTier = (t) =>
  t === "mega_volume" || t === "MEGA"     ? "MEGA"    :
  t === "mid_range"   || t === "MID"      ? "MID"     :
  t === "premium"     || t === "PREMIUM"  ? "PREMIUM" : "VALUE";

const fmt = (v) =>
  v >= 1e9 ? `$${(v/1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M`
  : `$${(v/1e3).toFixed(0)}K`;

const TabRegional = ({ go }) => {
  const { BUYERS } = useData();
  const [sel, setSel] = useState(null);

  const countries = useMemo(() => {
    const map = {};
    (BUYERS || []).forEach(b => {
      const code = b.country_code;
      if (!code || !META[code]) return;
      if (!map[code]) map[code] = {
        code,
        ...META[code],
        buyers: [],
      };
      map[code].buyers.push(b);
    });
    return Object.values(map).sort((a, b) => b.buyers.length - a.buyers.length);
  }, [BUYERS]);

  const selCountry = countries.find(c => c.code === sel);

  // Per-country computed stats
  const getStats = (buyers) => {
    const totalRevPotential = buyers.reduce((s, b) => {
      const mid = b.fob ? (b.fob.min + b.fob.max) / 2 : 0;
      const moqNums = b.moq ? b.moq.replace(/,/g,'').match(/\d+/g) : null;
      const moq = moqNums && moqNums.length >= 2
        ? (parseInt(moqNums[0]) + parseInt(moqNums[1])) / 2
        : moqNums ? parseInt(moqNums[0]) : 1000;
      const pipeline = Math.min(mid * moq, 500000); // cap at $500K per buyer
      return s + pipeline;
    }, 0);
    const avgScore = buyers.length
      ? Math.round(buyers.reduce((s, b) => s + (b.scores.vol + b.scores.margin + b.scores.pay + b.scores.growth) / 4, 0) / buyers.length)
      : 0;
    const tiers = {};
    buyers.forEach(b => {
      const t = normTier(b.tier);
      tiers[t] = (tiers[t] || 0) + 1;
    });
    const avgFOB = buyers.filter(b => b.fob?.min).length
      ? (buyers.filter(b => b.fob?.min).reduce((s, b) => s + (b.fob.min + b.fob.max) / 2, 0) / buyers.filter(b => b.fob?.min).length).toFixed(0)
      : null;
    return { totalRevPotential, avgScore, tiers, avgFOB };
  };

  // Group by region for the map legend
  const regions = useMemo(() => {
    const r = {};
    countries.forEach(c => {
      if (!r[c.region]) r[c.region] = 0;
      r[c.region] += c.buyers.length;
    });
    return r;
  }, [countries]);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:C.text, letterSpacing:-0.5 }}>Regional Map</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
            {countries.length} markets · {BUYERS.length} buyers · Click a country to explore
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Object.entries(regions).map(([region, count]) => (
            <span key={region} style={{
              fontSize:9, padding:"2px 8px", borderRadius:20,
              background:C.border, color:C.muted, border:`1px solid ${C.border}`,
            }}>
              {region} · {count}
            </span>
          ))}
        </div>
      </div>

      {/* SVG Dot Map */}
      <Card style={{ marginBottom:16, padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <Globe size={14} color={C.gold} strokeWidth={2} />
          <span style={{ fontSize:13, fontWeight:900, color:C.text }}>Buyer Hotspots</span>
          <span style={{ fontSize:9, color:C.muted, marginLeft:"auto" }}>dot size = buyer count</span>
        </div>
        <div style={{ position:"relative", width:"100%", background:"#0a0a0a", borderRadius:10, overflow:"hidden" }}>
          <svg viewBox="0 0 900 480" style={{ width:"100%", display:"block" }}>
            {/* Simple world outline — key landmasses */}
            {/* Americas */}
            <path d="M60,120 L80,100 L120,95 L150,100 L170,120 L200,115 L230,120 L260,140 L280,160 L290,200 L280,240 L260,280 L240,320 L220,360 L200,400 L180,430 L160,420 L150,390 L140,360 L130,330 L110,300 L90,270 L70,240 L50,210 L45,180 L50,150 Z" fill="#161616" stroke="#2a2a2a" strokeWidth="1"/>
            {/* Europe */}
            <path d="M420,110 L460,100 L510,105 L530,120 L520,150 L500,165 L480,175 L460,170 L440,165 L430,150 L425,135 Z" fill="#161616" stroke="#2a2a2a" strokeWidth="1"/>
            {/* Africa */}
            <path d="M450,185 L490,180 L520,190 L540,220 L545,260 L540,300 L530,340 L510,370 L490,385 L470,380 L450,360 L440,330 L435,290 L440,250 L445,215 Z" fill="#161616" stroke="#2a2a2a" strokeWidth="1"/>
            {/* Asia */}
            <path d="M530,100 L600,90 L680,85 L760,90 L820,100 L840,130 L830,160 L800,180 L770,190 L740,195 L710,210 L690,230 L670,220 L640,215 L610,200 L580,185 L560,170 L545,150 L535,130 Z" fill="#161616" stroke="#2a2a2a" strokeWidth="1"/>
            {/* Australia */}
            <path d="M680,330 L730,320 L770,325 L800,340 L810,370 L800,400 L770,415 L730,410 L700,395 L680,370 L672,350 Z" fill="#161616" stroke="#2a2a2a" strokeWidth="1"/>

            {/* Country dots */}
            {countries.map(c => {
              const r = Math.max(8, Math.min(22, 6 + c.buyers.length * 3));
              const isSelected = sel === c.code;
              const stats = getStats(c.buyers);
              return (
                <g key={c.code} onClick={() => setSel(sel === c.code ? null : c.code)}
                  style={{ cursor:"pointer" }}>
                  {/* Pulse ring when selected */}
                  {isSelected && (
                    <circle cx={c.x} cy={c.y} r={r + 8}
                      fill="none" stroke={C.gold} strokeWidth="1.5" opacity="0.5" strokeDasharray="4 3"/>
                  )}
                  <circle cx={c.x} cy={c.y} r={r}
                    fill={isSelected ? C.gold : c.tariffColor + "40"}
                    stroke={isSelected ? C.gold : c.tariffColor}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text x={c.x} y={c.y + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={isSelected ? "#000" : c.tariffColor}
                    fontSize={r > 14 ? 9 : 8} fontWeight="700">
                    {c.buyers.length}
                  </text>
                  {/* Country code label */}
                  <text x={c.x} y={c.y + r + 11}
                    textAnchor="middle"
                    fill={isSelected ? C.gold : C.muted}
                    fontSize="8" fontWeight={isSelected ? "700" : "400"}>
                    {c.code}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tariff legend */}
        <div style={{ display:"flex", gap:16, marginTop:10 }}>
          {[
            { color:"#22c55e", label:"0% tariff — free access" },
            { color:"#f59e0b", label:"Low tariff (2–5%)" },
          ].map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:l.color }} />
              <span style={{ fontSize:9, color:C.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Country grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:10, marginBottom:16 }}>
        {countries.map(c => {
          const stats = getStats(c.buyers);
          const isSelected = sel === c.code;
          return (
            <div key={c.code}
              onClick={() => setSel(sel === c.code ? null : c.code)}
              style={{
                padding:"14px 16px", borderRadius:10, cursor:"pointer",
                background: isSelected ? C.gold + "10" : "#111",
                border:`1px solid ${isSelected ? C.gold + "60" : C.border}`,
                transition:"all 0.15s",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border.replace("1a","2a"); }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:isSelected ? C.gold : C.text }}>{c.name}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>{c.region}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:isSelected ? C.gold : C.text }}>{c.buyers.length}</div>
                  <div style={{ fontSize:8, color:C.muted }}>buyer{c.buyers.length !== 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Tariff badge */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{
                  fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                  background:c.tariffColor + "18", color:c.tariffColor,
                  border:`1px solid ${c.tariffColor}30`,
                }}>
                  {c.tariff} — {c.tariffNote}
                </span>
                {stats.avgFOB && (
                  <span style={{ fontSize:9, color:C.muted }}>~${stats.avgFOB} FOB</span>
                )}
              </div>

              {/* Tier mini-bars */}
              <div style={{ display:"flex", gap:3, marginTop:6 }}>
                {Object.entries(TIERS).map(([k, v]) => {
                  const count = stats.tiers[k] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={k} title={`${v.label}: ${count}`} style={{
                      height:4, flex:count, borderRadius:2, background:v.color, opacity:0.8,
                    }} />
                  );
                })}
              </div>

              {/* Revenue potential */}
              {stats.totalRevPotential > 0 && (
                <div style={{ fontSize:9, color:C.muted, marginTop:6 }}>
                  Pipeline est. <span style={{ color:C.purple, fontWeight:700 }}>{fmt(stats.totalRevPotential)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected country detail */}
      {sel && selCountry && (() => {
        const stats = getStats(selCountry.buyers);
        return (
          <div>
            {/* Country header */}
            <div style={{
              padding:"14px 18px", borderRadius:10, marginBottom:12,
              background:`linear-gradient(135deg, ${C.gold}10, ${C.gold}05)`,
              border:`1px solid ${C.gold}30`,
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:C.gold }}>
                  {selCountry.name}
                </div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                  {selCountry.buyers.length} buyers · India tariff {selCountry.tariff} ({selCountry.tariffNote}) · {selCountry.region}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => go(null, "quote-builder")} style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"7px 14px", borderRadius:8, fontSize:11, fontWeight:700,
                  background:C.gold + "18", border:`1px solid ${C.gold}35`, color:C.gold, cursor:"pointer",
                }}>
                  <FileText size={11} strokeWidth={2.5} /> Generate Quote
                </button>
                <button onClick={() => go(null, "trade-intel")} style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"7px 14px", borderRadius:8, fontSize:11, fontWeight:700,
                  background:"transparent", border:`1px solid ${C.border}`, color:C.muted, cursor:"pointer",
                }}>
                  <BarChart2 size={11} strokeWidth={2} /> Trade Data
                </button>
              </div>
            </div>

            {/* Market stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:10, marginBottom:12 }}>
              {[
                { icon:Users,      value:selCountry.buyers.length,         label:"Buyers tracked",    color:C.blue   },
                { icon:DollarSign, value:stats.avgFOB ? `$${stats.avgFOB}` : "—", label:"Avg FOB target",  color:C.gold   },
                { icon:TrendingUp, value:`${stats.avgScore}/100`,           label:"Avg buyer score",   color:C.green  },
                { icon:MapPin,     value:selCountry.tariff,                 label:`Tariff (${selCountry.tariffNote})`, color:selCountry.tariffColor },
              ].map(s => (
                <div key={s.label} style={{
                  padding:"12px 14px", borderRadius:10,
                  background:s.color + "08", border:`1px solid ${s.color}20`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <s.icon size={12} color={s.color} strokeWidth={2} />
                    <span style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Buyer cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10 }}>
              {selCountry.buyers.map(b => (
                <div key={b.id}
                  onClick={() => go(b.slug || b.id, "buyers")}
                  style={{
                    padding:"12px 14px", borderRadius:10, cursor:"pointer",
                    background:"#0d0d0d", border:`1px solid ${C.border}`,
                    transition:"all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold + "40"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{b.name}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{b.hq_city || b.region}</div>
                    </div>
                    <TierBadge tier={b.tier} />
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:11, marginBottom:8 }}>
                    <div>
                      <span style={{ color:C.muted }}>Revenue: </span>
                      <span style={{ color:C.gold, fontWeight:600 }}>{b.revenue_text || "—"}</span>
                    </div>
                    <div>
                      <span style={{ color:C.muted }}>FOB: </span>
                      <span style={{ color:C.green, fontWeight:600 }}>{(() => {
    if (b.fob?.sweet) return b.fob.sweet;

    const mn = parseFloat(b.fob_min ?? b.fob?.min);
    const mx = parseFloat(b.fob_max ?? b.fob?.max);
    if (!isNaN(mn) && mn > 0) return `${mn}–${mx} FOB`;
    return "—";
  })()}</span>
                    </div>
                  </div>

                  {/* Score bars */}
                  <div style={{ display:"flex", gap:3 }}>
                    {[
                      { label:"Pay",    val:b.scores?.pay,    color:C.green  },
                      { label:"Vol",    val:b.scores?.vol,    color:C.blue   },
                      { label:"Margin", val:b.scores?.margin, color:C.gold   },
                      { label:"Growth", val:b.scores?.growth, color:C.purple },
                    ].map(s => (
                      <div key={s.label} style={{ flex:1 }}>
                        <div style={{ fontSize:7, color:C.muted, marginBottom:2, textAlign:"center" }}>{s.label}</div>
                        <div style={{ height:3, background:"#1a1a1a", borderRadius:2 }}>
                          <div style={{ width:`${s.val || 0}%`, height:"100%", background:s.color, borderRadius:2, transition:"width 0.4s" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                    <ChevronRight size={12} color={C.muted} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TabRegional;
