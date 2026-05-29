import { supabase } from "../lib/supabase.js";
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const INTEL_BASE = import.meta.env.VITE_INTEL_URL || 'http://localhost:4001';
const V1 = `${API_BASE}/api/v1`;

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path, params = {}) {
  const url = new URL(`${V1}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  let res;
  try {
    const headers = await getAuthHeaders();
    res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Request timed out — backend may be offline.');
    }
    throw new Error(`Network error: ${err.message}`);
  }

  let json;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `API ${res.status}: ${path}`;
    throw new Error(msg);
  }
  if (json?.success === false) throw new Error(json.error?.message || json.error || `API failed: ${path}`);
  return json;
}

export async function apiPost(path, body = {}) {
  const headers = await getAuthHeaders();
  let res;
  try {
    res = await fetch(`${V1}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Network error / timeout — backend unreachable
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Request timed out — backend may be offline. Check that the API server is running on port 4000.');
    }
    throw new Error(`Network error — cannot reach API: ${err.message}`);
  }

  // Try to parse JSON body regardless of status (error bodies are JSON)
  let json;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    // Surface the server's error message instead of generic HTTP status
    const msg = json?.error?.message || json?.error || json?.message || `API ${res.status}: ${path}`;
    throw new Error(msg);
  }
  if (json?.success === false) {
    throw new Error(json?.error?.message || json?.error || `API failed: ${path}`);
  }
  return json;
}

export async function fetchBuyers(params = {}) { return apiGet('/buyers', params); }
export async function fetchBuyerById(id) { return apiGet(`/buyers/${id}`); }
export async function fetchBuyerStats() { return apiGet('/buyers'); }
export async function fetchTradeStats(params = {}) { return apiGet('/trade-stats', params); }
export async function fetchSeasonalData(params = {}) { return apiGet('/trade-stats/seasonal', params); }
export async function fetchSuppliers(params = {}) { return apiGet('/suppliers', params); }
export async function fetchProducts(params = {}) { return apiGet('/products', params); }
export async function fetchShipments(params = {}) { return apiGet('/shipments', params); }
export async function fetchShipmentTrends(params = {}) { return apiGet('/shipments', params); }
export async function fetchPriceIntel(params = {}) { return apiGet('/prices', params); }
export async function fetchPriceSummary() { return apiGet('/prices'); }
export async function fetchCompliance(params = {}) { return apiGet('/compliance', params); }
export async function fetchRetail(params = {}) { return apiGet('/retail', params); }
export async function fetchAlerts(params = {}) { return apiGet('/alerts', params); }
export async function fetchQuotes(params = {}) { return apiGet('/quotes', params); }
export async function fetchHsCodes(params = {}) { return apiGet('/hs-codes', params); }
export async function fetchHealth() { return apiGet('/health'); }

export async function fetchCurrencyRates() {
  const res = await apiGet('/rates');
  if (res?.rates) return { rates: res.rates };
  throw new Error('Rates API failed');
}
export async function fetchCurrencyFallback() {
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    { signal: AbortSignal.timeout(10000) }
  );
  return res.json();
}

export async function fetchCurrencyHistory(startDate, endDate) {
  const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=INR,EUR,GBP`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('History API failed');
  return res.json();
}

export const api = {
  buyers:     { list: fetchBuyers, byId: fetchBuyerById, stats: fetchBuyerStats },
  tradeStats: { list: fetchTradeStats },
  suppliers:  { list: fetchSuppliers },
  products:   { list: fetchProducts },
  shipments:  { list: fetchShipments, trends: fetchShipmentTrends },
  prices:     { list: fetchPriceIntel, summary: fetchPriceSummary },
  compliance: { list: fetchCompliance },
  retail:     { list: fetchRetail },
  alerts:     { list: fetchAlerts },
  quotes:     { list: fetchQuotes, save: saveQuote },
  hsCodes:    { list: fetchHsCodes },
  health:     fetchHealth,
  currency:   { rates: fetchCurrencyRates, fallback: fetchCurrencyFallback, history: fetchCurrencyHistory },
  users:      { list: fetchUsers, invite: inviteUser, updateRole: updateUserRole, toggleActive: toggleUserActive, deleteUser: deleteUser },
};

export default api;

// ── Intelligence API (with auth) ──
async function intelGet(path, params = {}) {
  const url = new URL(`${INTEL_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const headers = await getAuthHeaders();
  return fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) })
    .then(r => r.json())
    .then(d => d.data || d)
    .catch(() => null);
}

export async function fetchOpportunities(params = {}) { return intelGet('/api/intelligence/opportunities', params); }
export async function fetchInsights(params = {}) { return intelGet('/api/intelligence/insights', params); }
export async function fetchDemandTrends(params = {}) { return intelGet('/api/intelligence/demand', params); }
export async function fetchBuyerSignals(params = {}) { return intelGet('/api/intelligence/buyers', params); }

// ── Quote Save ──
export async function saveQuote(data) { return apiPost("/quotes", data); }

// ── User Management (admin only) ──
export async function fetchUsers(params = {}) { return apiGet('/users', params); }
export async function fetchUserProfile() { return apiGet('/users/me'); }
export async function inviteUser(data) { return apiPost('/users/invite', data); }

export async function updateUserRole(userId, role) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${V1}/users/${userId}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ role }), signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function toggleUserActive(userId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${V1}/users/${userId}/toggle`, {
    method: 'PATCH', headers: { ...headers }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function deleteUser(userId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${V1}/users/${userId}`, {
    method: 'DELETE', headers: { ...headers }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ── CSV Export Helper ──
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
export async function fetchTariff(country_code, hs_code) {
  return apiGet('/tariffs', { country_code, hs_code });
}
