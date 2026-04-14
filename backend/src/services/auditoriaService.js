const prisma = require('../config/database');

class AuditoriaService {
  // Listar logs de auditoria da prefeitura
  async listar(prefeituraId, { pagina = 1, limite = 50, entidade, acao } = {}) {
    // Buscar IDs de usuários da prefeitura
    const usuarios = await prisma.usuario.findMany({
      where: { prefeituraId },
      select: { id: true },
    });
    const userIds = usuarios.map(u => u.id);

    const where = { usuarioId: { in: userIds } };
    if (entidade) where.entidade = entidade;
    if (acao) where.acao = acao;

    const [total, logs] = await Promise.all([
      prisma.logAuditoria.count({ where }),
      prisma.logAuditoria.findMany({
        where,
        include: {
          usuario: {
            select: { id: true, nome: true, email: true, perfil: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: logs,
      paginacao: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  // Registrar ação manual
  async registrar({ usuarioId, acao, entidade, entidadeId, detalhes, ip, userAgent }) {
    return prisma.logAuditoria.create({
      data: { usuarioId, acao, entidade, entidadeId, detalhes, ip, userAgent },
    });
  }
}

module.exports = new AuditoriaService();
