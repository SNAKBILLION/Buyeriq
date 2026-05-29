// ─────────────────────────────────────────────
// BuyerIQ — PDF Export Utility
// ─────────────────────────────────────────────
const BRAND = { gold: '#d4a843', bg: '#0a0a0a', text: '#e5e5e5' };

function openPrintWindow(html, title) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF'); return; }
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  setTimeout(() => { win.print(); }, 500);
}

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans','Outfit','DM Sans','Segoe UI',Arial,sans-serif; color: #222; padding: 40px; font-size: 12px; line-height: 1.6; }
    h1 { font-size: 22px; color: #1a1a1a; border-bottom: 3px solid ${BRAND.gold}; padding-bottom: 8px; margin-bottom: 16px; }
    h2 { font-size: 16px; color: ${BRAND.gold}; margin: 20px 0 10px; }
    h3 { font-size: 13px; color: #555; margin: 12px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
    th { background: #f5f0e6; color: #333; text-align: left; padding: 8px 10px; border: 1px solid #ddd; font-weight: 700; }
    td { padding: 6px 10px; border: 1px solid #eee; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .brand { font-size: 9px; color: #999; text-align: right; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
    .card { border: 1px solid #eee; border-radius: 8px; padding: 12px; }
    .card-title { font-size: 12px; font-weight: 700; color: ${BRAND.gold}; margin-bottom: 8px; }
    .kv { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
    .kv-label { color: #888; }
    .kv-value { font-weight: 600; color: #222; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid ${BRAND.gold}; font-size: 9px; color: #999; text-align: center; }
    .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 10px; color: #92400e; margin: 10px 0; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
  `;
}

// ── Export Buyer Profile ──────────────────────────────────────────────
export function exportBuyerPDF(buyer, complianceRules = []) {
  if (!buyer) return;
  const scores = buyer.scores || {};
  const avgScore = Math.round(((scores.pay||0)+(scores.vol||0)+(scores.margin||0)+(scores.growth||0)+(scores.ease||0))/5);

  const html = `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="header">
      <div>
        <h1>${buyer.name}</h1>
        <div style="color:#666">${buyer.hq||''} · ${buyer.country||''}</div>
      </div>
      <div class="brand">
        <div style="font-size:14px;font-weight:800;color:${BRAND.gold}">BuyerIQ</div>
        <div>Senses Lifestyle Intelligence</div>
        <div>Generated: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Company Overview</div>
        <div class="kv"><span class="kv-label">Revenue</span><span class="kv-value">${buyer.revenue||'—'}</span></div>
        <div class="kv"><span class="kv-label">Tier</span><span class="kv-value">${(buyer.tier||'').toUpperCase()}</span></div>
        <div class="kv"><span class="kv-label">Stores</span><span class="kv-value">${buyer.stores||'—'}</span></div>
        <div class="kv"><span class="kv-label">Stock</span><span class="kv-value">${buyer.stock||buyer.stock_ticker||'—'}</span></div>
        <div class="kv"><span class="kv-label">Brands</span><span class="kv-value">${(buyer.brands||[]).join(', ')}</span></div>
      </div>
      <div class="card">
        <div class="card-title">Buyer Scorecard (Avg: ${avgScore}/100)</div>
        <div class="kv"><span class="kv-label">Payment</span><span class="kv-value">${scores.pay||0}/100</span></div>
        <div class="kv"><span class="kv-label">Volume</span><span class="kv-value">${scores.vol||0}/100</span></div>
        <div class="kv"><span class="kv-label">Margin</span><span class="kv-value">${scores.margin||0}/100</span></div>
        <div class="kv"><span class="kv-label">Growth</span><span class="kv-value">${scores.growth||0}/100</span></div>
        <div class="kv"><span class="kv-label">Ease of Business</span><span class="kv-value">${scores.ease||0}/100</span></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Product Intelligence</div>
        <div class="kv"><span class="kv-label">Wood Types</span><span class="kv-value">${(buyer.wood||[]).join(', ')}</span></div>
        <div class="kv"><span class="kv-label">Finishes</span><span class="kv-value">${(buyer.finish||[]).join(', ')}</span></div>
        <div class="kv"><span class="kv-label">Products</span><span class="kv-value">${(buyer.products||[]).join(', ')}</span></div>
        <div class="kv"><span class="kv-label">FOB Range</span><span class="kv-value">$${buyer.fob?.min||0} – $${buyer.fob?.max||0}</span></div>
        <div class="kv"><span class="kv-label">Sweet Spot</span><span class="kv-value">${buyer.fob?.sweet||'—'}</span></div>
      </div>
      <div class="card">
        <div class="card-title">Terms & Negotiation</div>
        <div class="kv"><span class="kv-label">Payment</span><span class="kv-value">${buyer.payment||'—'}</span></div>
        <div class="kv"><span class="kv-label">Lead Time</span><span class="kv-value">${buyer.leadTime||'—'}</span></div>
        <div class="kv"><span class="kv-label">MOQ</span><span class="kv-value">${buyer.moq||'—'}</span></div>
        <div class="kv"><span class="kv-label">Negotiation Style</span><span class="kv-value">${buyer.negotiation||'—'}</span></div>
      </div>
    </div>

    <h2>Compliance Requirements</h2>
    <table>
      <thead><tr><th>Law</th><th>Status</th></tr></thead>
      <tbody>${(complianceRules.filter(r=>(r.affected_buyer_slugs||[]).includes(buyer.slug||buyer.id))||[]).map(c=>`<tr><td><strong>${c.name}</strong>${c.summary ? '<br><span style="font-size:10px;color:#666">'+c.summary+'</span>' : ''}</td><td>⚠️ Verify before shipment</td></tr>`).join('') || '<tr><td colspan=2>No specific requirements</td></tr>'}</tbody>
    </table>

    <h2>Seasonal Ordering Pattern</h2>
    <table>
      <thead><tr><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th></tr></thead>
      <tbody><tr><td>${buyer.seasonal?.Q1||0}%</td><td>${buyer.seasonal?.Q2||0}%</td><td>${buyer.seasonal?.Q3||0}%</td><td>${buyer.seasonal?.Q4||0}%</td></tr></tbody>
    </table>



    ${(buyer.contacts&&buyer.contacts.length>0)?`
    <h2>Direct Contacts — Sourcing Team</h2>
    <table>
      <thead><tr><th>Name / Team</th><th>Title</th><th>Department</th><th>Email</th><th>Phone</th></tr></thead>
      <tbody>${buyer.contacts.map(c=>`<tr>
        <td><strong>${c.full_name||'—'}</strong></td><td>${c.job_title||'—'}</td>
        <td>${c.department||'—'}</td>
        <td>${c.email?`<a href="mailto:${c.email}">${c.email}</a>`:'—'}</td>
        <td>${c.phone||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>
    ${buyer.vendor_portal_url?`<p style="margin-top:8px"><strong>Vendor Portal:</strong> <a href="${buyer.vendor_portal_url}">${buyer.vendor_portal_url}</a></p>`:''}
    `:''}

    <div class="footer">BuyerIQ by Senses Lifestyle · Confidential · ${new Date().toLocaleDateString()} · Data: SEC filings, UN COMTRADE, company reports</div>
  </body></html>`;

  openPrintWindow(html, `BuyerIQ — ${buyer.name} Profile`);
}

// ── Export Quote PDF ──────────────────────────────────────────────────
export function exportQuotePDF({ buyer, product, wood, qty, fob, inrRate, totalUSD, totalINR, weightKg, cbm, containers20, estRetail: _estRetail, buyerMarginPct: _buyerMarginPct, complianceCheck, retailBenchmark }) {
  if (!buyer || !product) return;
  // Use live retail benchmark if available, else fallback
  const usRetail = retailBenchmark?.platforms?.find(p => p.pl === 'amazon')?.avg;
  const estRetail = _estRetail || (usRetail ? parseFloat(usRetail) : fob * (parseFloat(buyer.fob?.mult)||3.5));
  const buyerMarginPct = _buyerMarginPct || (estRetail > 0 ? Math.round((1 - fob/estRetail)*100) : 0);
  const chinaFOB = parseFloat(product?.china_fob_avg || 0);
  const vietnamFOB = parseFloat(product?.vietnam_fob_avg || 0);

  const html = `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="header">
      <div><h1>Export Quote</h1><div style="color:#666">${buyer.name} — ${product.name}</div></div>
      <div class="brand">
        <div style="font-size:14px;font-weight:800;color:${BRAND.gold}">BuyerIQ</div>
        <div>Senses Lifestyle · Moradabad, UP, India</div>
        <div>Date: ${new Date().toLocaleDateString()} · Status: DRAFT</div>
      </div>
    </div>

    <h2>Quote Details</h2>
    <div class="grid">
      <div class="card">
        <div class="card-title">Product</div>
        <div class="kv"><span class="kv-label">Product</span><span class="kv-value">${product.name}</span></div>
        <div class="kv"><span class="kv-label">Wood Type</span><span class="kv-value">${wood||product.woods?.[0]||'—'}</span></div>
        <div class="kv"><span class="kv-label">Quantity</span><span class="kv-value">${qty?.toLocaleString()} ${product.unit||'pcs'}</span></div>
        <div class="kv"><span class="kv-label">Incoterm</span><span class="kv-value">FOB Nhava Sheva</span></div>
      </div>
      <div class="card">
        <div class="card-title">Buyer</div>
        <div class="kv"><span class="kv-label">Company</span><span class="kv-value">${buyer.name}</span></div>
        <div class="kv"><span class="kv-label">Country</span><span class="kv-value">${buyer.country}</span></div>
        <div class="kv"><span class="kv-label">Tier</span><span class="kv-value">${(buyer.tier||'').toUpperCase()}</span></div>
        <div class="kv"><span class="kv-label">Payment Terms</span><span class="kv-value">${buyer.payment||'—'}</span></div>
      </div>
    </div>

    <h2>Pricing</h2>
    <table>
      <thead><tr><th>Item</th><th>USD</th><th>INR</th></tr></thead>
      <tbody>
        <tr><td>FOB per unit</td><td><strong>$${fob?.toFixed(2)}</strong></td><td>₹${(fob*inrRate)?.toFixed(0)}</td></tr>
        <tr><td>Total Order Value</td><td><strong>$${totalUSD?.toLocaleString()}</strong></td><td>₹${(totalINR/100000)?.toFixed(1)}L</td></tr>
        <tr><td>Exchange Rate</td><td colspan="2">1 USD = ₹${inrRate?.toFixed(2)}</td></tr>
      </tbody>
    </table>

    <h2>Logistics</h2>
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Estimated Weight</td><td>${(weightKg/1000)?.toFixed(1)} MT (${weightKg?.toFixed(0)} kg)</td></tr>
        <tr><td>Estimated CBM</td><td>${cbm?.toFixed(0)} CBM</td></tr>
        <tr><td>Containers (20')</td><td>${containers20} × 20' FCL</td></tr>
      </tbody>
    </table>

    <h2>Margin Analysis</h2>
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Est. Retail Price</td><td>$${estRetail?.toFixed(2)}</td></tr>
        <tr><td>Buyer Margin</td><td>${buyerMarginPct}%</td></tr>
        <tr><td>Retail Multiple</td><td>${usRetail && fob ? (parseFloat(usRetail)/fob).toFixed(1)+'×' : buyer.fob?.mult||'3–4×'} (Amazon US)</td></tr>
      </tbody>
    </table>

    ${retailBenchmark?.platforms?.length > 0 ? `
    <h2>Retail Price by Market</h2>
    <table>
      <thead><tr><th>Platform</th><th>Avg Retail</th><th>Products</th><th>Buyer Margin at $${fob?.toFixed(2)} FOB</th></tr></thead>
      <tbody>
        ${retailBenchmark.platforms.map(p => `<tr><td>${p.label}</td><td>${p.cur}${p.avg}</td><td>${p.count.toLocaleString()}</td><td style="color:${parseInt(p.margin)>60?'#16a34a':'#ca8a04'};font-weight:700">${p.margin}%</td></tr>`).join('')}
      </tbody>
    </table>` : ''}

    <h2>Competitive Benchmark</h2>
    <table>
      <thead><tr><th>Origin</th><th>FOB Range</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:700;color:${BRAND.gold}">Senses Lifestyle (Your Quote)</td><td>$${fob?.toFixed(2)}</td><td>Moradabad, India</td></tr>
        <tr><td>China Average</td><td>${chinaFOB > 0 ? '$'+chinaFOB.toFixed(2)+' (DB avg)' : '$3.50 – $7.00'}</td><td>Lower cost, compliance risk</td></tr>
        <tr><td>Vietnam</td><td>${vietnamFOB > 0 ? '$'+vietnamFOB.toFixed(2)+' (DB avg)' : '$3.80 – $8.00'}</td><td>Growing competitor</td></tr>
        <tr><td>Indonesia</td><td>$4.00 – $9.00</td><td>Teak focused</td></tr>
        <tr><td>Indian Rival (Saharanpur)</td><td>$3.50 – $9.00</td><td>Direct competition</td></tr>
      </tbody>
    </table>

    ${complianceCheck?.length>0?`
    <h2>Compliance Checklist</h2>
    <table>
      <thead><tr><th>Requirement</th><th>Status</th></tr></thead>
      <tbody>${complianceCheck.map(c=>`<tr><td>${c.name}</td><td>${c.status}</td></tr>`).join('')}</tbody>
    </table>`:''}

    <div class="footer">Draft quote by BuyerIQ · Prices indicative · Senses Lifestyle · Moradabad, UP, India · ${new Date().toLocaleDateString()}</div>
  </body></html>`;

  openPrintWindow(html, `Quote — ${buyer.name} — ${product.name}`);
}

// ── Export Trade Intel PDF ────────────────────────────────────────────
export function exportTradeIntelPDF({ stats, comp, seasonalRaw, selectedHS, latestFullYear, HS_LABELS, MONTHS }) {
  const hsLabel = selectedHS?(HS_LABELS[selectedHS]||selectedHS):'All HS Codes';
  const peak = seasonalRaw?.reduce((max,r)=>r.total>(max?.total||0)?r:max,null);

  const html = `<!DOCTYPE html><html><head><style>${baseStyles()}
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:16px 0; }
    .kpi { border:1px solid #ddd; border-radius:8px; padding:12px; text-align:center; }
    .kpi-val { font-size:20px; font-weight:800; color:#d4a05a; }
    .kpi-label { font-size:10px; color:#888; margin-top:4px; text-transform:uppercase; }
    .action-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0; }
    .action-card { border-radius:6px; padding:10px; border:1px solid #eee; }
    .action-month { font-size:10px; font-weight:800; color:#d4a05a; }
    .action-text { font-size:10px; color:#666; margin-top:4px; line-height:1.4; }
  </style></head><body>

    <div class="header">
      <div><h1>Market Intelligence Report</h1><div style="color:#666">US Market Analysis · ${hsLabel} · ${latestFullYear}</div></div>
      <div class="brand"><div style="font-size:14px;font-weight:800;color:#d4a05a">BuyerIQ</div><div>Senses Lifestyle</div><div>${new Date().toLocaleDateString()}</div></div>
    </div>

    <h2>Key Performance Indicators</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">$${Math.round(stats.latestTotal/1000000)}M</div><div class="kpi-label">US Total Imports ${latestFullYear}</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#22c55e">${comp.india.pct}%</div><div class="kpi-label">India Market Share</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#ef4444">${comp.china.pct}%</div><div class="kpi-label">China Share (30% Tariff)</div></div>
      <div class="kpi"><div class="kpi-val">$${Math.round((comp.china.v-comp.india.v)/1000000)}M</div><div class="kpi-label">India Opportunity Gap</div></div>
    </div>

    <h2>Tariff Advantage</h2>
    <table>
      <thead><tr><th>Country</th><th>US Tariff</th><th>Imports ${latestFullYear}</th><th>Advantage</th></tr></thead>
      <tbody>
        <tr style="background:#f0fdf4"><td><strong>India (YOU)</strong></td><td style="color:green"><strong>18% (Feb 2026)</strong></td><td>$${Math.round(comp.india.v/1000000)}M</td><td style="color:green">✅ Strong</td></tr>
        <tr><td>China</td><td style="color:red"><strong>30%</strong></td><td>$${Math.round(comp.china.v/1000000)}M</td><td style="color:red">❌ Heavily taxed</td></tr>
        <tr><td>Vietnam</td><td>10%</td><td>$${Math.round(comp.vietnam.v/1000000)}M</td><td>⚠️ Moderate</td></tr>
        <tr><td>Indonesia</td><td>0%</td><td>$${Math.round(comp.indonesia.v/1000000)}M</td><td>⚠️ Competitor</td></tr>
        <tr><td>Thailand</td><td>10%</td><td>$${Math.round(comp.thailand.v/1000000)}M</td><td>⚠️ Competitor</td></tr>
      </tbody>
    </table>

    ${seasonalRaw?.length>0?`
    <h2>Seasonal Intelligence — ${hsLabel}</h2>
    <p style="color:#666;font-size:11px;margin-bottom:10px">Monthly US import patterns · Peak month: <strong>${peak?MONTHS[peak.month-1]:'—'}</strong> ($${peak?Math.round(peak.total/1000000*10)/10:0}M)</p>
    <table>
      <thead><tr><th>Month</th><th>US Imports</th><th>Season</th><th>Action</th></tr></thead>
      <tbody>${seasonalRaw.map(r=>{
        const month=MONTHS[r.month-1];
        const valM=Math.round(r.total/1000000*10)/10;
        const isPeak=r.month===peak?.month;
        const season=r.month>=10?'PEAK':r.month>=7?'High':r.month>=4?'Ramp':'Low';
        const action=r.month>=10?'Deliver on time':r.month>=7?'Push for PO':r.month>=4?'Send samples':'Negotiate pricing';
        return `<tr ${isPeak?'style="background:#fef3c7;font-weight:700"':''}><td>${month}${isPeak?' 🏆':''}</td><td>$${valM}M</td><td>${season}</td><td>${action}</td></tr>`;
      }).join('')}</tbody>
    </table>

    <h2>Buyer Pitch Action Plan</h2>
    <div class="action-grid">
      ${peak?(()=>{
        const pm=peak.month;
        const m=offset=>MONTHS[(pm-offset+12)%12];
        return [
          {m:m(4),action:"Send product catalog & samples",color:"#dbeafe"},
          {m:m(3),action:"Follow up — confirm interest & MOQ",color:"#fef3c7"},
          {m:m(2),action:"Push for PO — peak orders now!",color:"#fed7aa"},
          {m:m(0),action:`Deliver — PEAK month ($${Math.round(peak.total/1000000*10)/10}M)`,color:"#fef9c3"},
        ].map(a=>`<div class="action-card" style="background:${a.color}"><div class="action-month">${a.m}</div><div class="action-text">${a.action}</div></div>`).join('');
      })():''}
    </div>`:''}

    <div class="footer">BuyerIQ by Senses Lifestyle · Confidential · ${new Date().toLocaleDateString()} · Data: US Census Bureau, UN COMTRADE</div>
  </body></html>`;

  openPrintWindow(html, `BuyerIQ — Market Intelligence Report`);
}

// ── Export Trade Data Summary PDF ────────────────────────────────────
export function exportTradeDataPDF({ filteredData, tableSource, tableHS, tableYear, tableCountry, HS_LABELS, NAMES, MONTHS, isPartial }) {
  const filterInfo = [
    tableSource!=="all"?(tableSource==="census_bureau"?"Census Bureau":"COMTRADE"):"All Sources",
    tableHS!=="all"?tableHS+" — "+(HS_LABELS[tableHS]||tableHS):"All HS Codes",
    tableYear!=="all"?tableYear:"All Years",
    tableCountry!=="all"?(NAMES[tableCountry]||tableCountry):"All Countries",
  ].join(" · ");

  const totalVal = filteredData.reduce((s,t)=>s+(parseFloat(t.trade_value_usd)||0),0);

  // ✅ FIX: Source-aware country grouping
  // Census: partner_country = who exported TO USA (origin country)
  // COMTRADE: reporter_country = who is exporting (origin country)
  const byOrigin = {};
  filteredData.forEach(t => {
    const origin = t.data_source==="comtrade"
      ? (t.reporter_country||"Unknown")
      : (t.partner_country||"Unknown");
    if (!byOrigin[origin]) byOrigin[origin]={total:0,records:0,source:t.data_source};
    byOrigin[origin].total  += parseFloat(t.trade_value_usd)||0;
    byOrigin[origin].records++;
  });

  const byHS = {};
  filteredData.forEach(t=>{const h=t.hs_code?.substring(0,4)||"?"; byHS[h]=(byHS[h]||0)+(parseFloat(t.trade_value_usd)||0);});
  const hsRows = Object.entries(byHS).sort((a,b)=>b[1]-a[1])
    .map(([h,v])=>`<tr><td>${h}</td><td>${HS_LABELS[h]||h}</td><td>$${(v/1000000).toFixed(2)}M</td></tr>`).join("");

  // ── Census HS × Country matrix ──────────────────────────────
  const censusData = filteredData.filter(t=>t.data_source==="census_bureau");
  const hsCountryMatrix = {};
  censusData.forEach(t=>{
    const h=t.hs_code?.substring(0,4)||"?";
    const c=t.partner_country||"Unknown";
    if(!HS_LABELS[h]) return;
    if(!hsCountryMatrix[h]) hsCountryMatrix[h]={};
    hsCountryMatrix[h][c]=(hsCountryMatrix[h][c]||0)+(parseFloat(t.trade_value_usd)||0);
  });
  const hsMatrixRows = Object.entries(hsCountryMatrix)
    .sort((a,b)=>Object.values(b[1]).reduce((s,v)=>s+v,0)-Object.values(a[1]).reduce((s,v)=>s+v,0))
    .map(function(entry){
      const hs=entry[0], countries=entry[1];
      const india=countries["IND"]||0;
      const china=countries["CHN"]||0;
      const vietnam=countries["VNM"]||0;
      const indiaRatio=china>0?Math.round(india/china*100):0;
      const rowBg=indiaRatio<10?"background:#fef2f2":indiaRatio<30?"background:#fffbeb":"";
      const ratioColor=indiaRatio<10?"#ef4444":indiaRatio<30?"#f59e0b":"#22c55e";
      const vnm=vietnam>0?"$"+(vietnam/1e6).toFixed(1)+"M":"—";
      return "<tr style='"+rowBg+"'>"
        +"<td><strong>"+hs+"</strong></td>"
        +"<td>"+(HS_LABELS[hs]||hs)+"</td>"
        +"<td style='color:#22c55e;font-weight:700'>$"+(india/1e6).toFixed(1)+"M</td>"
        +"<td style='color:#ef4444;font-weight:700'>$"+(china/1e6).toFixed(1)+"M</td>"
        +"<td>"+vnm+"</td>"
        +"<td style='font-weight:700;color:"+ratioColor+"'>"+indiaRatio+"%</td>"
        +"<td style='color:#d4a843'>$"+((china-india)/1e6).toFixed(0)+"M</td>"
        +"</tr>";
    }).join("");

  const byYear = {};
  filteredData.forEach(t=>{const y=t.year||"?"; byYear[y]=(byYear[y]||0)+(parseFloat(t.trade_value_usd)||0);});
  const yearRows = Object.keys(byYear).sort()
    .map(y=>`<tr><td>${y}${isPartial(y)?" (Partial)":""}</td><td>$${(byYear[y]/1000000).toFixed(2)}M</td></tr>`).join("");

  // Is this COMTRADE data? Then show India vs China market comparison
  const hasCOMTRADE = filteredData.some(t=>t.data_source==="comtrade");
  const hasCensus   = filteredData.some(t=>t.data_source==="census_bureau");

  // COMTRADE: India vs China by destination market
  const indiaByMarket = {}, chinaByMarket = {};
  if (hasCOMTRADE) {
    filteredData.filter(t=>t.data_source==="comtrade").forEach(t=>{
      const market = t.partner_country||"Unknown";
      if (t.reporter_country==="IND") indiaByMarket[market]=(indiaByMarket[market]||0)+(parseFloat(t.trade_value_usd)||0);
      if (t.reporter_country==="CHN") chinaByMarket[market]=(chinaByMarket[market]||0)+(parseFloat(t.trade_value_usd)||0);
    });
  }

  const MARKET_NAMES = {
    USA:"United States",GBR:"United Kingdom",DEU:"Germany",AUS:"Australia",
    ARE:"UAE",SAU:"Saudi Arabia",CAN:"Canada",JPN:"Japan",NLD:"Netherlands",
  };
  const INDIA_TARIFFS = {USA:"18%",GBR:"0% DCTS",DEU:"0% GSP+",AUS:"0% AI-ECTA",ARE:"0% CEPA",SAU:"5% MFN",CAN:"0% MFN",JPN:"2.4% CEPA",NLD:"0% GSP+"};
  const CHINA_TARIFFS_PDF = {USA:"30%",GBR:"10%",DEU:"20%",AUS:"10%",CAN:"25%",JPN:"24%",ARE:"—",SAU:"—",NLD:"20%"};

  const allMarkets = [...new Set([...Object.keys(indiaByMarket),...Object.keys(chinaByMarket)])];
  const marketMatrix = allMarkets.map(m=>({
    market:m,
    india:indiaByMarket[m]||0,
    china:chinaByMarket[m]||0,
    gap:(chinaByMarket[m]||0)-(indiaByMarket[m]||0),
    ratio:(chinaByMarket[m]||0)>0?Math.round((indiaByMarket[m]||0)/(chinaByMarket[m]||0)*100):0,
  })).sort((a,b)=>b.gap-a.gap);

  const TARIFFS_PDF = {IND:"18%",CHN:"30%",VNM:"10%",THA:"10%",IDN:"0%",BGD:"0%",LKA:"10%",PHL:"10%",DEU:"0%",GBR:"0%",USA:"—",ARE:"0%",SAU:"5%",JPN:"2.4%",CAN:"0%",NLD:"0%",AUS:"0%"};
  const indiaTariff = 18;

  const html = `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="header">
      <div>
        <h1>Trade Intelligence Summary</h1>
        <div style="color:#666;margin-top:4px">${filterInfo}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">${filteredData.length} records · Total: $${(totalVal/1000000).toFixed(1)}M · ${new Date().toLocaleDateString()}</div>
      </div>
      <div class="brand">
        <div style="font-size:14px;font-weight:800;color:${BRAND.gold}">BuyerIQ</div>
        <div>Senses Lifestyle</div>
        <div>${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    ${hasCensus&&!hasCOMTRADE?`
    <!-- CENSUS: Country of Origin -->
    <h2>By Country of Origin — with Tariff Advantage</h2>
    <p style="font-size:10px;color:#888;margin-bottom:8px">Source: US Census Bureau (CIF basis) · Shows which countries exported to USA</p>
    <table>
      <thead><tr><th>Country (Exporter)</th><th>Total Value</th><th>Share</th><th>US Tariff</th><th>Advantage vs India</th></tr></thead>
      <tbody>${Object.entries(byOrigin).sort((a,b)=>b[1].total-a[1].total).slice(0,15).map(([c,d])=>{
        const tariff=TARIFFS_PDF[c]||"—";
        const tariffNum=parseFloat(tariff)||0;
        const advantage=c==="IND"?"← YOU":tariffNum>indiaTariff?`India ${tariffNum-indiaTariff}% cheaper`:"Competitor";
        const style=c==="IND"?"background:#f0fdf4;font-weight:700":tariffNum>50?"background:#fef2f2":"";
        return `<tr style="${style}">
          <td>${NAMES[c]||c}${c==="IND"?" 🇮🇳":""}</td>
          <td>$${(d.total/1000000).toFixed(2)}M</td>
          <td>${totalVal>0?Math.round(d.total/totalVal*100):0}%</td>
          <td style="color:${tariffNum>25?"red":tariffNum<5?"green":"orange"};font-weight:700">${tariff}</td>
          <td>${advantage}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>

    ${hsMatrixRows ? '<h2>HS Code \u00d7 Country Breakdown \u2014 US Imports</h2><p style="font-size:10px;color:#888;margin-bottom:8px">Census Bureau (CIF) \u00b7 India vs China vs Vietnam per category \u00b7 Red = India far behind China</p><table><thead><tr><th>HS</th><th>Category</th><th style="color:#22c55e">India (CIF)</th><th style="color:#ef4444">China (CIF)</th><th style="color:#f59e0b">Vietnam (CIF)</th><th>India/China</th><th style="color:#d4a843">Gap ($M)</th></tr></thead><tbody>' + hsMatrixRows + '</tbody></table>' : ''}
    `:''}

    ${hasCOMTRADE?`
    <!-- COMTRADE: India & China Exporters -->
    <h2>Exporter Summary — COMTRADE (FOB Basis)</h2>
    <p style="font-size:10px;color:#888;margin-bottom:8px">Source: UN COMTRADE · India & China reported export values (FOB) · Note: Census CIF values are typically 15–25% higher</p>
    <table>
      <thead><tr><th>Exporter</th><th>Total Exports</th><th>Share</th></tr></thead>
      <tbody>${Object.entries(byOrigin).sort((a,b)=>b[1].total-a[1].total).map(([c,d])=>{
        const style=c==="IND"?"background:#f0fdf4;font-weight:700":c==="CHN"?"background:#fef2f2":"";
        return `<tr style="${style}">
          <td>${NAMES[c]||c}${c==="IND"?" 🇮🇳":c==="CHN"?" 🇨🇳":""}</td>
          <td>$${(d.total/1000000).toFixed(2)}M</td>
          <td>${totalVal>0?Math.round(d.total/totalVal*100):0}%</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table>

    ${marketMatrix.length>0?`
    <h2>India vs China — Market Opportunity Matrix</h2>
    <p style="font-size:10px;color:#888;margin-bottom:8px">Where India can capture China's market share · Sorted by opportunity gap (largest first)</p>
    <table>
      <thead>
        <tr>
          <th>Market</th>
          <th>India (FOB)</th>
          <th>India Tariff</th>
          <th>China (FOB)</th>
          <th>China Tariff</th>
          <th>India % of China</th>
          <th>Gap ($M)</th>
          <th>Opportunity</th>
        </tr>
      </thead>
      <tbody>${marketMatrix.map(r=>{
        const oppLabel = r.ratio<5?"🔴 MAX":r.ratio<15?"🟠 HIGH":r.ratio<30?"🟡 GOOD":"🟢 STRONG";
        const oppStyle = r.ratio<5?"background:#fef2f2":r.ratio<15?"background:#fff7ed":r.ratio<30?"background:#fefce8":"background:#f0fdf4";
        return `<tr style="${oppStyle}">
          <td><strong>${MARKET_NAMES[r.market]||r.market}</strong></td>
          <td>$${(r.india/1000000).toFixed(1)}M</td>
          <td style="color:green;font-weight:700">${INDIA_TARIFFS[r.market]||"—"}</td>
          <td>$${(r.china/1000000).toFixed(1)}M</td>
          <td style="color:${r.market==="USA"?"red":"orange"};font-weight:700">${CHINA_TARIFFS_PDF[r.market]||"—"}</td>
          <td><strong>${r.ratio}%</strong></td>
          <td style="color:#d4a05a;font-weight:700">$${(r.gap/1000000).toFixed(1)}M</td>
          <td><strong>${oppLabel}</strong></td>
        </tr>`;
      }).join("")}</tbody>
    </table>
    <div class="note">
      🔴 MAX = India &lt;5% of China's exports — highest growth potential · 🟠 HIGH = 5-15% · 🟡 GOOD = 15-30% · 🟢 STRONG = India already well positioned
    </div>`:''}
    `:''}

    ${hasCensus&&hasCOMTRADE?`
    <div class="note">Mixed sources: Census Bureau (CIF) + COMTRADE (FOB) · Census values are typically 15–25% higher for the same trade · Both are correct measurements.</div>
    `:''}

    <div class="grid" style="margin-top:20px">
      <div><h2>By HS Code</h2>
        <table><thead><tr><th>HS</th><th>Category</th><th>Value</th></tr></thead>
        <tbody>${hsRows}</tbody></table>
      </div>
      <div><h2>By Year</h2>
        <table><thead><tr><th>Year</th><th>Value</th></tr></thead>
        <tbody>${yearRows}</tbody></table>
      </div>
    </div>

    <div class="footer">BuyerIQ by Senses Lifestyle · Confidential · ${new Date().toLocaleDateString()} · Data: US Census Bureau, UN COMTRADE</div>
  </body></html>`;

  openPrintWindow(html, "BuyerIQ — Trade Intelligence Summary");
}
