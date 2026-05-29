// ─────────────────────────────────────────────
// BuyerIQ — Pipeline Orchestrator
// ─────────────────────────────────────────────
// Full ETL orchestration:
// Raw → Clean → Dedup → Normalize →
// Intelligence (HS, buyer signals, supplier
// classify, price intel) → Confidence → DB
//
// Each entity type has a dedicated pipeline.
// ─────────────────────────────────────────────
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger.js';

// Pipeline stages
import { saveRaw, readRaw, listRawFiles } from '../pipeline/raw-storage.js';
import {
  cleanTradeRecord, cleanShipmentRecord, cleanRetailProduct,
  cleanSupplierRecord, cleanBuyerRecord, cleanPriceRecord,
  filterIncomplete,
} from '../pipeline/cleaner.js';
import {
  deduplicateCompanies, deduplicateProducts, deduplicateShipments,
} from '../pipeline/deduplicator.js';
import {
  normalizeEntityBatch,
} from '../intelligence/entity-normalizer.js';
import { mapToHSCode, mapBatchToHSCodes } from '../intelligence/hs-code-mapper.js';
import { detectBuyersFromShipments, detectBuyersFromMarketplace } from '../intelligence/buyer-signals.js';
import { classifySupplierBatch } from '../intelligence/supplier-classifier.js';
import { analyzeRetailPrices, analyzeShipmentPricing } from '../intelligence/price-intelligence.js';
import { scoreBatch } from '../intelligence/confidence-scorer.js';

// DB insert
import {
  insertTradeStatistics, insertShipmentRecords, insertRetailProducts,
  insertSuppliers, insertCompanies, insertPriceData,
} from '../pipeline/db-inserter.js';

// Monitoring
import { PipelineRun } from '../monitoring/pipeline-monitor.js';

const log = createLogger('orchestrator');

// ══════════════════════════════════════════════
// TRADE DATA PIPELINE
// ══════════════════════════════════════════════

/**
 * Process trade statistics through the full pipeline
 * Raw COMTRADE → Clean → Dedup → Normalize → Score → DB
 *
 * @param {Array} rawRecords - Raw records from COMTRADE connector
 * @param {object} meta - Job metadata
 * @returns {object} Pipeline result summary
 */
export async function processTradeData(rawRecords, meta = {}) {
  const run = new PipelineRun(meta.runId || uuid(), 'trade_stat');

  try {
    // Stage 1: Raw storage
    run.beginStage('raw_storage').record({ records_in: rawRecords.length });
    await saveRaw('trade', meta.source || 'comtrade', rawRecords, meta);
    run.record({ records_out: rawRecords.length }).endStage();

    // Stage 2: Cleaning
    run.beginStage('cleaning').record({ records_in: rawRecords.length });
    const cleaned = rawRecords.map(cleanTradeRecord);
    const valid = filterIncomplete(cleaned,
      ['reporter_code', 'partner_code', 'hs_code', 'trade_value_usd', 'year'], 4
    );
    run.record({
      records_out: valid.length,
      records_failed: rawRecords.length - valid.length,
    }).endStage();

    // Stage 3: Dedup (by composite key)
    run.beginStage('deduplication').record({ records_in: valid.length });
    const seen = new Map();
    const deduped = [];
    for (const r of valid) {
      const key = `${r.reporter_code}:${r.partner_code}:${r.hs_code}:${r.year}:${r.trade_flow}`;
      if (!seen.has(key)) { seen.set(key, true); deduped.push(r); }
    }
    run.record({
      records_out: deduped.length,
      duplicates_found: valid.length - deduped.length,
    }).endStage();

    // Stage 4: Entity normalization
    run.beginStage('normalization').record({ records_in: deduped.length });
    const { records: normalized, stats: normStats } = normalizeEntityBatch(deduped, 'trade');
    run.record({
      records_out: normalized.length,
      entities_normalized: normStats.countriesNormalized,
    }).endStage();

    // Stage 5: Confidence scoring
    run.beginStage('confidence_scoring').record({ records_in: normalized.length });
    const { records: scored, stats: confStats } = scoreBatch(normalized, 'trade_stat');
    run.record({
      records_out: scored.length,
      avg_confidence: confStats.avgScore,
    }).endStage();

    // Stage 6: DB insert
    run.beginStage('db_insert').record({ records_in: scored.length });
    const dbResult = await insertTradeStatistics(scored);
    run.record({ records_out: dbResult.inserted }).endStage();

    return await run.flush();
  } catch (err) {
    log.error('Trade pipeline failed', { error: err.message });
    if (run.currentStage) {
      run.record({ records_failed: run.currentStage.records_in, metadata: { error: err.message } }).endStage();
    }
    await run.flush();
    throw err;
  }
}

// ══════════════════════════════════════════════
// SHIPMENT PIPELINE
// ══════════════════════════════════════════════

/**
 * Process shipment records + detect buyer signals
 * Raw → Clean → Dedup → Normalize → HS map → Buyer signals → Score → DB
 */
export async function processShipmentData(rawRecords, meta = {}) {
  const run = new PipelineRun(meta.runId || uuid(), 'shipment');

  try {
    // Raw storage
    run.beginStage('raw_storage').record({ records_in: rawRecords.length });
    await saveRaw('shipments', meta.source || 'importyeti', rawRecords, meta);
    run.record({ records_out: rawRecords.length }).endStage();

    // Cleaning
    run.beginStage('cleaning').record({ records_in: rawRecords.length });
    const cleaned = rawRecords.map(cleanShipmentRecord);
    const valid = filterIncomplete(cleaned, ['importer_name', 'exporter_name'], 2);
    run.record({
      records_out: valid.length,
      records_failed: rawRecords.length - valid.length,
    }).endStage();

    // Dedup
    run.beginStage('deduplication').record({ records_in: valid.length });
    const deduped = deduplicateShipments(valid);
    run.record({
      records_out: deduped.length,
      duplicates_found: valid.length - deduped.length,
    }).endStage();

    // Normalize
    run.beginStage('normalization').record({ records_in: deduped.length });
    const { records: normalized, stats: normStats } = normalizeEntityBatch(deduped, 'shipment');
    run.record({
      records_out: normalized.length,
      entities_normalized: normStats.companiesNormalized + normStats.countriesNormalized,
    }).endStage();

    // HS code mapping (from product descriptions)
    run.beginStage('hs_mapping').record({ records_in: normalized.length });
    let hsMapped = 0;
    const hsEnriched = normalized.map((r) => {
      if (!r.hs_code && r.product_description) {
        const mapping = mapToHSCode(r.product_description);
        if (mapping) {
          hsMapped++;
          return { ...r, hs_code: mapping.hsCode, hs_mapping_confidence: mapping.confidence };
        }
      }
      return r;
    });
    run.record({ records_out: hsEnriched.length, hs_codes_mapped: hsMapped }).endStage();

    // Buyer signal detection
    run.beginStage('buyer_signal_detection').record({ records_in: hsEnriched.length });
    const buyerSignals = detectBuyersFromShipments(hsEnriched);
    run.record({
      records_out: hsEnriched.length,
      buyer_signals_detected: buyerSignals.length,
      metadata: {
        highScoreBuyers: buyerSignals.filter((b) => b.buyer_score >= 70).length,
        woodBuyers: buyerSignals.filter((b) => b.is_wood_kitchenware_buyer).length,
      },
    }).endStage();

    // Price analysis from shipment values
    run.beginStage('price_analysis').record({ records_in: hsEnriched.length });
    const priceAnalysis = analyzeShipmentPricing(hsEnriched);
    run.record({
      records_out: hsEnriched.length,
      prices_analyzed: priceAnalysis.length,
    }).endStage();

    // Confidence scoring
    run.beginStage('confidence_scoring').record({ records_in: hsEnriched.length });
    const { records: scored, stats: confStats } = scoreBatch(hsEnriched, 'shipment');
    run.record({ records_out: scored.length, avg_confidence: confStats.avgScore }).endStage();

    // DB insert (shipments)
    run.beginStage('db_insert').record({ records_in: scored.length });
    const dbResult = await insertShipmentRecords(scored);
    run.record({ records_out: dbResult.inserted }).endStage();

    // DB insert (buyer signals as companies)
    if (buyerSignals.length > 0) {
      run.beginStage('db_insert_buyers').record({ records_in: buyerSignals.length });
      const buyerRecords = buyerSignals.slice(0, 50).map((b) => cleanBuyerRecord({
        company_name: b.company_name,
        country: b.country,
        buyer_type: b.buyer_type,
        _source: 'shipment_analysis',
      }));
      const buyerResult = await insertCompanies(buyerRecords);
      run.record({ records_out: buyerResult.inserted }).endStage();
    }

    return await run.flush();
  } catch (err) {
    log.error('Shipment pipeline failed', { error: err.message });
    if (run.currentStage) {
      run.record({ records_failed: run.currentStage.records_in, metadata: { error: err.message } }).endStage();
    }
    await run.flush();
    throw err;
  }
}

// ══════════════════════════════════════════════
// MARKETPLACE PIPELINE
// ══════════════════════════════════════════════

/**
 * Process marketplace products + generate price intelligence
 * Raw → Clean → Dedup → HS map → Price intel → Buyer signals → Score → DB
 */
export async function processMarketplaceData(rawProducts, meta = {}) {
  const run = new PipelineRun(meta.runId || uuid(), 'retail_product');

  try {
    // Raw storage
    run.beginStage('raw_storage').record({ records_in: rawProducts.length });
    await saveRaw('marketplace', meta.source || meta.platform || 'unknown', rawProducts, meta);
    run.record({ records_out: rawProducts.length }).endStage();

    // Cleaning
    run.beginStage('cleaning').record({ records_in: rawProducts.length });
    const cleaned = rawProducts.map(cleanRetailProduct);
    const valid = filterIncomplete(cleaned, ['product_name', 'price'], 2);
    run.record({
      records_out: valid.length,
      records_failed: rawProducts.length - valid.length,
    }).endStage();

    // Dedup
    run.beginStage('deduplication').record({ records_in: valid.length });
    const dedupGroups = deduplicateProducts(valid);
    const deduped = dedupGroups.map((g) => g.canonical);
    run.record({
      records_out: deduped.length,
      duplicates_found: valid.length - deduped.length,
    }).endStage();

    // HS code mapping
    run.beginStage('hs_mapping').record({ records_in: deduped.length });
    const { products: hsMapped, stats: hsStats } = mapBatchToHSCodes(deduped);
    run.record({
      records_out: hsMapped.length,
      hs_codes_mapped: hsStats.mapped,
    }).endStage();

    // Price intelligence
    run.beginStage('price_analysis').record({ records_in: hsMapped.length });
    const priceResult = analyzeRetailPrices(hsMapped);
    run.record({
      records_out: hsMapped.length,
      prices_analyzed: priceResult.analysis.length,
      metadata: { benchmarks: priceResult.benchmarks, outliers: priceResult.outliers.length },
    }).endStage();

    // Buyer signals from marketplace sellers
    run.beginStage('buyer_signal_detection').record({ records_in: hsMapped.length });
    const buyerSignals = detectBuyersFromMarketplace(hsMapped);
    run.record({
      records_out: hsMapped.length,
      buyer_signals_detected: buyerSignals.length,
    }).endStage();

    // Confidence scoring
    run.beginStage('confidence_scoring').record({ records_in: hsMapped.length });
    const { records: scored, stats: confStats } = scoreBatch(hsMapped, 'retail_product');
    run.record({ records_out: scored.length, avg_confidence: confStats.avgScore }).endStage();

    // DB insert (products)
    run.beginStage('db_insert').record({ records_in: scored.length });
    const productResult = await insertRetailProducts(scored);
    run.record({ records_out: productResult.inserted }).endStage();

    // DB insert (price data)
    run.beginStage('db_insert_prices').record({ records_in: scored.length });
    const priceRecords = scored.filter((p) => p.price).map((p) => cleanPriceRecord({
      product_type: p.hs_code_mapped ? p.hs_code_description : 'wood_kitchenware',
      price_usd: p.price,
      price_type: 'retail',
      source_platform: p.platform,
      source_url: p.product_url,
      currency: 'USD',
      _source: p.platform,
    }));
    const priceDbResult = await insertPriceData(priceRecords);
    run.record({ records_out: priceDbResult.inserted }).endStage();

    return await run.flush();
  } catch (err) {
    log.error('Marketplace pipeline failed', { error: err.message });
    if (run.currentStage) {
      run.record({ records_failed: run.currentStage.records_in, metadata: { error: err.message } }).endStage();
    }
    await run.flush();
    throw err;
  }
}

// ══════════════════════════════════════════════
// SUPPLIER PIPELINE
// ══════════════════════════════════════════════

/**
 * Process supplier records + classify capabilities
 * Raw → Clean → Dedup → Normalize → Classify → Score → DB
 */
export async function processSupplierData(rawRecords, meta = {}) {
  const run = new PipelineRun(meta.runId || uuid(), 'supplier');

  try {
    // Raw storage
    run.beginStage('raw_storage').record({ records_in: rawRecords.length });
    await saveRaw('suppliers', meta.source || 'alibaba', rawRecords, meta);
    run.record({ records_out: rawRecords.length }).endStage();

    // Cleaning
    run.beginStage('cleaning').record({ records_in: rawRecords.length });
    const cleaned = rawRecords.map(cleanSupplierRecord);
    const valid = filterIncomplete(cleaned, ['company_name'], 1);
    run.record({
      records_out: valid.length,
      records_failed: rawRecords.length - valid.length,
    }).endStage();

    // Dedup (fuzzy company matching)
    run.beginStage('deduplication').record({ records_in: valid.length });
    const dedupGroups = deduplicateCompanies(valid);
    const deduped = dedupGroups.map((g) => g.canonical);
    run.record({
      records_out: deduped.length,
      duplicates_found: valid.length - deduped.length,
    }).endStage();

    // Normalize
    run.beginStage('normalization').record({ records_in: deduped.length });
    const { records: normalized, stats: normStats } = normalizeEntityBatch(deduped, 'supplier');
    run.record({
      records_out: normalized.length,
      entities_normalized: normStats.companiesNormalized + normStats.countriesNormalized,
    }).endStage();

    // Supplier classification
    run.beginStage('supplier_classification').record({ records_in: normalized.length });
    const { suppliers: classified, stats: classStats } = classifySupplierBatch(normalized);
    run.record({
      records_out: classified.length,
      suppliers_classified: classified.length,
      metadata: classStats,
    }).endStage();

    // Confidence scoring
    run.beginStage('confidence_scoring').record({ records_in: classified.length });
    const { records: scored, stats: confStats } = scoreBatch(classified, 'supplier');
    run.record({ records_out: scored.length, avg_confidence: confStats.avgScore }).endStage();

    // DB insert
    run.beginStage('db_insert').record({ records_in: scored.length });
    const dbResult = await insertSuppliers(scored);
    run.record({ records_out: dbResult.inserted }).endStage();

    return await run.flush();
  } catch (err) {
    log.error('Supplier pipeline failed', { error: err.message });
    if (run.currentStage) {
      run.record({ records_failed: run.currentStage.records_in, metadata: { error: err.message } }).endStage();
    }
    await run.flush();
    throw err;
  }
}

// ══════════════════════════════════════════════
// RAW DATA REPROCESSING
// ══════════════════════════════════════════════

/**
 * Reprocess raw data files for a date range.
 * Useful for rerunning with updated intelligence rules.
 *
 * @param {string} source - 'trade', 'shipments', 'marketplace', 'suppliers'
 * @param {string} subType - e.g., 'comtrade', 'amazon'
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 */
export async function reprocessRawData(source, subType, dateFrom, dateTo) {
  log.info(`Reprocessing ${source}/${subType} from ${dateFrom} to ${dateTo}`);

  const files = await listRawFiles(source, subType, dateFrom, dateTo);
  log.info(`Found ${files.length} raw files to reprocess`);

  const processors = {
    trade: processTradeData,
    shipments: processShipmentData,
    marketplace: processMarketplaceData,
    suppliers: processSupplierData,
  };

  const processor = processors[source];
  if (!processor) throw new Error(`No processor for source: ${source}`);

  let totalProcessed = 0;

  for (const file of files) {
    try {
      const envelope = await readRaw(file);
      const data = Array.isArray(envelope.data) ? envelope.data : [envelope.data];
      await processor(data, { runId: `reprocess-${uuid()}`, source: subType });
      totalProcessed += data.length;
    } catch (err) {
      log.error(`Failed to reprocess ${file}`, { error: err.message });
    }
  }

  log.info(`Reprocessing complete: ${totalProcessed} records from ${files.length} files`);
  return { files: files.length, records: totalProcessed };
}

export default {
  processTradeData, processShipmentData,
  processMarketplaceData, processSupplierData,
  reprocessRawData,
};
