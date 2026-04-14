const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middlewares/auth');
const { registrarAuditoria } = require('../middlewares/auditoria');

// Rotas públicas
router.post('/login', registrarAuditoria('LOGIN', 'Usuario'), authController.login.bind(authController));
router.post('/registro', registrarAuditoria('CREATE', 'Prefeitura'), authController.registro.bind(authController));

// Gov.br OAuth
router.get('/govbr', authController.govbrRedirect.bind(authController));
router.get('/govbr/callback', authController.govbrCallback.bind(authController));
router.post('/govbr/completar', registrarAuditoria('CREATE', 'Usuario'), authController.completarRegistroGovBr.bind(authController));

// Rotas autenticadas
router.get('/me', auth, authController.me.bind(authController));
router.put('/me', auth, registrarAuditoria('UPDATE', 'Usuario'), authController.atualizarPerfil.bind(authController));
router.put('/senha', auth, authController.alterarSenha.bind(authController));
router.post('/onboarding', auth, authController.onboarding.bind(authController));

module.exports = router;
