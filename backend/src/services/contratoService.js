const prisma = require('../config/database');
const logger = require('../config/logger');
const notificacaoService = require('./notificacaoService');

// Tabela de preços por módulo (base 2026)
const TABELA_PRECOS = {
  // Valores base por tamanho de cemitério (hectares)
  faixas: [
    { maxHa: 1, fator: 0.7 },    // < 1ha
    { maxHa: 3, fator: 1.0 },    // 1-3ha
    { maxHa: 5, fator: 1.3 },    // 3-5ha
    { maxHa: 10, fator: 1.6 },   // 5-10ha
    { maxHa: Infinity, fator: 2.0 }, // > 10ha
  ],
  modulos: {
    cadastro: { base: 8000, descricao: 'Cadastro e Diagnóstico Ambiental' },
    licenciamento: { base: 22000, descricao: 'Licenciamento Automatizado Completo' },
    contratacao: { base: 5000, descricao: 'Gestão de Contratação e Justificativas' },
    monitoramento: { base: 0, mensalBase: 1200, descricao: 'Monitoramento Recorrente (mensal)' },
  },
  // Limite de dispensa (Decreto 12.807/2025, vigente 01/01/2026)
  limiteDispensa: 65492.11,
};

class ContratoService {
  // Calcular valor da contratação
  calcularValor({ modulosCemiterios, moduloMonitoramento = false }) {
    // modulosCemiterios: [{ areaHa, modulos: ['cadastro', 'licenciamento', ...] }]
    let valorTotalOneTime = 0;
    let valorMensalTotal = 0;
    const detalhamento = [];

    for (const item of modulosCemiterios) {
      // Determinar fator de tamanho
      const faixa = TABELA_PRECOS.faixas.find(f => (item.areaHa || 2) <= f.maxHa);
      const fator = faixa.fator;

      const modulosItem = item.modulos || ['cadastro', 'licenciamento', 'contratacao'];
      let subtotal = 0;

      for (const mod of modulosItem) {
        const config = TABELA_PRECOS.modulos[mod];
        if (!config) continue;

        const valorMod = Math.round(config.base * fator);
        subtotal += valorMod;

        detalhamento.push({
          cemiterio: item.nome || `Cemitério ${detalhamento.length + 1}`,
          modulo: config.descricao,
          valorBase: config.base,
          fatorTamanho: fator,
          valorFinal: valorMod,
        });
      }

      valorTotalOneTime += subtotal;
    }

    // Monitoramento mensal
    if (moduloMonitoramento) {
      const qtdCemiterios = modulosCemiterios.length;
      valorMensalTotal = TABELA_PRECOS.modulos.monitoramento.mensalBase * qtdCemiterios;
      // Desconto para múltiplos cemitérios
      if (qtdCemiterios >= 3) valorMensalTotal *= 0.85;
      else if (qtdCemiterios >= 5) valorMensalTotal *= 0.75;
      valorMensalTotal = Math.round(valorMensalTotal);
    }

    // Determinar modalidade de contratação
    const valorTotal = valorTotalOneTime + (valorMensalTotal * 12); // considerar 12 meses para comparação
    let modalidade;
    let tipoContrato;

    if (valorTotalOneTime <= TABELA_PRECOS.limiteDispensa) {
      modalidade = 'DISPENSA_ART75_II';
    } else {
      modalidade = 'INEXIGIBILIDADE_ART74_III';
    }

    if (valorMensalTotal > 0 && valorTotalOneTime > 0) {
      tipoContrato = 'ONE_TIME_PLUS_ASSINATURA';
    } else if (valorMensalTotal > 0) {
      tipoContrato = 'ASSINATURA';
    } else {
      tipoContrato = 'ONE_TIME';
    }

    // Opções de parcelamento
    const parcelamento = [];
    for (let p = 1; p <= 6; p++) {
      parcelamento.push({
        parcelas: p,
        valorParcela: Math.round(valorTotalOneTime / p * 100) / 100,
        total: valorTotalOneTime,
      });
    }

    return {
      valorOneTime: valorTotalOneTime,
      valorMensal: valorMensalTotal,
      valorAnualEstimado: valorTotalOneTime + (valorMensalTotal * 12),
      modalidade,
      modalidadeDescricao: this._descreverModalidade(modalidade),
      tipoContrato,
      limiteDispensa: TABELA_PRECOS.limiteDispensa,
      dentroDispensa: valorTotalOneTime <= TABELA_PRECOS.limiteDispensa,
      detalhamento,
      parcelamento,
    };
  }

  // Criar contrato
  async criar(dados, prefeituraId, usuarioId) {
    // Verificar se já existe contrato ativo
    const contratoAtivo = await prisma.contrato.findFirst({
      where: { prefeituraId, status: { in: ['ATIVO', 'ASSINADO'] } },
    });

    if (contratoAtivo) {
      throw Object.assign(new Error('Já existe um contrato ativo para esta prefeitura'), { statusCode: 409 });
    }

    const tipo = dados.valorMensal ? (dados.valorTotal ? 'ONE_TIME_PLUS_ASSINATURA' : 'ASSINATURA') : 'ONE_TIME';

    const contrato = await prisma.$transaction(async (tx) => {
      const c = await tx.contrato.create({
        data: {
          prefeituraId,
          tipo,
          modalidade: dados.modalidade,
          valorTotal: dados.valorTotal,
          valorMensal: dados.valorMensal,
          parcelas: dados.parcelas || 1,
          moduloCadastro: dados.moduloCadastro ?? true,
          moduloLicenciamento: dados.moduloLicenciamento ?? true,
          moduloContratacao: dados.moduloContratacao ?? true,
          moduloMonitoramento: dados.moduloMonitoramento ?? false,
          dataInicio: new Date(dados.dataInicio),
          dataFim: dados.dataFim ? new Date(dados.dataFim) : null,
          status: 'RASCUNHO',
        },
      });

      // Criar parcelas de pagamento
      if (dados.valorTotal > 0) {
        const valorParcela = Math.round(dados.valorTotal / (dados.parcelas || 1) * 100) / 100;
        for (let i = 1; i <= (dados.parcelas || 1); i++) {
          const vencimento = new Date(dados.dataInicio);
          vencimento.setMonth(vencimento.getMonth() + (i - 1));

          await tx.pagamento.create({
            data: {
              contratoId: c.id,
              parcela: i,
              valor: i === (dados.parcelas || 1)
                ? dados.valorTotal - (valorParcela * ((dados.parcelas || 1) - 1)) // última parcela ajusta centavos
                : valorParcela,
              dataVencimento: vencimento,
              status: 'PENDENTE',
            },
          });
        }
      }

      return c;
    });

    logger.info(`Contrato criado: ${contrato.id}`, { prefeituraId, usuarioId });

    return this.buscarPorId(contrato.id, prefeituraId);
  }

  // Buscar por ID
  async buscarPorId(id, prefeituraId) {
    const contrato = await prisma.contrato.findUnique({
      where: { id },
      include: {
        prefeitura: { select: { nome: true, cnpj: true, cidade: true, uf: true } },
        pagamentos: { orderBy: { parcela: 'asc' } },
      },
    });

    if (!contrato) throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    if (contrato.prefeituraId !== prefeituraId) throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });

    const pagas = contrato.pagamentos.filter(p => p.status === 'PAGO');
    const atrasadas = contrato.pagamentos.filter(p => p.status === 'ATRASADO');

    return {
      ...contrato,
      resumoPagamentos: {
        total: contrato.pagamentos.length,
        pagas: pagas.length,
        pendentes: contrato.pagamentos.filter(p => p.status === 'PENDENTE').length,
        atrasadas: atrasadas.length,
        valorPago: pagas.reduce((s, p) => s + p.valor, 0),
        valorPendente: contrato.pagamentos.filter(p => p.status !== 'PAGO').reduce((s, p) => s + p.valor, 0),
      },
    };
  }

  // Listar contratos
  async listar(prefeituraId) {
    return prisma.contrato.findMany({
      where: { prefeituraId },
      include: {
        pagamentos: { orderBy: { parcela: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Atualizar status do contrato
  async atualizarStatus(id, novoStatus, prefeituraId, usuarioId) {
    const contrato = await prisma.contrato.findUnique({ where: { id } });
    if (!contrato || contrato.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    const atualizado = await prisma.contrato.update({
      where: { id },
      data: { status: novoStatus },
    });

    // Se ativou o contrato, atualizar plano da prefeitura
    if (novoStatus === 'ATIVO') {
      let plano = 'BASICO';
      if (contrato.moduloMonitoramento) plano = 'PROFISSIONAL';
      if (contrato.valorTotal > 50000) plano = 'ENTERPRISE';

      await prisma.prefeitura.update({
        where: { id: prefeituraId },
        data: {
          planoAtual: plano,
          dataContrato: new Date(),
          dataExpiracao: contrato.dataFim,
          valorContrato: contrato.valorTotal,
        },
      });
    }

    logger.info(`Contrato ${id} -> status ${novoStatus}`, { usuarioId });
    return atualizado;
  }

  // Registrar pagamento
  async registrarPagamento(pagamentoId, dados, prefeituraId, usuarioId) {
    const pagamento = await prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: { contrato: true },
    });

    if (!pagamento || pagamento.contrato.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Pagamento não encontrado'), { statusCode: 404 });
    }

    const atualizado = await prisma.pagamento.update({
      where: { id: pagamentoId },
      data: {
        status: 'PAGO',
        dataPagamento: dados.dataPagamento ? new Date(dados.dataPagamento) : new Date(),
        comprovante: dados.comprovante,
      },
    });

    logger.info(`Pagamento registrado: parcela ${pagamento.parcela}`, { pagamentoId, usuarioId });
    return atualizado;
  }

  _descreverModalidade(modalidade) {
    const desc = {
      DISPENSA_ART75_II: `Dispensa de licitação (Art. 75, II da Lei 14.133/2021 c/c Decreto 12.807/2025) - Valor dentro do limite de R$ ${TABELA_PRECOS.limiteDispensa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      INEXIGIBILIDADE_ART74_III: 'Inexigibilidade de licitação (Art. 74, III da Lei 14.133/2021) - Serviço técnico especializado de natureza predominantemente intelectual com notória especialização',
      LICITACAO_PREGAO: 'Licitação na modalidade pregão eletrônico',
    };
    return desc[modalidade] || modalidade;
  }
}

module.exports = new ContratoService();
