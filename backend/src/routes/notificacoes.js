const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const notificacaoService = require('../services/notificacaoService');

router.use(auth);

// GET /api/notificacoes - Listar notificações
router.get('/', async (req, res, next) => {
  try {
    const resultado = await notificacaoService.listar(req.prefeituraId, {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 20,
      apenasNaoLidas: req.query.naoLidas === 'true',
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// GET /api/notificacoes/contagem - Contar não lidas
router.get('/contagem', async (req, res, next) => {
  try {
    const total = await notificacaoService.contarNaoLidas(req.prefeituraId);
    res.json({ naoLidas: total });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notificacoes/:id/lida - Marcar como lida
router.put('/:id/lida', async (req, res, next) => {
  try {
    const notificacao = await notificacaoService.marcarComoLida(req.params.id, req.prefeituraId);
    res.json(notificacao);
  } catch (error) {
    next(error);
  }
});

// PUT /api/notificacoes/lidas - Marcar todas como lidas
router.put('/lidas', async (req, res, next) => {
  try {
    await notificacaoService.marcarTodasComoLidas(req.prefeituraId);
    res.json({ message: 'Todas notificações marcadas como lidas' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
