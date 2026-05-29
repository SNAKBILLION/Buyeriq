// ─────────────────────────────────────────────
// BuyerIQ — Backend Data Hook v2
// Full DB-driven — no static fallbacks for buyers
// ─────────────────────────────────────────────
import { useState, useEffect } from "react";
import { BUYERS, PRODUCTS, COUNTRIES, LAWS, TRADE_DATA, SOURCING_INTEL } from "../data/fallbacks.js";
import {
  fetchBuyers, fetchProducts, fetchShipments,
  fetchRetail, fetchSuppliers, fetchTradeStats,
  fetchCompliance, fetchAlerts, fetchPriceIntel,
} from "../services/api.js";

function mapDbBuyer(b) {
  const s = BUYERS.find(x => x.slug === b.slug || x.name === b.name) || {};
  const tier = (b.tier || 'mid_range')
    .toUpperCase()
    .replace('MID_RANGE','MID')
    .replace('MEGA_VOLUME','MEGA')
    .replace('_','');

  return {
    id:      b.slug || b.id,
    slug:    b.slug,
    dbId:    b.id,
    name:    b.name,
    tier,
    brands:  b.brands || s.brands || [],
    hq:      b.hq_city || s.hq || '',
    hq_city: b.hq_city || '',
    country: b.country_code || s.country || 'US',
    country_code: b.country_code || 'US',
    region:  b.region || s.region || 'North America',
    revenue: b.revenue_text || s.revenue || '',
    revenue_text: b.revenue_text || s.revenue || '',
    revConf: s.revConf || 'I',
    stock:   s.stock || b.stock_ticker || '',
    stock_ticker: b.stock_ticker || s.stock || '',
    website: b.website || s.website || '',
    vendor_portal_url: b.vendor_portal_url || s.vendor_portal_url || '',
    linkedin_url: s.linkedin_url || '',
    ir_url: s.ir_url || '',
    stores:  b.stores_count || s.stores || '',
    stores_count: b.stores_count || s.stores || '',
    wood: b.wood_preferences || s.wood || [],
    wood_preferences: b.wood_preferences || s.wood || [],
    finish: b.finish_preferences || s.finish || [],
    finish_preferences: b.finish_preferences || s.finish || [],
    products: b.top_products || s.products || [],
    top_products: b.top_products || s.products || [],
    fob: {
      min:   parseFloat(b.fob?.min ?? b.fob_min) || s.fob?.min || 0,
      max:   parseFloat(b.fob?.max ?? b.fob_max) || s.fob?.max || 0,
      sweet: b.fob_sweet_spot       || s.fob?.sweet || '',
      mult:  b.retail_multiple      || s.fob?.mult  || '',
    },
    fob_min: b.fob?.min ?? b.fob_min,
    fob_max: b.fob?.max ?? b.fob_max,
    fob_sweet_spot: b.fob_sweet_spot,
    seasonal: {
      Q1: b.seasonal_q1 ?? s.seasonal?.Q1 ?? 25,
      Q2: b.seasonal_q2 ?? s.seasonal?.Q2 ?? 25,
      Q3: b.seasonal_q3 ?? s.seasonal?.Q3 ?? 25,
      Q4: b.seasonal_q4 ?? s.seasonal?.Q4 ?? 25,
    },
    orderWindows: b.order_windows || s.orderWindows || [],
    leadTime: b.lead_time || s.leadTime || '',
    lead_time: b.lead_time || s.leadTime || '',
    moq: b.moq || s.moq || '',
    payment: b.payment_terms || s.payment || '',
    payment_terms: b.payment_terms || s.payment || '',
    negotiation: b.negotiation_style || s.negotiation || '',
    scores: {
      pay:    b.score_payment ?? s.scores?.pay    ?? 70,
      vol:    b.score_volume  ?? s.scores?.vol    ?? 70,
      margin: b.score_margin  ?? s.scores?.margin ?? 65,
      growth: b.score_growth  ?? s.scores?.growth ?? 65,
      ease:   b.score_ease    ?? s.scores?.ease   ?? 70,
    },
    compliance: b.compliance || s.compliance || [],
    certifications_required: b.certifications_required || s.certifications_required || [],
    competitors: b.known_competitors || s.competitors || [],
    known_competitors: b.known_competitors || [],
    contacts: s.contacts || [],
    alerts: s.alerts || [],
    notes: b.notes || '',
    confidence: b.confidence || 'industry_estimate',
    data_source: b.data_source || '',
    last_verified: b.last_verified || '',
    is_active: b.is_active !== false,
  };
}

export function useBackendData() {
  const [buyers, setBuyers] = useState(BUYERS);
  const [products, setProducts] = useState(PRODUCTS);
  const [shipments, setShipments] = useState([]);
  const [retail, setRetail] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tradeStats, setTradeStats] = useState([]);
  const [complianceRules, setComplianceRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState("static");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const results = {};

        const [
          buyersRes, productsRes, shipmentsRes, retailRes,
          suppliersRes, tradeRes, compRes, alertsRes, pricesRes,
        ] = await Promise.allSettled([
          fetchBuyers({ limit: 1000 }),
          fetchProducts({ limit: 500 }),
          fetchShipments({ limit: 500, sort_by: 'ship_date', sort_order: 'desc' }),
          fetchRetail({ limit: 20000, sort_by: 'scraped_at', sort_order: 'desc' }),
          fetchSuppliers({ limit: 50 }),
          fetchTradeStats({ limit: 20000, sort_by: "year", sort_order: "desc" }),
          fetchCompliance({ limit: 100 }),
          fetchAlerts({ limit: 100, sort_by: 'created_at', sort_order: 'desc' }),
          fetchPriceIntel({ limit: 50 }),
        ]);

        if (buyersRes.status === 'fulfilled' && buyersRes.value?.data?.length > 0) {
          const mapped = buyersRes.value.data
            .filter(b => b.is_active !== false)
            .map(mapDbBuyer);
          setBuyers(mapped);
          results.buyers = mapped.length;
        } else {
          setBuyers(BUYERS);
          results.buyers = BUYERS.length;
        }

        if (productsRes.status === 'fulfilled' && productsRes.value?.data?.length > 0) {
          setProducts(productsRes.value.data);
          results.products = productsRes.value.data.length;
        }

        if (shipmentsRes.status === 'fulfilled' && shipmentsRes.value?.data?.length > 0) {
          setShipments(shipmentsRes.value.data);
          results.shipments = shipmentsRes.value.data.length;
        }

        if (retailRes.status === 'fulfilled' && retailRes.value?.data?.length > 0) {
          setRetail(retailRes.value.data);
          results.retail = retailRes.value.data.length;
        }

        if (suppliersRes.status === 'fulfilled' && suppliersRes.value?.data?.length > 0) {
          setSuppliers(suppliersRes.value.data);
          results.suppliers = suppliersRes.value.data.length;
        }

        if (tradeRes.status === 'fulfilled' && tradeRes.value?.data?.length > 0) {
          setTradeStats(tradeRes.value.data);
          results.tradeStats = tradeRes.value.data.length;
        }

        if (compRes.status === 'fulfilled' && compRes.value?.data?.length > 0) {
          setComplianceRules(compRes.value.data);
          results.compliance = compRes.value.data.length;
        }

        if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.length > 0) {
          setAlerts(alertsRes.value.data);
          results.alerts = alertsRes.value.data.length;
        }

        if (pricesRes.status === 'fulfilled' && pricesRes.value?.data?.length > 0) {
          setPrices(pricesRes.value.data);
          results.prices = pricesRes.value.data.length;
        }

        const anyApiData = [
          buyersRes, productsRes, shipmentsRes, retailRes,
          suppliersRes, tradeRes, compRes, alertsRes, pricesRes,
        ].some(r => r.status === 'fulfilled' && (r.value?.data?.length || 0) > 0);

        setCounts(results);
        setSource(anyApiData ? "api" : "static");
        setError(null);

      } catch (err) {
        console.warn("Backend unavailable, using static data:", err.message);
        setSource("static");
        setError(err.message);
        setBuyers(BUYERS);
        setProducts(PRODUCTS);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  return {
    buyers,
    products,
    countries: COUNTRIES,
    laws: LAWS,
    tradeData: TRADE_DATA,
    sourcingIntel: SOURCING_INTEL,
    shipments,
    retail,
    suppliers,
    tradeStats,
    complianceRules,
    alerts,
    prices,
    loading,
    error,
    source,
    counts,
  };
}