const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const documentoService = require('../services/documentoService');
const prisma = require('../config/database');

router.use(auth);

// GET /api/documentos - Listar todos os documentos do cemitério
router.get('/', async (req, res, next) => {
  try {
    const { cemiterioId, tipo, status } = req.query;
    const where = {};

    if (cemiterioId) {
      where.cemiterioId = cemiterioId;
      where.cemiterio = { prefeituraId: req.prefeituraId };
    } else {
      where.OR = [
        { cemiterio: { prefeituraId: req.prefeituraId } },
        { licenciamento: { cemiterio: { prefeituraId: req.prefeituraId } } },
      ];
    }

    if (tipo) where.tipo = tipo;
    if (status) where.status = status;

    const documentos = await prisma.documento.findMany({
      where,
      include: {
        usuario: { select: { nome: true } },
        cemiterio: { select: { nome: true } },
        licenciamento: { select: { tipo: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(documentos);
  } catch (error) {
    next(error);
  }
});

// GET /api/documentos/:id/download - Download de documento
router.get('/:id/download', async (req, res, next) => {
  try {
    const { caminho, nomeArquivo, mimeType } = await documentoService.download(req.params.id, req.prefeituraId);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Type', mimeType);
    const fs = require('fs');
    fs.createReadStream(caminho).pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
