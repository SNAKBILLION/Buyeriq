// ─────────────────────────────────────────────
// BuyerIQ — Frontend Smoke Tests
// ─────────────────────────────────────────────
// Run: cd frontend && npx vitest run
// ─────────────────────────────────────────────
import { describe, test, expect } from 'vitest';

// ══════════════════════════════════════════════
// API SERVICE — Function Exports
// ══════════════════════════════════════════════

describe('API Service exports', () => {
  test('All fetch functions exist', async () => {
    const api = await import('../services/api.js');
    const expectedFunctions = [
      'fetchBuyers', 'fetchBuyerById', 'fetchTradeStats',
      'fetchSuppliers', 'fetchProducts', 'fetchShipments',
      'fetchPriceIntel', 'fetchCompliance', 'fetchRetail',
      'fetchAlerts', 'fetchQuotes', 'fetchHsCodes', 'fetchHealth',
      'fetchOpportunities', 'fetchInsights', 'fetchDemandTrends',
      'fetchBuyerSignals', 'saveQuote', 'fetchUsers', 'inviteUser',
      'updateUserRole', 'toggleUserActive', 'deleteUser',
      'exportToCSV', 'fetchCurrencyRates', 'fetchUserProfile',
    ];
    for (const fn of expectedFunctions) {
      expect(typeof api[fn]).toBe('function');
    }
  });
});

// ══════════════════════════════════════════════
// STATIC DATA — Fallbacks
// ══════════════════════════════════════════════

describe('Fallback data integrity', () => {
  test('BUYERS array has 31 entries', async () => {
    const { BUYERS } = await import('../data/fallbacks.js');
    expect(BUYERS.length).toBe(31);
  });

  test('Each buyer has required fields', async () => {
    const { BUYERS } = await import('../data/fallbacks.js');
    for (const b of BUYERS) {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('name');
      expect(b).toHaveProperty('country');
      expect(b).toHaveProperty('tier');
      expect(b).toHaveProperty('scores');
      expect(b).toHaveProperty('fob');
      expect(b).toHaveProperty('compliance');
    }
  });

  test('PRODUCTS array exists and has entries', async () => {
    const { PRODUCTS } = await import('../data/fallbacks.js');
    expect(PRODUCTS.length).toBeGreaterThan(0);
    for (const p of PRODUCTS) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('fobRange');
    }
  });

  test('LAWS array has 9 compliance laws', async () => {
    const { LAWS } = await import('../data/fallbacks.js');
    expect(LAWS.length).toBe(9);
  });

  test('COUNTRIES array has entries', async () => {
    const { COUNTRIES } = await import('../data/fallbacks.js');
    expect(COUNTRIES.length).toBeGreaterThan(0);
  });

  test('TRADE_DATA has key metrics', async () => {
    const { TRADE_DATA } = await import('../data/fallbacks.js');
    expect(TRADE_DATA).toHaveProperty('hsCode');
    expect(TRADE_DATA).toHaveProperty('usMarketVolume_2024');
    expect(TRADE_DATA).toHaveProperty('yearTrend');
    expect(TRADE_DATA).toHaveProperty('destinations');
  });
});

// ══════════════════════════════════════════════
// THEME — Configuration
// ══════════════════════════════════════════════

describe('Theme configuration', () => {
  test('TABS array has 15+ tabs', async () => {
    const { TABS } = await import('../data/theme.js');
    expect(TABS.length).toBeGreaterThanOrEqual(15);
  });

  test('Admin tab exists with adminOnly flag', async () => {
    const { TABS } = await import('../data/theme.js');
    const admin = TABS.find(t => t.id === 'admin');
    expect(admin).toBeDefined();
    expect(admin.adminOnly).toBe(true);
  });

  test('All tabs have id, label, icon', async () => {
    const { TABS } = await import('../data/theme.js');
    for (const t of TABS) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('icon');
    }
  });

  test('Theme colors are defined', async () => {
    const { C } = await import('../data/theme.js');
    expect(C.gold).toBeDefined();
    expect(C.bg).toBeDefined();
    expect(C.text).toBeDefined();
    expect(C.green).toBeDefined();
    expect(C.red).toBeDefined();
  });
});

// ══════════════════════════════════════════════
// PDF EXPORT — Utility
// ══════════════════════════════════════════════

describe('PDF export utilities', () => {
  test('exportBuyerPDF function exists', async () => {
    const { exportBuyerPDF } = await import('../utils/pdfExport.js');
    expect(typeof exportBuyerPDF).toBe('function');
  });

  test('exportQuotePDF function exists', async () => {
    const { exportQuotePDF } = await import('../utils/pdfExport.js');
    expect(typeof exportQuotePDF).toBe('function');
  });
});

// ══════════════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════════════

describe('CSV export', () => {
  test('exportToCSV handles empty data', async () => {
    const { exportToCSV } = await import('../services/api.js');
    // Should not throw on empty
    expect(() => exportToCSV([], 'test.csv')).not.toThrow();
    expect(() => exportToCSV(null, 'test.csv')).not.toThrow();
  });
});

// ══════════════════════════════════════════════
// TAB COMPONENTS — Import Check
// ══════════════════════════════════════════════

describe('Tab components import correctly', () => {
  const tabs = [
    'TabDashboard', 'TabBuyers', 'TabTradeIntel', 'TabLiveMarket',
    'TabPriceIntel', 'TabQuoteBuilder', 'TabCompliance', 'TabSeasonal',
    'TabRegional', 'TabProductDNA', 'TabDesignTrends', 'TabCompetitors',
    'TabScorecard', 'TabAlerts', 'TabAdmin',
  ];

  for (const tab of tabs) {
    test(`${tab} exports a default component`, async () => {
      const mod = await import(`../components/tabs/${tab}.jsx`);
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });
  }
});
