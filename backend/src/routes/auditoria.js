const express = require('express');
const router = express.Router();
const { auth, autorizar } = require('../middlewares/auth');
const auditoriaService = require('../services/auditoriaService');

router.use(auth);

// GET /api/auditoria - Listar logs (apenas Admin e Auditor)
router.get('/', autorizar('ADMIN', 'AUDITOR'), async (req, res, next) => {
  try {
    const resultado = await auditoriaService.listar(req.prefeituraId, {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 50,
      entidade: req.query.entidade,
      acao: req.query.acao,
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
