const prisma = require('../config/database');
const logger = require('../config/logger');
const checklistService = require('./checklistService');
const riscoService = require('./riscoService');

class CemiterioService {
  // Criar cemitério
  async criar(dados, prefeituraId, usuarioId) {
    // Calcular sepulturas disponíveis se tiver dados
    if (dados.totalSepulturas && dados.sepulturasOcupadas) {
      dados.sepulturasDisponiveis = dados.totalSepulturas - dados.sepulturasOcupadas;
      dados.percentualOcupacao = (dados.sepulturasOcupadas / dados.totalSepulturas) * 100;
    }

    // Calcular risco de necrochorume
    if (dados.tipoSolo || dados.nivelLencolFreatico || dados.volumeEnterrosAnual) {
      dados.riscoNecrochorume = riscoService.calcularRiscoNecrochorume({
        tipoSolo: dados.tipoSolo,
        nivelLencolFreatico: dados.nivelLencolFreatico,
        distanciaCorpoHidrico: dados.distanciaCorpoHidrico,
        volumeEnterrosAnual: dados.volumeEnterrosAnual,
        possuiDrenagem: dados.possuiDrenagem,
        areaTotal: dados.areaTotal,
        totalSepulturas: dados.totalSepulturas,
      });
    }

    const cemiterio = await prisma.cemiterio.create({
      data: {
        prefeituraId,
        nome: dados.nome,
        tipo: dados.tipo || 'MUNICIPAL',
        endereco: dados.endereco,
        cidade: dados.cidade,
        uf: dados.uf,
        cep: dados.cep,
        latitude: dados.latitude,
        longitude: dados.longitude,
        areaTotal: dados.areaTotal,
        anoFundacao: dados.anoFundacao,
        tipoSolo: dados.tipoSolo,
        nivelLencolFreatico: dados.nivelLencolFreatico,
        distanciaCorpoHidrico: dados.distanciaCorpoHidrico,
        volumeEnterrosAnual: dados.volumeEnterrosAnual,
        totalSepulturas: dados.totalSepulturas,
        sepulturasOcupadas: dados.sepulturasOcupadas,
        sepulturasDisponiveis: dados.sepulturasDisponiveis,
        riscoNecrochorume: dados.riscoNecrochorume,
        percentualOcupacao: dados.percentualOcupacao,
        possuiOssario: dados.possuiOssario || false,
        possuiCapela: dados.possuiCapela || false,
        possuiDrenagem: dados.possuiDrenagem || false,
        possuiLiminar: dados.possuiLiminar || false,
        prazoLiminar: dados.prazoLiminar ? new Date(dados.prazoLiminar) : null,
        observacoes: dados.observacoes,
        status: 'CADASTRO',
      },
    });

    // Gerar checklist automático CONAMA 335 + regras estaduais
    await checklistService.gerarChecklist(cemiterio.id, dados.uf);

    logger.info(`Cemitério criado: ${cemiterio.nome} (${cemiterio.id})`, { usuarioId });

    // Retornar cemitério com checklist
    return this.buscarPorId(cemiterio.id, prefeituraId);
  }

  // Buscar por ID
  async buscarPorId(id, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({
      where: { id },
      include: {
        arquivos: { orderBy: { createdAt: 'desc' } },
        checklistItens: { orderBy: { categoria: 'asc' } },
        licenciamentos: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        monitoramentos: {
          orderBy: { dataColeta: 'desc' },
          take: 3,
        },
        dadosImportados: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { licenciamentos: true, monitoramentos: true, documentos: true },
        },
      },
    });

    if (!cemiterio) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    if (prefeituraId && cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Agregar dados do checklist
    const totalChecklist = cemiterio.checklistItens.length;
    const conformes = cemiterio.checklistItens.filter(i => i.conforme === true).length;
    const naoConformes = cemiterio.checklistItens.filter(i => i.conforme === false).length;
    const pendentes = cemiterio.checklistItens.filter(i => i.conforme === null).length;

    return {
      ...cemiterio,
      resumoChecklist: {
        total: totalChecklist,
        conformes,
        naoConformes,
        pendentes,
        percentualConformidade: totalChecklist > 0 ? Math.round((conformes / totalChecklist) * 100) : 0,
      },
    };
  }

  // Listar cemitérios da prefeitura
  async listar(prefeituraId, { pagina = 1, limite = 20, status, busca, comLiminar } = {}) {
    const where = { prefeituraId };

    if (status) where.status = status;
    if (comLiminar === 'true') where.possuiLiminar = true;
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cidade: { contains: busca, mode: 'insensitive' } },
        { endereco: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const [total, cemiterios] = await Promise.all([
      prisma.cemiterio.count({ where }),
      prisma.cemiterio.findMany({
        where,
        include: {
          _count: { select: { licenciamentos: true, monitoramentos: true } },
        },
        orderBy: [
          { possuiLiminar: 'desc' }, // Liminares primeiro
          { createdAt: 'desc' },
        ],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: cemiterios,
      paginacao: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    };
  }

  // Atualizar cemitério
  async atualizar(id, dados, prefeituraId, usuarioId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id } });

    if (!cemiterio) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }
    if (cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Recalcular métricas se dados relevantes mudaram
    const dadosAtualizacao = { ...dados };

    if (dados.totalSepulturas !== undefined || dados.sepulturasOcupadas !== undefined) {
      const total = dados.totalSepulturas ?? cemiterio.totalSepulturas;
      const ocupadas = dados.sepulturasOcupadas ?? cemiterio.sepulturasOcupadas;
      if (total && ocupadas) {
        dadosAtualizacao.sepulturasDisponiveis = total - ocupadas;
        dadosAtualizacao.percentualOcupacao = (ocupadas / total) * 100;
      }
    }

    if (dados.tipoSolo || dados.nivelLencolFreatico || dados.volumeEnterrosAnual) {
      dadosAtualizacao.riscoNecrochorume = riscoService.calcularRiscoNecrochorume({
        tipoSolo: dados.tipoSolo ?? cemiterio.tipoSolo,
        nivelLencolFreatico: dados.nivelLencolFreatico ?? cemiterio.nivelLencolFreatico,
        distanciaCorpoHidrico: dados.distanciaCorpoHidrico ?? cemiterio.distanciaCorpoHidrico,
        volumeEnterrosAnual: dados.volumeEnterrosAnual ?? cemiterio.volumeEnterrosAnual,
        possuiDrenagem: dados.possuiDrenagem ?? cemiterio.possuiDrenagem,
        areaTotal: dados.areaTotal ?? cemiterio.areaTotal,
        totalSepulturas: dados.totalSepulturas ?? cemiterio.totalSepulturas,
      });
    }

    // Tratar prazoLiminar
    if (dados.prazoLiminar) {
      dadosAtualizacao.prazoLiminar = new Date(dados.prazoLiminar);
    }

    // Remover campos que não existem na tabela
    delete dadosAtualizacao.arquivos;
    delete dadosAtualizacao.checklistItens;

    const atualizado = await prisma.cemiterio.update({
      where: { id },
      data: dadosAtualizacao,
    });

    logger.info(`Cemitério atualizado: ${id}`, { usuarioId });

    return this.buscarPorId(id, prefeituraId);
  }

  // Upload de arquivo
  async adicionarArquivo(cemiterioId, arquivo, tipo, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: cemiterioId } });

    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    return prisma.arquivoCemiterio.create({
      data: {
        cemiterioId,
        tipo: tipo || 'OUTRO',
        nomeOriginal: arquivo.originalname,
        caminho: arquivo.path,
        tamanho: arquivo.size,
        mimeType: arquivo.mimetype,
      },
    });
  }

  // Remover arquivo
  async removerArquivo(arquivoId, prefeituraId) {
    const arquivo = await prisma.arquivoCemiterio.findUnique({
      where: { id: arquivoId },
      include: { cemiterio: true },
    });

    if (!arquivo || arquivo.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Arquivo não encontrado'), { statusCode: 404 });
    }

    // Deletar arquivo físico
    const fs = require('fs');
    if (fs.existsSync(arquivo.caminho)) {
      fs.unlinkSync(arquivo.caminho);
    }

    await prisma.arquivoCemiterio.delete({ where: { id: arquivoId } });
  }

  // Atualizar item do checklist
  async atualizarChecklist(itemId, dados, prefeituraId, usuarioId) {
    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { cemiterio: true },
    });

    if (!item || item.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Item não encontrado'), { statusCode: 404 });
    }

    return prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        conforme: dados.conforme,
        observacao: dados.observacao,
        evidencia: dados.evidencia,
        verificadoPor: usuarioId,
        verificadoEm: new Date(),
      },
    });
  }

  // Estatísticas dos cemitérios
  async obterEstatisticas(prefeituraId) {
    const cemiterios = await prisma.cemiterio.findMany({
      where: { prefeituraId },
      select: {
        id: true,
        nome: true,
        status: true,
        riscoNecrochorume: true,
        percentualOcupacao: true,
        possuiLiminar: true,
        prazoLiminar: true,
        areaTotal: true,
        totalSepulturas: true,
        sepulturasOcupadas: true,
        sepulturasDisponiveis: true,
      },
    });

    const stats = {
      total: cemiterios.length,
      porStatus: {},
      comLiminar: cemiterios.filter(c => c.possuiLiminar).length,
      riscoAlto: cemiterios.filter(c => (c.riscoNecrochorume || 0) > 70).length,
      superlotados: cemiterios.filter(c => (c.percentualOcupacao || 0) > 90).length,
      areaTotal: cemiterios.reduce((sum, c) => sum + (c.areaTotal || 0), 0),
      totalSepulturas: cemiterios.reduce((sum, c) => sum + (c.totalSepulturas || 0), 0),
      sepulturasOcupadas: cemiterios.reduce((sum, c) => sum + (c.sepulturasOcupadas || 0), 0),
      liminaresPendentes: cemiterios
        .filter(c => c.possuiLiminar && c.prazoLiminar)
        .map(c => ({
          cemiterioId: c.id,
          nome: c.nome,
          prazo: c.prazoLiminar,
          diasRestantes: Math.ceil((new Date(c.prazoLiminar) - new Date()) / (1000 * 60 * 60 * 24)),
        }))
        .sort((a, b) => a.diasRestantes - b.diasRestantes),
    };

    for (const c of cemiterios) {
      stats.porStatus[c.status] = (stats.porStatus[c.status] || 0) + 1;
    }

    return stats;
  }
}

module.exports = new CemiterioService();
