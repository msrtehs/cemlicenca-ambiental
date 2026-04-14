const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const prisma = require('../config/database');

router.use(auth);

// GET /api/dashboard/resumo - Dashboard principal da prefeitura
router.get('/resumo', async (req, res, next) => {
  try {
    const prefeituraId = req.prefeituraId;

    const [
      prefeitura,
      cemiterios,
      licenciamentosAtivos,
      licenciamentosConcluidos,
      documentosGerados,
      notificacoesNaoLidas,
      contratoAtivo,
    ] = await Promise.all([
      prisma.prefeitura.findUnique({ where: { id: prefeituraId } }),
      prisma.cemiterio.findMany({
        where: { prefeituraId },
        select: {
          id: true, nome: true, status: true, riscoNecrochorume: true,
          percentualOcupacao: true, possuiLiminar: true, prazoLiminar: true,
        },
      }),
      prisma.licenciamento.count({
        where: {
          cemiterio: { prefeituraId },
          status: { notIn: ['LICENCA_EMITIDA', 'INDEFERIDO', 'CANCELADO'] },
        },
      }),
      prisma.licenciamento.count({
        where: {
          cemiterio: { prefeituraId },
          status: 'LICENCA_EMITIDA',
        },
      }),
      prisma.documento.count({
        where: {
          OR: [
            { cemiterio: { prefeituraId } },
            { licenciamento: { cemiterio: { prefeituraId } } },
          ],
        },
      }),
      prisma.notificacao.count({ where: { prefeituraId, lida: false } }),
      prisma.contrato.findFirst({
        where: { prefeituraId, status: 'ATIVO' },
      }),
    ]);

    // Alertas urgentes
    const alertas = [];

    for (const cem of cemiterios) {
      if (cem.possuiLiminar && cem.prazoLiminar) {
        const dias = Math.ceil((new Date(cem.prazoLiminar) - new Date()) / (1000 * 60 * 60 * 24));
        if (dias <= 30 && dias > 0) {
          alertas.push({
            tipo: 'LIMINAR',
            urgencia: dias <= 7 ? 'CRITICO' : dias <= 15 ? 'ALTO' : 'MEDIO',
            cemiterio: cem.nome,
            mensagem: `Liminar vence em ${dias} dias`,
            diasRestantes: dias,
          });
        }
      }

      if ((cem.riscoNecrochorume || 0) > 70) {
        alertas.push({
          tipo: 'RISCO',
          urgencia: 'ALTO',
          cemiterio: cem.nome,
          mensagem: `Risco de necrochorume: ${cem.riscoNecrochorume}%`,
        });
      }

      if ((cem.percentualOcupacao || 0) > 90) {
        alertas.push({
          tipo: 'SUPERLOTACAO',
          urgencia: 'MEDIO',
          cemiterio: cem.nome,
          mensagem: `Ocupação: ${cem.percentualOcupacao?.toFixed(1)}%`,
        });
      }
    }

    // Ordenar alertas por urgência
    const ordemUrgencia = { CRITICO: 0, ALTO: 1, MEDIO: 2 };
    alertas.sort((a, b) => (ordemUrgencia[a.urgencia] || 3) - (ordemUrgencia[b.urgencia] || 3));

    res.json({
      prefeitura: {
        nome: prefeitura.nome,
        plano: prefeitura.planoAtual,
      },
      cards: {
        totalCemiterios: cemiterios.length,
        comLiminar: cemiterios.filter(c => c.possuiLiminar).length,
        licenciamentosAtivos,
        licenciamentosConcluidos,
        documentosGerados,
        notificacoesNaoLidas,
      },
      alertas,
      cemiterios: cemiterios.map(c => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        risco: c.riscoNecrochorume,
        ocupacao: c.percentualOcupacao,
        liminar: c.possuiLiminar,
      })),
      contratoAtivo: !!contratoAtivo,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/estatisticas - Estatísticas para gráficos
router.get('/estatisticas', async (req, res, next) => {
  try {
    const prefeituraId = req.prefeituraId;

    // Licenciamentos por status
    const licPorStatus = await prisma.licenciamento.groupBy({
      by: ['status'],
      where: { cemiterio: { prefeituraId } },
      _count: { id: true },
    });

    // Cemitérios por status
    const cemPorStatus = await prisma.cemiterio.groupBy({
      by: ['status'],
      where: { prefeituraId },
      _count: { id: true },
    });

    // Documentos por tipo
    const docPorTipo = await prisma.documento.groupBy({
      by: ['tipo'],
      where: {
        OR: [
          { cemiterio: { prefeituraId } },
          { licenciamento: { cemiterio: { prefeituraId } } },
        ],
      },
      _count: { id: true },
    });

    // Últimos 6 meses de monitoramento
    const seisAtras = new Date();
    seisAtras.setMonth(seisAtras.getMonth() - 6);

    const monitoramentos = await prisma.monitoramento.findMany({
      where: {
        cemiterio: { prefeituraId },
        dataColeta: { gte: seisAtras },
      },
      select: {
        periodo: true,
        nivelNecrochorume: true,
        percentualOcupacao: true,
        novosSepultamentos: true,
        cemiterio: { select: { nome: true } },
      },
      orderBy: { dataColeta: 'asc' },
    });

    res.json({
      licenciamentosPorStatus: licPorStatus.map(l => ({ status: l.status, count: l._count.id })),
      cemiteriosPorStatus: cemPorStatus.map(c => ({ status: c.status, count: c._count.id })),
      documentosPorTipo: docPorTipo.map(d => ({ tipo: d.tipo, count: d._count.id })),
      evolucaoMonitoramento: monitoramentos,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
