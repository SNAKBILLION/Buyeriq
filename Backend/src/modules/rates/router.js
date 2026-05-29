import { Router } from "express";
import { query } from "../../config/database.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT ON (target_currency)
        target_currency, rate
      FROM currency_rates
      WHERE base_currency = 'USD'
      ORDER BY target_currency, fetched_at DESC
    `);

    const rates = {};
    result.rows.forEach(r => {
      rates[r.target_currency] = parseFloat(r.rate);
    });

    res.json({ base: "USD", rates });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rates" });
  }
});

export default router;
