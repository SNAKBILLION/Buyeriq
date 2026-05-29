import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";
import { query } from "../../config/database.js";

class BuyersService extends BaseRepository {
  constructor() {
    super("buyers", ["tier","country_code","region","is_active"]);
  }

  async getByIdentifier(identifier) {
    const record = identifier.match(/^[0-9a-f-]{36}$/) ? await this.findById(identifier) : await this.findBySlug(identifier);
    if (!record) throw ApiError.notFound("Buyer not found");
    // Load contacts for single buyer
    let contacts = [];
    try {
      const cRes = await query(
        `SELECT full_name, job_title, department, email, phone, linkedin_url, notes, confidence
         FROM contacts WHERE buyer_id = $1 ORDER BY created_at ASC`,
        [record.id]
      );
      contacts = cRes.rows;
    } catch (_) {}
    return this._mapToFrontend(record, contacts);
  }

  async findAll(filters = {}, pagination = {}) {
    const result = await super.findAll(filters, pagination);

    // Batch-load contacts for all buyers (avoids N+1)
    const ids = result.data.map(b => b.id).filter(Boolean);
    let contactsMap = {};
    if (ids.length > 0) {
      try {
        const cRes = await query(
          `SELECT buyer_id, full_name, job_title, department, email, phone, linkedin_url, notes, confidence
           FROM contacts WHERE buyer_id = ANY($1) ORDER BY created_at ASC`,
          [ids]
        );
        cRes.rows.forEach(c => {
          if (!contactsMap[c.buyer_id]) contactsMap[c.buyer_id] = [];
          contactsMap[c.buyer_id].push({
            full_name: c.full_name,
            job_title: c.job_title,
            department: c.department,
            email: c.email,
            phone: c.phone,
            linkedin_url: c.linkedin_url,
            notes: c.notes,
            confidence: c.confidence,
          });
        });
      } catch (_) {
        // contacts join failed — proceed without
      }
    }

    result.data = result.data.map(b => this._mapToFrontend(b, contactsMap[b.id] || []));
    return result;
  }

  // ── Map DB columns → frontend expected shape ──
  _mapToFrontend(b, contacts = []) {
    if (!b) return b;

    const countryNames = {
      US: "United States", GB: "United Kingdom", SE: "Sweden", DE: "Germany",
      FR: "France", NL: "Netherlands", DK: "Denmark", ES: "Spain",
      IE: "Ireland", CA: "Canada", AU: "Australia", JP: "Japan",
      ZA: "South Africa",
    };

    return {
      // Identity
      id:          b.slug || b.id,
      dbId:        b.id,
      slug:        b.slug,
      name:        b.name,
      tier:        b.tier,
      is_active:   b.is_active,
      confidence:  b.confidence,

      // Location
      country_code: b.country_code,
      country:      countryNames[b.country_code] || b.country_code || "",
      region:       b.region,
      hq_city:      b.hq_city || b.region || "",

      // Company identity (now from buyers table directly via migration 006)
      website:        b.website || "",
      stock_ticker:   b.stock_ticker || "",
      revenue_text:   b.revenue_text || "",
      revenue_source: b.revenue_source || "",
      stores:         b.stores_count || "",
      stores_count:   b.stores_count || "",

      // Portals
      vendor_portal_url: b.vendor_portal_url || null,
      linkedin_url:      b.linkedin_url || null,
      ir_url:            b.ir_url || null,

      // Aliases for legacy components
      hq:     b.hq_city || b.region || "",
      stock:  b.stock_ticker || "",
      revenue: b.revenue_text || "",
      revConf: b.revenue_conf || b.confidence || "I",
      revSource: b.revenue_source || b.data_source || "",

      // Arrays
      brands:      b.brands || [],
      wood:        b.wood_preferences || [],
      finish:      b.finish_preferences || [],
      products:    b.top_products || [],
      trends:      b.design_trends || [],
      competitors: b.known_competitors || [],
      certs:       b.certifications_required || [],
      orderWindows: b.order_windows || [],

      // FOB
      fob: {
        min:   parseFloat(b.fob_min || 0),
        max:   parseFloat(b.fob_max || 0),
        sweet: b.fob_sweet_spot || "",
        mult:  b.retail_multiple || "3.5×",
      },

      // Scores
      scores: {
        pay:    b.score_payment || 0,
        vol:    b.score_volume  || 0,
        margin: b.score_margin  || 0,
        growth: b.score_growth  || 0,
        ease:   b.score_ease    || 0,
      },

      // Seasonal
      seasonal: {
        Q1: b.seasonal_q1 || 0,
        Q2: b.seasonal_q2 || 0,
        Q3: b.seasonal_q3 || 0,
        Q4: b.seasonal_q4 || 0,
      },

      // Terms
      payment:     b.payment_terms       || "",
      moq:         b.moq                 || "",
      leadTime:    b.lead_time           || "",
      negotiation: b.negotiation_style   || "",

      // Contacts (from contacts table)
      contacts: contacts,

      // Compliance + alerts (empty by default — loaded by getEnrichedBuyer)
      compliance: b._compliance || [],
      alerts:     b._alerts     || [],

      // Meta
      last_verified: b.last_verified || null,
      data_source:   b.data_source   || "",
    };
  }

  // ── Enriched buyer with company + compliance ──
  async getEnrichedBuyer(identifier) {
    const buyer = identifier.match(/^[0-9a-f-]{36}$/) ? await this.findById(identifier) : await this.findBySlug(identifier);
    if (!buyer) throw ApiError.notFound("Buyer not found");

    // Load company data if linked
    let companyData = {};
    if (buyer.company_id) {
      const compRes = await query("SELECT * FROM companies WHERE id = $1", [buyer.company_id]);
      if (compRes.rows[0]) {
        const c = compRes.rows[0];
        companyData = {
          revenue_text:   c.revenue        || buyer.revenue_text  || "",
          hq_city:        c.hq_address     || buyer.hq_city       || "",
          stock_ticker:   c.stock_ticker   || buyer.stock_ticker  || "",
          revenue_conf:   c.revenue_conf   || "industry_estimate",
          revenue_source: c.revenue_source || buyer.revenue_source || "",
          website:        c.website        || buyer.website        || "",
        };
      }
    }

    // Load contacts
    const contactsRes = await query(
      `SELECT full_name, job_title, department, email, phone, linkedin_url, notes, confidence
       FROM contacts WHERE buyer_id = $1 ORDER BY created_at ASC`,
      [buyer.id]
    );
    const contacts = contactsRes.rows;

    // Load compliance
    const complianceRes = await query(`
      SELECT cr.name, cr.slug, cr.status, cr.summary, cr.key_fact, bc.is_mandatory
      FROM buyer_compliance bc
      JOIN compliance_rules cr ON cr.id = bc.compliance_id
      WHERE bc.buyer_id = $1
    `, [buyer.id]);
    const compliance = complianceRes.rows.map(r => ({
      name: r.name,
      slug: r.slug,
      status: r.status || 'ACTIVE',
      urgency: r.urgency || 'medium',
      detail: r.summary || r.key_fact || '',
      is_compliant: r.is_mandatory,
    }));

    // Load alerts
    const alertsRes = await query(`
      SELECT type, urgency, title, message, is_verified
      FROM alerts WHERE buyer_id = $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 10
    `, [buyer.id]);
    const alerts = alertsRes.rows.map(a => ({
      type: a.type, urgency: a.urgency, msg: a.title || a.message, verified: a.is_verified,
    }));

    return this._mapToFrontend(
      { ...buyer, ...companyData, _compliance: compliance, _alerts: alerts },
      contacts
    );
  }
}

export default new BuyersService();
