import { Router } from "express";
import * as ctrl from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { createSchema, updateSchema, querySchema } from "./validation.js";
import { authenticate, authorize, authorizeWrite } from "../../middleware/auth.js";
import { query } from "../../config/database.js";

const router = Router();

router.get("/",    authenticate, validate(querySchema, "query"), ctrl.getAll);
router.get("/:id", authenticate, ctrl.getOne);
router.post("/",   authenticate, authorizeWrite(), validate(createSchema), ctrl.create);
router.put("/:id",  authenticate, authorizeWrite(), validate(updateSchema), ctrl.update);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

// ── Bulk Upload (CSV data from Admin Panel) ──
router.post("/bulk", authenticate, authorize("admin", "manager"), async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "products array required" });
    }
    if (products.length > 200) {
      return res.status(400).json({ error: "Maximum 200 products per upload" });
    }

    let inserted = 0;
    let updated = 0;
    let errors = [];

    for (const p of products) {
      if (!p.name) { errors.push(`Row skipped — no name`); continue; }

      const slug = (p.slug || p.name).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);

      try {
        const result = await query(`
          INSERT INTO products
            (name, slug, hs_code, category, sub_category,
             material_primary, wood_types, finish_types, weight_kg, dimensions,
             fob_range_min, fob_range_max, unit, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            hs_code = COALESCE(EXCLUDED.hs_code, products.hs_code),
            category = COALESCE(EXCLUDED.category, products.category),
            sub_category = COALESCE(EXCLUDED.sub_category, products.sub_category),
            material_primary = COALESCE(EXCLUDED.material_primary, products.material_primary),
            wood_types = COALESCE(EXCLUDED.wood_types, products.wood_types),
            finish_types = COALESCE(EXCLUDED.finish_types, products.finish_types),
            weight_kg = COALESCE(EXCLUDED.weight_kg, products.weight_kg),
            dimensions = COALESCE(EXCLUDED.dimensions, products.dimensions),
            fob_range_min = COALESCE(EXCLUDED.fob_range_min, products.fob_range_min),
            fob_range_max = COALESCE(EXCLUDED.fob_range_max, products.fob_range_max),
            unit = COALESCE(EXCLUDED.unit, products.unit),
            notes = COALESCE(EXCLUDED.notes, products.notes),
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_new
        `, [
          p.name.trim(),
          slug,
          p.hs_code || null,
          p.category || null,
          p.sub_category || null,
          p.material || p.material_primary || null,
          p.wood_types ? (Array.isArray(p.wood_types) ? `{${p.wood_types.join(',')}}` : `{${p.wood_types}}`) : null,
          p.finish_types ? (Array.isArray(p.finish_types) ? `{${p.finish_types.join(',')}}` : `{${p.finish_types}}`) : null,
          p.weight_kg ? parseFloat(p.weight_kg) : null,
          p.dimensions || null,
          p.fob_range_min ? parseFloat(p.fob_range_min) : null,
          p.fob_range_max ? parseFloat(p.fob_range_max) : null,
          p.unit || 'piece',
          p.notes || null,
        ]);

        if (result.rows[0]?.is_new) inserted++;
        else updated++;
      } catch (err) {
        errors.push(`${p.name}: ${err.message.substring(0, 80)}`);
      }
    }

    res.json({
      success: true,
      message: `${inserted} inserted, ${updated} updated${errors.length ? `, ${errors.length} errors` : ''}`,
      inserted,
      updated,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      total: inserted + updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
