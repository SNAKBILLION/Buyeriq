import { query } from "../config/database.js";
import { logger } from "../config/logger.js";

const CURRENCIES = ["INR","EUR","GBP","AUD","CAD","JPY","ZAR","CNY","SGD","AED"];

async function fetchFromCurrencyBeacon() {
  const key = process.env.CURRENCY_BEACON_KEY;
  if (!key) throw new Error("CURRENCY_BEACON_KEY not set");
  const symbols = CURRENCIES.join(',');
  const res = await fetch(
    `https://api.currencybeacon.com/v1/latest?api_key=${key}&base=USD&symbols=${symbols}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`CurrencyBeacon returned ${res.status}`);
  const data = await res.json();
  if (!data.rates) throw new Error('CurrencyBeacon: no rates in response');
  return { rates: data.rates, source: 'currencybeacon' };
}

async function fetchFromFrankfurter() {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD', {
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`Frankfurter returned ${res.status}`);
  const data = await res.json();
  return { rates: data.rates, source: 'frankfurter' };
}

export async function fetchCurrencyRates() {
  let rates = null;
  let source = null;

  try {
    const result = await fetchFromCurrencyBeacon();
    rates = result.rates;
    source = result.source;
    logger.info(`Currency: CurrencyBeacon success — USD/INR: ${rates.INR}`);
  } catch (err) {
    logger.warn(`CurrencyBeacon failed: ${err.message} — falling back to Frankfurter`);
  }

  if (!rates) {
    try {
      const result = await fetchFromFrankfurter();
      rates = result.rates;
      source = result.source;
      logger.info(`Currency: Frankfurter fallback — USD/INR: ${rates.INR}`);
    } catch (err) {
      logger.error(`Both currency APIs failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  let inserted = 0;
  for (const cur of CURRENCIES) {
    if (rates[cur]) {
      await query(
        `INSERT INTO currency_rates (base_currency, target_currency, rate, source, fetched_at)
         VALUES ('USD', $1, $2, $3, NOW())
         ON CONFLICT (base_currency, target_currency, fetched_at) DO NOTHING`,
        [cur, rates[cur], source]
      );
      inserted++;
    }
  }

  logger.info(`Currency rates updated: ${inserted} pairs from ${source}`);
  return { success: true, pairs: inserted, source, usd_inr: rates.INR };
}