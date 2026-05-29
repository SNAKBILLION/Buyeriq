import { createContext, useContext } from "react";
import { BUYERS, PRODUCTS, COUNTRIES, LAWS, TRADE_DATA, SOURCING_INTEL } from "../data/fallbacks.js";

export const DataContext = createContext({
  // Static-backed
  BUYERS,
  PRODUCTS,
  products: PRODUCTS,
  COUNTRIES,
  LAWS,
  TRADE_DATA,
  SOURCING_INTEL,
  // DB-backed (empty until scraping populates)
  shipments: [],
  retail: [],
  suppliers: [],
  tradeStats: [],
  complianceRules: [],
  alerts: [],
  prices: [],
  // Meta
  source: "static",
  loading: false,
  counts: {},
});

export const useData = () => useContext(DataContext);
