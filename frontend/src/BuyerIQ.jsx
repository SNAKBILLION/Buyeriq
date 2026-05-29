// ═══════════════════════════════════════════════════════════════════════
//  BuyerIQ v4.7 — Buyer Intelligence Platform (Refactored)
//  Senses Lifestyle · Moradabad, India
// ═══════════════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
  Treemap, Legend, LineChart, Line
} from "recharts";

// ── Lucide Icons ─────────────────────────────
import {
  LayoutDashboard, Calculator, Globe, Radio,
  Building2, Map, Package, TrendingUp,
  Trophy, Bell, Scale, Settings2,
  ShoppingBag, BarChart2, Compass, SlidersHorizontal,
  ChevronRight, ChevronDown,
} from "lucide-react";

// ── Modular Imports ──────────────────────────
import { C, THEME, TIERS, CONFIDENCE, TABS, CURRENCY_PAIRS, FREIGHT_ROUTES } from "./data/theme.js";
import { BUYERS, TRADE_DATA, SOURCING_INTEL, PRODUCTS, COUNTRIES, LAWS } from "./data/fallbacks.js";
import { Badge, TierBadge, Card, Heading, Stat, ScoreBar, Tag, DataSourceTag, ttStyle } from "./components/ui/Primitives.jsx";
import { useLiveRates, convertFOB } from "./hooks/useLiveRates.js";
import { supabase } from "./lib/supabase.js";
import { useBackendData } from "./hooks/useBackendData.js";
import { DataContext } from "./context/DataContext.jsx";

// ── Migrated Tab Components ──────────────────
import TabDashboard from "./components/tabs/TabDashboard.jsx";
import TabPriceIntel from "./components/tabs/TabPriceIntel.jsx";
import TabBuyers from "./components/tabs/TabBuyers.jsx";
import TabRegional from "./components/tabs/TabRegional.jsx";
import TabProductDNA from "./components/tabs/TabProductDNA.jsx";
import TabCompetitors from "./components/tabs/TabCompetitors.jsx";
import TabAlerts from "./components/tabs/TabAlerts.jsx";
import TabCompliance from "./components/tabs/TabCompliance.jsx";
import TabQuoteBuilder from "./components/tabs/TabQuoteBuilder.jsx";
import TabTradeIntel from "./components/tabs/TabTradeIntel.jsx";
import TabLiveMarket from "./components/tabs/TabLiveMarket.jsx";
import TabAdmin from "./components/tabs/TabAdmin.jsx";
import DecisionLayer from "./components/decision/DecisionLayer.jsx";
import { useAuth } from "./hooks/useAuth.js";

// ═══════════════════════════════════════════════════════════════════════
//  TAB → LUCIDE ICON MAP
// ═══════════════════════════════════════════════════════════════════════
const TAB_ICONS = {
  "dashboard":     (s = 16) => <LayoutDashboard size={s} strokeWidth={1.75} />,
  "quote-builder": (s = 16) => <Calculator      size={s} strokeWidth={1.75} />,
  "trade-intel":   (s = 16) => <Globe           size={s} strokeWidth={1.75} />,
  "live-market":   (s = 16) => <Radio           size={s} strokeWidth={1.75} />,
  "buyers":        (s = 16) => <Building2       size={s} strokeWidth={1.75} />,
  "regional":      (s = 16) => <Map             size={s} strokeWidth={1.75} />,
  "product-dna":   (s = 16) => <Package         size={s} strokeWidth={1.75} />,
  "price-intel":   (s = 16) => <TrendingUp      size={s} strokeWidth={1.75} />,
  "competitors":   (s = 16) => <Trophy          size={s} strokeWidth={1.75} />,
  "alerts":        (s = 16) => <Bell            size={s} strokeWidth={1.75} />,
  "compliance":    (s = 16) => <Scale           size={s} strokeWidth={1.75} />,
  "admin":         (s = 16) => <Settings2       size={s} strokeWidth={1.75} />,
};

// ═══════════════════════════════════════════════════════════════════════
//  NAV SECTIONS — 12 tabs → 6 grouped sections
//  icon: Lucide component for section header
//  standalone: true → solo item, no collapsible header
//  adminOnly: true  → hidden for non-admin users
// ═══════════════════════════════════════════════════════════════════════
const NAV_SECTIONS = [
  {
    id: "dashboard",
    standalone: true,
    tabs: ["dashboard"],
  },
  {
    id: "sales",
    label: "Sales Hub",
    Icon: ShoppingBag,
    tabs: ["quote-builder", "buyers"],
  },
  {
    id: "market",
    label: "Market Intel",
    Icon: BarChart2,
    tabs: ["trade-intel", "price-intel", "live-market"],
  },
  {
    id: "discover",
    label: "Discover",
    Icon: Compass,
    tabs: ["regional", "competitors", "product-dna"],
  },
  {
    id: "ops",
    label: "Operations",
    Icon: SlidersHorizontal,
    tabs: ["alerts", "compliance"],
  },
  {
    id: "admin",
    standalone: true,
    adminOnly: true,
    tabs: ["admin"],
  },
];

// ═══════════════════════════════════════════════════════════════════════
//  MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function BuyerIQ() {
  const [tab, setTab]         = useState("dashboard");
  const [sidebar, setSidebar] = useState(true);
  const [sel, setSel]         = useState(null);
  const [filters, setFilters] = useState({ country: "", tier: "" });

  // All sections open by default
  const [openSections, setOpenSections] = useState(() =>
    NAV_SECTIONS.reduce((acc, s) => { acc[s.id] = true; return acc; }, {})
  );

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const { user: authUser } = useAuth();
  const [userRole, setUserRole]   = useState("viewer");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName]   = useState("");

  const ADMIN_EMAILS = ["snaksham7@gmail.com", "admin@senseslifestyle.com", "snak@senseslifestyle.com"];

  useEffect(() => {
    if (authUser?.email) {
      setUserEmail(authUser.email);
      const isKnownAdmin = ADMIN_EMAILS.includes(authUser.email.toLowerCase());
      import("./services/api.js").then(({ fetchUserProfile }) => {
        fetchUserProfile().then(res => {
          if (res?.data) {
            setUserRole(res.data.role || (isKnownAdmin ? "admin" : "viewer"));
            setUserName(res.data.name || "");
            setUserEmail(res.data.email || authUser.email);
          } else if (isKnownAdmin) {
            setUserRole("admin");
          }
        }).catch(() => {
          setUserRole(isKnownAdmin ? "admin" : (authUser.user_metadata?.role || "viewer"));
        });
      });
    }
  }, [authUser]);

  // Auto-open section containing the active tab
  useEffect(() => {
    const section = NAV_SECTIONS.find(s => !s.standalone && s.tabs.includes(tab));
    if (section) setOpenSections(prev => ({ ...prev, [section.id]: true }));
  }, [tab]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || userRole === "admin");

  const { rates, history, loading: ratesLoading, error: ratesError, lastUpdated } = useLiveRates();
  const {
    buyers: BUYERS_DATA, products: PRODUCTS_DATA,
    shipments, retail, suppliers, tradeStats, complianceRules, alerts, prices,
    source: dataSource, loading: dataLoading, counts: dataCounts,
  } = useBackendData();



  const go = useCallback((id, toTab, action) => { setSel(id || null); setTab(toTab || "buyers"); if(action) setTimeout(() => window.dispatchEvent(new CustomEvent("buyeriq:action", {detail:{action, id}})), 300); }, []);

  const renderContent = () => {
    switch (tab) {
      case "dashboard":    return (<><DecisionLayer go={go} rates={rates} /><TabDashboard go={go} rates={rates} /></>);
      case "quote-builder":return <TabQuoteBuilder rates={rates} sel={sel} setSel={setSel} go={go} />;
      case "trade-intel": return <TabTradeIntel go={go} setFilters={setFilters} />;
      case "live-market":  return <TabLiveMarket rates={rates} history={history} ratesLoading={ratesLoading} ratesError={ratesError} lastUpdated={lastUpdated} />;
      case "buyers":       return <TabBuyers search="" sel={sel} setSel={setSel} filters={filters} go={go} />;
      case "regional":     return <TabRegional go={go} />;
      case "product-dna":  return <TabProductDNA go={go} />;
      case "price-intel":  return <TabPriceIntel rates={rates} />;
      case "competitors":  return <TabCompetitors go={go} />;
      case "alerts":       return <TabAlerts />;
      case "compliance":   return <TabCompliance go={go} />;
      case "admin":        return userRole === "admin" ? <TabAdmin /> : <TabDashboard go={go} rates={rates} />;
      default:             return <TabDashboard go={go} rates={rates} />;
    }
  };

  const dataValue = {
    BUYERS: BUYERS_DATA, buyers: BUYERS_DATA, PRODUCTS: PRODUCTS_DATA, products: PRODUCTS_DATA,
    COUNTRIES, LAWS, TRADE_DATA, SOURCING_INTEL,
    shipments, retail, suppliers, tradeStats, complianceRules, alerts, prices,
    source: dataSource, loading: dataLoading, counts: dataCounts,
  };

  return (
    <DataContext.Provider value={dataValue}>
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif", background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        @media (max-width: 768px) {
          .biq-sidebar { display: none !important; }
          .biq-mobile-nav { display: flex !important; }
        }
        .biq-nav-tab {
          transition: background 0.15s ease, color 0.15s ease;
        }
        .biq-nav-tab:hover {
          background: #161616 !important;
          color: #f0ebe0 !important;
        }
        .biq-section-hdr {
          transition: background 0.15s ease;
        }
        .biq-section-hdr:hover { background: #161616 !important; }
        .biq-chevron {
          transition: transform 0.2s ease;
          display: flex;
          align-items: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .biq-nav-tab,
          .biq-section-hdr,
          .biq-chevron { transition: none !important; }
        }
      `}</style>

      {/* ─── Sidebar ─── */}
      <div className="biq-sidebar" style={{
        width: sidebar ? 232 : 58,
        background: "#0e0e0e",
        borderRight: `1px solid ${C.border}`,
        transition: "width 0.25s ease",
        flexShrink: 0,
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{
          padding: sidebar ? "18px 18px 14px" : "18px 10px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 34, height: 34,
            background: `linear-gradient(135deg, ${C.gold}, #b8862d)`,
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: C.bg, fontSize: 13, flexShrink: 0,
            boxShadow: `0 2px 8px ${C.gold}30`,
          }}>SL</div>
          {sidebar && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, letterSpacing: -0.3 }}>BuyerIQ</div>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>Senses Lifestyle</div>
            </div>
          )}
        </div>

        {/* User Info */}
        {sidebar && (
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {userName || userEmail.split("@")[0]}
                </div>
                <div style={{ fontSize: 10, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
              </div>
              <span style={{
                flexShrink: 0,
                background: (userRole === "admin" ? C.red : userRole === "manager" ? C.gold : C.green) + "20",
                color: userRole === "admin" ? C.red : userRole === "manager" ? C.gold : C.green,
                fontSize: 9, padding: "2px 8px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase", marginLeft: 8,
              }}>{userRole}</span>
            </div>
          </div>
        )}

        {/* Buyer Filters */}
        {sidebar && tab === "buyers" && (
          <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <select value={filters.country} onChange={e => setFilters(f => ({ ...f, country: e.target.value }))}
              style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 11, cursor: "pointer" }}>
              <option value="">All Countries</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
            <select value={filters.tier} onChange={e => setFilters(f => ({ ...f, tier: e.target.value }))}
              style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 11, cursor: "pointer" }}>
              <option value="">All Tiers</option>
              {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}

        {/* ── Nav ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>

          {/* COLLAPSED: flat icon list with tooltip */}
          {!sidebar && visibleTabs.map(t => (
            <button key={t.id} className="biq-nav-tab"
              onClick={() => { setTab(t.id); setSel(null); }}
              title={t.label}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "11px 0",
                background: tab === t.id ? C.gold + "12" : "transparent",
                border: "none",
                borderLeft: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent",
                color: tab === t.id ? C.gold : C.muted,
                cursor: "pointer",
              }}>
              {TAB_ICONS[t.id]?.(16)}
            </button>
          ))}

          {/* EXPANDED: 6-section grouped nav */}
          {sidebar && NAV_SECTIONS.map(section => {
            const sectionTabs = section.tabs
              .map(id => visibleTabs.find(t => t.id === id))
              .filter(Boolean);

            if (sectionTabs.length === 0) return null;

            const isOpen       = openSections[section.id];
            const hasActiveTab = sectionTabs.some(t => t.id === tab);

            // ── Standalone (Dashboard / Admin) ──
            if (section.standalone) {
              return (
                <div key={section.id}>
                  {sectionTabs.map(t => (
                    <button key={t.id} className="biq-nav-tab"
                      onClick={() => { setTab(t.id); setSel(null); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 16px",
                        background: tab === t.id ? C.gold + "12" : "transparent",
                        border: "none",
                        borderLeft: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent",
                        color: tab === t.id ? C.gold : C.muted,
                        cursor: "pointer", fontSize: 13,
                        fontWeight: tab === t.id ? 600 : 400,
                        textAlign: "left",
                      }}>
                      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {TAB_ICONS[t.id]?.(16)}
                      </span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                  <div style={{ height: 1, background: C.border, margin: "6px 14px" }} />
                </div>
              );
            }

            // ── Grouped section ──
            const { Icon } = section;
            return (
              <div key={section.id} style={{ marginBottom: 2 }}>
                {/* Section Header */}
                <button
                  className="biq-section-hdr"
                  onClick={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 14px 7px 14px",
                    background: "transparent", border: "none", cursor: "pointer",
                  }}>
                  {/* Section icon */}
                  <span style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    color: hasActiveTab ? C.gold : C.muted,
                  }}>
                    <Icon size={13} strokeWidth={2} />
                  </span>
                  {/* Section label */}
                  <span style={{
                    flex: 1, textAlign: "left",
                    fontSize: 10, fontWeight: 700,
                    color: hasActiveTab ? C.gold : C.muted,
                    textTransform: "uppercase", letterSpacing: 1,
                  }}>
                    {section.label}
                  </span>
                  {/* Lucide chevron — rotates on open */}
                  <span className="biq-chevron" style={{
                    color: C.muted,
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}>
                    <ChevronRight size={13} strokeWidth={2} />
                  </span>
                </button>

                {/* Section Tab Items */}
                {isOpen && sectionTabs.map(t => (
                  <button key={t.id} className="biq-nav-tab"
                    onClick={() => { setTab(t.id); setSel(null); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 16px 8px 30px",
                      background: tab === t.id ? C.gold + "12" : "transparent",
                      border: "none",
                      borderLeft: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent",
                      color: tab === t.id ? C.gold : C.muted,
                      cursor: "pointer", fontSize: 12,
                      fontWeight: tab === t.id ? 600 : 400,
                      textAlign: "left",
                    }}>
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {TAB_ICONS[t.id]?.(14)}
                    </span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* User Profile Footer */}
        {sidebar && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail || "User"}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{
                background: (userRole === "admin" ? C.red : userRole === "manager" ? C.gold : C.muted) + "20",
                color: userRole === "admin" ? C.red : userRole === "manager" ? C.gold : C.muted,
                fontSize: 9, padding: "2px 8px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase",
              }}>{userRole}</span>
              <button onClick={handleLogout} style={{
                background: "none", border: `1px solid ${C.border}`, color: C.muted,
                padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontSize: 10,
              }}>Logout</button>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button onClick={() => setSidebar(!sidebar)} style={{
          padding: 14, background: "none", border: "none",
          borderTop: `1px solid ${C.border}`, color: C.muted, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {sidebar
            ? <ChevronRight size={16} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
            : <ChevronRight size={16} strokeWidth={2} />
          }
        </button>
      </div>

      {/* ─── Mobile Nav ─── */}
      <div className="biq-mobile-nav" style={{
        display: "none",
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#0e0e0e", borderTop: `1px solid ${C.border}`,
        zIndex: 100, overflowX: "auto", padding: "2px 0",
      }}>
        <div style={{ display: "flex", minWidth: "max-content" }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSel(null); }}
              title={t.label}
              style={{
                flex: "0 0 auto", padding: "10px 14px",
                background: "none", border: "none",
                color: tab === t.id ? C.gold : C.muted,
                cursor: "pointer",
                borderBottom: tab === t.id ? `2px solid ${C.gold}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s ease",
              }}>
              {TAB_ICONS[t.id]?.(20)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {/* Top Bar */}
        <div style={{
          padding: "12px 24px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 8,
          position: "sticky", top: 0,
          background: C.bg + "ee", zIndex: 50,
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {rates && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}`, flexShrink: 0 }} />
                {[
                  { label: "$/₹",  val: rates.INR || rates.inr },
                  { label: "€/₹",  val: (rates.EUR || rates.eur) ? (rates.INR || rates.inr) / (rates.EUR || rates.eur) : null },
                  { label: "£/₹",  val: (rates.GBP || rates.gbp) ? (rates.INR || rates.inr) / (rates.GBP || rates.gbp) : null },
                ].filter(c => c.val != null && isFinite(c.val)).map(c => (
                  <span key={c.label} style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 6,
                    background: "#161616", border: `1px solid ${C.border}`,
                    color: C.text, fontWeight: 600,
                  }}>
                    <span style={{ color: C.muted }}>{c.label}</span> {c.val?.toFixed(2)}
                  </span>
                ))}
              </div>
            )}
            {!rates && (
              <div style={{ fontSize: 11, color: C.muted }}>
                Data verified from public sources · Estimates marked <span style={{ color: C.amber, fontWeight: 700 }}>~</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {rates && <span style={{ fontSize: 9, color: C.muted }}>Live</span>}
            <Badge type="V" /> <Badge type="I" />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px 24px 90px" }}>
          {dataLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Skeleton pulse animation */}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
              {[1,2,3].map(i => (
                <div key={i} style={{ borderRadius: 12, background: "#161616", border: "1px solid #222", padding: 20, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.15}s` }}>
                  <div style={{ height: 16, width: "40%", background: "#2a2a2a", borderRadius: 6, marginBottom: 12 }} />
                  <div style={{ height: 12, width: "70%", background: "#222", borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 12, width: "55%", background: "#222", borderRadius: 6 }} />
                </div>
              ))}
              <div style={{ textAlign: "center", color: "#444", fontSize: 12, marginTop: 8 }}>
                Connecting to server — may take up to 50s on first load...
              </div>
            </div>
          ) : renderContent()}
        </div>

        {/* Footer */}
        <div style={{
          padding: "18px 24px",
          borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: "#333", textAlign: "center",
        }}>
          BuyerIQ v4.7 · Senses Lifestyle, Moradabad · {BUYERS_DATA?.length || BUYERS.length} buyers · {COUNTRIES.length} countries · {complianceRules?.length || LAWS.length} compliance laws · Live currency via Frankfurter API · Trade data: UN COMTRADE, USDA FAS, Census Bureau
        </div>
      </div>
    </div>
    </DataContext.Provider>
  );
}
