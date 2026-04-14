const prisma = require('../config/database');
const logger = require('../config/logger');
const riscoService = require('./riscoService');
const checklistService = require('./checklistService');
const notificacaoService = require('./notificacaoService');

// Etapas padrão do fluxo de licenciamento
const ETAPAS_LICENCIAMENTO = [
  { ordem: 1, nome: 'Diagnóstico Ambiental', descricao: 'Checklist CONAMA 335 + análise de risco necrochorume + relatório diagnóstico' },
  { ordem: 2, nome: 'Projeto Básico', descricao: 'Geração de RCA, PCA e documentos técnicos obrigatórios' },
  { ordem: 3, nome: 'Documentação Legal', descricao: 'Memorial descritivo, ART/RRT, laudos técnicos' },
  { ordem: 4, nome: 'Protocolo no Órgão Ambiental', descricao: 'Envio do requerimento ao órgão estadual competente' },
  { ordem: 5, nome: 'Acompanhamento', descricao: 'Monitorar análise, responder exigências complementares' },
  { ordem: 6, nome: 'Licença Emitida', descricao: 'Download da licença + início do monitoramento' },
];

const ETAPAS_EXPRESS = [
  { ordem: 1, nome: 'Diagnóstico Rápido', descricao: 'Checklist simplificado + relatório básico' },
  { ordem: 2, nome: 'Relatório Técnico', descricao: 'Documento técnico consolidado para dispensa' },
  { ordem: 3, nome: 'Protocolo Simplificado', descricao: 'Envio direto ao órgão ambiental' },
  { ordem: 4, nome: 'Licença Emitida', descricao: 'Download da licença simplificada' },
];

class LicenciamentoService {
  // Iniciar licenciamento
  async criar(dados, prefeituraId, usuarioId) {
    const cemiterio = await prisma.cemiterio.findUnique({
      where: { id: dados.cemiterioId },
      include: { checklistItens: true },
    });

    if (!cemiterio) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }
    if (cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Verificar se já existe licenciamento ativo
    const ativo = await prisma.licenciamento.findFirst({
      where: {
        cemiterioId: dados.cemiterioId,
        status: { notIn: ['LICENCA_EMITIDA', 'INDEFERIDO', 'CANCELADO'] },
      },
    });

    if (ativo) {
      throw Object.assign(new Error('Já existe um licenciamento em andamento para este cemitério'), { statusCode: 409 });
    }

    // Buscar regras do estado
    const regrasEstado = await prisma.regraEstadual.findFirst({
      where: { uf: cemiterio.uf, ativo: true },
    });

    // Calcular diagnóstico automático
    const risco = riscoService.gerarRelatorioRisco(cemiterio);
    const checklist = await checklistService.obterChecklist(cemiterio.id);
    const totalItens = checklist.reduce((s, g) => s + g.total, 0);
    const conformes = checklist.reduce((s, g) => s + g.conformes, 0);
    const percentualConformidade = totalItens > 0 ? Math.round((conformes / totalItens) * 100) : 0;

    const isExpress = dados.isExpress || false;
    const etapas = isExpress ? ETAPAS_EXPRESS : ETAPAS_LICENCIAMENTO;

    // Criar licenciamento com etapas em transação
    const licenciamento = await prisma.$transaction(async (tx) => {
      const lic = await tx.licenciamento.create({
        data: {
          cemiterioId: dados.cemiterioId,
          tipo: dados.tipoLicenca,
          status: 'DIAGNOSTICO',
          percentualConformidade,
          riscoGeral: risco.nivel,
          diagnosticoJson: {
            risco,
            checklist: checklist.map(g => ({
              categoria: g.categoria,
              total: g.total,
              conformes: g.conformes,
              naoConformes: g.naoConformes,
            })),
            percentualConformidade,
            dataAnalise: new Date().toISOString(),
          },
          orgaoAmbiental: dados.orgaoAmbiental || regrasEstado?.orgaoAmbiental || null,
          isExpress,
          prazoLiminar: cemiterio.prazoLiminar,
          observacoes: dados.observacoes,
        },
      });

      // Criar etapas
      for (const etapa of etapas) {
        await tx.etapaLicenciamento.create({
          data: {
            licenciamentoId: lic.id,
            ordem: etapa.ordem,
            nome: etapa.nome,
            descricao: etapa.descricao,
            status: etapa.ordem === 1 ? 'EM_ANDAMENTO' : 'PENDENTE',
            dataInicio: etapa.ordem === 1 ? new Date() : null,
          },
        });
      }

      // Atualizar status do cemitério
      await tx.cemiterio.update({
        where: { id: dados.cemiterioId },
        data: { status: 'EM_LICENCIAMENTO' },
      });

      return lic;
    });

    logger.info(`Licenciamento iniciado: ${licenciamento.id} (${dados.tipoLicenca}) para cemitério ${dados.cemiterioId}`, { usuarioId });

    // Notificar
    await notificacaoService.criar({
      prefeituraId,
      tipo: 'ATUALIZACAO_STATUS',
      canal: 'INTERNO',
      titulo: `Licenciamento ${dados.tipoLicenca} iniciado - ${cemiterio.nome}`,
      mensagem: `O processo de licenciamento ${isExpress ? 'EXPRESS' : 'completo'} (${dados.tipoLicenca}) foi iniciado para o cemitério "${cemiterio.nome}". Diagnóstico: conformidade ${percentualConformidade}%, risco ${risco.nivel}.`,
      destinatario: 'sistema',
    });

    return this.buscarPorId(licenciamento.id, prefeituraId);
  }

  // Buscar por ID
  async buscarPorId(id, prefeituraId) {
    const licenciamento = await prisma.licenciamento.findUnique({
      where: { id },
      include: {
        cemiterio: {
          select: {
            id: true, nome: true, cidade: true, uf: true,
            prefeituraId: true, possuiLiminar: true, prazoLiminar: true,
          },
        },
        etapas: { orderBy: { ordem: 'asc' } },
        documentos: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!licenciamento) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }
    if (prefeituraId && licenciamento.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Calcular progresso
    const totalEtapas = licenciamento.etapas.length;
    const etapasConcluidas = licenciamento.etapas.filter(e => e.status === 'CONCLUIDA').length;
    const etapaAtual = licenciamento.etapas.find(e => e.status === 'EM_ANDAMENTO');

    // Verificar prazos
    let diasRestantesLiminar = null;
    if (licenciamento.prazoLiminar) {
      diasRestantesLiminar = Math.ceil(
        (new Date(licenciamento.prazoLiminar) - new Date()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      ...licenciamento,
      progresso: {
        totalEtapas,
        etapasConcluidas,
        percentual: totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0,
        etapaAtual: etapaAtual?.nome || 'Concluído',
      },
      diasRestantesLiminar,
      urgente: diasRestantesLiminar !== null && diasRestantesLiminar <= 30,
    };
  }

  // Listar licenciamentos
  async listar(prefeituraId, { pagina = 1, limite = 20, status, cemiterioId } = {}) {
    const where = { cemiterio: { prefeituraId } };
    if (status) where.status = status;
    if (cemiterioId) where.cemiterioId = cemiterioId;

    const [total, licenciamentos] = await Promise.all([
      prisma.licenciamento.count({ where }),
      prisma.licenciamento.findMany({
        where,
        include: {
          cemiterio: { select: { id: true, nome: true, cidade: true, uf: true, possuiLiminar: true, prazoLiminar: true } },
          etapas: { orderBy: { ordem: 'asc' } },
          _count: { select: { documentos: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    // Adicionar progresso a cada licenciamento
    const comProgresso = licenciamentos.map(lic => {
      const totalEtapas = lic.etapas.length;
      const concluidas = lic.etapas.filter(e => e.status === 'CONCLUIDA').length;
      const atual = lic.etapas.find(e => e.status === 'EM_ANDAMENTO');

      return {
        ...lic,
        progresso: {
          totalEtapas,
          etapasConcluidas: concluidas,
          percentual: totalEtapas > 0 ? Math.round((concluidas / totalEtapas) * 100) : 0,
          etapaAtual: atual?.nome || (concluidas === totalEtapas ? 'Concluído' : 'Aguardando'),
        },
      };
    });

    return {
      dados: comProgresso,
      paginacao: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    };
  }

  // Avançar etapa
  async avancarEtapa(licenciamentoId, prefeituraId, usuarioId, observacao) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: {
        cemiterio: true,
        etapas: { orderBy: { ordem: 'asc' } },
      },
    });

    if (!lic) throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    if (lic.cemiterio.prefeituraId !== prefeituraId) throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });

    const etapaAtual = lic.etapas.find(e => e.status === 'EM_ANDAMENTO');
    if (!etapaAtual) {
      throw Object.assign(new Error('Nenhuma etapa em andamento'), { statusCode: 400 });
    }

    const proximaEtapa = lic.etapas.find(e => e.ordem === etapaAtual.ordem + 1);

    await prisma.$transaction(async (tx) => {
      // Concluir etapa atual
      await tx.etapaLicenciamento.update({
        where: { id: etapaAtual.id },
        data: {
          status: 'CONCLUIDA',
          dataConclusao: new Date(),
          observacao,
        },
      });

      if (proximaEtapa) {
        // Iniciar próxima etapa
        await tx.etapaLicenciamento.update({
          where: { id: proximaEtapa.id },
          data: {
            status: 'EM_ANDAMENTO',
            dataInicio: new Date(),
          },
        });

        // Atualizar status do licenciamento conforme etapa
        const statusMap = {
          'Projeto Básico': 'PROJETO_BASICO',
          'Relatório Técnico': 'PROJETO_BASICO',
          'Documentação Legal': 'AGUARDANDO_PROTOCOLO',
          'Protocolo no Órgão Ambiental': 'PROTOCOLADO',
          'Protocolo Simplificado': 'PROTOCOLADO',
          'Acompanhamento': 'EM_ANALISE',
          'Licença Emitida': 'LICENCA_EMITIDA',
        };

        const novoStatus = statusMap[proximaEtapa.nome] || lic.status;
        await tx.licenciamento.update({
          where: { id: licenciamentoId },
          data: { status: novoStatus },
        });
      } else {
        // Última etapa - licença emitida
        await tx.licenciamento.update({
          where: { id: licenciamentoId },
          data: {
            status: 'LICENCA_EMITIDA',
            dataEmissao: new Date(),
            dataValidade: new Date(Date.now() + 4 * 365 * 24 * 60 * 60 * 1000), // 4 anos padrão
          },
        });

        await tx.cemiterio.update({
          where: { id: lic.cemiterioId },
          data: { status: 'LICENCIADO' },
        });
      }
    });

    logger.info(`Etapa avançada: ${etapaAtual.nome} -> ${proximaEtapa?.nome || 'CONCLUÍDO'}`, { licenciamentoId, usuarioId });

    // Notificar
    await notificacaoService.criar({
      prefeituraId,
      tipo: 'ATUALIZACAO_STATUS',
      canal: 'INTERNO',
      titulo: `Etapa concluída - ${lic.cemiterio.nome}`,
      mensagem: `Etapa "${etapaAtual.nome}" concluída. ${proximaEtapa ? `Próxima: "${proximaEtapa.nome}"` : 'LICENCIAMENTO CONCLUÍDO!'}`,
      destinatario: 'sistema',
    });

    return this.buscarPorId(licenciamentoId, prefeituraId);
  }

  // Registrar número de protocolo
  async registrarProtocolo(licenciamentoId, dados, prefeituraId, usuarioId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: { cemiterio: true },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    const atualizado = await prisma.licenciamento.update({
      where: { id: licenciamentoId },
      data: {
        numeroProtocolo: dados.numeroProtocolo,
        dataProtocolo: dados.dataProtocolo ? new Date(dados.dataProtocolo) : new Date(),
        orgaoAmbiental: dados.orgaoAmbiental || lic.orgaoAmbiental,
        status: 'PROTOCOLADO',
      },
    });

    logger.info(`Protocolo registrado: ${dados.numeroProtocolo}`, { licenciamentoId, usuarioId });

    return this.buscarPorId(licenciamentoId, prefeituraId);
  }

  // Registrar exigências do órgão
  async registrarExigencias(licenciamentoId, dados, prefeituraId, usuarioId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: { cemiterio: true },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    await prisma.licenciamento.update({
      where: { id: licenciamentoId },
      data: {
        status: 'EXIGENCIAS',
        observacoes: dados.descricao,
        prazoLegal: dados.prazo ? new Date(dados.prazo) : null,
      },
    });

    // Notificar urgência
    await notificacaoService.criar({
      prefeituraId,
      tipo: 'ATUALIZACAO_STATUS',
      canal: 'EMAIL',
      titulo: `EXIGÊNCIAS do órgão ambiental - ${lic.cemiterio.nome}`,
      mensagem: `O ${lic.orgaoAmbiental || 'órgão ambiental'} solicitou exigências complementares para o licenciamento do cemitério "${lic.cemiterio.nome}".\n\nDescrição: ${dados.descricao}\n${dados.prazo ? `Prazo: ${new Date(dados.prazo).toLocaleDateString('pt-BR')}` : ''}`,
      destinatario: lic.cemiterio.prefeituraId,
    });

    return this.buscarPorId(licenciamentoId, prefeituraId);
  }

  // Cancelar licenciamento
  async cancelar(licenciamentoId, motivo, prefeituraId, usuarioId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: { cemiterio: true },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    await prisma.licenciamento.update({
      where: { id: licenciamentoId },
      data: {
        status: 'CANCELADO',
        observacoes: `CANCELADO: ${motivo}`,
      },
    });

    logger.info(`Licenciamento cancelado: ${licenciamentoId}`, { motivo, usuarioId });
  }

  // Obter órgãos ambientais por UF
  async obterOrgaoAmbiental(uf) {
    const regras = await prisma.regraEstadual.findMany({
      where: { uf, ativo: true },
    });

    return regras.map(r => ({
      orgao: r.orgaoAmbiental,
      norma: r.norma,
      requisitos: r.requisitos,
      apiDisponivel: r.apiDisponivel,
      urlProtocolo: r.urlProtocolo,
    }));
  }
}

module.exports = new LicenciamentoService();
