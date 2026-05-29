import { useState, useEffect } from "react";
import {
  UserPlus, Shield, AlertTriangle, CheckCircle2,
  BarChart2, Info, Upload, Download, FileText, Check,
} from "lucide-react";
import { C } from "../../data/theme.js";
import { Card, Heading, EmptyState } from "../ui/Primitives.jsx";
import { fetchUsers, inviteUser, updateUserRole, toggleUserActive, deleteUser, fetchTariff, apiPost } from "../../services/api.js";

const ROLES = ["admin", "manager", "sales", "production", "viewer"];
const ROLE_COLORS = { admin: C.red, manager: C.gold, sales: C.green, production: C.blue, viewer: C.muted };
const ROLE_DESC = {
  admin: "Full access — manage users, data, settings",
  manager: "Read + write all data, create quotes",
  sales: "Read all data + create quotes",
  production: "Read-only access",
  viewer: "Read-only access",
};

const HS_CODES = ['3924','4419','4420','4602','6911','6912','7013','7323','7418','7615','8215'];
const HS_LABELS = {
  '3924': 'Plastic', '4419': 'Wood Kitchenware', '4420': 'Wood Ornamental',
  '4602': 'Bamboo', '6911': 'Ceramic Tableware', '6912': 'Ceramic Kitchenware',
  '7013': 'Glass', '7323': 'Steel/Iron', '7418': 'Copper', '7615': 'Aluminum', '8215': 'Combo'
};
const COUNTRIES = ['USA','GBR','DEU','NLD','FRA','SWE','AUS','CAN','JPN','ARE','SAU','SGP','NZL'];
const COUNTRY_NAMES = {
  USA:'United States', GBR:'United Kingdom', DEU:'Germany', NLD:'Netherlands',
  FRA:'France', SWE:'Sweden', AUS:'Australia', CAN:'Canada', JPN:'Japan',
  ARE:'UAE', SAU:'Saudi Arabia', SGP:'Singapore', NZL:'New Zealand'
};

const TabAdmin = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [invError, setInvError] = useState("");
  const [invSuccess, setInvSuccess] = useState("");

  // Tariff Manager
  const [showTariff, setShowTariff] = useState(false);
  const [tariffCountry, setTariffCountry] = useState("USA");
  const [tariffHS, setTariffHS] = useState("4419");
  const [tariffMFN, setTariffMFN] = useState("");
  const [tariffPref, setTariffPref] = useState("");
  const [tariffScheme, setTariffScheme] = useState("");
  const [tariffNote, setTariffNote] = useState("");
  const [tariffHasFTA, setTariffHasFTA] = useState(false);
  const [tariffSaving, setTariffSaving] = useState(false);
  const [tariffMsg, setTariffMsg] = useState("");
  const [tariffError, setTariffError] = useState("");
  const [tariffList, setTariffList] = useState([]);
  const [tariffListLoading, setTariffListLoading] = useState(false);

  // Products CSV Upload
  const [showProducts, setShowProducts] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");
  const [csvError, setCsvError] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      const res = await fetchUsers({ limit: 100 });
      setUsers(res?.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTariffList() {
    setTariffListLoading(true);
    try {
      const res = await fetchTariff(tariffCountry, "");
      setTariffList(res?.data || []);
    } catch { setTariffList([]); }
    finally { setTariffListLoading(false); }
  }

  async function loadTariffForEdit() {
    try {
      const res = await fetchTariff(tariffCountry, tariffHS);
      if (res?.data?.length > 0) {
        const t = res.data[0];
        setTariffMFN(t.mfn_rate ?? '');
        setTariffPref(t.preferential_rate ?? '');
        setTariffScheme(t.scheme ?? '');
        setTariffNote(t.note ?? '');
        setTariffHasFTA(t.has_fta ?? false);
      } else {
        setTariffMFN(''); setTariffPref(''); setTariffScheme(''); setTariffNote(''); setTariffHasFTA(false);
      }
    } catch { }
  }

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (showTariff) { loadTariffList(); } }, [showTariff, tariffCountry]);
  useEffect(() => { if (showTariff) loadTariffForEdit(); }, [tariffCountry, tariffHS, showTariff]);


  async function handleLogoutAll() {
    if (!window.confirm('Logout from all devices and sessions?')) return;
    try {
      const { supabase } = await import('../../lib/supabase.js');
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/';
    } catch(err) {
      alert('Logout failed: ' + err.message);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true); setInvError(""); setInvSuccess("");
    try {
      await inviteUser({ name: invName, email: invEmail, role: invRole });
      setInvSuccess(`Invited ${invEmail} as ${invRole}.`);
      setInvName(""); setInvEmail(""); setInvRole("viewer");
      loadUsers();
    } catch (err) {
      setInvError(err.message || "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function handleTariffSave() {
    if (!tariffMFN) { setTariffError("MFN Rate required"); return; }
    setTariffSaving(true); setTariffMsg(""); setTariffError("");
    try {
      await apiPost('/tariffs/upsert', {
        country_code: tariffCountry,
        hs_code: tariffHS,
        mfn_rate: parseFloat(tariffMFN),
        preferential_rate: tariffPref !== '' ? parseFloat(tariffPref) : parseFloat(tariffMFN),
        scheme: tariffScheme || 'MFN',
        note: tariffNote,
        has_fta: tariffHasFTA,
        confidence: 'VERIFIED',
        data_source: 'admin_manual_update',
      });
      setTariffMsg(`Tariff updated: ${tariffCountry} HS${tariffHS} → ${tariffMFN}% MFN`);
      loadTariffList();
    } catch (err) {
      setTariffError(err.message || "Update failed");
    } finally {
      setTariffSaving(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try { await updateUserRole(userId, newRole); loadUsers(); }
    catch (err) { alert("Role update failed: " + err.message); }
  }

  async function handleToggle(userId, currentActive) {
    if (!confirm(`${currentActive ? "Block" : "Unblock"} this user?`)) return;
    try { await toggleUserActive(userId); loadUsers(); }
    catch (err) { alert("Toggle failed: " + err.message); }
  }

  async function handleDelete(userId, name) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    try { await deleteUser(userId); loadUsers(); }
    catch (err) { alert("Delete failed: " + err.message); }
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
    return lines.slice(1).map(line => {
      const values = []; let current = ''; let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
        current += char;
      }
      values.push(current.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      if (obj.wood_types) obj.wood_types = obj.wood_types.split(',').map(w => w.trim()).filter(Boolean);
      return obj;
    }).filter(row => row.name);
  }

  function handleCSVFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name); setCsvMsg(""); setCsvError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseCSV(evt.target.result);
      setCsvData(parsed);
      if (parsed.length === 0) setCsvError("No valid rows found in CSV");
    };
    reader.readAsText(file);
  }

  async function handleCSVUpload() {
    if (csvData.length === 0) return;
    setCsvUploading(true); setCsvMsg(""); setCsvError("");
    try {
      const res = await apiPost('/products/bulk', { products: csvData });
      setCsvMsg("\u2705 " + (res.message || 'Upload complete'));
      if (res.errors?.length) setCsvError("\u26a0\ufe0f " + res.errors.length + " rows had issues: " + res.errors.slice(0,3).join('; '));
    } catch (err) {
      setCsvError("\u274c Upload failed: " + err.message);
    } finally { setCsvUploading(false); }
  }

  function downloadTemplate() {
    const t = "name,hs_code,category,material,wood_types,weight_kg,dimensions,fob_range_min,fob_range_max,unit,notes\n" +
      'Chopping Board,4419,Cutting Board,wood,"Acacia,Mango,Sheesham",0.8,"12\u00d78\u00d71.5 inch",4.5,12,piece,\n' +
      'Serving Tray,4419,Serving,wood,"Acacia,Mango",1.2,"18\u00d712\u00d72 inch",5,14,piece,\n' +
      'Cast Iron Skillet,7323,Cookware,steel,,3.5,"12 inch dia",8,18,piece,';
    const blob = new Blob([t], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'products-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const inputStyle = { width: "100%", background: "#161616", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13 };
  const selectStyle = { ...inputStyle, cursor: "pointer" };

  return (
    <div>
      <Heading sub={`${users.length} users — Invite only, you control access`}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Shield size={20} color={C.gold} strokeWidth={1.75} /> Admin Panel</span></Heading>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => { setShowInvite(!showInvite); setShowTariff(false); setShowProducts(false); }} style={{
          background: showInvite ? "#333" : `linear-gradient(135deg, ${C.gold}, #b8862d)`,
          color: showInvite ? C.muted : C.bg, border: "none", padding: "10px 24px",
          borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>
          {showInvite ? "Cancel" : "+ Invite New User"}
        </button>
          <button onClick={handleLogoutAll} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444',
            cursor: 'pointer', marginLeft: 8,
          }}>
            Logout All Sessions
          </button>
        <button onClick={() => { setShowTariff(!showTariff); setShowInvite(false); setShowProducts(false); }} style={{
          background: showTariff ? "#333" : `linear-gradient(135deg, ${C.blue}, #1d4ed8)`,
          color: showTariff ? C.muted : "#fff", border: "none", padding: "10px 24px",
          borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>
          {showTariff ? "Cancel" : "Update Tariff Rates"}
        </button>
        <button onClick={() => { setShowProducts(!showProducts); setShowInvite(false); setShowTariff(false); }} style={{
          background: showProducts ? "#333" : `linear-gradient(135deg, ${C.green}, #16a34a)`,
          color: showProducts ? C.muted : "#fff", border: "none", padding: "10px 24px",
          borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>
          {showProducts ? "Cancel" : "Upload Products CSV"}
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <Card style={{ marginBottom: 20, borderLeft: `3px solid ${C.gold}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gold, marginBottom: 14 }}>Invite New User</div>
          <form onSubmit={handleInvite}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Name</div>
                <input value={invName} onChange={e => setInvName(e.target.value)} required style={inputStyle} placeholder="Full Name" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Email</div>
                <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} required style={inputStyle} placeholder="email@company.com" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Role</div>
                <select value={invRole} onChange={e => setInvRole(e.target.value)} style={inputStyle}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="submit" disabled={inviting} style={{
                  width: "100%", padding: "10px 20px", background: C.gold, border: "none",
                  borderRadius: 8, color: C.bg, fontWeight: 800, fontSize: 13, cursor: "pointer",
                }}>
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </div>
          </form>
          {invError && <div style={{ color: C.red, fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} strokeWidth={2} /> {invError}</div>}
          {invSuccess && <div style={{ color: C.green, fontSize: 12, marginTop: 8, padding: "8px 12px", background: C.green + "10", borderRadius: 6 }}>{invSuccess}</div>}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, display: "flex", alignItems: "flex-start", gap: 5 }}>
            <AlertTriangle size={12} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> After inviting here, also create the user in Supabase Auth Dashboard with the same email address.
          </div>
        </Card>
      )}

      {/* Tariff Manager */}
      {showTariff && (
        <Card style={{ marginBottom: 20, borderLeft: `3px solid ${C.blue}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.blue, marginBottom: 4 }}>Tariff Rate Manager</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            <strong style={{color:C.gold}}>Ye India ka export tariff hai</strong> — jab US/UK/EU India se import karta hai tab India ko kitna duty dena padta hai.<br/>
            Example: US ne India pe 18% lagaya (Feb 2026) → Quote Builder mein automatically reflect hoga.<br/>
            <span style={{ color: C.amber, fontWeight: 700 }}>Sirf India ke rates yahan update karo</span> — China/Vietnam ke rates code mein hain.
          </div>

          {/* Competitor Reference — so admin knows context when updating */}
          {(() => {
            const COMPETITOR_REF = {
              USA: { china: 30, vietnam: 10, indonesia: 10, note: 'US-China deal Nov 2025 / US-India Feb 2026' },
              GBR: { china: 12, vietnam: 12, indonesia: 12, note: 'UK MFN rate for all 3' },
              DEU: { china: 20, vietnam: 12, indonesia: 20, note: 'China: EU MFN. Vietnam: EVFTA. Indonesia: EU MFN' },
              NLD: { china: 20, vietnam: 12, indonesia: 20, note: 'Same as DEU — all EU27' },
              FRA: { china: 20, vietnam: 12, indonesia: 20, note: 'Same as DEU — all EU27' },
              SWE: { china: 20, vietnam: 12, indonesia: 20, note: 'Same as DEU — all EU27' },
              AUS: { china: 5, vietnam: 5, indonesia: 5, note: 'AANZFTA applies to Vietnam & Indonesia. China: MFN 5%' },
              CAN: { china: 25, vietnam: 0, indonesia: 6.5, note: 'China: 25% surtax. Vietnam: CPTPP 0%. Indonesia: MFN' },
              JPN: { china: 3.9, vietnam: 0, indonesia: 0, note: 'Vietnam & Indonesia: 0% via CPTPP/IJEPA. China: MFN' },
              ARE: { china: 5, vietnam: 5, indonesia: 5, note: 'GCC MFN 5% for all — India only 0% via CEPA' },
              SAU: { china: 5, vietnam: 5, indonesia: 5, note: 'GCC MFN 5% for all — no FTA advantage for India here' },
              SGP: { china: 0, vietnam: 0, indonesia: 0, note: 'Singapore: 0% for everyone — free trade hub' },
              NZL: { china: 0, vietnam: 0, indonesia: 5, note: 'China: 0% via NZ-China FTA. Vietnam: AANZFTA 0%' },
            };
            const ref = COMPETITOR_REF[tariffCountry];
            if (!ref) return null;
            return (
              <div style={{ padding: '12px 14px', background: '#0a0a0a', borderRadius: 8, marginBottom: 16, fontSize: 11 }}>
                <div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><BarChart2 size={13} strokeWidth={2} /> Competitor Tariff Reference — {COUNTRY_NAMES[tariffCountry]} (HS 4419)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                  {[
                    { flag: '🇨🇳', label: 'China', rate: ref.china },
                    { flag: '🇻🇳', label: 'Vietnam', rate: ref.vietnam },
                    { flag: '🇮🇩', label: 'Indonesia', rate: ref.indonesia },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#111', padding: '8px 10px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: C.muted }}>{c.flag} {c.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: c.rate > 20 ? C.red : c.rate > 5 ? C.amber : C.green }}>{c.rate}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>{ref.note}</div>
              </div>
            );
          })()}

          {/* Select Country + HS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Country</div>
              <select value={tariffCountry} onChange={e => setTariffCountry(e.target.value)} style={selectStyle}>
                {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_NAMES[c]} ({c})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>HS Code</div>
              <select value={tariffHS} onChange={e => setTariffHS(e.target.value)} style={selectStyle}>
                {HS_CODES.map(hs => <option key={hs} value={hs}>HS {hs} — {HS_LABELS[hs]}</option>)}
              </select>
            </div>
          </div>

          {/* Tariff Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>MFN Rate (%) *</div>
              <input type="number" step="0.1" value={tariffMFN} onChange={e => setTariffMFN(e.target.value)}
                placeholder="e.g. 26" style={{ ...inputStyle, color: C.gold }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Preferential Rate (%)</div>
              <input type="number" step="0.1" value={tariffPref} onChange={e => setTariffPref(e.target.value)}
                placeholder="e.g. 0 (FTA rate)" style={{ ...inputStyle, color: C.green }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Scheme / Agreement</div>
              <input value={tariffScheme} onChange={e => setTariffScheme(e.target.value)}
                placeholder="e.g. UK DCTS, MFN, Trump 2025" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Note</div>
              <input value={tariffNote} onChange={e => setTariffNote(e.target.value)}
                placeholder="e.g. 90-day pause active" style={inputStyle} />
            </div>
          </div>

          {/* FTA Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="checkbox" id="hasFTA" checked={tariffHasFTA} onChange={e => setTariffHasFTA(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }} />
            <label htmlFor="hasFTA" style={{ fontSize: 12, color: C.text, cursor: "pointer" }}>
              FTA Active (India has preferential rate advantage)
            </label>
          </div>

          {/* Save Button */}
          <button onClick={handleTariffSave} disabled={tariffSaving} style={{
            background: `linear-gradient(135deg, ${C.blue}, #1d4ed8)`, color: "#fff",
            border: "none", padding: "10px 28px", borderRadius: 8,
            fontWeight: 800, fontSize: 13, cursor: "pointer", marginBottom: 12,
          }}>
            {tariffSaving ? "Saving..." : "Save Tariff Rate"}
          </button>

          {tariffMsg && <div style={{ color: C.green, fontSize: 12, padding: "8px 12px", background: C.green + "10", borderRadius: 6, marginBottom: 8 }}>{tariffMsg}</div>}
          {tariffError && <div style={{ color: C.red, fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} strokeWidth={2} /> {tariffError}</div>}

          {/* Current Tariffs for Selected Country */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              Current Tariffs — {COUNTRY_NAMES[tariffCountry]}
            </div>
            {tariffListLoading ? (
              <div style={{ fontSize: 11, color: C.muted }}>Loading...</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["HS Code", "Material", "MFN %", "Pref %", "Scheme", "FTA"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: C.muted, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tariffList.map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid #161616`,
                        background: t.hs_code === tariffHS ? C.blue + "08" : "transparent" }}
                        onClick={() => setTariffHS(t.hs_code)}
                        onMouseEnter={e => e.currentTarget.style.cursor = "pointer"}
                      >
                        <td style={{ padding: "6px 10px", color: C.gold, fontWeight: 700 }}>{t.hs_code}</td>
                        <td style={{ padding: "6px 10px", color: C.muted }}>{HS_LABELS[t.hs_code] || t.hs_code}</td>
                        <td style={{ padding: "6px 10px", color: C.text, fontWeight: 700 }}>{t.mfn_rate ?? '—'}%</td>
                        <td style={{ padding: "6px 10px", color: t.has_fta ? C.green : C.muted }}>{t.preferential_rate ?? '—'}%</td>
                        <td style={{ padding: "6px 10px", color: C.muted }}>{t.scheme}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{ color: t.has_fta ? C.green : C.muted, fontWeight: 700 }}>
                            {t.has_fta ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: C.green }}><Check size={11} strokeWidth={2.5} /> FTA</span> : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, display: "flex", alignItems: "flex-start", gap: 5 }}><Info size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> Tip: Click any row to load it for editing. Changes reflect immediately in Quote Builder tariff section.</div>
          </div>
        </Card>
      )}

      {/* Products CSV Upload */}
      {showProducts && (
        <Card style={{ marginBottom: 20, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.green, marginBottom: 4 }}>Product Catalog Manager</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Upload your product catalog via CSV. Products will appear in Quote Builder dropdown. Existing products with same name will be updated (not duplicated).
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ background: "#161616", border: `1px dashed ${C.green}40`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 12, color: C.green, fontWeight: 700 }}>
              <FileText size={13} strokeWidth={2} /> Choose CSV File
              <input type="file" accept=".csv" onChange={handleCSVFile} style={{ display: "none" }} />
            </label>
            {csvFileName && <span style={{ fontSize: 11, color: C.muted }}>{csvFileName} — {csvData.length} products</span>}
            <button onClick={downloadTemplate} style={{ background: "none", border: `1px solid ${C.blue}40`, color: C.blue, padding: "8px 16px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              <Download size={13} strokeWidth={2} /> Download Template CSV
            </button>
          </div>

          {csvData.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Preview — {csvData.length} products</div>
              <div style={{ overflowX: "auto", marginBottom: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Name", "HS", "Category", "Material", "Weight", "FOB Range", "Unit"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: C.muted, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #161616" }}>
                        <td style={{ padding: "6px 8px", color: C.text, fontWeight: 700 }}>{p.name}</td>
                        <td style={{ padding: "6px 8px", color: C.gold }}>{p.hs_code}</td>
                        <td style={{ padding: "6px 8px", color: C.muted }}>{p.category}</td>
                        <td style={{ padding: "6px 8px", color: C.blue }}>{p.material}</td>
                        <td style={{ padding: "6px 8px", color: C.muted }}>{p.weight_kg}kg</td>
                        <td style={{ padding: "6px 8px", color: C.green }}>${p.fob_range_min}–${p.fob_range_max}</td>
                        <td style={{ padding: "6px 8px", color: C.muted }}>{p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 20 && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>+ {csvData.length - 20} more...</div>}
              </div>
              <button onClick={handleCSVUpload} disabled={csvUploading} style={{
                background: `linear-gradient(135deg, ${C.green}, #16a34a)`, color: "#fff",
                border: "none", padding: "10px 28px", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}>
                {csvUploading ? "Uploading..." : <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Upload size={13} strokeWidth={2} /> Upload {csvData.length} Products to Database</span>}
              </button>
            </div>
          )}

          {csvMsg && <div style={{ color: C.green, fontSize: 12, marginTop: 10, padding: "8px 12px", background: C.green + "10", borderRadius: 6 }}>{csvMsg}</div>}
          {csvError && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{csvError}</div>}
          <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><Info size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> CSV columns: name, hs_code, category, material, wood_types, weight_kg, dimensions, fob_range_min, fob_range_max, unit, notes. Put multiple wood types in quotes: "Acacia,Mango,Sheesham"</div>
          </div>
        </Card>
      )}

      {/* Role Legend */}
      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ROLES.map(r => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ROLE_COLORS[r] }} />
              <span style={{ fontSize: 11, color: C.text, fontWeight: 700, textTransform: "capitalize" }}>{r}</span>
              <span style={{ fontSize: 10, color: C.muted }}>— {ROLE_DESC[r]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Users Table */}
      {error && <Card style={{ borderColor: C.red + "30", marginBottom: 16 }}><div style={{ color: C.red, fontSize: 12 }}>Failed to load users: {error}</div></Card>}
      {!loading && users.length === 0 && (
        <EmptyState icon={UserPlus} title="No users yet" message="Invite your first team member using the button above." />
      )}

      {users.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: C.muted, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid #161616` }}>
                  <td style={{ padding: "10px 12px", color: C.text, fontWeight: 700 }}>{u.name}</td>
                  <td style={{ padding: "10px 12px", color: C.muted }}>{u.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={{
                      background: ROLE_COLORS[u.role] + "20", color: ROLE_COLORS[u.role],
                      border: `1px solid ${ROLE_COLORS[u.role]}40`, borderRadius: 6,
                      padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      background: u.is_active ? C.green + "20" : C.red + "20",
                      color: u.is_active ? C.green : C.red,
                      fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                    }}>
                      {u.is_active ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.muted, fontSize: 11 }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleToggle(u.id, u.is_active)} style={{
                        background: "none", border: `1px solid ${u.is_active ? C.amber : C.green}40`,
                        color: u.is_active ? C.amber : C.green, padding: "4px 10px",
                        borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600,
                      }}>
                        {u.is_active ? "Block" : "Unblock"}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.name)} style={{
                        background: "none", border: `1px solid ${C.red}40`,
                        color: C.red, padding: "4px 10px",
                        borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600,
                      }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TabAdmin;
