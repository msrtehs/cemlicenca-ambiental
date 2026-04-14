const express = require('express');
const router = express.Router();
const monitoramentoController = require('../controllers/monitoramentoController');
const { auth } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');

router.use(auth);

// CRUD Monitoramentos
router.get('/', monitoramentoController.listar.bind(monitoramentoController));
router.post('/', registrarAuditoria('CREATE', 'Monitoramento'), monitoramentoController.criar.bind(monitoramentoController));
router.get('/sustentabilidade', monitoramentoController.dashboardSustentabilidade.bind(monitoramentoController));
router.get('/historico/:cemiterioId', monitoramentoController.historico.bind(monitoramentoController));
router.get('/previsao/:cemiterioId', monitoramentoController.previsaoRisco.bind(monitoramentoController));
router.get('/exportar/:cemiterioId', monitoramentoController.exportarCSV.bind(monitoramentoController));
router.get('/:id', monitoramentoController.buscarPorId.bind(monitoramentoController));

// Relatórios
router.post('/relatorio-anual', registrarAuditoria('CREATE', 'Documento'), monitoramentoController.gerarRelatorioAnual.bind(monitoramentoController));

module.exports = router;
