const express = require('express');
const router = express.Router();
const cemiterioController = require('../controllers/cemiterioController');
const { auth, autorizar } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');
const upload = require('../middlewares/upload');

// Todas as rotas requerem autenticação
router.use(auth);

// CRUD Cemitérios
router.get('/', cemiterioController.listar.bind(cemiterioController));
router.get('/estatisticas', cemiterioController.estatisticas.bind(cemiterioController));
router.post('/', registrarAuditoria('CREATE', 'Cemiterio'), cemiterioController.criar.bind(cemiterioController));
router.get('/:id', cemiterioController.buscarPorId.bind(cemiterioController));
router.put('/:id', registrarAuditoria('UPDATE', 'Cemiterio'), cemiterioController.atualizar.bind(cemiterioController));

// Upload de arquivos (planta baixa, fotos, etc.)
router.post('/:id/arquivos',
  upload.single('arquivo'),
  registrarAuditoria('CREATE', 'ArquivoCemiterio'),
  cemiterioController.uploadArquivo.bind(cemiterioController)
);
router.delete('/:id/arquivos/:arquivoId',
  registrarAuditoria('DELETE', 'ArquivoCemiterio'),
  cemiterioController.removerArquivo.bind(cemiterioController)
);

// Checklist CONAMA
router.get('/:id/checklist', cemiterioController.obterChecklist.bind(cemiterioController));
router.put('/:id/checklist/:itemId', registrarAuditoria('UPDATE', 'ChecklistItem'), cemiterioController.atualizarChecklist.bind(cemiterioController));
router.post('/:id/checklist/autopreencher', cemiterioController.autoPreencherChecklist.bind(cemiterioController));

// Importação de planilha Excel antiga
router.post('/:id/importar',
  upload.single('arquivo'),
  registrarAuditoria('CREATE', 'DadoImportado'),
  cemiterioController.importarExcel.bind(cemiterioController)
);

// Análise de risco
router.get('/:id/risco', cemiterioController.calcularRisco.bind(cemiterioController));

// Geração de documentos PDF
router.post('/:id/memorial', registrarAuditoria('CREATE', 'Documento'), cemiterioController.gerarMemorial.bind(cemiterioController));
router.post('/:id/diagnostico', registrarAuditoria('CREATE', 'Documento'), cemiterioController.gerarDiagnostico.bind(cemiterioController));

module.exports = router;
