import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { C } from "../../data/theme.js";
import { Card, Heading, Badge, EmptyState, DataSourceTag } from "../ui/Primitives.jsx";
import { Bell, X } from "lucide-react";

const TabAlerts = () => {
  const { BUYERS, alerts: dbAlerts, source } = useData();

  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_alerts') || '[]'); }
    catch { return []; }
  });

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissed_alerts', JSON.stringify(next));
  };

  const clearAll = () => {
    setDismissed([]);
    localStorage.removeItem('dismissed_alerts');
  };

  const staticAlerts = BUYERS.flatMap(b => (b.alerts || []).map(a => ({
    ...a, buyer: b.name, id: `static-${b.id}-${a.type}`, _source: "buyer_profile",
  })));

  const liveAlerts = (dbAlerts || []).map(a => ({
    type: a.type, urgency: a.urgency, msg: a.message || a.title,
    buyer: a.buyer_name || "System", verified: a.is_verified,
    id: a.id, _source: "ai_engine",
  }));

  const all = [...liveAlerts, ...staticAlerts];

  const dedupMap = {};
  all.forEach(a => {
    const key = (a.msg || a.type || '').slice(0, 60) + '|' + (a.buyer || '');
    if (!dedupMap[key]) {
      dedupMap[key] = { ...a, _count: 1 };
    } else {
      dedupMap[key]._count++;
      const uOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      if ((uOrder[a.urgency] || 4) < (uOrder[dedupMap[key].urgency] || 4)) {
        dedupMap[key].urgency = a.urgency;
      }
    }
  });

  // Follow-up alerts from localStorage CRM data
  const today = new Date(); today.setHours(0,0,0,0);
  const followupAlerts = BUYERS.flatMap(b => {
    const crm = (() => { try { return JSON.parse(localStorage.getItem('crm_' + b.id) || '{}'); } catch { return {}; } })();
    if (!crm.next_followup) return [];
    const due = new Date(crm.next_followup); due.setHours(0,0,0,0);
    const diff = Math.round((due - today) / 86400000);
    if (diff > 7) return [];
    const overdue = diff < 0;
    const dueToday = diff === 0;
    return [{
      type: 'followup',
      urgency: overdue ? 'critical' : dueToday ? 'high' : 'medium',
      msg: overdue ? `Follow-up overdue by ${Math.abs(diff)} day${Math.abs(diff)>1?'s':''}` : dueToday ? 'Follow-up due today' : `Follow-up due in ${diff} day${diff>1?'s':''}`,
      buyer: b.name,
      buyerId: b.id,
      id: `followup-${b.id}`,
      _source: 'crm',
      _stage: crm.stage || 'cold',
    }];
  });

  const sorted = [...followupAlerts, ...Object.values(dedupMap)]
    .filter(a => !dismissed.includes(a.id))
    .sort((a, b) =>
      ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 })[a.urgency] -
      ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 })[b.urgency]
    );

  const urgColors = { critical: C.red, high: C.amber, medium: C.blue, low: C.muted, info: C.muted };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Heading sub={`${sorted.length} active — ${liveAlerts.length} from AI engine, ${staticAlerts.length} from buyer profiles`}>Alerts Center</Heading>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {dismissed.length > 0 && (
            <button onClick={clearAll} style={{ fontSize: 11, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
              Restore {dismissed.length} dismissed
            </button>
          )}
          <DataSourceTag source={liveAlerts.length > 0 ? "api" : source} />
        </div>
      </div>

      {sorted.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No active alerts"
          message="All alerts dismissed. Click 'Restore' to bring them back."
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((a, i) => (
          <Card key={a.id || i} style={{ borderLeft: `3px solid ${urgColors[a.urgency] || C.muted}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ background: (urgColors[a.urgency] || C.muted) + "20", color: urgColors[a.urgency] || C.muted, fontSize: 10, padding: "2px 10px", borderRadius: 20, fontWeight: 800, textTransform: "uppercase" }}>{a.urgency}</span>
                  <span style={{ background: C.gold + "18", color: C.gold, fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>{a.type}</span>
                  {a.verified ? <Badge type="V" /> : <Badge type="I" />}
                  {a._source === "ai_engine" && <span style={{ fontSize: 9, color: C.green, background: C.green + "15", padding: "1px 6px", borderRadius: 4 }}>AI</span>}
                  {a._count > 1 && <span style={{ fontSize: 9, color: C.amber, background: C.amber + "18", padding: "1px 7px", borderRadius: 4, fontWeight: 700 }}>{a._count}x</span>}
                </div>
                <div style={{ fontSize: 13, color: C.text }}>{a.msg}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.muted, fontSize: 12, whiteSpace: "nowrap", fontWeight: 600 }}>{a.buyer}</span>
                <button
                  onClick={() => dismiss(a.id)}
                  title="Dismiss"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 2, display: "flex", alignItems: "center", borderRadius: 4 }}
                  onMouseEnter={e => e.currentTarget.style.color = C.red}
                  onMouseLeave={e => e.currentTarget.style.color = C.muted}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
export default TabAlerts;
