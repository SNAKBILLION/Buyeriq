// ─────────────────────────────────────────────
// BuyerIQ — useLiveRates Hook
// ─────────────────────────────────────────────
// Fetches live FX rates from Frankfurter API
// with fallback to fawazahmed0 CDN.
// Refreshes every 5 minutes.
// Identical behavior to original BuyerIQ.jsx.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { fetchCurrencyRates, fetchCurrencyFallback, fetchCurrencyHistory } from '../services/api.js';

export function useLiveRates() {
  const [rates, setRates] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRates() {
      try {
        setLoading(true);
        const data = await fetchCurrencyRates();
        if (!cancelled) {
          setRates(data.rates);
          setLastUpdated(new Date().toLocaleTimeString());
          setError(null);
        }
      } catch {
        try {
          const data2 = await fetchCurrencyFallback();
          if (!cancelled && data2.usd) {
            setRates(data2.usd);
            setLastUpdated(new Date().toLocaleTimeString());
            setError(null);
          }
        } catch {
          if (!cancelled) setError('Currency API unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function fetchHist() {
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const data = await fetchCurrencyHistory(start, end);
        if (!cancelled && data.rates) {
          const hist = Object.entries(data.rates).map(([date, r]) => ({
            date: date.slice(5),
            INR: r.INR, EUR: r.EUR, GBP: r.GBP,
          }));
          setHistory(hist);
        }
      } catch { /* silent */ }
    }

    fetchRates();
    fetchHist();
    const interval = setInterval(fetchRates, 300000); // 5 min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { rates, history, loading, error, lastUpdated };
}

/**
 * Convert FOB amount from USD to target currency
 * Identical to original convertFOB function.
 */
export function convertFOB(usdAmount, rates) {
  if (!rates || !usdAmount) return {};
  const inr = rates.INR || rates.inr;
  const eur = rates.EUR || rates.eur;
  const gbp = rates.GBP || rates.gbp;
  const aud = rates.AUD || rates.aud;
  const cad = rates.CAD || rates.cad;
  return {
    USD: usdAmount,
    INR: inr ? +(usdAmount * inr).toFixed(0) : null,
    EUR: eur ? +(usdAmount * eur).toFixed(2) : null,
    GBP: gbp ? +(usdAmount * gbp).toFixed(2) : null,
    AUD: aud ? +(usdAmount * aud).toFixed(2) : null,
    CAD: cad ? +(usdAmount * cad).toFixed(2) : null,
  };
}

export default useLiveRates;
