import { useState } from "react";
import { C, CURRENCY_PAIRS, FREIGHT_ROUTES } from "../../data/theme.js";
import { Card, Heading } from "../ui/Primitives.jsx";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { convertFOB } from "../../hooks/useLiveRates.js";

const TabLiveMarket = ({ rates, history, ratesLoading, ratesError, lastUpdated }) => {
  const [convertAmt, setConvertAmt] = useState(10);
  const [convertFrom, setConvertFrom] = useState("USD");
  const getRate = (from, to) => {
    if (!rates) return null;
    if (from === to) return 1;
    if (from === "USD") return rates[to] || rates[to.toLowerCase()] || null;
    if (to === "USD") {
      const fromRate = rates[from] || rates[from.toLowerCase()];
      return fromRate ? 1 / fromRate : null;
    }
    const fromRate = rates[from] || rates[from.toLowerCase()];
    const toRate = rates[to] || rates[to.toLowerCase()];
    if (fromRate && toRate) return toRate / fromRate;
    return null;
  };
  const pairData = CURRENCY_PAIRS.map(p => ({ ...p, rate: getRate(p.from, p.to) }));
  const converted = convertAmt && rates ? convertFOB(convertFrom === "USD" ? convertAmt : convertAmt / (rates[convertFrom] || rates[convertFrom.toLowerCase()] || 1), rates) : {};
  return (
    <div>
      <Heading sub={ratesLoading ? "Connecting..." : ratesError ? ratesError : `Live rates · Updated ${lastUpdated}`} badge="V">Live Market Intelligence</Heading>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 18px", borderRadius: 10, background: ratesLoading ? C.amber+"15" : ratesError ? C.red+"15" : C.green+"15", border: `1px solid ${ratesLoading ? C.amber+"30" : ratesError ? C.red+"30" : C.green+"30"}`, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: ratesLoading ? C.amber : ratesError ? C.red : C.green }} />
          <span style={{ color: ratesLoading ? C.amber : ratesError ? C.red : C.green, fontWeight: 700 }}>{ratesLoading ? "Connecting..." : ratesError ? "Offline — Using cached rates" : "Live Connected"}</span>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, marginBottom: 14 }}>Live Exchange Rates</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {pairData.map(p => (
          <Card key={p.label} style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{p.label}</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.rate ? C.green : C.red }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{p.rate ? p.rate.toFixed(p.to === "INR" ? 2 : 4) : "—"}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>1 {p.from} = {p.rate ? (p.to === "INR" ? "₹"+p.rate.toFixed(2) : p.rate.toFixed(4)+" "+p.to) : "N/A"}</div>
          </Card>
        ))}
      </div>
      <Card style={{ marginBottom: 24, padding: "20px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gold, marginBottom: 16 }}>FOB Quick Converter</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input type="number" min="0" value={convertAmt} onChange={e => setConvertAmt(Number(e.target.value))} style={{ width: 100, background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, fontWeight: 800, outline: "none", textAlign: "center" }} />
          <select value={convertFrom} onChange={e => setConvertFrom(e.target.value)} style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 14px", color: C.gold, fontSize: 13, fontWeight: 700 }}>
            <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option>
          </select>
          <span style={{ fontSize: 12, color: C.muted }}>FOB per piece</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {[{ cur: "INR", sym: "₹", color: "#ff9933" }, { cur: "EUR", sym: "€", color: "#4488ff" }, { cur: "GBP", sym: "£", color: "#c8102e" }, { cur: "USD", sym: "$", color: "#4ade80" }, { cur: "AUD", sym: "A$", color: "#ffcd00" }, { cur: "CAD", sym: "C$", color: "#ff6666" }].map(c => (
            <div key={c.cur} style={{ padding: "12px 16px", borderRadius: 10, background: c.color+"10", border: `1px solid ${c.color}25`, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{c.cur}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c.color }}>{c.sym}{converted[c.cur] || "—"}</div>
            </div>
          ))}
        </div>
      </Card>
      {history.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gold, marginBottom: 14 }}>USD/INR — 30 Day Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="inrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={["dataMin - 0.2", "dataMax + 0.2"]} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} />
              <Area type="monotone" dataKey="INR" stroke={C.gold} fill="url(#inrGrad)" strokeWidth={2} name="₹ per USD" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gold, marginBottom: 14 }}>Key Freight Routes — Moradabad Exports</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {FREIGHT_ROUTES.map(r => (
            <div key={r.id} style={{ padding: "16px 18px", borderRadius: 12, background: "#0d1117", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{r.label.split("→")[1].trim()}</div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>{r.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <div style={{ background: "#161616", borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>20ft Container</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{r.rate20ft}</div>
                </div>
                <div style={{ background: "#161616", borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Transit Time</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{r.transit}</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 6 }}>{r.carriers}</div>
              <a href="https://www.freightos.com/" target="_blank" rel="noreferrer"
                style={{ fontSize: 9, color: C.gold, textDecoration: "none" }}>
                Verify live rate on Freightos →
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
export default TabLiveMarket;
