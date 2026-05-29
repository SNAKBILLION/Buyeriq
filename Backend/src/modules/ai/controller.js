import { asyncHandler } from "../../utils/asyncHandler.js";

// Sanitize string — remove newlines and prompt injection chars
function s(val, maxLen = 200) {
  if (!val || typeof val !== 'string') return 'N/A';
  return val.replace(/[\n\r`${}\\]/g, ' ').slice(0, maxLen).trim() || 'N/A';
}

const VALID_TIERS = ['MEGA', 'PREMIUM', 'MID', 'VALUE', 'mega_volume', 'premium', 'mid_range', 'value'];

export const generateEmail = asyncHandler(async (req, res) => {
  const { buyer } = req.body;
  if (!buyer) throw new Error("Buyer data required");

  // Sanitize all buyer fields before prompt injection
  const name        = s(buyer.name, 100);
  const countryCode = s(buyer.country_code, 3);
  const tier        = VALID_TIERS.includes(buyer.tier) ? buyer.tier : 'N/A';
  const revenue     = s(buyer.revenue_text, 50);
  const stores      = s(String(buyer.stores || ''), 50);
  const fobMin      = parseFloat(buyer.fob?.min) || 0;
  const fobMax      = parseFloat(buyer.fob?.max) || 0;
  const brands      = (buyer.brands || []).slice(0, 3).map(b => s(b, 50)).join(', ') || 'N/A';

  const prompt = `You are a sales expert for Senses Lifestyle, a premium wood kitchenware exporter from Moradabad, India (HS 4419).
Write a professional outreach email to ${name} (${countryCode} buyer, ${tier} tier).
Buyer context:
- Revenue: ${revenue}
- Stores: ${stores}
- FOB range: $${fobMin}–$${fobMax}
- India tariff advantage: 18% vs China 30%
- Key brands: ${brands}
Email requirements:
- Subject line included
- 3 short paragraphs max
- Mention India tariff advantage vs China
- Reference their specific product category
- End with clear CTA (samples or video call)
- Professional but warm tone
- No generic phrases like "I hope this email finds you well"
Write only the email, no explanation.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  const email = data.choices?.[0]?.message?.content || "Failed to generate email.";
  res.json({ success: true, email });
});
