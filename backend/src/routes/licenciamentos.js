const express = require('express');
const router = express.Router();
const licenciamentoController = require('../controllers/licenciamentoController');
const { auth, autorizar } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');

router.use(auth);

// CRUD Licenciamentos
router.get('/', licenciamentoController.listar.bind(licenciamentoController));
router.post('/', registrarAuditoria('CREATE', 'Licenciamento'), licenciamentoController.criar.bind(licenciamentoController));
router.get('/orgaos/:uf', licenciamentoController.orgaosPorUF.bind(licenciamentoController));
router.get('/:id', licenciamentoController.buscarPorId.bind(licenciamentoController));

// Fluxo de licenciamento
router.post('/:id/avancar', registrarAuditoria('UPDATE', 'Licenciamento'), licenciamentoController.avancarEtapa.bind(licenciamentoController));
router.post('/:id/protocolo', registrarAuditoria('UPDATE', 'Licenciamento'), licenciamentoController.registrarProtocolo.bind(licenciamentoController));
router.post('/:id/exigencias', registrarAuditoria('UPDATE', 'Licenciamento'), licenciamentoController.registrarExigencias.bind(licenciamentoController));
router.post('/:id/cancelar', autorizar('ADMIN', 'SECRETARIO'), registrarAuditoria('UPDATE', 'Licenciamento'), licenciamentoController.cancelar.bind(licenciamentoController));

// Documentos
router.get('/:id/documentos', licenciamentoController.listarDocumentos.bind(licenciamentoController));
router.post('/:id/documentos/gerar', registrarAuditoria('CREATE', 'Documento'), licenciamentoController.gerarDocumento.bind(licenciamentoController));
router.post('/:id/documentos/gerar-todos', registrarAuditoria('CREATE', 'Documento'), licenciamentoController.gerarTodosDocumentos.bind(licenciamentoController));

module.exports = router;
