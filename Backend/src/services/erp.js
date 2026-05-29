// ─────────────────────────────────────────────
// BuyerIQ — ERP Integration Service
// ─────────────────────────────────────────────
// Connects to Expand smERP / eDominer ERP system
// for syncing orders, products, buyers, and invoices.
//
// Setup:
//   Set ERP_API_URL, ERP_API_KEY, ERP_COMPANY_ID
//
// Features:
//   - Push quotes as sales orders
//   - Pull product catalog
//   - Sync buyer master data
//   - Pull invoice/shipment status
// ─────────────────────────────────────────────
import { logger as log } from '../config/logger.js';

// Logger imported from config

const ERP_URL = (process.env.ERP_API_URL || '').replace(/\/+$/, '') || null;
const ERP_KEY = process.env.ERP_API_KEY || null;
const ERP_COMPANY = process.env.ERP_COMPANY_ID || null;

// ── ERP HTTP Client ──────────────────────────

async function erpRequest(method, endpoint, body = null) {
  if (!ERP_URL || !ERP_KEY) {
    return { success: false, error: 'ERP not configured. Set ERP_API_URL and ERP_API_KEY.' };
  }

  try {
    const url = `${ERP_URL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${ERP_KEY}`,
      'Content-Type': 'application/json',
      'X-Company-ID': ERP_COMPANY || '',
    };

    const options = { method, headers, signal: AbortSignal.timeout(30000) };
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      log.error(`ERP ${method} ${endpoint} failed: ${res.status}`);
      return { success: false, error: data?.message || `ERP returned ${res.status}`, status: res.status };
    }

    return { success: true, data };
  } catch (err) {
    log.error(`ERP request failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════
// QUOTE → SALES ORDER
// ══════════════════════════════════════════════

export async function pushQuoteToERP(quote) {
  log.info(`Pushing quote to ERP: ${quote.product_name} × ${quote.quantity}`);

  const order = {
    order_type: 'export_sales',
    reference: `BIQ-${quote.id?.slice(0, 8) || Date.now()}`,
    customer_name: quote.buyer_name || 'BuyerIQ Quote',
    items: [{
      product_name: quote.product_name,
      wood_type: quote.wood_type || '',
      quantity: quote.quantity,
      unit: quote.unit || 'piece',
      unit_price: quote.fob_per_unit,
      currency: quote.fob_currency || 'USD',
      total: quote.total_usd,
    }],
    incoterm: quote.incoterm || 'FOB',
    origin_port: quote.origin_port || 'Nhava Sheva',
    exchange_rate: quote.exchange_rate,
    total_inr: quote.total_inr,
    notes: quote.notes || '',
    source: 'buyeriq',
  };

  return erpRequest('POST', '/api/sales-orders', order);
}

// ══════════════════════════════════════════════
// PRODUCT CATALOG SYNC
// ══════════════════════════════════════════════

export async function pullProductCatalog() {
  log.info('Pulling product catalog from ERP');
  const result = await erpRequest('GET', '/api/products?category=kitchenware&limit=100');

  if (result.success && result.data) {
    // Map ERP product format to BuyerIQ format
    const products = (result.data.items || result.data || []).map(p => ({
      name: p.product_name || p.name,
      hs_code: p.hs_code || '4419',
      category: p.category || 'kitchenware',
      wood_types: p.materials || [],
      fob_min: p.min_price || p.cost_price,
      fob_max: p.max_price || p.selling_price,
      weight_kg: p.weight || 0,
      unit: p.unit || 'piece',
      erp_product_id: p.id || p.product_id,
      erp_sku: p.sku,
    }));

    log.info(`Pulled ${products.length} products from ERP`);
    return { success: true, products, count: products.length };
  }

  return result;
}

// ══════════════════════════════════════════════
// BUYER MASTER SYNC
// ══════════════════════════════════════════════

export async function pullBuyerMaster() {
  log.info('Pulling buyer master from ERP');
  const result = await erpRequest('GET', '/api/customers?type=export&limit=200');

  if (result.success && result.data) {
    const buyers = (result.data.items || result.data || []).map(b => ({
      name: b.customer_name || b.name,
      country: b.country,
      email: b.email,
      phone: b.phone,
      payment_terms: b.payment_terms,
      credit_limit: b.credit_limit,
      outstanding: b.outstanding_amount,
      last_order_date: b.last_order_date,
      erp_customer_id: b.id || b.customer_id,
    }));

    log.info(`Pulled ${buyers.length} buyers from ERP`);
    return { success: true, buyers, count: buyers.length };
  }

  return result;
}

// ══════════════════════════════════════════════
// ORDER STATUS / INVOICES
// ══════════════════════════════════════════════

export async function getOrderStatus(orderId) {
  return erpRequest('GET', `/api/sales-orders/${orderId}/status`);
}

export async function getRecentInvoices(limit = 20) {
  return erpRequest('GET', `/api/invoices?type=export&limit=${limit}&sort=date_desc`);
}

export async function getShipmentTracking(orderId) {
  return erpRequest('GET', `/api/shipments/${orderId}/tracking`);
}

// ══════════════════════════════════════════════
// FULL SYNC
// ══════════════════════════════════════════════

export async function runFullSync() {
  log.info('Starting full ERP sync...');
  const startTime = Date.now();

  const results = {
    products: await pullProductCatalog(),
    buyers: await pullBuyerMaster(),
    invoices: await getRecentInvoices(),
  };

  const duration = Date.now() - startTime;
  log.info(`ERP sync complete in ${duration}ms`);

  return {
    success: true,
    duration_ms: duration,
    synced: {
      products: results.products?.count || 0,
      buyers: results.buyers?.count || 0,
      invoices: results.invoices?.data?.length || 0,
    },
    errors: Object.entries(results)
      .filter(([, v]) => !v.success)
      .map(([k, v]) => ({ module: k, error: v.error })),
  };
}

// ══════════════════════════════════════════════
// STATUS CHECK
// ══════════════════════════════════════════════

export function getERPStatus() {
  return {
    configured: !!(ERP_URL && ERP_KEY),
    url: ERP_URL ? ERP_URL.replace(/\/api.*/, '') : null,
    company_id: ERP_COMPANY || null,
    features: {
      push_quotes: true,
      pull_products: true,
      pull_buyers: true,
      pull_invoices: true,
      shipment_tracking: true,
    },
    setup_instructions: !ERP_URL ? [
      '1. Get API URL from Expand smERP / eDominer admin panel',
      '2. Generate API key with read+write access',
      '3. Set env vars: ERP_API_URL, ERP_API_KEY, ERP_COMPANY_ID',
      '4. Test: GET /api/v1/erp/status',
    ] : [],
  };
}
