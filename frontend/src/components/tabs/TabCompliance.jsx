import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, Tag, DataSourceTag, ConfidenceBadge } from "../ui/Primitives.jsx";

const TabCompliance = ({ go }) => {
  const { BUYERS, buyers, LAWS, complianceRules, source } = useData();
  const [sel, setSel] = useState(null);

  // Use DB rules if available, else static LAWS
  const hasDbRules = complianceRules && complianceRules.length > 0;
  const displayLaws = hasDbRules
    ? complianceRules.map(r => ({
        id: r.slug || r.id,
        name: r.name,
        co: r.country_scope,
        date: r.effective_date?.split('T')[0] || '—',
        by: r.enforcer || '—',
        status: (r.status || 'active').toUpperCase(),
        sum: r.summary,
        reqs: r.requirements || [],
        pen: r.penalties,
        fact: r.key_fact || '',
        buyers: r.affected_buyer_slugs || [],
        confidence: r.confidence,
      }))
    : LAWS;

  const statusColors = { "ACTIVE": C.green, "ACTIVE (→EUDR)": C.amber, "UPCOMING — CRITICAL": C.red, "UPCOMING": C.red };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Heading sub={`${displayLaws.length} ${hasDbRules ? 'database' : 'verified'} compliance rules`} badge="V">Compliance Hub</Heading>
        <DataSourceTag source={hasDbRules ? "api" : source} />
      </div>

      {/* Senses Action Checklist */}
      <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: C.gold + '08', border: `1px solid ${C.gold}25` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 12 }}>Senses Lifestyle — Compliance Action Checklist</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {[
            { text: 'Obtain Lacey Act wood species declaration (Form PPQ 505)', urgency: 'high' },
            { text: 'Get California Prop 65 compliant labeling for US shipments', urgency: 'high' },
            { text: 'Prepare EUDR due diligence documentation before Dec 2026', urgency: 'critical' },
            { text: 'Maintain FSC/PEFC chain-of-custody certificate for EU buyers', urgency: 'high' },
            { text: 'Ensure REACH compliance documentation for EU+JP buyers', urgency: 'medium' },
            { text: 'Get CPSIA testing certificates for children-adjacent products', urgency: 'medium' },
            { text: 'Document timber origin for UK Timber Regulation buyers', urgency: 'medium' },
            { text: 'Complete IWAY 6.1 self-assessment for IKEA onboarding', urgency: 'medium' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#bbb' }}>
              <span style={{ color: item.urgency === 'critical' ? C.red : item.urgency === 'high' ? C.amber : C.blue, fontWeight: 800, fontSize: 10, marginTop: 1, whiteSpace: 'nowrap' }}>
                {item.urgency === 'critical' ? '!! ' : item.urgency === 'high' ? '! ' : '· '}
              </span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {displayLaws.map(law => (
          <Card key={law.id} onClick={() => setSel(sel === law.id ? null : law.id)} style={{ borderColor: sel === law.id ? C.gold : law.status.includes("CRITICAL") ? C.red + "40" : C.border, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{law.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{law.co} · {law.by}</div>
              </div>
              <span style={{ background: (statusColors[law.status] || C.muted) + "20", color: statusColors[law.status] || C.muted, fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 800, whiteSpace: "nowrap" }}>{law.status}</span>
            </div>
            <div style={{ fontSize: 12, color: "#bbb", marginTop: 8 }}>{law.sum}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11 }}>
              <span style={{ color: C.muted }}>Effective: {law.date}</span>
              <span style={{ color: C.gold, fontWeight: 700 }}>{law.buyers.length} buyers</span>
            </div>
            {sel === law.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2a2a2a" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, marginBottom: 8 }}>Requirements:</div>
                {law.reqs.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#bbb", padding: "4px 0 4px 14px", position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.gold }}>•</span>{r}</div>)}
                <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginTop: 12, marginBottom: 4 }}>Penalties:</div>
                <div style={{ fontSize: 12, color: "#bbb" }}>{law.pen}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, marginTop: 12, marginBottom: 4 }}>Key Fact:</div>
                <div style={{ fontSize: 12, color: "#bbb", fontStyle: "italic" }}>{law.fact}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.blue, marginTop: 12, marginBottom: 6 }}>Affected Buyers:</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {law.buyers.map(id => { const b = (buyers || BUYERS).find(x => x.id === id || x.slug === id); return b ? <Tag key={id} color={C.blue} style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); go && go(b.id, 'buyers'); }}>{b.name}</Tag> : null; })}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
export default TabCompliance;
