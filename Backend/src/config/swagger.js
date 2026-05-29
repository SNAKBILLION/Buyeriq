// ─────────────────────────────────────────────
// BuyerIQ — Swagger API Documentation
// ─────────────────────────────────────────────
// Mount: app.use('/api/docs', swaggerUI.serve, swaggerUI.setup(spec))
// ─────────────────────────────────────────────

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'BuyerIQ API',
    version: '1.0.0',
    description: 'Buyer Intelligence Platform API — Senses Lifestyle',
    contact: { name: 'BuyerIQ Dev', email: 'admin@senseslifestyle.com' },
  },
  servers: [
    { url: 'http://localhost:4000/api/v1', description: 'Development' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' }, limit: { type: 'integer' },
          total: { type: 'integer' }, pages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: { success: { type: 'boolean' }, error: { type: 'object', properties: { message: { type: 'string' } } } },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    // ── Health ──
    '/health': {
      get: { tags: ['Health'], summary: 'Database health check', security: [],
        responses: { 200: { description: 'OK' } } },
    },

    // ── Users ──
    '/users/login': {
      post: { tags: ['Auth'], summary: 'Login (legacy JWT)', security: [],
        requestBody: { content: { 'application/json': { schema: {
          type: 'object', required: ['email', 'password'],
          properties: { email: { type: 'string' }, password: { type: 'string' } },
        } } } },
        responses: { 200: { description: 'Token + user' }, 401: { description: 'Invalid credentials' } } },
    },
    '/users/me': {
      get: { tags: ['Auth'], summary: 'Get current user profile',
        responses: { 200: { description: 'User profile' } } },
    },
    '/users': {
      get: { tags: ['Admin'], summary: 'List all users (admin only)',
        responses: { 200: { description: 'Paginated user list' } } },
    },
    '/users/invite': {
      post: { tags: ['Admin'], summary: 'Invite new user (admin only)',
        requestBody: { content: { 'application/json': { schema: {
          type: 'object', required: ['name', 'email'],
          properties: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['admin','manager','sales','production','viewer'] } },
        } } } },
        responses: { 201: { description: 'User created' }, 409: { description: 'Email exists' } } },
    },
    '/users/{id}/role': {
      patch: { tags: ['Admin'], summary: 'Change user role (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: {
          type: 'object', required: ['role'],
          properties: { role: { type: 'string', enum: ['admin','manager','sales','production','viewer'] } },
        } } } },
        responses: { 200: { description: 'Updated' } } },
    },
    '/users/{id}/toggle': {
      patch: { tags: ['Admin'], summary: 'Block/unblock user (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Toggled' } } },
    },

    // ── Data Modules (all follow same pattern) ──
    ...generateCRUDPaths('buyers', 'Buyers', ['tier', 'country_code', 'region']),
    ...generateCRUDPaths('suppliers', 'Suppliers', ['country_code', 'cluster']),
    ...generateCRUDPaths('products', 'Products', ['hs_code', 'category']),
    ...generateCRUDPaths('contacts', 'Contacts', ['buyer_id', 'company_id']),
    ...generateCRUDPaths('shipments', 'Shipments', ['buyer_id', 'hs_code', 'origin_country', 'dest_country']),
    ...generateCRUDPaths('trade-stats', 'Trade Statistics', ['reporter_country', 'partner_country', 'year']),
    ...generateCRUDPaths('prices', 'Prices', ['source_name', 'price_type', 'marketplace']),
    ...generateCRUDPaths('retail', 'Retail Products', ['marketplace', 'category']),
    ...generateCRUDPaths('compliance', 'Compliance', ['country_scope', 'status']),
    ...generateCRUDPaths('alerts', 'Alerts', ['type', 'urgency', 'status']),
    ...generateCRUDPaths('quotes', 'Quotes', ['buyer_id', 'status']),
    ...generateCRUDPaths('hs-codes', 'HS Codes', ['chapter']),

    // ── Notifications ──
    '/notifications/send': {
      post: { tags: ['Notifications'], summary: 'Send email/WhatsApp notification',
        requestBody: { content: { 'application/json': { schema: {
          type: 'object', required: ['channel', 'to', 'subject'],
          properties: { channel: { type: 'string', enum: ['email','whatsapp'] }, to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
        } } } },
        responses: { 200: { description: 'Sent' } } },
    },

    // ── ERP ──
    '/erp/sync': {
      post: { tags: ['ERP'], summary: 'Trigger ERP data sync',
        responses: { 200: { description: 'Sync started' } } },
    },
    '/erp/status': {
      get: { tags: ['ERP'], summary: 'Get ERP sync status',
        responses: { 200: { description: 'Sync status' } } },
    },
  },
};

function generateCRUDPaths(resource, tag, filters = []) {
  const filterParams = filters.map(f => ({ name: f, in: 'query', schema: { type: 'string' } }));
  const paginationParams = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
    { name: 'sort_by', in: 'query', schema: { type: 'string' } },
    { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } },
    { name: 'search', in: 'query', schema: { type: 'string' } },
  ];
  return {
    [`/${resource}`]: {
      get: { tags: [tag], summary: `List ${tag}`, parameters: [...paginationParams, ...filterParams],
        responses: { 200: { description: `Paginated ${tag} list` } } },
      post: { tags: [tag], summary: `Create ${tag.slice(0,-1) || tag} (admin/manager)`,
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Created' }, 403: { description: 'Forbidden' } } },
    },
    [`/${resource}/{id}`]: {
      get: { tags: [tag], summary: `Get ${tag.slice(0,-1) || tag} by ID`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Record' }, 404: { description: 'Not found' } } },
      put: { tags: [tag], summary: `Update ${tag.slice(0,-1) || tag} (admin/manager)`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Updated' } } },
      delete: { tags: [tag], summary: `Delete ${tag.slice(0,-1) || tag} (admin only)`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' }, 403: { description: 'Forbidden' } } },
    },
  };
}

// ── Simple HTML docs page (no swagger-ui dependency needed) ──
export function serveAPIDocs(app, basePath = '/api/docs') {
  app.get(basePath, (req, res) => {
    res.send(`<!DOCTYPE html><html><head>
      <title>BuyerIQ API Docs</title>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"/>
    </head><body>
      <div id="swagger-ui"></div>
      <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>SwaggerUIBundle({ spec: ${JSON.stringify(swaggerSpec)}, dom_id: '#swagger-ui' });</script>
    </body></html>`);
  });

  app.get(`${basePath}/json`, (req, res) => { res.json(swaggerSpec); });
}
