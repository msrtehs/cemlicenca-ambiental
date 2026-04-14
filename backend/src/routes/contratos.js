const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');
const { auth, autorizar } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');

router.use(auth);

// Calculadora de valor (acesso público autenticado)
router.post('/calcular', contratoController.calcularValor.bind(contratoController));

// CRUD Contratos
router.get('/', contratoController.listar.bind(contratoController));
router.post('/', autorizar('ADMIN', 'SECRETARIO'), registrarAuditoria('CREATE', 'Contrato'), contratoController.criar.bind(contratoController));
router.get('/:id', contratoController.buscarPorId.bind(contratoController));
router.put('/:id/status', autorizar('ADMIN', 'SECRETARIO'), registrarAuditoria('UPDATE', 'Contrato'), contratoController.atualizarStatus.bind(contratoController));

// Justificativa e documentos de contratação
router.post('/:id/justificativa', autorizar('ADMIN', 'SECRETARIO'), registrarAuditoria('CREATE', 'Documento'), contratoController.gerarJustificativa.bind(contratoController));

// Pagamentos
router.post('/:id/pagamentos/:pagamentoId', autorizar('ADMIN', 'CONTADOR'), registrarAuditoria('UPDATE', 'Pagamento'), contratoController.registrarPagamento.bind(contratoController));

module.exports = router;
