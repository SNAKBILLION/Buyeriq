// ─────────────────────────────────────────────
// BuyerIQ — HS Code Mapper v2.0
// Full Kitchenware Platform
// ─────────────────────────────────────────────
import { createLogger } from '../utils/logger.js';
import { normalizeHSCode, getHSHeading } from './entity-normalizer.js';

const log = createLogger('hs-mapper');

const HS_RULES = [

  // ══════════════════════════════════════════
  // WOOD (4419, 4420)
  // ══════════════════════════════════════════
  {
    hsCode: '441910',
    description: 'Bread boards, chopping boards and similar',
    keywords: ['cutting board', 'chopping board', 'bread board', 'cheese board', 'carving board', 'butcher block'],
    materials: ['wood', 'wooden', 'bamboo', 'acacia', 'teak', 'walnut', 'maple', 'olive', 'mango'],
    confidence: 0.95, priority: 10,
  },
  {
    hsCode: '441990',
    description: 'Other tableware and kitchenware, of wood',
    keywords: [
      'serving board', 'serving tray', 'salad bowl', 'mixing bowl',
      'wooden spoon', 'wooden fork', 'wooden spatula', 'wooden ladle',
      'utensil set', 'kitchen utensil', 'rolling pin', 'mortar pestle',
      'mortar and pestle', 'salt cellar', 'pepper mill', 'spice rack',
      'napkin holder', 'trivet', 'coaster', 'wine rack', 'knife block',
      'fruit bowl', 'snack bowl', 'soup bowl', 'rice paddle',
      'honey dipper', 'butter dish', 'wooden plate', 'chopstick',
      'cake stand', 'tiered tray',
    ],
    materials: ['wood', 'wooden', 'bamboo', 'acacia', 'teak', 'walnut', 'maple', 'olive', 'mango', 'rubberwood', 'beech', 'pine', 'oak'],
    confidence: 0.90, priority: 8,
  },
  {
    hsCode: '4419',
    description: 'Tableware and kitchenware, of wood (general)',
    keywords: ['kitchenware', 'tableware', 'kitchen accessory', 'kitchen set', 'wood kitchen', 'wooden kitchen', 'bamboo kitchen'],
    materials: ['wood', 'wooden', 'bamboo'],
    confidence: 0.80, priority: 5,
  },
  {
    hsCode: '442010',
    description: 'Statuettes and other ornaments, of wood',
    keywords: ['figurine', 'statuette', 'sculpture', 'carved figure', 'ornament', 'wood carving', 'wall art', 'wall hanging', 'wall decor', 'wooden mask'],
    materials: ['wood', 'wooden', 'teak', 'sandalwood', 'rosewood'],
    confidence: 0.90, priority: 9,
  },
  {
    hsCode: '442090',
    description: 'Other ornamental articles of wood',
    keywords: ['jewelry box', 'jewellery box', 'trinket box', 'decorative box', 'photo frame', 'picture frame', 'candle holder', 'candlestick', 'vase', 'bookend'],
    materials: ['wood', 'wooden', 'mango', 'sheesham', 'driftwood'],
    confidence: 0.85, priority: 7,
  },

  // ══════════════════════════════════════════
  // STEEL / IRON (7323)
  // ══════════════════════════════════════════
  {
    hsCode: '732393',
    description: 'Stainless steel table/kitchen articles',
    keywords: [
      'stainless steel bowl', 'steel mixing bowl', 'steel colander',
      'steel strainer', 'steel grater', 'steel whisk', 'steel ladle',
      'steel spatula', 'steel tongs', 'steel spoon', 'steel fork',
      'steel kitchen utensil', 'steel serving spoon', 'steel cookware',
      'steel pot', 'steel pan', 'steel wok', 'steel kadai',
    ],
    materials: ['stainless steel', 'steel', 'inox', '18/10', '18/8'],
    confidence: 0.92, priority: 10,
  },
  {
    hsCode: '732391',
    description: 'Cast iron table/kitchen articles',
    keywords: [
      'cast iron skillet', 'cast iron pan', 'cast iron pot',
      'cast iron dutch oven', 'cast iron griddle', 'cast iron wok',
      'cast iron kadai', 'cast iron tawa', 'iron skillet',
    ],
    materials: ['cast iron', 'iron', 'enameled iron', 'seasoned iron'],
    confidence: 0.93, priority: 10,
  },
  {
    hsCode: '7323',
    description: 'Table/kitchen articles of iron or steel (general)',
    keywords: [
      'iron kitchen', 'steel kitchen', 'metal kitchen utensil',
      'metal serving', 'metal bowl', 'metal tray', 'metal rack',
      'dish rack', 'drying rack', 'cooling rack', 'baking rack',
      'roasting rack', 'wire basket', 'metal strainer',
    ],
    materials: ['iron', 'steel', 'metal', 'galvanized'],
    confidence: 0.80, priority: 6,
  },

  // ══════════════════════════════════════════
  // GLASS (7013)
  // ══════════════════════════════════════════
  {
    hsCode: '701349',
    description: 'Drinking glasses (other)',
    keywords: [
      'drinking glass', 'water glass', 'juice glass', 'wine glass',
      'beer glass', 'cocktail glass', 'highball glass', 'tumbler',
      'shot glass', 'glass cup', 'glassware set',
    ],
    materials: ['glass', 'crystal', 'borosilicate', 'soda lime glass'],
    confidence: 0.93, priority: 10,
  },
  {
    hsCode: '701399',
    description: 'Other glassware for table/kitchen',
    keywords: [
      'glass bowl', 'glass serving bowl', 'glass salad bowl',
      'glass mixing bowl', 'glass baking dish', 'glass casserole',
      'glass plate', 'glass platter', 'glass tray', 'glass storage',
      'glass jar', 'glass container', 'glass pitcher', 'glass jug',
      'glass vase', 'glass candle holder',
    ],
    materials: ['glass', 'borosilicate', 'tempered glass', 'crystal glass'],
    confidence: 0.90, priority: 8,
  },
  {
    hsCode: '7013',
    description: 'Glassware for table/kitchen (general)',
    keywords: ['glassware', 'glass kitchenware', 'glass tableware', 'glass dining'],
    materials: ['glass', 'crystal'],
    confidence: 0.78, priority: 5,
  },

  // ══════════════════════════════════════════
  // CERAMIC / PORCELAIN (6911, 6912)
  // ══════════════════════════════════════════
  {
    hsCode: '691110',
    description: 'Porcelain/china tableware and kitchenware',
    keywords: [
      'porcelain plate', 'china plate', 'porcelain bowl', 'china bowl',
      'porcelain mug', 'china mug', 'porcelain cup', 'porcelain dish',
      'porcelain serving bowl', 'porcelain dinnerware', 'china dinnerware',
      'bone china', 'fine china', 'porcelain set',
    ],
    materials: ['porcelain', 'china', 'bone china', 'fine china', 'white porcelain'],
    confidence: 0.93, priority: 10,
  },
  {
    hsCode: '691200',
    description: 'Ceramic tableware (non-porcelain)',
    keywords: [
      'ceramic plate', 'ceramic bowl', 'ceramic mug', 'ceramic cup',
      'ceramic dish', 'stoneware plate', 'stoneware bowl', 'stoneware mug',
      'earthenware', 'terracotta pot', 'ceramic baking dish',
      'ceramic casserole', 'ceramic serving bowl', 'ceramic dinnerware',
      'stoneware set', 'ceramic set', 'pottery bowl', 'clay pot',
    ],
    materials: ['ceramic', 'stoneware', 'earthenware', 'terracotta', 'clay', 'pottery'],
    confidence: 0.91, priority: 9,
  },

  // ══════════════════════════════════════════
  // ALUMINUM (7615)
  // ══════════════════════════════════════════
  {
    hsCode: '761510',
    description: 'Aluminum table/kitchen articles',
    keywords: [
      'aluminum pan', 'aluminium pan', 'aluminum pot', 'aluminium pot',
      'aluminum baking pan', 'aluminum roasting pan', 'aluminum tray',
      'aluminum foil tray', 'aluminum cookware', 'anodized aluminum',
      'aluminum wok', 'aluminum kadai', 'aluminum pressure cooker',
      'aluminum bowl', 'aluminum colander',
    ],
    materials: ['aluminum', 'aluminium', 'anodized aluminum', 'cast aluminum', 'hard anodized'],
    confidence: 0.91, priority: 9,
  },

  // ══════════════════════════════════════════
  // PLASTIC (3924)
  // ══════════════════════════════════════════
  {
    hsCode: '392410',
    description: 'Plastic tableware and kitchenware',
    keywords: [
      'plastic plate', 'plastic bowl', 'plastic cup', 'plastic tray',
      'plastic container', 'plastic storage', 'plastic organizer',
      'melamine plate', 'melamine bowl', 'melamine dinnerware',
      'plastic cutting board', 'plastic colander', 'plastic strainer',
      'plastic kitchen', 'BPA free container', 'food storage container',
    ],
    materials: ['plastic', 'melamine', 'polypropylene', 'BPA free', 'nylon', 'silicone'],
    confidence: 0.88, priority: 7,
  },

  // ══════════════════════════════════════════
  // MIXED / COMBO PRODUCTS
  // ══════════════════════════════════════════
  {
    hsCode: '4419',
    description: 'Mixed kitchenware set (wood primary)',
    keywords: [
      'wood and metal', 'wooden handle steel', 'wood steel combo',
      'wood iron kitchen', 'acacia steel', 'bamboo metal',
    ],
    materials: ['wood', 'wooden', 'acacia', 'bamboo'],
    confidence: 0.75, priority: 4,
  },
];

// Pre-compile regex patterns
// FIX: ReDoS — escape special regex chars in keywords before building pattern
// Using simple string includes() for matching instead of complex regex with \\s+
// This avoids exponential backtracking on malicious/unusual product descriptions
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED_RULES = HS_RULES.map((rule) => ({
  ...rule,
  // FIX: Use escaped keyword with simple word boundary — no nested quantifiers
  keywordPatterns: rule.keywords.map((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i')),
  materialPatterns: rule.materials.map((m) => new RegExp(`\\b${escapeRegex(m)}\\b`, 'i')),
})).sort((a, b) => b.priority - a.priority);

// All relevant HS headings
const RELEVANT_HEADINGS = new Set(['4419', '4420', '7323', '7013', '6911', '6912', '7615', '3924', '4602']);

export function mapToHSCode(description) {
  if (!description) return null;
  const text = description.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const rule of COMPILED_RULES) {
    let score = 0;
    const matchedKeywords = [];
    const matchedMaterials = [];

    for (let i = 0; i < rule.keywordPatterns.length; i++) {
      if (rule.keywordPatterns[i].test(text)) {
        matchedKeywords.push(rule.keywords[i]);
        score += 10;
      }
    }
    for (let i = 0; i < rule.materialPatterns.length; i++) {
      if (rule.materialPatterns[i].test(text)) {
        matchedMaterials.push(rule.materials[i]);
        score += 3;
      }
    }

    if (matchedKeywords.length === 0) continue;
    if (matchedKeywords.length > 0 && matchedMaterials.length > 0) score += 5;

    const finalScore = score * (rule.priority / 10) * rule.confidence;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = {
        hsCode: rule.hsCode,
        hsDescription: rule.description,
        confidence: Math.min(rule.confidence + (matchedKeywords.length - 1) * 0.02, 0.99),
        matchedKeywords,
        matchedMaterials,
        score: finalScore,
      };
    }
  }

  return bestMatch;
}

export function mapBatchToHSCodes(products) {
  const stats = { total: 0, mapped: 0, unmapped: 0, byCode: {} };

  const results = products.map((product) => {
    stats.total++;
    const description = product.product_name || product.title || product.product_description || '';
    const mapping = mapToHSCode(description);

    if (mapping) {
      stats.mapped++;
      stats.byCode[mapping.hsCode] = (stats.byCode[mapping.hsCode] || 0) + 1;
      return {
        ...product,
        hs_code_mapped: mapping.hsCode,
        hs_code_description: mapping.hsDescription,
        hs_mapping_confidence: mapping.confidence,
        hs_matched_keywords: mapping.matchedKeywords,
        hs_matched_materials: mapping.matchedMaterials,
      };
    }

    stats.unmapped++;
    return { ...product, hs_code_mapped: null, hs_mapping_confidence: 0 };
  });

  log.info(`HS mapping: ${stats.mapped}/${stats.total} mapped`, { byCode: stats.byCode });
  return { products: results, stats };
}

export function isRelevantHSCode(code) {
  const heading = getHSHeading(code);
  return RELEVANT_HEADINGS.has(heading);
}

export function getSubCodes(heading) {
  return COMPILED_RULES
    .filter((r) => r.hsCode.startsWith(heading))
    .map((r) => ({ code: r.hsCode, description: r.description }));
}

export function getMaterialFromHSCode(hsCode) {
  const heading = getHSHeading(hsCode);
  const map = {
    '4419': 'wood', '4420': 'wood',
    '7323': 'steel', '7326': 'steel',
    '7013': 'glass',
    '6911': 'ceramic', '6912': 'ceramic',
    '7615': 'aluminum',
    '3924': 'plastic',
    '4602': 'bamboo',
  };
  return map[heading] || 'unknown';
}

export default {
  mapToHSCode, mapBatchToHSCodes, isRelevantHSCode,
  getSubCodes, getMaterialFromHSCode, HS_RULES,
};
