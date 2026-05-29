// ─────────────────────────────────────────────
// BuyerIQ — Decision Intelligence Layer v1.1
// ─────────────────────────────────────────────
// v1.1: All emoji replaced with Lucide SVG icons
// ─────────────────────────────────────────────
import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import DailyActions from "./DailyActions.jsx";
import BuyerHitList from "./BuyerHitList.jsx";
import OpportunityAlerts from "./OpportunityAlerts.jsx";
import QuoteRecommendations from "./QuoteRecommendations.jsx";
import {
  Brain, Zap, Target, TrendingUp, Calculator,
  BarChart2, ChevronDown, ChevronUp,
} from "lucide-react";

const SECTIONS = [
  { id: "actions",       label: "Today's Actions",  Icon: Zap        },
  { id: "hitlist",       label: "Buyer Hit List",   Icon: Target     },
  { id: "opportunities", label: "Opportunities",    Icon: TrendingUp },
  { id: "quotes",        label: "Quote Suggestions",Icon: Calculator },
];

export default function DecisionLayer({ go, rates }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("all");
  const { loading: dataLoading } = useData();

  if (collapsed) {
    return (
      <div style={{
        marginBottom: 16, padding: "10px 16px", borderRadius: 10,
        background: `linear-gradient(135deg, ${C.gold}08, ${C.blue}08)`,
        border: `1px solid ${C.gold}20`, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}
        onClick={() => setCollapsed(false)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Brain size={16} color={C.gold} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>Decision Intelligence</span>
          <span style={{ fontSize: 11, color: C.muted }}>— Click to expand</span>
        </div>
        <ChevronDown size={14} color={C.muted} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, padding: "14px 18px", borderRadius: 12,
        background: `linear-gradient(135deg, ${C.gold}0a, ${C.blue}06, ${C.green}06)`,
        border: `1px solid ${C.gold}18`,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Brain size={20} color={C.gold} strokeWidth={1.8} />
            <span style={{ fontSize: 18, fontWeight: 900, color: C.gold }}>Decision Intelligence</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginLeft: 30 }}>
            What should Senses Lifestyle do today? AI-powered recommendations from your buyer intelligence.
            {dataLoading && <span style={{ color: C.amber }}> Loading fresh data…</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Section pills */}
          <div style={{ display: "flex", gap: 4 }}>
            <Pill active={activeSection === "all"} onClick={() => setActiveSection("all")}>All</Pill>
            {SECTIONS.map(s => (
              <Pill key={s.id} active={activeSection === s.id} onClick={() => setActiveSection(s.id)}
                title={s.label}>
                <s.Icon size={12} strokeWidth={2} />
              </Pill>
            ))}
          </div>
          <button onClick={() => setCollapsed(true)}
            style={{
              background: "none", border: `1px solid #333`, borderRadius: 6,
              padding: "4px 10px", color: C.muted, cursor: "pointer", fontSize: 11,
              display: "flex", alignItems: "center", gap: 5,
            }}>
            <ChevronUp size={12} strokeWidth={2} /> Collapse
          </button>
        </div>
      </div>

      {/* Sections */}
      {(activeSection === "all" || activeSection === "actions")       && <DailyActions go={go} />}
      {(activeSection === "all" || activeSection === "hitlist")       && <BuyerHitList go={go} />}
      {(activeSection === "all" || activeSection === "opportunities") && <OpportunityAlerts go={go} />}
      {(activeSection === "all" || activeSection === "quotes")        && <QuoteRecommendations go={go} onQuote={(id) => go?.(id, "quote-builder")} />}

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px", padding: "0 4px" }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${C.gold}40, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <BarChart2 size={11} color={C.muted} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Data Dashboard
          </span>
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${C.gold}40, transparent)` }} />
      </div>
    </div>
  );
}

function Pill({ active, onClick, children, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? C.gold + "20" : "transparent",
      color: active ? C.gold : C.muted,
      fontSize: 11, fontWeight: active ? 800 : 600,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}
