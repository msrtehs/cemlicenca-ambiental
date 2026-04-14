const prisma = require('../config/database');
const logger = require('../config/logger');

class PrefeituraService {
  // Buscar prefeitura por ID
  async buscarPorId(id) {
    const prefeitura = await prisma.prefeitura.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            usuarios: true,
            cemiterios: true,
            contratos: true,
          },
        },
      },
    });

    if (!prefeitura) {
      throw Object.assign(new Error('Prefeitura não encontrada'), { statusCode: 404 });
    }

    return prefeitura;
  }

  // Buscar prefeitura por CNPJ
  async buscarPorCnpj(cnpj) {
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
    return prisma.prefeitura.findUnique({
      where: { cnpj: cnpjLimpo },
    });
  }

  // Listar prefeituras (para consultores/admins)
  async listar({ pagina = 1, limite = 20, uf, busca }) {
    const where = {};

    if (uf) {
      where.uf = uf;
    }

    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cidade: { contains: busca, mode: 'insensitive' } },
        { cnpj: { contains: busca.replace(/[^\d]/g, '') } },
      ];
    }

    const [total, prefeituras] = await Promise.all([
      prisma.prefeitura.count({ where }),
      prisma.prefeitura.findMany({
        where,
        include: {
          _count: {
            select: {
              cemiterios: true,
              usuarios: true,
            },
          },
        },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: prefeituras,
      paginacao: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  // Atualizar dados da prefeitura
  async atualizar(id, dados, usuarioId) {
    const prefeitura = await prisma.prefeitura.findUnique({ where: { id } });
    if (!prefeitura) {
      throw Object.assign(new Error('Prefeitura não encontrada'), { statusCode: 404 });
    }

    // Campos permitidos para atualização
    const dadosAtualizacao = {};
    const camposPermitidos = ['nome', 'cep', 'endereco', 'telefone', 'email', 'populacao'];

    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) {
        dadosAtualizacao[campo] = dados[campo];
      }
    }

    const atualizada = await prisma.prefeitura.update({
      where: { id },
      data: dadosAtualizacao,
    });

    logger.info(`Prefeitura atualizada: ${id}`, { usuarioId });

    return atualizada;
  }

  // Dashboard resumo da prefeitura
  async obterResumo(prefeituraId) {
    const [
      prefeitura,
      totalCemiterios,
      cemiteriosComLiminar,
      licenciamentosAtivos,
      contratoAtivo,
      notificacoesNaoLidas,
    ] = await Promise.all([
      prisma.prefeitura.findUnique({ where: { id: prefeituraId } }),
      prisma.cemiterio.count({ where: { prefeituraId } }),
      prisma.cemiterio.count({ where: { prefeituraId, possuiLiminar: true } }),
      prisma.licenciamento.count({
        where: {
          cemiterio: { prefeituraId },
          status: { notIn: ['LICENCA_EMITIDA', 'INDEFERIDO', 'CANCELADO'] },
        },
      }),
      prisma.contrato.findFirst({
        where: { prefeituraId, status: 'ATIVO' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notificacao.count({
        where: { prefeituraId, lida: false },
      }),
    ]);

    return {
      prefeitura,
      resumo: {
        totalCemiterios,
        cemiteriosComLiminar,
        licenciamentosAtivos,
        planoAtual: prefeitura.planoAtual,
        contratoAtivo: !!contratoAtivo,
        notificacoesNaoLidas,
      },
    };
  }
}

module.exports = new PrefeituraService();
