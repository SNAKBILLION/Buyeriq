import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { useAPI } from "../../hooks/useAPI.js";
import { exportToCSV, fetchSeasonalData } from "../../services/api.js";
import { exportTradeDataPDF } from "../../utils/pdfExport.js";
import { C } from "../../data/theme.js";
import { EmptyState } from "../ui/Primitives.jsx";
import { Database, AlertTriangle, Star, X, TrendingDown, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, AreaChart, Area,
} from "recharts";

// ── Country metadata ──────────────────────────────────────────────────
const FLAGS = {
  USA:"🇺🇸",GBR:"🇬🇧",DEU:"🇩🇪",NLD:"🇳🇱",FRA:"🇫🇷",AUS:"🇦🇺",CAN:"🇨🇦",JPN:"🇯🇵",
  ARE:"🇦🇪",SAU:"🇸🇦",SGP:"🇸🇬",NZL:"🇳🇿",SWE:"🇸🇪",IND:"🇮🇳",CHN:"🇨🇳",VNM:"🇻🇳",
  IDN:"🇮🇩",THA:"🇹🇭",PHL:"🇵🇭",LKA:"🇱🇰",BGD:"🇧🇩",KOR:"🇰🇷",MEX:"🇲🇽",ESP:"🇪🇸",
  ITA:"🇮🇹",POL:"🇵🇱",TUR:"🇹🇷",
};
const NAMES = {
  USA:"United States",GBR:"United Kingdom",DEU:"Germany",NLD:"Netherlands",FRA:"France",
  AUS:"Australia",CAN:"Canada",JPN:"Japan",ARE:"UAE",SAU:"Saudi Arabia",SGP:"Singapore",
  SWE:"Sweden",IND:"India",CHN:"China",VNM:"Vietnam",IDN:"Indonesia",THA:"Thailand",
  PHL:"Philippines",LKA:"Sri Lanka",BGD:"Bangladesh",KOR:"South Korea",MEX:"Mexico",
  NZL:"New Zealand",ESP:"Spain",ITA:"Italy",POL:"Poland",TUR:"Turkey",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HS_LABELS = {
  "4419":"Wood Kitchenware","4420":"Wood Ornamental","7323":"Steel Kitchenware",
  "7013":"Glass Kitchenware","6911":"Ceramic Tableware","6912":"Ceramic Kitchenware",
  "7615":"Aluminum Kitchenware","4602":"Bamboo/Basket","8215":"Cutlery/Utensils",
  "7418":"Copper Kitchenware","4205":"Leather Articles",
};
const HS_COLORS = {
  "4419":"#22c55e","4420":"#86efac","7323":"#94a3b8","7013":"#38bdf8",
  "6911":"#fb923c","6912":"#f97316","7615":"#a78bfa","4602":"#d4a53c",
  "8215":"#e879f9","7418":"#fb7185","4205":"#92400e",
};
const TARIFF       = { USA:"18%",GBR:"0% DCTS",DEU:"0% GSP+",NLD:"0% GSP+",FRA:"0% GSP+",AUS:"0% AI-ECTA",CAN:"0% MFN",JPN:"2.4% CEPA",ARE:"0% CEPA",SAU:"5% MFN",SGP:"0% FTA",SWE:"0% GSP+" };
const CHINA_TARIFF = { USA:"30%",GBR:"10%",DEU:"20%",AUS:"10%",CAN:"25%",JPN:"24%" };

const fmt      = v => `$${(v/1000000).toFixed(1)}M`;
const fmtExact = v => `$${(v/1000000).toFixed(2)}M`;
const pct      = (a,b) => b > 0 ? Math.round(a/b*100) : 0;
const PARTIAL_YEARS = { "2026":"Jan-Feb" };
const isPartial     = yr => !!PARTIAL_YEARS[String(yr)];

// ── Design helpers ───────────────────────────────────────────────────
const glassCard = (accent="#d4a05a") => ({
  background:"linear-gradient(135deg,#161616 0%,#111111 100%)",
  border:`1px solid ${accent}25`, borderRadius:12, padding:"16px 20px",
  boxShadow:`0 0 20px ${accent}08`, transition:"all 0.2s ease",
});

// KPI card — no emoji icon (avoids broken grey box)
const kpiCard = (value, label, sub, color="#d4a05a", trend=null) => (
  <div style={{ ...glassCard(color), flex:1, minWidth:140, cursor:"pointer", position:"relative" }}
    onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${color}60`;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${color}25`;e.currentTarget.style.transform="translateY(0)";}}>
    <div style={{ fontSize:10,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:22,fontWeight:900,color,letterSpacing:-0.5 }}>{value}</div>
    {sub && <div style={{ fontSize:10,color:C.muted,marginTop:4 }}>{sub}</div>}
    {trend !== null && (
      <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:5 }}>
        <span style={{ display:"flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:4,background:trend>=0?"#22c55e20":"#ef444420" }}>
          {trend>=0
            ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
          }
        </span>
        <span style={{ fontSize:10,color:trend>=0?"#22c55e":"#ef4444",fontWeight:700 }}>{trend>=0?"+":""}{trend}% YoY</span>
      </div>
    )}
  </div>
);

// Source badge
const SrcBadge = ({src}) => {
  const cfg = { census_bureau:{label:"Census",color:"#22c55e"}, comtrade:{label:"COMTRADE",color:"#38bdf8"} }[src]||{label:src,color:"#888"};
  return <span style={{ fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,background:cfg.color+"20",color:cfg.color,border:`1px solid ${cfg.color}40`,letterSpacing:0.5 }}>{cfg.label}</span>;
};

// ── Heatmap cell color ───────────────────────────────────────────────
const heatColor = (ratio) => {
  if (ratio === 0)   return { bg:"#0a0a0a",  text:"#333",    border:"#1a1a1a" };
  if (ratio < 5)     return { bg:"#ef444418", text:"#ef4444", border:"#ef444430" };
  if (ratio < 20)    return { bg:"#f59e0b18", text:"#f59e0b", border:"#f59e0b30" };
  if (ratio < 50)    return { bg:"#fbbf2418", text:"#fbbf24", border:"#fbbf2430" };
  return               { bg:"#22c55e18", text:"#22c55e", border:"#22c55e30" };
};

// ── HS × Market Heatmap Component ────────────────────────────────────
const HsMarketHeatmap = ({ data, markets, year, C, SrcBadge, NAMES, TARIFF, CHINA_TARIFF }) => {
  const [activeCell, setActiveCell] = useState(null);
  const [filterLevel, setFilterLevel] = useState("all");
  const shortMkt = { USA:"USA",GBR:"UK",DEU:"GER",AUS:"AUS",ARE:"UAE",SAU:"SAU",CAN:"CAN",JPN:"JPN",NLD:"NLD" };

  const filtered = filterLevel==="all" ? data : data.filter(row =>
    row.cells.some(c => {
      if(filterLevel==="MAX") return c.level==="MAX"||c.level==="ZERO";
      if(filterLevel==="HIGH") return c.level==="HIGH";
      return true;
    })
  );

  return (
    <div style={{ ...{background:"linear-gradient(135deg,#161616 0%,#111111 100%)",border:"1px solid #d4a05a25",borderRadius:12,padding:"16px 20px",boxShadow:"0 0 20px #d4a05a08"},marginBottom:20 }}>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:"#d4a05a" }}>HS × Market Opportunity Heatmap</div>
          <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>
            {year} · India % of China per HS code × market · Darker red = bigger opportunity
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          {/* Filter buttons */}
          {[
            {id:"all",   label:"All"},
            {id:"MAX",   label:"MAX only",  color:"#ef4444"},
            {id:"HIGH",  label:"HIGH only", color:"#f59e0b"},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFilterLevel(f.id)}
              style={{ padding:"4px 12px",borderRadius:6,border:`1px solid ${filterLevel===f.id?(f.color||"#d4a05a"):"#2a2a2a"}`,
                background:filterLevel===f.id?(f.color||"#d4a05a")+"20":"transparent",
                color:filterLevel===f.id?(f.color||"#d4a05a"):C.muted,
                fontSize:10,fontWeight:700,cursor:"pointer",transition:"all 0.15s" }}>
              {f.label}
            </button>
          ))}
          <SrcBadge src="comtrade" />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" }}>
        {[
          {label:"No data",    bg:"#0a0a0a",   text:"#444",    border:"#1a1a1a"},
          {label:"<5% — MAX",  bg:"#ef444418", text:"#ef4444", border:"#ef444430"},
          {label:"5–20% — HIGH",bg:"#f59e0b18",text:"#f59e0b", border:"#f59e0b30"},
          {label:"20–50% — MED",bg:"#fbbf2418",text:"#fbbf24", border:"#fbbf2430"},
          {label:">50% — STRONG",bg:"#22c55e18",text:"#22c55e",border:"#22c55e30"},
        ].map((l,i)=>(
          <div key={i} style={{ display:"flex",alignItems:"center",gap:5,fontSize:10 }}>
            <div style={{ width:14,height:14,borderRadius:3,background:l.bg,border:`1px solid ${l.border}` }} />
            <span style={{ color:l.text }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap table */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ padding:"6px 10px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,whiteSpace:"nowrap",minWidth:120 }}>HS Category</th>
              {markets.map(m=>(
                <th key={m} style={{ padding:"6px 8px",textAlign:"center",color:C.muted,fontSize:10,fontWeight:700,whiteSpace:"nowrap",minWidth:52 }}>
                  <div>{shortMkt[m]||m}</div>
                  <div style={{ fontSize:8,color:"#22c55e",fontWeight:400 }}>{TARIFF[m]||"—"}</div>
                </th>
              ))}
              <th style={{ padding:"6px 8px",textAlign:"center",color:C.muted,fontSize:10,fontWeight:700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row=>(
              <tr key={row.hs}>
                <td style={{ padding:"6px 10px",color:row.color,fontWeight:600,fontSize:11,whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:9,color:C.muted,marginRight:6 }}>{row.hs}</span>{row.short}
                </td>
                {row.cells.map(cell=>{
                  const col = heatColor(cell.ratio);
                  const isActive = activeCell===`${row.hs}|${cell.market}`;
                  return (
                    <td key={cell.market}
                      onMouseEnter={()=>setActiveCell(`${row.hs}|${cell.market}`)}
                      onMouseLeave={()=>setActiveCell(null)}
                      title={`${row.label} → ${NAMES[cell.market]||cell.market}
India: $${(cell.india/1e6).toFixed(1)}M
China: $${(cell.china/1e6).toFixed(1)}M
India/China: ${cell.ratio}%
Gap: $${(cell.gap/1e6).toFixed(1)}M`}
                      style={{
                        padding:"6px 4px",textAlign:"center",
                        background:isActive?"#ffffff15":col.bg,
                        border:`1px solid ${isActive?"#ffffff30":col.border}`,
                        borderRadius:4,cursor:"pointer",
                        transition:"all 0.15s ease",
                        minWidth:52,
                      }}>
                      {cell.china>0?(
                        <div>
                          <div style={{ fontSize:11,fontWeight:700,color:col.text }}>{cell.ratio}%</div>
                          <div style={{ fontSize:8,color:C.muted }}>${(cell.india/1e6).toFixed(0)}M</div>
                        </div>
                      ):(
                        <div style={{ color:"#333",fontSize:10 }}>—</div>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding:"6px 8px",textAlign:"center" }}>
                  <div style={{ fontSize:10,fontWeight:700,color:"#22c55e" }}>${(row.totalIndia/1e6).toFixed(0)}M</div>
                  <div style={{ fontSize:8,color:"#ef4444" }}>${(row.totalChina/1e6).toFixed(0)}M</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip hint */}
      <div style={{ marginTop:10,fontSize:9,color:C.muted }}>
        Hover any cell for exact values · % = India as share of China exports to that market
      </div>
    </div>
  );
};

// ── Census USA: India vs China vs Vietnam per HS ──────────────────────
const CensusHSUSA = ({ data, year, C, SrcBadge }) => {
  return (
    <div style={{ ...{background:"linear-gradient(135deg,#161616 0%,#111111 100%)",border:"1px solid #22c55e25",borderRadius:12,padding:"16px 20px",boxShadow:"0 0 20px #22c55e08"},marginBottom:20 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:"#22c55e" }}>USA Market: India vs China by Category</div>
          <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>{year} · US Census Bureau (CIF) · Most accurate for US market</div>
        </div>
        <SrcBadge src="census_bureau" />
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {["HS Category","India (CIF)","China (CIF)","Vietnam (CIF)","India/China","India Opportunity"].map(h=>(
                <th key={h} style={{ padding:"8px 10px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row,i)=>{
              const col = heatColor(row.indiaRatio);
              return (
                <tr key={row.hs} style={{ borderBottom:`1px solid #161616` }}
                  onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"8px 10px",fontWeight:600 }}>
                    <span style={{ color:row.color }}>{row.short}</span>
                    <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>{row.hs}</span>
                  </td>
                  <td style={{ padding:"8px 10px",color:"#22c55e",fontWeight:700 }}>${(row.india/1e6).toFixed(1)}M</td>
                  <td style={{ padding:"8px 10px",color:"#ef4444",fontWeight:700 }}>${(row.china/1e6).toFixed(1)}M</td>
                  <td style={{ padding:"8px 10px",color:"#f59e0b" }}>{row.vietnam>0?`$${(row.vietnam/1e6).toFixed(1)}M`:"—"}</td>
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ width:70,height:5,background:"#1a1a1a",borderRadius:3 }}>
                        <div style={{ height:"100%",borderRadius:3,background:col.text,width:`${Math.min(row.indiaRatio,100)}%`,transition:"width 0.3s ease" }} />
                      </div>
                      <span style={{ color:col.text,fontWeight:700,fontSize:11 }}>{row.indiaRatio}%</span>
                    </div>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 8px",borderRadius:12,background:col.bg,color:col.text,fontSize:9,fontWeight:700,border:`1px solid ${col.border}` }}>
                      {row.china>row.india ? `+${((row.china-row.india)/1e6).toFixed(0)}M upside` : "India leads"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Quick Wins Component ──────────────────────────────────────────────
const QuickWins = ({ data, year, C, SrcBadge, NAMES }) => {
  const [hsFilter, setHsFilter] = useState("all");
  const GROUPS = {
    all:     "All Categories",
    wood:    "Wood & Craft",
    cutlery: "Cutlery & Leather",
  };
  const WOOD_HS    = ["4419","4420","4602"];
  const CUTLERY_HS = ["8215","4205","7418"];
  const filtered = hsFilter==="all" ? data
    : hsFilter==="wood"    ? data.filter(w=>WOOD_HS.includes(w.hs))
    : data.filter(w=>CUTLERY_HS.includes(w.hs));

  return (
    <div style={{ ...{background:"linear-gradient(135deg,#161616 0%,#111111 100%)",border:"1px solid #a78bfa25",borderRadius:12,padding:"16px 20px",boxShadow:"0 0 20px #a78bfa08"},marginBottom:20 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:"#a78bfa" }}>Quick Wins — Top Opportunities</div>
          <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>
            {year} · Best HS+Market combos where India has tariff advantage + growth potential
          </div>
        </div>
        <SrcBadge src="comtrade" />
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
        {Object.entries(GROUPS).map(([k,label])=>(
          <button key={k} onClick={()=>setHsFilter(k)}
            style={{ padding:"3px 10px",borderRadius:6,cursor:"pointer",transition:"all 0.15s",fontSize:10,fontWeight:700,
              border:`1px solid ${hsFilter===k?"#a78bfa":"#2a2a2a"}`,
              background:hsFilter===k?"#a78bfa20":"transparent",
              color:hsFilter===k?"#a78bfa":"#666" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10 }}>
        {filtered.map((w,i)=>{
          const col = heatColor(w.ratio);
          return (
            <div key={i} style={{ padding:"14px 16px",borderRadius:10,background:"#0d0d0d",border:`1px solid ${col.border}`,transition:"all 0.15s",cursor:"pointer" }}
              onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.border=`1px solid ${col.text}60`; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.border=`1px solid ${col.border}`; }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:12,fontWeight:700,color:C.text }}>{w.label}</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{w.marketName} · HS {w.hs} · 2024</div>
                </div>
                <span style={{ padding:"2px 8px",borderRadius:12,background:col.bg,color:col.text,fontSize:9,fontWeight:700,border:`1px solid ${col.border}`,flexShrink:0 }}>
                  {w.ratio}% of China
                </span>
              </div>
              <div style={{ display:"flex",gap:12,marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>India</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#22c55e" }}>${(w.india/1e6).toFixed(1)}M</div>
                  <div style={{ fontSize:9,color:"#22c55e" }}>{w.indiaTariff}</div>
                </div>
                <div style={{ width:1,background:C.border }} />
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>China</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#ef4444" }}>${(w.china/1e6).toFixed(1)}M</div>
                  <div style={{ fontSize:9,color:"#ef4444" }}>{w.chinaTariff}</div>
                </div>
                <div style={{ width:1,background:C.border }} />
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>Gap</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#d4a05a" }}>${(w.gap/1e6).toFixed(0)}M</div>
                  <div style={{ fontSize:9,color:C.muted }}>upside</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height:4,background:"#1a1a1a",borderRadius:2 }}>
                <div style={{ height:"100%",borderRadius:2,background:`linear-gradient(90deg,#22c55e,${col.text})`,width:`${Math.min(w.ratio,100)}%`,transition:"width 0.4s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────
const TabTradeIntel = ({ go, setFilters }) => {
  const { tradeStats } = useData();
  const [activeTab,     setActiveTab]     = useState("us-market");
  const [selectedHS,    setSelectedHS]    = useState("4419");
  const [selectedYear,  setSelectedYear]  = useState("all");
  const [seasonalYear,  setSeasonalYear]  = useState("all");
  const [tableSource,   setTableSource]   = useState("all");
  const [tableHS,       setTableHS]       = useState("all");
  const [tableYear,     setTableYear]     = useState("all");
  const [tableCountry,  setTableCountry]  = useState("all");
  const [tablePage,     setTablePage]     = useState(1);
  const TABLE_PAGE_SIZE = 50;

  const { data: seasonalRaw } = useAPI(
    () => fetchSeasonalData({ hs_code:selectedHS||undefined, year:seasonalYear!=="all"?seasonalYear:undefined }),
    null,
    { cacheKey:`seasonal-${selectedHS}-${seasonalYear}` }
  );

  const hasData = tradeStats && tradeStats.length > 0;

  // ── All computations ─────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!hasData) return null;

    const census   = tradeStats.filter(r => r.data_source==="census_bureau");
    const comtrade = tradeStats.filter(r => r.data_source==="comtrade");

    const censusYears   = [...new Set(census.map(r=>String(r.year)))].sort();
    const comtradeYears = [...new Set(comtrade.map(r=>String(r.year)))].sort();
    const allYears      = [...new Set(tradeStats.map(r=>String(r.year)))].sort();

    // Latest full Census year (no partial)
    const latestFullYear = (() => {
      for (let i=censusYears.length-1; i>=0; i--) { if (!isPartial(censusYears[i])) return censusYears[i]; }
      return censusYears[censusYears.length-1];
    })();

    // Census yearly HS aggregation
    const censusByYearHS = {};
    census.forEach(r => {
      const yr=String(r.year), hs=r.hs_code?.substring(0,4);
      if (!HS_LABELS[hs]) return;
      const val=parseFloat(r.trade_value_usd)||0;
      if (!censusByYearHS[yr]) censusByYearHS[yr]={};
      censusByYearHS[yr][hs]=(censusByYearHS[yr][hs]||0)+val;
    });

    const yearTrend = censusYears.filter(y=>!isPartial(y)&&y!=="2026").map(yr => {
      const row={year:yr,total:0};
      Object.keys(HS_LABELS).forEach(hs=>{ const v=censusByYearHS[yr]?.[hs]||0; row[hs]=Math.round(v/1e6*10)/10; row.total+=v; });
      row.totalM=Math.round(row.total/1e6*10)/10;
      return row;
    });

    const latestData  = censusByYearHS[latestFullYear]||{};
    const latestTotal = Object.entries(latestData).filter(([hs])=>HS_LABELS[hs]).reduce((s,[,v])=>s+v,0);

    const getCompetitor = (yr) => {
      const data=census.filter(r=>yr==="all"||String(r.year)===yr);
      const by={};
      data.forEach(r=>{ const c=r.partner_country; if(c) by[c]=(by[c]||0)+(parseFloat(r.trade_value_usd)||0); });
      const total=Object.values(by).reduce((s,v)=>s+v,0);
      return {
        india:    {v:by.IND||0,pct:pct(by.IND||0,total)},
        china:    {v:by.CHN||0,pct:pct(by.CHN||0,total)},
        vietnam:  {v:by.VNM||0,pct:pct(by.VNM||0,total)},
        indonesia:{v:by.IDN||0,pct:pct(by.IDN||0,total)},
        thailand: {v:by.THA||0,pct:pct(by.THA||0,total)},
        total,
      };
    };

    const fullYears  = censusYears.filter(y=>!isPartial(y)&&y!=="2026");
    const wood4419   = censusYears.filter(y=>!isPartial(y)).map(yr=>({ year:isPartial(yr)?yr+"*":yr, valueM:Math.round((censusByYearHS[yr]?.["4419"]||0)/1e6*100)/100, partial:isPartial(yr) }));
    const woodLatest = censusByYearHS[fullYears[fullYears.length-1]]?.["4419"]||0;
    const woodPrev   = fullYears.length>1?censusByYearHS[fullYears[fullYears.length-2]]?.["4419"]||0:0;
    const woodYoY    = woodPrev>0?Math.round((woodLatest-woodPrev)/woodPrev*100):0;

    const getMaterial = (yr) => {
      const data = yr==="all"
        ? Object.values(censusByYearHS).reduce((acc,d)=>{ Object.entries(d).forEach(([k,v])=>{ acc[k]=(acc[k]||0)+v; }); return acc; },{})
        : censusByYearHS[yr]||{};
      const total=Object.entries(data).filter(([hs])=>HS_LABELS[hs]).reduce((s,[,v])=>s+v,0);
      return Object.entries(data).filter(([hs])=>HS_LABELS[hs]).sort((a,b)=>b[1]-a[1]).map(([hs,val])=>({
        hs, label:HS_LABELS[hs], valueM:Math.round(val/1e6*10)/10, pct:pct(val,total), color:HS_COLORS[hs]||"#888",
      }));
    };

    // ── COMTRADE: India ──────────────────────────────────────────
    const indiaExports = comtrade.filter(r=>r.reporter_country==="IND");
    const indiaByYear  = {};
    indiaExports.forEach(r=>{ indiaByYear[r.year]=(indiaByYear[r.year]||0)+(parseFloat(r.trade_value_usd)||0); });
    const iKeys         = Object.keys(indiaByYear).sort();
    const indiaLatestYr = iKeys[iKeys.length-1];

    // ✅ FIX: Use LATEST YEAR only for destinations & HS breakdown (not cumulative)
    const indiaExportsLatest = indiaExports.filter(r=>String(r.year)===indiaLatestYr);

    const indiaByCountryLatest = {};
    indiaExportsLatest.forEach(r=>{ const c=r.partner_country; indiaByCountryLatest[c]=(indiaByCountryLatest[c]||0)+(parseFloat(r.trade_value_usd)||0); });
    const indiaTotalLatest = Object.values(indiaByCountryLatest).reduce((s,v)=>s+v,0);
    const indiaDestinations = Object.entries(indiaByCountryLatest).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([code,val])=>({
      country:NAMES[code]||code, code, flag:FLAGS[code]||"🌍",
      share:pct(val,indiaTotalLatest), valueM:Math.round(val/1e6*100)/100, tariff:TARIFF[code]||"—",
    }));

    const indiaLatestVal = indiaByYear[indiaLatestYr]||0;
    const indiaPrevVal   = iKeys.length>=2 ? indiaByYear[iKeys[iKeys.length-2]]||0 : 0;
    const indiaYoY       = indiaPrevVal>0 ? Math.round((indiaLatestVal-indiaPrevVal)/indiaPrevVal*100) : null;
    const indiaCAGR      = iKeys.length>1&&indiaByYear[iKeys[0]]>0
      ? Math.round((Math.pow(indiaLatestVal/indiaByYear[iKeys[0]],1/(iKeys.length-1))-1)*100) : null;
    const indiaTrend     = iKeys.map(yr=>({ year:yr, valueM:Math.round((indiaByYear[yr]||0)/1e6*100)/100 }));

    // ✅ FIX: HS breakdown from latest year only
    const indiaByHSLatest = {};
    indiaExportsLatest.forEach(r=>{ const hs=r.hs_code?.substring(0,4); if(!HS_LABELS[hs]) return; indiaByHSLatest[hs]=(indiaByHSLatest[hs]||0)+(parseFloat(r.trade_value_usd)||0); });
    const indiaTotalHSLatest = Object.values(indiaByHSLatest).reduce((s,v)=>s+v,0);
    const indiaHSBreakdown   = Object.entries(indiaByHSLatest).sort((a,b)=>b[1]-a[1]).map(([hs,val])=>({
      hs, label:HS_LABELS[hs], short:HS_LABELS[hs]?.replace(" Kitchenware","").replace(" Tableware",""),
      valueM:Math.round(val/1e6*10)/10, pct:pct(val,indiaTotalHSLatest), color:HS_COLORS[hs]||"#888",
    }));

    // ── COMTRADE: China ──────────────────────────────────────────
    const chinaExports = comtrade.filter(r=>r.reporter_country==="CHN");
    const chinaByYear  = {};
    chinaExports.forEach(r=>{ chinaByYear[r.year]=(chinaByYear[r.year]||0)+(parseFloat(r.trade_value_usd)||0); });

    // India vs China trend (both reporters, yearly total)
    const allComtradeYrs = [...new Set([...Object.keys(indiaByYear),...Object.keys(chinaByYear)])].sort();
    const indiaVsChina   = allComtradeYrs.map(yr=>({
      year:yr,
      India: Math.round((indiaByYear[yr]||0)/1e6*10)/10,
      China: Math.round((chinaByYear[yr]||0)/1e6*10)/10,
    }));

    // ── Market Opportunity Matrix (single definition) ───────────
    const MARKETS = ['USA','GBR','DEU','AUS','ARE','SAU','CAN','JPN','NLD'];
    const indiaByMkt = {}, chinaByMkt = {};
    indiaExportsLatest.forEach(r=>{ if(MARKETS.includes(r.partner_country)) indiaByMkt[r.partner_country]=(indiaByMkt[r.partner_country]||0)+(parseFloat(r.trade_value_usd)||0); });
    chinaExports.filter(r=>String(r.year)===indiaLatestYr).forEach(r=>{ if(MARKETS.includes(r.partner_country)) chinaByMkt[r.partner_country]=(chinaByMkt[r.partner_country]||0)+(parseFloat(r.trade_value_usd)||0); });
    const opportunityMatrix = MARKETS.map(m=>{
      const iv=indiaByMkt[m]||0, cv=chinaByMkt[m]||0;
      const gap=cv-iv, ratio=cv>0?Math.round(iv/cv*100):0;
      const level=ratio<5?"MAX":ratio<20?"HIGH":ratio<50?"MED":"LOW";
      return { market:m, flag:FLAGS[m]||"🌍", name:NAMES[m]||m, indiaVal:iv, chinaVal:cv, gap, ratio, level,
               indiaTariff:TARIFF[m]||"—", chinaTariff:CHINA_TARIFF[m]||"—" };
    }).sort((a,b)=>b.gap-a.gap);
    const marketOpportunity = opportunityMatrix; // alias for PDF

    // ── HS × Market Heatmap ──────────────────────────────────────
    // 11 HS codes × 9 markets: India % of China per cell
    const indiaByHSMkt = {}, chinaByHSMkt = {};
    indiaExportsLatest.forEach(r=>{
      const hs=r.hs_code?.substring(0,4); const m=r.partner_country;
      if(!HS_LABELS[hs]||!MARKETS.includes(m)) return;
      const key=`${hs}|${m}`;
      indiaByHSMkt[key]=(indiaByHSMkt[key]||0)+(parseFloat(r.trade_value_usd)||0);
    });
    chinaExports.filter(r=>String(r.year)===indiaLatestYr).forEach(r=>{
      const hs=r.hs_code?.substring(0,4); const m=r.partner_country;
      if(!HS_LABELS[hs]||!MARKETS.includes(m)) return;
      const key=`${hs}|${m}`;
      chinaByHSMkt[key]=(chinaByHSMkt[key]||0)+(parseFloat(r.trade_value_usd)||0);
    });
    // Build heatmap rows: each HS, each market
    const hsMarketHeatmap = Object.keys(HS_LABELS).map(hs=>{
      const cells = MARKETS.map(m=>{
        const key=`${hs}|${m}`;
        const india=indiaByHSMkt[key]||0, china=chinaByHSMkt[key]||0;
        const ratio=china>0?Math.round(india/china*100):0;
        const gap=china-india;
        const level=ratio===0?"ZERO":ratio<5?"MAX":ratio<20?"HIGH":ratio<50?"MED":"LOW";
        return { market:m, india, china, ratio, gap, level };
      });
      const totalIndia=cells.reduce((s,c)=>s+c.india,0);
      const totalChina=cells.reduce((s,c)=>s+c.china,0);
      return { hs, label:HS_LABELS[hs], short:HS_LABELS[hs]?.replace(" Kitchenware","").replace(" Tableware",""), cells, totalIndia, totalChina, color:HS_COLORS[hs]||"#888" };
    }).filter(r=>r.totalIndia>0||r.totalChina>0).sort((a,b)=>b.totalChina-a.totalChina);

    // ── Census USA: India vs China vs Vietnam per HS ─────────────
    const censusUSA2024 = census.filter(r=>String(r.year)===latestFullYear);
    const censusHSUSA = Object.keys(HS_LABELS).map(hs=>{
      const india   = censusUSA2024.filter(r=>r.partner_country==="IND"&&r.hs_code===hs).reduce((s,r)=>s+(parseFloat(r.trade_value_usd)||0),0);
      const china   = censusUSA2024.filter(r=>r.partner_country==="CHN"&&r.hs_code===hs).reduce((s,r)=>s+(parseFloat(r.trade_value_usd)||0),0);
      const vietnam = censusUSA2024.filter(r=>r.partner_country==="VNM"&&r.hs_code===hs).reduce((s,r)=>s+(parseFloat(r.trade_value_usd)||0),0);
      return { hs, label:HS_LABELS[hs], short:HS_LABELS[hs]?.replace(" Kitchenware","").replace(" Tableware",""),
               india, china, vietnam, color:HS_COLORS[hs]||"#888",
               indiaRatio:china>0?Math.round(india/china*100):0 };
    }).filter(r=>r.india>0||r.china>0).sort((a,b)=>b.china-a.china);

    // ── Quick Wins: top HS+Market combos ─────────────────────────
    // Where India is closest to China & tariff advantage exists
    const quickWins = [];
    Object.keys(HS_LABELS).forEach(hs=>{
      MARKETS.forEach(m=>{
        const key=`${hs}|${m}`;
        const india=indiaByHSMkt[key]||0, china=chinaByHSMkt[key]||0;
        if(china<1e6) return; // skip tiny markets
        const ratio=china>0?Math.round(india/china*100):0;
        const gap=china-india;
        const tariffAdv = (TARIFF[m]||"").includes("0%")||(m==="USA"); // India has tariff advantage
        if(ratio>0&&ratio<30&&tariffAdv) quickWins.push({ hs, market:m, label:HS_LABELS[hs], marketName:NAMES[m]||m, india, china, ratio, gap, indiaTariff:TARIFF[m]||"—", chinaTariff:CHINA_TARIFF[m]||"—" });
      });
    });
    quickWins.sort((a,b)=>{ const scoreA=(100-a.ratio)*(a.gap/1e6); const scoreB=(100-b.ratio)*(b.gap/1e6); return scoreB-scoreA; });
    const topQuickWins = quickWins.slice(0,6);

    // ── HS Battle: India vs China per HS code ──────────────────
    const chinaByHSLatest = {};
    chinaExports.filter(r=>String(r.year)===indiaLatestYr).forEach(r=>{ const hs=r.hs_code?.substring(0,4); if(!HS_LABELS[hs]) return; chinaByHSLatest[hs]=(chinaByHSLatest[hs]||0)+(parseFloat(r.trade_value_usd)||0); });
    const hsBattle = Object.keys(HS_LABELS).map(hs=>({
      hs, label:HS_LABELS[hs], short:HS_LABELS[hs]?.replace(" Kitchenware","").replace(" Tableware",""),
      india:Math.round((indiaByHSLatest[hs]||0)/1e6*10)/10,
      china:Math.round((chinaByHSLatest[hs]||0)/1e6*10)/10,
      color:HS_COLORS[hs]||"#888",
    })).filter(r=>r.india>0||r.china>0).sort((a,b)=>b.china-a.china);

    // Census CAGR
    const censusFullYears = censusYears.filter(y => !isPartial(y) && y !== '2026');
    const censusFirst = censusFullYears[0];
    const censusLatest = censusFullYears[censusFullYears.length - 1];
    const censusIndiaFirst = census.filter(r => String(r.year) === censusFirst && r.partner_country === 'IND').reduce((s,r) => s + (parseFloat(r.trade_value_usd)||0), 0);
    const censusIndiaLatest = census.filter(r => String(r.year) === censusLatest && r.partner_country === 'IND').reduce((s,r) => s + (parseFloat(r.trade_value_usd)||0), 0);
    const censusNYears = censusFullYears.length - 1;
    const censusCAGR = censusIndiaFirst > 0 && censusNYears > 0 ? Math.round((Math.pow(censusIndiaLatest / censusIndiaFirst, 1 / censusNYears) - 1) * 100) : null;

    return {
      censusYears, comtradeYears, allYears, latestFullYear, fullYears,
      yearTrend, wood4419, woodYoY, latestTotal,
      getMaterial, getCompetitor,
      indiaDestinations, indiaLatestYr, indiaLatestVal, indiaYoY, indiaCAGR, indiaTrend, iKeys,
      censusCAGR, censusFirst, censusLatest,
      indiaVsChina, indiaHSBreakdown, opportunityMatrix, marketOpportunity, hsBattle,
      hsMarketHeatmap, censusHSUSA, topQuickWins,
      census:   { count:census.length,   years:censusYears },
      comtrade: { count:comtrade.length,  years:comtradeYears },
      total: tradeStats.length,
    };
  }, [tradeStats, hasData]);

  if (!hasData || !stats) {
    return <div><EmptyState icon={Database} title="Loading Trade Data" message="Fetching from database..." /></div>;
  }

  const displayYear = selectedYear==="all" ? stats.latestFullYear : selectedYear;
  const comp        = stats.getCompetitor(displayYear);
  const opportunity = comp.china.v>0&&comp.india.v>0 ? Math.round((comp.china.v-comp.india.v)/1e6) : 0;

  const tabStyle = id => ({
    padding:"8px 18px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
    background:activeTab===id?C.gold+"20":"transparent",
    color:activeTab===id?C.gold:C.muted,
    border:activeTab===id?`1px solid ${C.gold}40`:"1px solid transparent",
  });

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:4 }}>
            <span style={{ fontSize:18,fontWeight:700,color:C.gold }}>Market Intelligence</span>
            <span style={{ fontSize:9,padding:"3px 8px",borderRadius:20,background:"#22c55e20",color:"#22c55e",border:"1px solid #22c55e40",fontWeight:700 }}>LIVE</span>
          </div>
          <div style={{ fontSize:11,color:C.muted }}>
            {stats.total.toLocaleString()} records · {stats.allYears[0]}–{stats.allYears[stats.allYears.length-1]} · <SrcBadge src="census_bureau" /> <SrcBadge src="comtrade" />
          </div>
        </div>
        <button onClick={()=>exportToCSV(tradeStats,"market_intelligence.csv")}
          style={{ padding:"6px 14px",borderRadius:8,background:"#161616",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer" }}>
          ↓ CSV
        </button>
      </div>

      {/* ── Data coverage strip ── */}
      <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" }}>
        <div style={{ padding:"8px 14px",borderRadius:8,background:"#22c55e08",border:"1px solid #22c55e20",fontSize:11 }}>
          <span style={{ color:"#22c55e",fontWeight:700 }}>Census Bureau</span>
          <span style={{ color:C.muted }}> · {stats.census.count.toLocaleString()} monthly records · Jan 2020 → Feb 2026 · US imports (CIF)</span>
        </div>
        {stats.comtrade.count>0 && (
          <div style={{ padding:"8px 14px",borderRadius:8,background:"#38bdf808",border:"1px solid #38bdf820",fontSize:11 }}>
            <span style={{ color:"#38bdf8",fontWeight:700 }}>UN COMTRADE</span>
            <span style={{ color:C.muted }}> · {stats.comtrade.count} records · 2020–2024 · India + China exports (FOB)</span>
          </div>
        )}
        <div style={{ padding:"8px 14px",borderRadius:8,background:"#f59e0b08",border:"1px solid #f59e0b20",fontSize:11,display:"flex",alignItems:"center",gap:6 }}>
          <AlertTriangle size={11} color="#f59e0b" strokeWidth={2.5} />
          <span style={{ color:"#f59e0b",fontWeight:700 }}>2026*</span>
          <span style={{ color:C.muted }}>Jan–Feb only · 2025 = Full Year ✓</span>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ display:"flex",gap:6,marginBottom:24,padding:"6px",background:"#0d0d0d",borderRadius:12,border:`1px solid ${C.border}`,width:"fit-content" }}>
        {[
          { id:"us-market",     label:"US Market",     sub:"Census" },
          { id:"india-exports", label:"India Exports",  sub:"COMTRADE" },
          { id:"raw-data",      label:"Raw Data",       sub:"All sources" },
        ].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={tabStyle(t.id)}>
            {t.label}
            <span style={{ fontSize:8,marginLeft:6,opacity:0.6 }}>{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: US MARKET                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==="us-market" && (
        <div>
          {/* KPI Cards */}
          <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>
            {kpiCard(fmt(comp.total||stats.latestTotal), `US Imports (${displayYear})`, `All HS Codes · Census Bureau`, "#60a5fa")}
            {kpiCard(`${comp.india.pct}%`, "India Share", `${fmt(comp.india.v)} · ${displayYear}`, "#22c55e")}
            {kpiCard(`${comp.china.pct}%`, "China Share", `${fmt(comp.china.v)} · 30% Tariff`, "#ef4444")}
            {kpiCard(`$${opportunity}M`, "India Opportunity", "China gap — your upside", "#d4a05a")}
            {stats.censusCAGR !== null && kpiCard(`${stats.censusCAGR}%`, "India CAGR", `Census ${stats.censusFirst}–${stats.censusLatest}`, "#a78bfa")}
          </div>

          {/* Tariff Banner */}
          <div style={{ ...glassCard("#d4a05a"),marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
            <div style={{ width:36,height:36,borderRadius:8,background:"#d4a05a20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a05a" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.gold,marginBottom:4 }}>India Tariff Advantage — US Market ({displayYear})</div>
              <div style={{ display:"flex",gap:20,flexWrap:"wrap" }}>
                <span style={{ fontSize:12,color:"#22c55e" }}>India: <strong>18%</strong> <span style={{ color:C.muted,fontSize:10 }}>Feb 2026 deal</span></span>
                <span style={{ fontSize:12,color:"#ef4444" }}>China: <strong>30%</strong> <span style={{ color:C.muted,fontSize:10 }}>Nov 2025 deal</span></span>
                <span style={{ fontSize:12,color:C.gold,fontWeight:700 }}>Gap: 12% — India saves US buyers <strong>$12 per $100</strong> vs China</span>
              </div>
            </div>
          </div>

          {/* US Imports stacked bar */}
          <div style={{ ...glassCard("#d4a05a"),marginBottom:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:C.gold }}>US Imports by Material</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>All HS codes · 2020–{stats.latestFullYear} · Full years only · Census Bureau</div>
              </div>
              <SrcBadge src="census_bureau" />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.yearTrend} barSize={20}>
                <XAxis dataKey="year" tick={{ fill:C.muted,fontSize:11 }} axisLine={false} />
                <YAxis tick={{ fill:C.muted,fontSize:10 }} axisLine={false} unit="M" />
                <Tooltip contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }} formatter={(v,n)=>[`$${v}M`,HS_LABELS[n]||n]} />
                <Legend formatter={v=>HS_LABELS[v]||v} wrapperStyle={{ fontSize:9 }} />
                {Object.keys(HS_LABELS).map(hs=>stats.yearTrend.some(r=>r[hs]>0)&&<Bar key={hs} dataKey={hs} stackId="a" fill={HS_COLORS[hs]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20 }}>
            {/* Wood 4419 */}
            <div style={glassCard("#22c55e")}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#22c55e" }}>Wood Kitchenware (HS 4419)</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                    <span>YoY: <span style={{ color:stats.woodYoY>=0?"#22c55e":"#ef4444",fontWeight:700 }}>{stats.woodYoY>=0?"+":""}{stats.woodYoY}%</span></span>
                    {stats.woodYoY<0 && (
                      <span style={{ display:"flex",alignItems:"center",gap:3,color:"#f59e0b",fontSize:9 }}>
                        <Info size={9} color="#f59e0b" strokeWidth={2}/> Post-2022 normalization · industry-wide
                      </span>
                    )}
                    <span style={{ display:"flex",alignItems:"center",gap:3 }}>
                      <Star size={9} color="#22c55e" strokeWidth={2} fill="#22c55e"/> Your core category
                    </span>
                  </div>
                </div>
                <SrcBadge src="census_bureau" />
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={stats.wood4419}>
                  <defs>
                    <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tick={{ fill:C.muted,fontSize:10 }} axisLine={false} />
                  <YAxis tick={{ fill:C.muted,fontSize:9 }} axisLine={false} unit="M" />
                  <Tooltip contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }} formatter={v=>[`$${v}M`]} />
                  <Area type="monotone" dataKey="valueM" stroke="#22c55e" strokeWidth={2.5} fill="url(#woodGrad)" name="Value USD" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Origin Country Race */}
            <div style={glassCard("#ef4444")}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#ef4444" }}>Origin Country Race</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>US imports by origin · Census Bureau</div>
                </div>
                <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}
                  style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.gold,padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer" }}>
                  <option value="all">All Years</option>
                  {stats.censusYears.filter(y=>!isPartial(y)&&y!=="2026").map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {[
                { key:"india",     label:"India ← YOU", color:"#22c55e", tariff:"18%" },
                { key:"china",     label:"China",        color:"#ef4444", tariff:"30%" },
                { key:"vietnam",   label:"Vietnam",      color:"#f59e0b", tariff:"10%" },
                { key:"indonesia", label:"Indonesia",    color:"#a78bfa", tariff:"10%" },
                { key:"thailand",  label:"Thailand",     color:"#38bdf8", tariff:"10%" },
              ].map(c => {
                const val=comp[c.key]?.v||0, maxVal=comp.china.v||1;
                return (
                  <div key={c.key} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontSize:11,color:c.color,fontWeight:c.key==="india"?700:400 }}>{c.label}</span>
                      <div style={{ display:"flex",gap:10 }}>
                        <span style={{ fontSize:10,color:C.muted }}>Tariff: <span style={{ color:c.color }}>{c.tariff}</span></span>
                        <span style={{ fontSize:11,color:c.color,fontWeight:700 }}>{fmt(val)}</span>
                      </div>
                    </div>
                    <div style={{ height:6,background:"#1a1a1a",borderRadius:3 }}>
                      <div style={{ height:"100%",borderRadius:3,background:c.color,width:`${Math.round(val/maxVal*100)}%`,transition:"width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seasonal Intelligence */}
          {seasonalRaw && seasonalRaw.length>0 && (() => {
            const peak=seasonalRaw.reduce((max,r)=>r.total>(max?.total||0)?r:max,null);
            const peakVal=peak?.total||1;
            const getColor=month=>month>=10?"#d4a05a":month>=7?"#f59e0b":month>=4?"#fb923c":"#38bdf8";
            const getSeason=month=>month>=10?{label:"PEAK",color:"#d4a05a"}:month>=7?{label:"High",color:"#f59e0b"}:month>=4?{label:"Ramp",color:"#fb923c"}:{label:"Low",color:"#38bdf8"};
            return (
              <div style={{ ...glassCard("#f59e0b"),marginBottom:20 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:"#f59e0b" }}>Seasonal Intelligence</div>
                    <div style={{ fontSize:11,color:C.muted,marginTop:4 }}>Monthly US import patterns — When to pitch buyers</div>
                    <div style={{ display:"flex",gap:6,marginTop:8,flexWrap:"wrap" }}>
                      <select value={seasonalYear} onChange={e=>setSeasonalYear(e.target.value)}
                        style={{ background:"#0d0d0d",border:`1px solid ${C.border}`,color:C.gold,padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer" }}>
                        <option value="all">2020–2025 combined</option>
                        {stats.censusYears.filter(y=>!isPartial(y)).map(y=><option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={selectedHS} onChange={e=>setSelectedHS(e.target.value)}
                        style={{ background:"#0d0d0d",border:`1px solid ${C.border}`,color:C.gold,padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer" }}>
                        <option value="">All HS Codes</option>
                        {Object.entries(HS_LABELS).map(([hs,l])=><option key={hs} value={hs}>{hs} — {l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1 }}>Peak Month</div>
                      <div style={{ fontSize:18,fontWeight:900,color:"#d4a05a" }}>{peak?MONTHS[peak.month-1]:"—"}</div>
                      <div style={{ fontSize:10,color:C.muted }}>${Math.round(peakVal/1e6*10)/10}M</div>
                    </div>
                    <button onClick={()=>{
                      const rows=seasonalRaw.map(r=>`${MONTHS[r.month-1]},${Math.round(r.total/1e6*10)/10}`).join("\n");
                      const blob=new Blob([`Month,Value_M\n${rows}`],{type:"text/csv"});
                      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="seasonal_data.csv"; a.click();
                    }} style={{ padding:"6px 12px",borderRadius:8,background:"#d4a05a20",border:"1px solid #d4a05a40",color:C.gold,fontSize:11,cursor:"pointer" }}>
                      ↓ CSV
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={seasonalRaw.map(r=>({ month:MONTHS[r.month-1],monthNum:r.month,valueM:Math.round(r.total/1e6*10)/10,total:r.total }))} barSize={60} margin={{top:28,right:10,left:0,bottom:5}}>
                    <XAxis dataKey="month" tick={{ fill:C.muted,fontSize:12,fontWeight:600 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill:"#ffffff05" }} contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:10,fontSize:12,padding:"10px 14px" }}
                      formatter={(v,_,props)=>[`$${v}M — ${getSeason(props.payload.monthNum).label}`,"US Imports"]} />
                    <Bar dataKey="valueM" radius={[8,8,0,0]} label={{ position:"top",fontSize:10,fill:"#aaa",formatter:v=>`$${v}M` }}>
                      {seasonalRaw.map((r,i)=><Cell key={i} fill={getColor(r.month)} opacity={r.total===peakVal?1:0.7+(r.total/peakVal)*0.3} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:"flex",gap:8,marginTop:8,marginBottom:16,flexWrap:"wrap" }}>
                  {(()=>{
                    const sorted=[...seasonalRaw].sort((a,b)=>a.total-b.total);
                    const q25=sorted[Math.floor(sorted.length*0.25)]?.total||0;
                    const q75=sorted[Math.floor(sorted.length*0.75)]?.total||0;
                    const peakM=MONTHS[peak.month-1];
                    const lowM=seasonalRaw.filter(r=>r.total<=q25).map(r=>MONTHS[r.month-1]);
                    const highM=seasonalRaw.filter(r=>r.total>=q75).map(r=>MONTHS[r.month-1]);
                    return [
                      {label:`Low: ${lowM.slice(0,3).join(", ")}`,color:"#38bdf8",bg:"#38bdf815"},
                      {label:`Mid: ${seasonalRaw.filter(r=>r.total>q25&&r.total<q75).map(r=>MONTHS[r.month-1]).slice(0,3).join(", ")}`,color:"#fb923c",bg:"#fb923c15"},
                      {label:`High: ${highM.filter(m=>m!==peakM).slice(0,3).join(", ")}`,color:"#f59e0b",bg:"#f59e0b15"},
                      {label:`PEAK: ${peakM}`,color:"#d4a05a",bg:"#d4a05a15"},
                    ].map((s,i)=><div key={i} style={{ padding:"4px 12px",borderRadius:20,background:s.bg,border:`1px solid ${s.color}30`,fontSize:10,color:s.color,fontWeight:700 }}>{s.label}</div>);
                  })()}
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`,paddingTop:16 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:C.gold,marginBottom:12 }}>Buyer Pitch Action Plan</div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10 }}>
                    {(()=>{
                      const pm=peak.month;
                      return [
                        {months:`${MONTHS[(pm-4+12)%12]} — 4 months before`,action:"Send catalog & samples — buyers start planning",color:"#38bdf8"},
                        {months:`${MONTHS[(pm-3+12)%12]} — 3 months before`,action:"Follow up — confirm interest, share MOQ & pricing",color:"#fb923c"},
                        {months:`${MONTHS[(pm-2+12)%12]} — 2 months before`,action:"Push for PO — peak orders placed this month!",color:"#f59e0b"},
                        {months:`${MONTHS[pm-1]} = PEAK ($${Math.round(peak.total/1e6*10)/10}M)`,action:"Deliver on time — biggest revenue month",color:"#d4a05a"},
                      ].map((a,i)=>(
                        <div key={i} style={{ padding:"12px 14px",borderRadius:10,background:a.color+"10",border:`1px solid ${a.color}25` }}>
                          <div style={{ fontSize:11,fontWeight:700,color:a.color,marginBottom:3 }}>{a.months}</div>
                          <div style={{ fontSize:11,color:C.muted,lineHeight:1.4,marginBottom:8 }}>{a.action}</div>
                          <button onClick={()=>{ go&&go(null,'buyers'); setFilters&&setFilters({country:'US',tier:''}); }} style={{ background:'none',border:`1px solid ${a.color}40`,color:a.color,fontSize:10,padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:700 }}>View Buyers →</button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Market Size by Category */}
          <div style={{ ...glassCard("#a78bfa"),marginBottom:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:"#a78bfa" }}>US Market Size by Category</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>Total US imports from all countries · Census Bureau</div>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}
                  style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.gold,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer" }}>
                  <option value="all">All Years</option>
                  {stats.censusYears.filter(y=>!isPartial(y)).map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <SrcBadge src="census_bureau" />
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8 }}>
              {stats.getMaterial(selectedYear).map(m=>(
                <div key={m.hs} style={{ padding:"12px 14px",borderRadius:10,background:m.color+"10",border:`1px solid ${m.color}25`,transition:"all 0.15s",cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                  {m.hs==="4419"&&<div style={{ fontSize:8,color:"#22c55e",fontWeight:700,marginBottom:4,letterSpacing:1,display:"flex",alignItems:"center",gap:3 }}><Star size={8} color="#22c55e" strokeWidth={2} fill="#22c55e"/> YOUR CORE</div>}
                  <div style={{ fontSize:10,color:C.muted,marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:20,fontWeight:900,color:m.color }}>${m.valueM}M</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{m.pct}% · HS {m.hs}</div>
                </div>
              ))}
            </div>
          </div>

              {/* ── Census HS × Country Breakdown ── */}
              {stats.censusHSUSA && stats.censusHSUSA.length > 0 && (
                <div style={{ background:"linear-gradient(135deg,#161616 0%,#111111 100%)",border:"1px solid #38bdf825",borderRadius:12,padding:"16px 20px",marginBottom:20 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:14,fontWeight:700,color:"#38bdf8" }}>HS Code × Country — Who Exports What to USA</div>
                      <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>{stats.latestFullYear} · US Census Bureau (CIF) · India vs China vs Vietnam per category</div>
                    </div>
                    <SrcBadge src="census_bureau" />
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                          {["HS Category","India (CIF)","China (CIF)","Vietnam (CIF)","India/China","Opportunity"].map(h=>(
                            <th key={h} style={{ padding:"8px 10px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.censusHSUSA.map((row,i)=>{
                          const col = row.indiaRatio<10?{text:"#ef4444",bg:"#ef444408"}:row.indiaRatio<30?{text:"#f59e0b",bg:"#f59e0b08"}:{text:"#22c55e",bg:"#22c55e08"};
                          return (
                            <tr key={row.hs} style={{ borderBottom:`1px solid #161616`,background:col.bg }}
                              onMouseEnter={e=>e.currentTarget.style.background="#ffffff06"}
                              onMouseLeave={e=>e.currentTarget.style.background=col.bg}>
                              <td style={{ padding:"8px 10px",fontWeight:600 }}>
                                <span style={{ color:row.color }}>{row.short}</span>
                                <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>{row.hs}</span>
                                {row.hs==="4419"&&<span style={{ marginLeft:6,fontSize:8,color:"#22c55e",fontWeight:700 }}>YOUR CORE</span>}
                              </td>
                              <td style={{ padding:"8px 10px",color:"#22c55e",fontWeight:700 }}>${(row.india/1e6).toFixed(1)}M</td>
                              <td style={{ padding:"8px 10px",color:"#ef4444",fontWeight:700 }}>${(row.china/1e6).toFixed(1)}M</td>
                              <td style={{ padding:"8px 10px",color:"#f59e0b" }}>{row.vietnam>0?`$${(row.vietnam/1e6).toFixed(1)}M`:"—"}</td>
                              <td style={{ padding:"8px 10px" }}>
                                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                                  <div style={{ width:70,height:5,background:"#1a1a1a",borderRadius:3 }}>
                                    <div style={{ height:"100%",borderRadius:3,background:col.text,width:`${Math.min(row.indiaRatio,100)}%`,transition:"width 0.3s" }} />
                                  </div>
                                  <span style={{ color:col.text,fontWeight:700,fontSize:11 }}>{row.indiaRatio}%</span>
                                </div>
                              </td>
                              <td style={{ padding:"8px 10px" }}>
                                {row.china>row.india
                                  ? <span style={{ padding:"2px 8px",borderRadius:12,background:col.bg,color:col.text,fontSize:9,fontWeight:700,border:`1px solid ${col.text}30` }}>+${((row.china-row.india)/1e6).toFixed(0)}M upside</span>
                                  : <span style={{ fontSize:9,color:"#22c55e",fontWeight:700 }}>India leads</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: INDIA EXPORTS                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==="india-exports" && (
        <div>
          {stats.comtrade.count===0 ? (
            <div style={{ ...glassCard("#38bdf8"),textAlign:"center",padding:"40px 20px" }}>
              <div style={{ fontSize:16,fontWeight:700,color:"#38bdf8",marginBottom:8 }}>COMTRADE Data Not Loaded</div>
              <div style={{ fontSize:12,color:C.muted }}>Run: <code style={{ color:"#38bdf8" }}>node scripts/fetch-all-data.js --comtrade</code></div>
            </div>
          ) : (
            <>
              {/* ✅ KPI — latest year annual (not cumulative) */}
              <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>
                {kpiCard(
                  fmt(stats.indiaLatestVal),
                  `India Exports (${stats.indiaLatestYr})`,
                  `Annual · COMTRADE FOB basis`,
                  "#22c55e", stats.indiaYoY
                )}
                {stats.indiaDestinations[0] && kpiCard(
                  `${FLAGS[stats.indiaDestinations[0].code]||""} ${stats.indiaDestinations[0].country}`,
                  `Top Market (${stats.indiaLatestYr})`,
                  `${stats.indiaDestinations[0].share}% share · ${stats.indiaDestinations[0].tariff}`,
                  "#38bdf8"
                )}
                {stats.indiaCAGR !== null && kpiCard(
                  `${stats.indiaCAGR}%`,
                  "India CAGR",
                  `${stats.iKeys[0]}–${stats.indiaLatestYr}`,
                  "#a78bfa"
                )}
                {kpiCard(
                  `${stats.iKeys.length}`,
                  "Years of Data",
                  "UN COMTRADE 2020–2024",
                  "#d4a05a"
                )}
              </div>

              {/* Tariff Banner */}
              <div style={{ ...glassCard("#d4a05a"),marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
                <div style={{ width:36,height:36,borderRadius:8,background:"#d4a05a20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a05a" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:C.gold,marginBottom:6 }}>India Tariff Advantage — Why US Buyers Should Switch</div>
                  <div style={{ display:"flex",gap:24,flexWrap:"wrap",alignItems:"center" }}>
                    <span style={{ fontSize:11,color:"#22c55e",fontWeight:700 }}>India → USA: 18% <span style={{ color:C.muted,fontWeight:400 }}>Feb 2026</span></span>
                    <span style={{ fontSize:11,color:"#ef4444",fontWeight:700 }}>China → USA: 30% <span style={{ color:C.muted,fontWeight:400 }}>Nov 2025 (was 145%)</span></span>
                    <div style={{ padding:"3px 12px",borderRadius:20,background:"#d4a05a20",border:"1px solid #d4a05a40" }}>
                      <span style={{ fontSize:11,color:C.gold,fontWeight:700 }}>12% gap = India 10.2% cheaper landed cost</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ India vs China — DUAL Y-AXIS */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20 }}>
                <div style={glassCard("#ef4444")}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:"#ef4444" }}>India vs China Exports</div>
                      <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>Annual exports to world — dual scale</div>
                    </div>
                    <SrcBadge src="comtrade" />
                  </div>
                  {/* Legend */}
                  <div style={{ display:"flex",gap:16,marginBottom:8 }}>
                    <span style={{ fontSize:10,color:"#22c55e",fontWeight:700 }}>— India (left axis)</span>
                    <span style={{ fontSize:10,color:"#ef4444",fontWeight:700 }}>— China (right axis)</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.indiaVsChina} margin={{ top:8,right:16,left:0,bottom:0 }}>
                      <XAxis dataKey="year" tick={{ fill:C.muted,fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="india" orientation="left"  tick={{ fill:"#22c55e",fontSize:9 }} axisLine={false} tickLine={false} unit="M" />
                      <YAxis yAxisId="china" orientation="right" tick={{ fill:"#ef4444",fontSize:9 }} axisLine={false} tickLine={false} unit="M" />
                      <Tooltip
                        contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }}
                        formatter={(v,n)=>[`$${v}M`,n]}
                      />
                      <Line yAxisId="india" type="monotone" dataKey="India" stroke="#22c55e" strokeWidth={2.5} dot={{ fill:"#22c55e",r:4 }} activeDot={{ r:6 }} />
                      <Line yAxisId="china" type="monotone" dataKey="China" stroke="#ef4444" strokeWidth={2.5} dot={{ fill:"#ef4444",r:4 }} activeDot={{ r:6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* India trend */}
                <div style={glassCard("#22c55e")}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:"#22c55e" }}>India Export Trend</div>
                      <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>
                        CAGR: <span style={{ color:"#22c55e",fontWeight:700 }}>{stats.indiaCAGR}%</span>
                        {stats.indiaYoY!==null&&<span style={{ marginLeft:8,color:stats.indiaYoY>=0?"#22c55e":"#ef4444",fontWeight:700 }}>YoY: {stats.indiaYoY>=0?"+":""}{stats.indiaYoY}%</span>}
                      </div>
                    </div>
                    <SrcBadge src="comtrade" />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stats.indiaTrend}>
                      <defs>
                        <linearGradient id="indiaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="year" tick={{ fill:C.muted,fontSize:10 }} axisLine={false} />
                      <YAxis tick={{ fill:C.muted,fontSize:9 }} axisLine={false} unit="M" />
                      <Tooltip contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }} formatter={v=>[`$${v}M`]} />
                      <Area type="monotone" dataKey="valueM" stroke="#22c55e" strokeWidth={2.5} fill="url(#indiaGrad)" name="India Exports (FOB)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ✅ HS Breakdown (latest year) + Top Destinations (latest year) */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20 }}>
                <div style={glassCard("#a78bfa")}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:"#a78bfa" }}>India Exports by Category</div>
                      {/* ✅ Clearly labelled as latest year */}
                      <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{stats.indiaLatestYr} annual · COMTRADE FOB</div>
                    </div>
                    <SrcBadge src="comtrade" />
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stats.indiaHSBreakdown} layout="vertical" margin={{ left:0,right:16,top:0,bottom:0 }} barSize={14}>
                      <XAxis type="number" tick={{ fill:C.muted,fontSize:9 }} axisLine={false} unit="M" />
                      {/* ✅ FIX: width=110 — no more cut-off labels */}
                      <YAxis type="category" dataKey="short" tick={{ fill:C.muted,fontSize:10 }} axisLine={false} width={110} />
                      <Tooltip
                        contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }}
                        formatter={(v,_,p)=>[`$${v}M (${p.payload.pct}%)`,p.payload.label]}
                      />
                      <Bar dataKey="valueM" radius={[0,4,4,0]}>
                        {stats.indiaHSBreakdown.map((d,i)=><Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Destinations — latest year */}
                <div style={glassCard("#38bdf8")}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:"#38bdf8" }}>Top Destinations</div>
                      <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{stats.indiaLatestYr} annual · COMTRADE FOB</div>
                    </div>
                    <SrcBadge src="comtrade" />
                  </div>
                  {stats.indiaDestinations.slice(0,8).map(d=>(
                    <div key={d.code} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7,padding:"6px 10px",borderRadius:8,background:"#ffffff06" }}>
                      <span style={{ fontSize:12,color:C.text }}>{d.flag} {d.country}</span>
                      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                        <span style={{ fontSize:10,color:"#22c55e",fontWeight:600 }}>IN {d.tariff}</span>
                        {CHINA_TARIFF[d.code]&&<span style={{ fontSize:10,color:"#ef4444" }}>CN {CHINA_TARIFF[d.code]}</span>}
                        <span style={{ fontSize:11,fontWeight:700,color:"#38bdf8",minWidth:52,textAlign:"right" }}>{fmtExact(d.valueM*1e6)}</span>
                        <span style={{ fontSize:10,color:C.muted,minWidth:28,textAlign:"right" }}>{d.share}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Market Opportunity Matrix ── */}

              {/* ── Market Opportunity Matrix ── */}
              <div style={{ ...glassCard("#d4a05a"),marginBottom:20 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:C.gold }}>Market Opportunity Matrix</div>
                    <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{stats.indiaLatestYr} annual · India vs China per market · Where can India grow?</div>
                  </div>
                  <SrcBadge src="comtrade" />
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                        {["Market","India (FOB)","China (FOB)","India/China","Gap ($M)","Opportunity"].map(h=>(
                          <th key={h} style={{ textAlign:"left",padding:"8px 12px",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.opportunityMatrix.map(row=>{
                        const levelColor = row.level==="MAX"?"#ef4444":row.level==="HIGH"?"#f59e0b":row.level==="MED"?"#22c55e":"#6b7280";
                        const levelBg    = row.level==="MAX"?"#ef444415":row.level==="HIGH"?"#f59e0b15":row.level==="MED"?"#22c55e15":"#6b728015";
                        const barPct     = row.chinaVal>0?Math.min(100,Math.round(row.indiaVal/row.chinaVal*100)):0;
                        return (
                          <tr key={row.market} style={{ borderBottom:`1px solid #161616` }}
                            onMouseEnter={e=>e.currentTarget.style.background="#ffffff06"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{ padding:"10px 12px",fontWeight:600,color:C.text }}>{row.flag} {row.name}</td>
                            <td style={{ padding:"10px 12px",color:"#22c55e",fontWeight:700 }}>${(row.indiaVal/1e6).toFixed(1)}M</td>
                            <td style={{ padding:"10px 12px",color:"#ef4444",fontWeight:700 }}>${(row.chinaVal/1e6).toFixed(1)}M</td>
                            <td style={{ padding:"10px 12px" }}>
                              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                                <div style={{ width:80,height:6,background:"#1a1a1a",borderRadius:3,flexShrink:0 }}>
                                  <div style={{ height:"100%",borderRadius:3,background:"#22c55e",width:`${barPct}%` }} />
                                </div>
                                <span style={{ fontSize:11,color:C.muted }}>{row.ratio}%</span>
                              </div>
                            </td>
                            <td style={{ padding:"10px 12px",color:C.gold,fontWeight:700 }}>${(row.gap/1e6).toFixed(1)}M</td>
                            <td style={{ padding:"10px 12px" }}>
                              <span style={{ padding:"3px 10px",borderRadius:20,background:levelBg,color:levelColor,fontSize:10,fontWeight:700 }}>
                                {row.level}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:"flex",gap:12,marginTop:12,flexWrap:"wrap" }}>
                  {[
                    {level:"MAX",color:"#ef4444",bg:"#ef444415",desc:"India <5% of China — massive gap"},
                    {level:"HIGH",color:"#f59e0b",bg:"#f59e0b15",desc:"India 5–20% of China — strong opportunity"},
                    {level:"MED",color:"#22c55e",bg:"#22c55e15",desc:"India 20–50% of China — growing"},
                    {level:"LOW",color:"#6b7280",bg:"#6b728015",desc:"India >50% of China — well positioned"},
                  ].map(l=>(
                    <div key={l.level} style={{ display:"flex",alignItems:"center",gap:6,fontSize:10 }}>
                      <span style={{ padding:"2px 8px",borderRadius:12,background:l.bg,color:l.color,fontWeight:700 }}>{l.level}</span>
                      <span style={{ color:C.muted }}>{l.desc}</span>
                    </div>
                  ))}
                </div>
                {/* ── Total Gap insight strip ── */}
                {(()=>{
                  const totalGap   = stats.opportunityMatrix.reduce((s,r)=>s+(r.gap||0),0);
                  const maxMarkets = stats.opportunityMatrix.filter(r=>r.level==="MAX").length;
                  const totalIndia = stats.opportunityMatrix.reduce((s,r)=>s+(r.indiaVal||0),0);
                  const totalChina = stats.opportunityMatrix.reduce((s,r)=>s+(r.chinaVal||0),0);
                  const avgRatio   = totalChina>0?Math.round(totalIndia/totalChina*100):0;
                  return (
                    <div style={{ marginTop:14,padding:"12px 16px",borderRadius:10,background:"#d4a05a08",border:"1px solid #d4a05a20",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12 }}>
                      {[
                        { label:"Total addressable gap (9 markets)", value:`$${(totalGap/1e9).toFixed(1)}B`, color:C.gold },
                        { label:"MAX opportunity markets",            value:`${maxMarkets} of 9`,             color:"#ef4444" },
                        { label:"India's avg share of China",         value:`${avgRatio}%`,                   color:"#22c55e" },
                        { label:"If India captures 50% of gap",       value:`$${(totalGap/2/1e9).toFixed(1)}B upside`, color:"#a78bfa" },
                      ].map(s=>(
                        <div key={s.label} style={{ borderLeft:`2px solid ${s.color}40`,paddingLeft:10 }}>
                          <div style={{ fontSize:15,fontWeight:900,color:s.color }}>{s.value}</div>
                          <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── HS × Market Heatmap ── */}
              {stats.hsMarketHeatmap && stats.hsMarketHeatmap.length > 0 && (
                <HsMarketHeatmap data={stats.hsMarketHeatmap} markets={['USA','GBR','DEU','AUS','ARE','SAU','CAN','JPN','NLD']} year={stats.indiaLatestYr} C={C} SrcBadge={SrcBadge} NAMES={NAMES} TARIFF={TARIFF} CHINA_TARIFF={CHINA_TARIFF} />
              )}

              {/* ── Census USA: India vs China vs Vietnam per HS ── */}
              {stats.censusHSUSA && stats.censusHSUSA.length > 0 && (
                <CensusHSUSA data={stats.censusHSUSA} year={stats.latestFullYear} C={C} SrcBadge={SrcBadge} />
              )}

              {/* ── Quick Wins ── */}
              {stats.topQuickWins && stats.topQuickWins.length > 0 && (
                <QuickWins data={stats.topQuickWins} year={stats.indiaLatestYr} C={C} SrcBadge={SrcBadge} NAMES={NAMES} />
              )}

              {/* ── HS Code Battle: India vs China (summary bar) ── */}
              <div style={{ ...glassCard("#94a3b8"),marginBottom:20 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:"#94a3b8" }}>HS Code Battle — All Markets Combined</div>
                    <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{stats.indiaLatestYr} · India vs China total across all 9 markets · COMTRADE FOB</div>
                  </div>
                  <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                    <span style={{ fontSize:10,color:"#22c55e",fontWeight:700 }}>— India</span>
                    <span style={{ fontSize:10,color:"#ef4444",fontWeight:700 }}>— China</span>
                    <SrcBadge src="comtrade" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.hsBattle} layout="vertical" margin={{ left:0,right:20,top:0,bottom:0 }} barSize={10} barGap={2}>
                    <XAxis type="number" tick={{ fill:C.muted,fontSize:9 }} axisLine={false} unit="M" />
                    <YAxis type="category" dataKey="short" tick={{ fill:C.muted,fontSize:10 }} axisLine={false} width={110} />
                    <Tooltip contentStyle={{ background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11 }} formatter={(v,n)=>[`$${v}M`,n==="india"?"India (FOB)":"China (FOB)"]} />
                    <Bar dataKey="china" fill="#ef4444" radius={[0,4,4,0]} name="china" opacity={0.8} />
                    <Bar dataKey="india" fill="#22c55e" radius={[0,4,4,0]} name="india" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data note */}
              <div style={{ padding:"12px 16px",borderRadius:8,background:"#38bdf808",border:"1px solid #38bdf820",fontSize:11,color:C.muted,marginBottom:20 }}>
                <span style={{ color:"#38bdf8",fontWeight:700 }}>Data note: </span>
                COMTRADE = India/China self-reported exports (FOB) · Census = US actual imports (CIF, 15–25% higher) · Both are correct measurements of the same trade.
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 3: RAW DATA                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==="raw-data" && (
        <div>
          {/* Filters */}
          <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
            <select value={tableSource} onChange={e=>{setTableSource(e.target.value);setTablePage(1);}}
              style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.text,padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer" }}>
              <option value="all">All Sources</option>
              <option value="census_bureau">Census Bureau</option>
              <option value="comtrade">COMTRADE</option>
            </select>
            <select value={tableHS} onChange={e=>{setTableHS(e.target.value);setTablePage(1);}}
              style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.text,padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer" }}>
              <option value="all">All HS Codes</option>
              {Object.entries(HS_LABELS).map(([hs,l])=><option key={hs} value={hs}>{hs} — {l}</option>)}
            </select>
            <select value={tableYear} onChange={e=>{setTableYear(e.target.value);setTablePage(1);}}
              style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.text,padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer" }}>
              <option value="all">All Years</option>
              {stats.allYears.map(y=><option key={y} value={y}>{y}{isPartial(y)?" (Partial)":""}</option>)}
            </select>
            <select value={tableCountry} onChange={e=>{setTableCountry(e.target.value);setTablePage(1);}}
              style={{ background:"#161616",border:`1px solid ${C.border}`,color:C.text,padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer" }}>
              <option value="all">All Countries</option>
              {[...new Set(tradeStats.map(t=>t.partner_country||t.reporter_country))].filter(c=>c&&NAMES[c]).sort().map(c=>(
                <option key={c} value={c}>{FLAGS[c]} {NAMES[c]}</option>
              ))}
            </select>
            {(tableSource!=="all"||tableHS!=="all"||tableYear!=="all"||tableCountry!=="all") && (
              <button onClick={()=>{setTableSource("all");setTableHS("all");setTableYear("all");setTableCountry("all");setTablePage(1);}}
                style={{ background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5 }}>
                <X size={11} strokeWidth={2.5}/> Clear
              </button>
            )}
            <div style={{ marginLeft:"auto",display:"flex",gap:6 }}>
              <button onClick={()=>exportToCSV(tradeStats,"trade_statistics.csv")}
                style={{ padding:"6px 14px",borderRadius:8,background:"#161616",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer" }}>
                ↓ CSV
              </button>
            </div>
          </div>

          {(()=>{
            const filtered=[...tradeStats].sort((a,b)=>{
              const ap=isPartial(a.year)?1:0, bp=isPartial(b.year)?1:0;
              if(ap!==bp) return ap-bp;
              const yr=b.year-a.year; if(yr!==0) return yr;
              return (b.month||0)-(a.month||0);
            }).filter(t=>{
              if(tableSource!=="all"&&t.data_source!==tableSource) return false;
              const hs4=t.hs_code?.substring(0,4);
              if(tableHS!=="all"&&t.hs_code!==tableHS&&hs4!==tableHS) return false;
              if(tableYear!=="all"&&String(t.year)!==tableYear) return false;
              if(tableCountry!=="all"&&t.partner_country!==tableCountry&&t.reporter_country!==tableCountry) return false;
              return true;
            });

            const totalVal = filtered.reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);

            // ✅ FIX: Source-aware India/China value calculation
            // Census: reporter=USA, partner=IND/CHN → India/China exported TO USA
            // COMTRADE: reporter=IND/CHN, partner=market → India/China exported FROM
            const censusFiltered   = filtered.filter(t=>t.data_source==="census_bureau");
            const comtradeFiltered = filtered.filter(t=>t.data_source==="comtrade");

            const censusIndiaVal  = censusFiltered.filter(t=>t.partner_country==="IND").reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);
            const censusChineVal  = censusFiltered.filter(t=>t.partner_country==="CHN").reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);
            const comtradeIndiaVal = comtradeFiltered.filter(t=>t.reporter_country==="IND").reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);
            const comtradeChnaVal  = comtradeFiltered.filter(t=>t.reporter_country==="CHN").reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);

            const showMixed = tableSource==="all" && censusIndiaVal>0 && comtradeIndiaVal>0;

            return (
              <>
                {totalVal>0&&(
                  <div style={{ display:"flex",gap:8,marginBottom:8,flexWrap:"wrap" }}>
                    <div style={{ padding:"6px 12px",borderRadius:8,background:"#38bdf810",border:"1px solid #38bdf825",fontSize:11 }}>
                      Filtered: <span style={{ color:"#38bdf8",fontWeight:700 }}>{fmt(totalVal)}</span> · {filtered.length} records
                    </div>
                    {censusIndiaVal>0&&(
                      <div style={{ padding:"6px 12px",borderRadius:8,background:"#22c55e10",border:"1px solid #22c55e25",fontSize:11 }}>
                        <span style={{ color:C.muted }}>India imported by USA</span>
                        <span style={{ color:"#22c55e",fontWeight:700,marginLeft:6 }}>{fmt(censusIndiaVal)}</span>
                        <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>Census CIF</span>
                      </div>
                    )}
                    {comtradeIndiaVal>0&&(
                      <div style={{ padding:"6px 12px",borderRadius:8,background:"#22c55e10",border:"1px solid #22c55e25",fontSize:11 }}>
                        <span style={{ color:C.muted }}>India self-reported exports</span>
                        <span style={{ color:"#22c55e",fontWeight:700,marginLeft:6 }}>{fmt(comtradeIndiaVal)}</span>
                        <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>COMTRADE FOB · {tableCountry!=="all"?`→ ${tableCountry}`:"all markets"}</span>
                      </div>
                    )}
                    {censusChineVal>0&&(
                      <div style={{ padding:"6px 12px",borderRadius:8,background:"#ef444410",border:"1px solid #ef444425",fontSize:11 }}>
                        <span style={{ color:C.muted }}>China imported by USA</span>
                        <span style={{ color:"#ef4444",fontWeight:700,marginLeft:6 }}>{fmt(censusChineVal)}</span>
                        <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>Census CIF</span>
                      </div>
                    )}
                    {comtradeChnaVal>0&&(
                      <div style={{ padding:"6px 12px",borderRadius:8,background:"#ef444410",border:"1px solid #ef444425",fontSize:11 }}>
                        <span style={{ color:C.muted }}>China self-reported exports</span>
                        <span style={{ color:"#ef4444",fontWeight:700,marginLeft:6 }}>{fmt(comtradeChnaVal)}</span>
                        <span style={{ color:C.muted,fontSize:9,marginLeft:6 }}>COMTRADE FOB · {tableCountry!=="all"?`→ ${tableCountry}`:"all markets"}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Source explanation — always visible when data shown */}
                {totalVal>0&&(
                  <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
                    {censusIndiaVal>0&&comtradeIndiaVal>0&&(
                      <div style={{ padding:"8px 14px",borderRadius:8,background:"#f59e0b08",border:"1px solid #f59e0b25",fontSize:10,color:C.muted,flex:1,minWidth:300 }}>
                        <span style={{ color:"#f59e0b",fontWeight:700 }}>Why India Census ({fmt(censusIndiaVal)}) vs COMTRADE ({fmt(comtradeIndiaVal)}) differ: </span>
                        Census = what USA actually imported from India (CIF basis, more accurate). COMTRADE = what India officially reported as exports (FOB basis, under-reported — India's informal exporters don't fully report to DGFT). Both are correct — Census is the more reliable figure for US market size.
                      </div>
                    )}
                    {censusChineVal>0&&comtradeChnaVal>0&&(
                      <div style={{ padding:"8px 14px",borderRadius:8,background:"#38bdf808",border:"1px solid #38bdf820",fontSize:10,color:C.muted,flex:1,minWidth:300 }}>
                        <span style={{ color:"#38bdf8",fontWeight:700 }}>Why China Census ({fmt(censusChineVal)}) vs COMTRADE ({fmt(comtradeChnaVal)}) are close: </span>
                        China has strong export reporting — Census and COMTRADE values nearly match (~2% difference). This confirms Census data accuracy.
                      </div>
                    )}
                    {!censusIndiaVal&&!censusChineVal&&comtradeIndiaVal>0&&(
                      <div style={{ padding:"8px 14px",borderRadius:8,background:"#38bdf808",border:"1px solid #38bdf820",fontSize:10,color:C.muted }}>
                        <span style={{ color:"#38bdf8",fontWeight:700 }}>COMTRADE (FOB): </span>
                        India/China self-reported export values. FOB = excludes freight & insurance. Scope = {tableCountry!=="all"?`exports to ${NAMES[tableCountry]||tableCountry}`:"exports to all 9 tracked markets"}.
                      </div>
                    )}
                    {!comtradeIndiaVal&&!comtradeChnaVal&&censusIndiaVal>0&&(
                      <div style={{ padding:"8px 14px",borderRadius:8,background:"#22c55e08",border:"1px solid #22c55e20",fontSize:10,color:C.muted }}>
                        <span style={{ color:"#22c55e",fontWeight:700 }}>Census Bureau (CIF): </span>
                        US import data — what USA actually paid including freight & insurance. Most accurate measure of US market demand.
                      </div>
                    )}
                  </div>
                )}

                {filtered.length===0&&(
                  <div style={{ textAlign:"center",padding:"40px 20px",color:C.muted }}>
                    <div style={{ fontSize:24,marginBottom:8 }}>—</div>
                    <div style={{ fontSize:14,fontWeight:700,color:C.gold,marginBottom:4 }}>No Records Found</div>
                    <div style={{ fontSize:11 }}>Try different filters</div>
                  </div>
                )}

                {filtered.length>0&&(
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                          {["Source","Reporter","Partner","HS","Material","Year","Month","Flow","Value"].map(h=>(
                            <th key={h} style={{ textAlign:"left",padding:"8px 10px",color:C.muted,fontSize:10,whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice((tablePage-1)*TABLE_PAGE_SIZE,tablePage*TABLE_PAGE_SIZE).map((t,i)=>(
                          <tr key={t.id||i} style={{ borderBottom:`1px solid #161616` }}
                            onMouseEnter={e=>e.currentTarget.style.background="#ffffff06"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{ padding:"6px 10px" }}><SrcBadge src={t.data_source} /></td>
                            <td style={{ padding:"6px 10px",color:C.text,fontWeight:600 }}>{FLAGS[t.reporter_country]||""} {t.reporter_country}</td>
                            <td style={{ padding:"6px 10px",color:C.text }}>
                              {NAMES[t.partner_country]?`${FLAGS[t.partner_country]||""} ${NAMES[t.partner_country]}`:<span style={{ color:"#444",fontSize:10 }}>{t.partner_country||"—"}</span>}
                            </td>
                            <td style={{ padding:"6px 10px",color:C.gold }}>{t.hs_code}</td>
                            <td style={{ padding:"6px 10px",color:C.muted,fontSize:10 }}>{HS_LABELS[t.hs_code]||HS_LABELS[t.hs_code?.substring(0,4)]||"—"}</td>
                            <td style={{ padding:"6px 10px",color:isPartial(t.year)?C.gold:C.muted }}>{t.year}{isPartial(t.year)?"*":""}</td>
                            <td style={{ padding:"6px 10px",color:C.muted }}>{t.month?MONTHS[t.month-1]:"—"}</td>
                            <td style={{ padding:"6px 10px",color:t.flow==="export"?"#22c55e":"#38bdf8" }}>{t.flow||"—"}</td>
                            <td style={{ padding:"6px 10px",color:"#22c55e",fontWeight:700 }}>{fmt(parseFloat(t.trade_value_usd)||0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:8 }}>
                      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                        <div style={{ fontSize:11,color:C.muted }}>
                          Showing {Math.min(tablePage*TABLE_PAGE_SIZE,filtered.length)} of {filtered.length} records
                        </div>
                        <button onClick={()=>exportTradeDataPDF({ filteredData:filtered,tableSource,tableHS,tableYear,tableCountry,HS_LABELS,NAMES,MONTHS,isPartial })}
                          style={{ padding:"4px 10px",borderRadius:6,background:"#d4a05a20",border:"1px solid #d4a05a40",color:"#d4a05a",fontSize:10,cursor:"pointer",fontWeight:700 }}>
                          PDF Summary
                        </button>
                      </div>
                      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                        <button onClick={()=>setTablePage(p=>Math.max(1,p-1))} disabled={tablePage===1}
                          style={{ padding:"4px 10px",borderRadius:6,background:tablePage===1?"#0d0d0d":"#161616",border:`1px solid ${C.border}`,color:tablePage===1?C.muted:C.text,fontSize:11,cursor:tablePage===1?"default":"pointer" }}>
                          ← Prev
                        </button>
                        {Array.from({length:Math.min(5,Math.ceil(filtered.length/TABLE_PAGE_SIZE))},(_,i)=>{
                          const total=Math.ceil(filtered.length/TABLE_PAGE_SIZE);
                          let page;
                          if(total<=5) page=i+1;
                          else if(tablePage<=3) page=i+1;
                          else if(tablePage>=total-2) page=total-4+i;
                          else page=tablePage-2+i;
                          return <button key={page} onClick={()=>setTablePage(page)}
                            style={{ padding:"4px 10px",borderRadius:6,background:tablePage===page?C.gold+"20":"#161616",border:`1px solid ${tablePage===page?C.gold+"60":C.border}`,color:tablePage===page?C.gold:C.muted,fontSize:11,cursor:"pointer",fontWeight:tablePage===page?700:400 }}>
                            {page}
                          </button>;
                        })}
                        <button onClick={()=>setTablePage(p=>Math.min(Math.ceil(filtered.length/TABLE_PAGE_SIZE),p+1))} disabled={tablePage>=Math.ceil(filtered.length/TABLE_PAGE_SIZE)}
                          style={{ padding:"4px 10px",borderRadius:6,background:tablePage>=Math.ceil(filtered.length/TABLE_PAGE_SIZE)?"#0d0d0d":"#161616",border:`1px solid ${C.border}`,color:tablePage>=Math.ceil(filtered.length/TABLE_PAGE_SIZE)?C.muted:C.text,fontSize:11,cursor:tablePage>=Math.ceil(filtered.length/TABLE_PAGE_SIZE)?"default":"pointer" }}>
                          Next →
                        </button>
                        <span style={{ fontSize:10,color:C.muted }}>Page {tablePage} of {Math.ceil(filtered.length/TABLE_PAGE_SIZE)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop:24,padding:"12px 16px",borderRadius:8,background:"#0d0d0d",border:`1px solid ${C.border}`,fontSize:10,color:C.muted }}>
        Census Bureau ({stats.census.years[0]}–{stats.census.years[stats.census.years.length-1]}) · {stats.census.count.toLocaleString()} monthly records · CIF basis
        {stats.comtrade.count>0&&` · COMTRADE (${stats.comtrade.years[0]}–${stats.comtrade.years[stats.comtrade.years.length-1]}) · ${stats.comtrade.count} records · FOB basis`}
        {" · 2026* = Jan–Feb only · 2025 = Full Year ✓"}
      </div>
    </div>
  );
};

export default TabTradeIntel;
