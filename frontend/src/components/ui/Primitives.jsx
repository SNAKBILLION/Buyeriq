// ─────────────────────────────────────────────
// BuyerIQ — UI Primitives  v4.6
// ─────────────────────────────────────────────
// Shared components used across all tabs.
// v4.6: All emoji replaced with Lucide SVG icons.
// ─────────────────────────────────────────────
import { useState } from 'react';
import {
  Loader2, Inbox, AlertCircle, Globe, Cpu,
  PenLine, Download, Calculator,
} from 'lucide-react';
import { C, TIERS, CONFIDENCE } from '../../data/theme.js';

export const Badge = ({ type, style: s = {} }) => {
  const d = CONFIDENCE[type];
  if (!d) return null;
  return (
    <span title={d.tip} style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: d.color + "15", color: d.color,
      border: `1px solid ${d.color}30`,
      fontSize: 10, padding: "1px 7px", borderRadius: 99,
      fontWeight: 600, whiteSpace: "nowrap", ...s
    }}>
      {d.icon} {d.label}
    </span>
  );
};

export const TierBadge = ({ tier }) => {
  // Map DB tier names to TIERS keys
  const tierMap = { premium: 'PREMIUM', mid_range: 'MID', value: 'VALUE', mega_volume: 'MEGA' };
  const key = tierMap[tier] || tier?.toUpperCase?.() || tier;
  const t = TIERS[key];
  if (!t) return null;
  return (
    <span style={{
      background: t.color + "20", color: t.color,
      border: `1px solid ${t.color}40`,
      fontSize: 10, padding: "2px 9px", borderRadius: 99, fontWeight: 700,
    }}>
      {t.label}
    </span>
  );
};

export const Card = ({ children, style: s = {}, onClick, hoverBorder }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && onClick ? C.cardHover : C.card,
        border: `1px solid ${hov && onClick ? (hoverBorder || C.gold + "60") : C.border}`,
        borderRadius: 14, padding: 20,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease", ...s,
      }}
    >
      {children}
    </div>
  );
};

export const Heading = ({ children, sub, badge }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: -0.5 }}>
        {children}
      </h2>
      {badge && <Badge type={badge} />}
    </div>
    {sub && <p style={{ fontSize: 12, color: C.muted, margin: "5px 0 0" }}>{sub}</p>}
  </div>
);

export const Stat = ({ value, label, sub, icon }) => (
  <Card style={{ textAlign: "center", padding: 16 }}>
    {icon && <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>}
    <div style={{ fontSize: 28, fontWeight: 900, color: C.gold, letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{sub}</div>}
  </Card>
);

export const ScoreBar = ({ value, label, color = C.gold }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: "#999" }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}%</span>
    </div>
    <div style={{ background: "#1a1a1a", borderRadius: 6, height: 7, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg,${color}90,${color})`, borderRadius: 6, transition: "width 0.6s" }} />
    </div>
  </div>
);

export const Tag = ({ children, color = C.gold, onClick, style }) => (
  <span onClick={onClick} style={{
    background: color + "15", color,
    border: `1px solid ${color}25`,
    fontSize: 10, padding: "2px 9px", borderRadius: 99, fontWeight: 600,
    ...style,
  }}>
    {children}
  </span>
);

export const DataSourceTag = ({ source }) => (
  <span style={{
    fontSize: 9, padding: "1px 6px", borderRadius: 4,
    background: source === 'api' ? C.green + '15' : C.amber + '15',
    color: source === 'api' ? C.green : C.amber,
    border: `1px solid ${source === 'api' ? C.green : C.amber}30`,
    fontWeight: 600,
  }}>
    {source === 'api' ? '● LIVE' : '○ STATIC'}
  </span>
);

// Tooltip style for Recharts
export const ttStyle = {
  contentStyle: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 8, fontSize: 12, color: C.text,
  },
};

// ── Production UX: Loading / Empty / Error ───

export const LoadingState = ({ message = "Loading data..." }) => (
  <Card style={{ textAlign: "center", padding: "40px 20px" }}>
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
      <Loader2 size={24} color={C.gold} strokeWidth={2}
        style={{ animation: "spin 1s linear infinite" }} />
    </div>
    <div style={{ fontSize: 13, color: C.muted }}>{message}</div>
  </Card>
);

export const EmptyState = ({ icon: IconOverride, title = "No data yet", message, action }) => (
  <Card style={{ textAlign: "center", padding: "40px 20px", borderStyle: "dashed" }}>
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
      {IconOverride
        ? <IconOverride size={36} color={C.muted} strokeWidth={1.5} />
        : <Inbox size={36} color={C.muted} strokeWidth={1.5} />
      }
    </div>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>{title}</div>
    {message && <div style={{ fontSize: 12, color: C.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>{message}</div>}
    {action && <div style={{ marginTop: 12 }}>{action}</div>}
  </Card>
);

export const ErrorState = ({ error, retry }) => (
  <Card style={{ textAlign: "center", padding: "30px 20px", borderColor: C.red + "30" }}>
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
      <AlertCircle size={24} color={C.red} strokeWidth={2} />
    </div>
    <div style={{ fontSize: 13, color: C.red, marginBottom: 6 }}>{error || "Something went wrong"}</div>
    {retry && <button onClick={retry} style={{ background: C.gold, color: C.bg, border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Retry</button>}
  </Card>
);

export const ConfidenceBadge = ({ level }) => {
  const map = {
    verified: { color: C.green, label: "Verified", icon: "✓" },
    industry_estimate: { color: C.amber, label: "Estimated", icon: "~" },
    unverified: { color: C.red, label: "Unverified", icon: "?" },
  };
  const d = map[level] || map.unverified;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: d.color + "15", color: d.color,
      border: `1px solid ${d.color}30`,
      fontSize: 9, padding: "1px 6px", borderRadius: 99, fontWeight: 600,
    }}>
      {d.icon} {d.label}
    </span>
  );
};

export const SourceIcon = ({ type }) => {
  const iconMap = {
    scraping:   <Globe size={12} color={C.muted} strokeWidth={2} />,
    api:        <Cpu size={12} color={C.muted} strokeWidth={2} />,
    manual:     <PenLine size={12} color={C.muted} strokeWidth={2} />,
    import:     <Download size={12} color={C.muted} strokeWidth={2} />,
    calculated: <Calculator size={12} color={C.muted} strokeWidth={2} />,
  };
  return (
    <span title={type} style={{ display: "inline-flex", alignItems: "center" }}>
      {iconMap[type] || <Cpu size={12} color={C.muted} strokeWidth={2} />}
    </span>
  );
};

export const Pagination = ({ page, total, limit, onPage }) => {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, alignItems: "center" }}>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ background: "none", border: `1px solid ${C.border}`, color: page <= 1 ? "#333" : C.muted, padding: "5px 12px", borderRadius: 6, cursor: page <= 1 ? "default" : "pointer", fontSize: 11 }}>← Prev</button>
      <span style={{ fontSize: 11, color: C.muted }}>{page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} style={{ background: "none", border: `1px solid ${C.border}`, color: page >= pages ? "#333" : C.muted, padding: "5px 12px", borderRadius: 6, cursor: page >= pages ? "default" : "pointer", fontSize: 11 }}>Next →</button>
    </div>
  );
};
