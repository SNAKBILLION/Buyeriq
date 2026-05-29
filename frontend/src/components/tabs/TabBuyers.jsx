import { useMemo, useState, useEffect } from "react";
import {
  Building2, Mail, ExternalLink, BarChart2,
  Phone, Download, FileDown, Globe, CheckCircle2, Shield,
  DollarSign, Calendar,
} from "lucide-react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, Badge, TierBadge, Tag, DataSourceTag } from "../ui/Primitives.jsx";
import { exportToCSV, fetchBuyerById } from "../../services/api.js";
import { exportBuyerPDF } from "../../utils/pdfExport.js";

const TabBuyers = ({ search, sel, setSel, filters, go }) => {
  const { buyers, source, complianceRules, alerts } = useData();
  const [localSearch, setLocalSearch] = useState('');
  const [buyerDetail, setBuyerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [crmNote, setCrmNote] = useState('');
  const [crmStage, setCrmStage] = useState('cold');
  const [crmSaved, setCrmSaved] = useState(false);
  const [lastContact, setLastContact] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [emailModal, setEmailModal] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCrmSave = () => {
    const key = 'crm_' + sel;
    localStorage.setItem(key, JSON.stringify({ note: crmNote, stage: crmStage, last_contact: lastContact, next_followup: nextFollowup, saved_at: new Date().toISOString() }));
    setCrmSaved(true);
    setTimeout(() => setCrmSaved(false), 2000);
  };

  // Load saved CRM data
  useEffect(() => {
    if (!sel) return;
    const saved = localStorage.getItem('crm_' + sel);
    if (saved) {
      const d = JSON.parse(saved);
      setCrmNote(d.note || '');
      setCrmStage(d.stage || 'cold');
      setLastContact(d.last_contact || '');
      setNextFollowup(d.next_followup || '');
    } else {
      setCrmNote('');
      setCrmStage('cold');
      setLastContact('');
      setNextFollowup('');
    }
  }, [sel]);

  // Email action from competitor tab
  const [pendingEmailAction, setPendingEmailAction] = useState(false);
  useEffect(() => {
    const handler = (e) => { if (e.detail?.action === "email") setPendingEmailAction(true); };
    window.addEventListener("buyeriq:action", handler);
    return () => window.removeEventListener("buyeriq:action", handler);
  }, []);
  useEffect(() => {
    if (pendingEmailAction && sel && buyerDetail) {
      setPendingEmailAction(false);
      setTimeout(() => generateEmail(buyerDetail), 200);
    }
  }, [pendingEmailAction, sel, buyerDetail]);

  // Filter buyers
  const list = useMemo(() => {
    let r = buyers.filter(b => b.is_active !== false);
    if (localSearch) {
      const s = localSearch.toLowerCase();
      r = r.filter(b =>
        b.name?.toLowerCase().includes(s) ||
        b.country_code?.toLowerCase().includes(s) ||
        b.region?.toLowerCase().includes(s) ||
        (b.brands || []).some(x => x.toLowerCase().includes(s))
      );
    }
    if (filters?.country) r = r.filter(b => b.country_code === filters.country);
    if (filters?.tier) r = r.filter(b => b.tier === filters.tier);
    return [...r].sort((a, b) => {
      if (sortBy === 'score') {
        const sa = ((a.scores?.vol||0) + (a.scores?.margin||0) + (a.scores?.pay||0) + (a.scores?.growth||0) + (a.scores?.ease||0)) / 5;
        const sb = ((b.scores?.vol||0) + (b.scores?.margin||0) + (b.scores?.pay||0) + (b.scores?.growth||0) + (b.scores?.ease||0)) / 5;
        return sb - sa;
      }
      if (sortBy === 'revenue') {
        const parseRev = (t) => {
          if (!t || /private|n\/a|unknown/i.test(t)) return 0;
          const toNum = (n, s) => {
            const v = parseFloat(n.replace(/,/g,'')) || 0;
            const u = (s||'').toUpperCase();
            if (u === 'T') return v * 1e12;
            if (u === 'B') return v * 1e9;
            if (u === 'M') return v * 1e6;
            if (u === 'K') return v * 1e3;
            return v;
          };
          const dm = t.match(/\$([0-9,.]+)\s*([TBMKtbmk])?/);
          if (dm) return toNum(dm[1], dm[2]);
          const fm = t.match(/([0-9,.]+)\s*([TBMKtbmk])/);
          if (fm) return toNum(fm[1], fm[2]);
          return 0;
        };
        const ra = parseRev(a.revenue_text);
        const rb = parseRev(b.revenue_text);
        return rb - ra;
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });
  }, [buyers, localSearch, filters, sortBy]);

  // Fetch buyer detail when selected
  useEffect(() => {
    if (!sel) { setBuyerDetail(null); return; }
    const found = buyers.find(b => b.id === sel || b.slug === sel);
    if (found) setBuyerDetail(found);
    setLoadingDetail(true);
    fetchBuyerById(sel)
      .then(res => { if (res?.data) setBuyerDetail(res.data); })
      .catch(() => { /* keep local data */ })
      .finally(() => setLoadingDetail(false));
  }, [sel]);

  const b = buyerDetail;

  const tierLabel = {
    mega_volume: 'Mega Volume',
    premium: 'Premium',
    mid_range: 'Mid Range',
    value: 'Value',
  };

  const generateEmail = async (buyer) => {
    setEmailModal(true);
    setEmailLoading(true);
    setEmailContent('');
    setEmailCopied(false);
    try {
      const crmRaw = localStorage.getItem('crm_' + buyer.id);
      const crm = crmRaw ? JSON.parse(crmRaw) : {};
      const stage = crm.stage || 'cold';
      const lastContact = crm.last_contact || null;
      const notes = crm.note || '';

      const stageContext = {
        cold:   'This is a FIRST TIME cold outreach. Introduce Senses Lifestyle briefly. Focus on why we are the right supplier for them.',
        warm:   `This is a FOLLOW-UP email. We have had prior contact${lastContact ? ` (last: ${lastContact})` : ''}. Reference the previous conversation naturally. Move toward next step.`,
        hot:    `This is a HOT lead follow-up${lastContact ? ` (last contact: ${lastContact})` : ''}. Buyer is interested. Push for samples or PO. Be direct and confident.`,
        closed: 'This buyer has already ordered from us. This is a reorder or new collection email. Reference our existing relationship. Introduce new products or seasonal collection.',
      }[stage] || '';

      const prompt = `You are a sales expert for Senses Lifestyle, a premium wood kitchenware exporter from Moradabad, India (HS 4419).
Write a professional outreach email to ${buyer.name} (${buyer.country_code} buyer, ${buyer.tier} tier).
Relationship context: ${stageContext}${notes ? `\nSales notes: ${notes}` : ''}
Buyer context:
- Revenue: ${buyer.revenue_text || 'N/A'}
- Stores: ${buyer.stores || 'N/A'}
- FOB range: $${buyer.fob?.min || 'N/A'}–$${buyer.fob?.max || 'N/A'}
- India tariff advantage: ${buyer.tariff_text || '18% vs China 30%'}
- Key brands: ${(buyer.brands || []).slice(0,3).join(', ') || 'N/A'}
Email requirements:
- Subject line included
- 3 short paragraphs max
- Tone and angle must match the relationship stage above
- Mention India tariff advantage vs China
- Reference their specific product category
- End with clear CTA matching the stage (intro call for cold, samples for warm/hot, reorder for closed)
- Professional but warm tone
- No generic phrases like "I hope this email finds you well"
Write only the email, no explanation.`;

      const apiUrl = import.meta.env.VITE_API_URL || 'https://buyeriq.onrender.com';
      const token = (await import('../../context/DataContext.jsx')).default;
      const sb = (await import('../../services/api.js'));
      const response = await fetch(`${apiUrl}/api/v1/ai/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb-yzauezwoanhfcwxekrtk-auth-token') ? JSON.parse(localStorage.getItem('sb-yzauezwoanhfcwxekrtk-auth-token'))?.access_token : ''}`
        },
        body: JSON.stringify({ buyer })
      });
      const data = await response.json();
      const text = data.email || 'Failed to generate email.';
      setEmailContent(text);
    } catch (e) {
      setEmailContent('Error generating email. Please try again.');
    }
    setEmailLoading(false);
  };

  const countryFlag = {
    US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', NL: '🇳🇱', FR: '🇫🇷',
    SE: '🇸🇪', DK: '🇩🇰', ES: '🇪🇸', IE: '🇮🇪', CA: '🇨🇦',
    AU: '🇦🇺', JP: '🇯🇵', ZA: '🇿🇦',
  };

  if (b) return (
    <div>
      {/* Email Modal */}
      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#111', border: `1px solid ${C.blue}40`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.blue }}>AI Outreach Email</div>
              <button onClick={() => setEmailModal(false)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            {emailLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>Generating personalized email...</div>
                <div style={{ fontSize: 11, color: '#444' }}>Using buyer intelligence + tariff data</div>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontSize:10, background: crmStage==='hot' ? C.red+'20' : crmStage==='warm' ? C.amber+'20' : crmStage==='closed' ? C.green+'20' : C.blue+'20', color: crmStage==='hot' ? C.red : crmStage==='warm' ? C.amber : crmStage==='closed' ? C.green : C.blue, padding:'2px 10px', borderRadius:20, fontWeight:700, textTransform:'capitalize' }}>
                    {crmStage} stage email
                  </span>
                  <button onClick={() => generateEmail(buyerDetail)} style={{ background:'none', border:`1px solid #333`, color:C.muted, fontSize:11, padding:'3px 10px', borderRadius:6, cursor:'pointer' }}>
                    ↺ Regenerate
                  </button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#ddd', lineHeight: 1.7, fontFamily: 'inherit', marginBottom: 16 }}>{emailContent}</pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(emailContent); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }}
                  style={{ background: emailCopied ? `${C.green}20` : `${C.blue}18`, border: `1px solid ${emailCopied ? C.green : C.blue}40`, color: emailCopied ? C.green : C.blue, padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, width: '100%' }}
                >
                  {emailCopied ? '✓ Copied!' : 'Copy Email'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={() => setSel(null)} style={{ background: "none", border: `1px solid #333`, color: C.gold, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          ← All Buyers
        </button>
        <button onClick={() => exportBuyerPDF(b, complianceRules)} style={{ background: "#1a1a1a", border: `1px solid ${C.gold}40`, color: C.gold, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <FileDown size={13} strokeWidth={2} /> Export PDF
        </button>
        {go && (
          <button onClick={() => go(b.id, 'quote-builder')} style={{ background: `${C.green}18`, border: `1px solid ${C.green}40`, color: C.green, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            Generate Quote →
          </button>
        )}
        <button onClick={() => generateEmail(b)} style={{ background: `${C.blue}18`, border: `1px solid ${C.blue}40`, color: C.blue, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <Mail size={13} strokeWidth={2} /> Draft Email
        </button>
      </div>

      {/* ── Active Alerts ── */}
      {(alerts||[]).filter(a=>a.buyer_name===b.name).length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 8 }}>Active Alerts</div>
          {(alerts||[]).filter(a=>a.buyer_name===b.name).map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: C.text, padding: '5px 0', borderBottom: i < (alerts||[]).filter(a=>a.buyer_name===b.name).length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ color: a.urgency === 'critical' ? C.red : C.amber, fontWeight: 700, marginRight: 8, textTransform: 'uppercase', fontSize: 9 }}>{a.urgency}</span>
              {a.title}{a.message ? ` — ${a.message}` : ""}
            </div>
          ))}
        </div>
      )}

      <Card>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>{countryFlag[b.country_code] || <Globe size={22} color={C.muted} strokeWidth={1.5} />}</span>
              <h2 style={{ fontSize: 24, color: C.text, margin: 0, fontWeight: 800 }}>{b.name}</h2>
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
              {b.hq_city} · {b.stock || b.stock_ticker || 'Private'}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <TierBadge tier={b.tier} />
              {(b.brands || []).map(x => (
                <span key={x} style={{ background: "#1f1f1f", color: "#aaa", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>{x}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.gold }}>{b.revenue_text}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{b.revenue_source}</div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
              Last verified: {b.last_verified?.split('T')[0] || '2026-03'}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>

          {/* Company Info */}
          <div style={{ background: "#0e0e0e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={13} color={C.gold} strokeWidth={2} /> Company Info <Badge type="V" /></div>
            <div style={{ fontSize: 12, color: "#bbb", lineHeight: 2 }}>
              <div><b style={{ color: C.text }}>HQ:</b> {b.hq_city}</div>
              <div><b style={{ color: C.text }}>Region:</b> {b.region}</div>
              <div><b style={{ color: C.text }}>Stores:</b> {b.stores || b.stores_count}</div>
              <div><b style={{ color: C.text }}>Stock:</b> {b.stock || b.stock_ticker || 'Private'}</div>
              {b.website && (
                <div><b style={{ color: C.text }}>Website:</b>{' '}
                  <a href={`https://${b.website}`} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{b.website}</a>
                </div>
              )}
            </div>
          </div>

          {/* Contact & Vendor Portal */}
          <div style={{ background: "#0e0e0e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Mail size={13} color={C.gold} strokeWidth={2} /> Become a Supplier <Badge type="V" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {b.vendor_portal_url && (
                <a href={b.vendor_portal_url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", padding: "10px 14px", borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 700, textDecoration: "none", border: `1px solid ${C.green}30` }}>
                  <ExternalLink size={13} strokeWidth={2} /> Vendor Portal
                </a>
              )}
              {b.linkedin_url && (
                <a href={b.linkedin_url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", padding: "10px 14px", borderRadius: 8, color: "#0a66c2", fontSize: 12, fontWeight: 700, textDecoration: "none", border: "1px solid #0a66c230" }}>
                  <ExternalLink size={13} strokeWidth={2} /> LinkedIn Company Page
                </a>
              )}
              {b.ir_url && (
                <a href={b.ir_url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", padding: "10px 14px", borderRadius: 8, color: C.amber, fontSize: 12, fontWeight: 700, textDecoration: "none", border: `1px solid ${C.amber}30` }}>
                  <BarChart2 size={13} strokeWidth={2} /> Investor Relations
                </a>
              )}
            </div>
          </div>

          {/* Direct Contact */}
          {b.contacts && b.contacts.length > 0 && (
            <div style={{ background: "#0e0e0e", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Phone size={13} color={C.gold} strokeWidth={2} /> Direct Contact <Badge type="V" /></div>
              {b.contacts.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: "#bbb", lineHeight: 2 }}>
                  <div><b style={{ color: C.text }}>{c.full_name}</b></div>
                  <div style={{ color: C.muted }}>{c.job_title} — {c.department}</div>
                  {c.email && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={11} color={C.blue} strokeWidth={2} /> <a href={`mailto:${c.email}`} style={{ color: C.blue }}>{c.email}</a></div>}
                  {c.phone && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={11} color="#bbb" strokeWidth={2} /> {c.phone}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Trade Intelligence */}
          <div style={{ background: "#0e0e0e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 10 }}>Trade Intelligence <Badge type="V" /></div>
            <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: C.muted }}>Market: </span>
                <span style={{ fontWeight: 700 }}>{countryFlag[b.country_code]} {b.region}</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: C.muted }}>India Tariff: </span>
                <span style={{ color: C.green, fontWeight: 700 }}>
                  {b.country_code === 'GB' ? '0% (UK DCTS)' :
                   ['DE','NL','FR','SE','DK','IE','ES'].includes(b.country_code) ? '0% (EU GSP+)' :
                   b.country_code === 'AU' ? '0% (AI-ECTA)' :
                   b.country_code === 'CA' ? '0% (MFN)' :
                   b.country_code === 'JP' ? '2.4% (CEPA)' :
                   b.country_code === 'US' ? '18% (Feb 2026)' :
                   b.country_code === 'ZA' ? '0% (SACU)' :
                   b.country_code === 'AE' ? '0% (CEPA)' :
                   b.country_code === 'SA' ? '5% (MFN)' :
                   '—'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#444", fontStyle: "italic" }}>
                Source: BuyerIQ Tariff DB — verified treaty rates
              </div>
            </div>
          </div>

          {/* Buyer Scorecard */}
          {b.scores && (
            <div style={{ background: "#0e0e0e", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 12 }}>Buyer Scorecard</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Payment",      val: b.scores.pay,    color: C.green  },
                  { label: "Volume",       val: b.scores.vol,    color: C.blue   },
                  { label: "Margin",       val: b.scores.margin, color: C.gold   },
                  { label: "Growth",       val: b.scores.growth, color: C.purple },
                  { label: "Ease of Biz", val: b.scores.ease,   color: C.amber  },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 700 }}>{s.val}/100</span>
                    </div>
                    <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3 }}>
                      <div style={{ width: `${s.val || 0}%`, height: "100%", background: s.color, borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "#161616", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: C.muted }}>Avg Score</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.gold }}>
                  {Math.round(((b.scores.pay||0) + (b.scores.vol||0) + (b.scores.margin||0) + (b.scores.growth||0) + (b.scores.ease||0)) / 5)}/100
                </span>
              </div>
            </div>
          )}


          {/* ── Buying Terms ── */}
          {(b.fob?.min > 0 || b.moq || b.payment || b.leadTime) && (
            <div style={{ background: '#0e0e0e', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={13} color={C.blue} strokeWidth={2} /> Buying Terms
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {b.fob?.sweet && (
                  <div style={{ background: '#161616', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>FOB Sweet Spot</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{b.fob.sweet}</div>
                  </div>
                )}
                {b.moq && (
                  <div style={{ background: '#161616', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>MOQ</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.moq}</div>
                  </div>
                )}
                {b.payment && (
                  <div style={{ background: '#161616', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Payment</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.payment}</div>
                  </div>
                )}
                {b.leadTime && (
                  <div style={{ background: '#161616', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Lead Time</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.leadTime}</div>
                  </div>
                )}
                {b.negotiation && (
                  <div style={{ background: '#161616', borderRadius: 7, padding: '8px 10px', gridColumn: '1/-1' }}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Negotiation Style</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>{b.negotiation}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Seasonal Intelligence ── */}
          {b.seasonal && Object.values(b.seasonal).some(v => v > 0) && (
            <div style={{ background: '#0e0e0e', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, marginBottom: 12 }}>
                Seasonal Buying Pattern
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {['Q1','Q2','Q3','Q4'].map(q => {
                  const val = b.seasonal[q] || 0;
                  const isPeak = val === Math.max(...Object.values(b.seasonal));
                  return (
                    <div key={q} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isPeak ? C.gold : C.muted }}>{val}%</div>
                      <div style={{ width: '100%', height: `${val}%`, minHeight: 4, background: isPeak ? C.gold : C.purple, borderRadius: '3px 3px 0 0', transition: 'height 0.5s' }} />
                      <div style={{ fontSize: 10, color: isPeak ? C.gold : C.muted, fontWeight: isPeak ? 700 : 400 }}>{q}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: C.muted }}>
                Peak: {['Q1','Q2','Q3','Q4'].find(q => b.seasonal[q] === Math.max(...Object.values(b.seasonal)))} · 
                {' '}{Math.max(...Object.values(b.seasonal))}% of annual orders
              </div>
            </div>
          )}

              {/* ── CRM Notes ── */}
          <div style={{ background: '#0e0e0e', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.amber, marginBottom: 12 }}>CRM — Sales Notes</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deal Stage</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['cold','warm','hot','closed'].map(stage => (
                  <button key={stage} onClick={() => setCrmStage(stage)} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: crmStage === stage ? (stage === 'hot' ? C.red : stage === 'warm' ? C.amber : stage === 'closed' ? C.green : C.blue) + '25' : '#161616',
                    color: crmStage === stage ? (stage === 'hot' ? C.red : stage === 'warm' ? C.amber : stage === 'closed' ? C.green : C.blue) : C.muted,
                    border: `1px solid ${crmStage === stage ? (stage === 'hot' ? C.red : stage === 'warm' ? C.amber : stage === 'closed' ? C.green : C.blue) + '50' : '#222'}`,
                    textTransform: 'capitalize',
                  }}>{stage}</button>
                ))}
              </div>
            </div>
            {/* Date fields */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:10, color:C.muted, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Last Contact</div>
                <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)}
                  style={{ width:'100%', background:'#161616', border:'1px solid #333', borderRadius:7, color:C.text, fontSize:12, padding:'6px 10px', boxSizing:'border-box', colorScheme:'dark' }} />
              </div>
              <div>
                <div style={{ fontSize:10, color:nextFollowup && new Date(nextFollowup) <= new Date() ? C.red : C.muted, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
                  Next Follow-up {nextFollowup && new Date(nextFollowup) <= new Date() ? '⚠ OVERDUE' : nextFollowup && new Date(nextFollowup) <= new Date(Date.now()+7*86400000) ? '📅 This week' : ''}
                </div>
                <input type="date" value={nextFollowup} onChange={e => setNextFollowup(e.target.value)}
                  style={{ width:'100%', background:'#161616', border:`1px solid ${nextFollowup && new Date(nextFollowup) <= new Date() ? C.red+'60' : '#333'}`, borderRadius:7, color: nextFollowup && new Date(nextFollowup) <= new Date() ? C.red : C.text, fontSize:12, padding:'6px 10px', boxSizing:'border-box', colorScheme:'dark' }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Private Notes</div>
              <textarea
                value={crmNote}
                onChange={e => setCrmNote(e.target.value)}
                placeholder="Add notes about this buyer — last meeting, products discussed, key contacts..."
                rows={3}
                style={{ width: '100%', background: '#161616', border: '1px solid #333', borderRadius: 7, color: C.text, fontSize: 12, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={handleCrmSave} style={{
              padding: '6px 16px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: crmSaved ? C.green + '20' : '#1a1a1a',
              border: `1px solid ${crmSaved ? C.green : '#333'}`,
              color: crmSaved ? C.green : C.muted,
            }}>
              {crmSaved ? '✓ Saved' : 'Save Notes'}
            </button>
          </div>

          {/* ── Compliance Requirements ── */}
          {(b.certifications_required?.length > 0 || (Array.isArray(b.compliance) && b.compliance.length > 0)) && (
            <div style={{ background: '#0e0e0e', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={13} color={C.red} strokeWidth={2} /> Compliance Requirements
              </div>
              {/* Certification badges */}
              {b.certifications_required?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: Array.isArray(b.compliance) && b.compliance.length > 0 ? 12 : 0 }}>
                  {b.certifications_required.map((cert, i) => (
                    <span key={i} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                      background: C.red + '15', color: C.red, border: `1px solid ${C.red}30`,
                    }}>{cert}</span>
                  ))}
                </div>
              )}
              {/* Law detail cards */}
              {Array.isArray(b.compliance) && b.compliance.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {b.compliance.map((law, i) => {
                    const urgencyColor = law.urgency === 'critical' ? C.red : law.urgency === 'high' ? C.amber : C.muted;
                    const statusColor = (law.status === 'ACTIVE' || law.status === 'REQUIRED') ? C.green : law.status === 'UPCOMING' ? C.amber : C.muted;
                    return (
                      <div key={i} style={{ padding: '8px 10px', background: '#161616', borderRadius: 7, borderLeft: `3px solid ${urgencyColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{law.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: statusColor + '15', padding: '2px 7px', borderRadius: 10 }}>
                            {law.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{law.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </Card>
    </div>
  );

  // Buyer List
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Heading sub={`${list.length} verified buyers · Click for full profile`}>Buyer Profiles</Heading>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <DataSourceTag source={source} />
          <input type="text" placeholder="Search buyers..." value={localSearch} onChange={e => setLocalSearch(e.target.value)} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', color: '#f0ebe0', fontSize: 11, outline: 'none', width: 180 }} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: '#161616', border: '1px solid #333', color: '#999', padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', outline: 'none' }}>
            <option value="score">Sort: Score</option>
            <option value="revenue">Sort: Revenue</option>
            <option value="name">Sort: Name A-Z</option>
          </select>
          <button
            onClick={() => exportToCSV(list.map(b => ({
              name: b.name, country: b.country_code, tier: b.tier,
              revenue: b.revenue_text, stores: b.stores || b.stores_count,
              hq: b.hq_city, website: b.website,
              vendor_portal: b.vendor_portal_url
            })), 'buyeriq-buyers.csv')}
            style={{ background: "#161616", border: `1px solid ${C.border}`, color: C.muted, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            <Download size={13} strokeWidth={2} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {list.map(b => (
          <Card key={b.id} onClick={() => setSel(b.id)} style={{ padding: 16, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{countryFlag[b.country_code] || <Globe size={18} color={C.muted} strokeWidth={1.5} />}</span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{b.name}</div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{b.hq_city}</div>
              </div>
              <TierBadge tier={b.tier} />
            </div>

            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {(b.brands || []).slice(0, 3).map(x => (
                <span key={x} style={{ background: "#1a1a1a", color: "#888", fontSize: 10, padding: "2px 7px", borderRadius: 12 }}>{x}</span>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, lineHeight: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.muted }}>Revenue <Badge type="V" /></span>
                <span style={{ color: C.gold, fontWeight: 600 }}>{b.revenue_text}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.muted }}>Stores</span>
                <span style={{ color: "#ccc" }}>{b.stores || b.stores_count}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.muted }}>India Tariff</span>
                <span style={{ color: C.green, fontWeight: 600 }}>
                  {b.country_code === 'GB' ? '0% DCTS' :
                   ['DE','NL','FR','SE','DK','IE','ES'].includes(b.country_code) ? '0% GSP+' :
                   b.country_code === 'AU' ? '0% ECTA' :
                   b.country_code === 'CA' ? '0% MFN' :
                   b.country_code === 'JP' ? '2.4% CEPA' :
                   b.country_code === 'US' ? '18% (Feb 2026)' :
                   b.country_code === 'AE' ? '0% CEPA' :
                   b.country_code === 'SA' ? '5% MFN' :
                   '—'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              {b.vendor_portal_url && (
                <span style={{ fontSize: 10, color: C.green, background: `${C.green}15`, padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={10} strokeWidth={2.5} /> Vendor Portal
                </span>
              )}
              {(b.stock || b.stock_ticker) && !(b.stock || b.stock_ticker || '').includes('Private') && (
                <span style={{ fontSize: 10, color: C.blue, background: `${C.blue}15`, padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <BarChart2 size={10} strokeWidth={2.5} /> Public Co.
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TabBuyers;
