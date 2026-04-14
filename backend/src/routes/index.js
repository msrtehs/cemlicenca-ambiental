const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servico: 'CemLicença Ambiental API',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas de módulos
router.use('/auth', require('./auth'));
router.use('/prefeituras', require('./prefeituras'));
router.use('/cemiterios', require('./cemiterios'));
router.use('/licenciamentos', require('./licenciamentos'));
router.use('/contratos', require('./contratos'));
router.use('/monitoramentos', require('./monitoramentos'));
router.use('/documentos', require('./documentos'));
router.use('/notificacoes', require('./notificacoes'));
router.use('/auditoria', require('./auditoria'));
router.use('/dashboard', require('./dashboard'));

module.exports = router;
