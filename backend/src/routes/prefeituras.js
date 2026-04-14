const express = require('express');
const router = express.Router();
const prefeituraController = require('../controllers/prefeituraController');
const usuarioController = require('../controllers/usuarioController');
const { auth, autorizar, restringirPrefeitura } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');

// Todas as rotas requerem autenticação
router.use(auth);

// Dados da própria prefeitura
router.get('/minha', prefeituraController.minha.bind(prefeituraController));
router.get('/resumo', prefeituraController.resumo.bind(prefeituraController));

// Listar prefeituras (apenas consultores)
router.get('/', autorizar('CONSULTOR', 'ADMIN'), prefeituraController.listar.bind(prefeituraController));

// CRUD prefeitura específica
router.get('/:id', restringirPrefeitura, prefeituraController.buscarPorId.bind(prefeituraController));
router.put('/:id', restringirPrefeitura, autorizar('ADMIN', 'SECRETARIO'), registrarAuditoria('UPDATE', 'Prefeitura'), prefeituraController.atualizar.bind(prefeituraController));

// Gestão de usuários da prefeitura
router.get('/:prefeituraId/usuarios', restringirPrefeitura, usuarioController.listar.bind(usuarioController));
router.post('/:prefeituraId/usuarios', restringirPrefeitura, autorizar('ADMIN'), registrarAuditoria('CREATE', 'Usuario'), usuarioController.criar.bind(usuarioController));
router.get('/:prefeituraId/usuarios/:id', restringirPrefeitura, usuarioController.buscarPorId.bind(usuarioController));
router.put('/:prefeituraId/usuarios/:id', restringirPrefeitura, autorizar('ADMIN'), registrarAuditoria('UPDATE', 'Usuario'), usuarioController.atualizar.bind(usuarioController));
router.delete('/:prefeituraId/usuarios/:id', restringirPrefeitura, autorizar('ADMIN'), registrarAuditoria('DELETE', 'Usuario'), usuarioController.desativar.bind(usuarioController));

module.exports = router;
