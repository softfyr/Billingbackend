import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const swaggerDocument = require('./swagger.json');

export const setupSwagger = (app) => {
  // Serve Swagger UI documentation on /api-docs using separate swagger.json file
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Multi-Tenant Billing SaaS API Docs'
  }));

  // Serve raw JSON spec endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
  });
};
