import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { query } from "../../config/database.js";

const router = Router();

// GET /api/v1/tariffs
router.get("/", authenticate, async (req, res) => {
  try {
    const { country_code, hs_code } = req.query;
    let sql = `SELECT * FROM tariff_data WHERE 1=1`;
    const params = [];
    if (country_code) { params.push(country_code); sql += ` AND country_code = $${params.length}`; }
    if (hs_code) { params.push(hs_code); sql += ` AND hs_code = $${params.length}`; }
    sql += ` ORDER BY country_code, hs_code`;
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tariffs/upsert
router.post("/upsert", authenticate, authorize("admin", "manager"), async (req, res) => {
  try {
    const { country_code, hs_code, mfn_rate, preferential_rate, scheme, note, has_fta, confidence, data_source } = req.body;
    if (!country_code || !hs_code || mfn_rate === undefined) {
      return res.status(400).json({ error: "country_code, hs_code, mfn_rate required" });
    }
    const result = await query(`
      INSERT INTO tariff_data (hs_code, country_code, mfn_rate, preferential_rate, scheme, note, has_fta, confidence, data_source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (hs_code, country_code) DO UPDATE SET
        mfn_rate = EXCLUDED.mfn_rate,
        preferential_rate = EXCLUDED.preferential_rate,
        scheme = EXCLUDED.scheme,
        note = EXCLUDED.note,
        has_fta = EXCLUDED.has_fta,
        confidence = EXCLUDED.confidence,
        data_source = EXCLUDED.data_source,
        updated_at = NOW()
      RETURNING *
    `, [hs_code, country_code, mfn_rate, preferential_rate ?? mfn_rate, scheme || 'MFN', note || null, has_fta || false, confidence || 'VERIFIED', data_source || 'admin_manual']);
    res.json({ data: result.rows[0], message: "Tariff updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
