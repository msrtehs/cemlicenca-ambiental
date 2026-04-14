const prisma = require('../config/database');
const logger = require('../config/logger');
const notificacaoService = require('./notificacaoService');

class MonitoramentoService {
  // Criar registro de monitoramento
  async criar(dados, prefeituraId, usuarioId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: dados.cemiterioId } });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    // Avaliar alertas automáticos
    const alertas = this._avaliarAlertas(dados, cemiterio);

    const monitoramento = await prisma.monitoramento.create({
      data: {
        cemiterioId: dados.cemiterioId,
        periodo: dados.periodo,
        dataColeta: new Date(dados.dataColeta),
        nivelNecrochorume: dados.nivelNecrochorume,
        phSolo: dados.phSolo,
        nivelLencolFreatico: dados.nivelLencolFreatico,
        percentualOcupacao: dados.percentualOcupacao,
        novosSepultamentos: dados.novosSepultamentos,
        exumacoes: dados.exumacoes,
        ossariosUtilizados: dados.ossariosUtilizados,
        alertaContaminacao: alertas.contaminacao,
        alertaSuperlotacao: alertas.superlotacao,
        alertaManutencao: alertas.manutencao,
        descricaoAlerta: alertas.descricao || null,
        status: alertas.temAlerta ? 'ALERTA' : 'CONCLUIDO',
      },
    });

    // Atualizar dados do cemitério com últimos valores
    const updateData = {};
    if (dados.percentualOcupacao != null) updateData.percentualOcupacao = dados.percentualOcupacao;
    if (dados.nivelLencolFreatico != null) updateData.nivelLencolFreatico = dados.nivelLencolFreatico;
    if (Object.keys(updateData).length > 0) {
      await prisma.cemiterio.update({ where: { id: dados.cemiterioId }, data: updateData });
    }

    // Enviar notificações de alerta
    if (alertas.temAlerta) {
      await notificacaoService.criar({
        prefeituraId,
        tipo: 'ALERTA_MONITORAMENTO',
        canal: 'INTERNO',
        titulo: `ALERTA: Monitoramento ${cemiterio.nome} - ${dados.periodo}`,
        mensagem: alertas.descricao,
        destinatario: 'sistema',
      });

      if (alertas.contaminacao) {
        await notificacaoService.criar({
          prefeituraId,
          tipo: 'ALERTA_MONITORAMENTO',
          canal: 'EMAIL',
          titulo: `URGENTE: Contaminação detectada - ${cemiterio.nome}`,
          mensagem: `Alerta de contaminação no cemitério "${cemiterio.nome}".\n\n${alertas.descricao}\n\nAcesse o sistema CemLicença para ver o relatório completo e ações recomendadas.`,
          destinatario: cemiterio.prefeituraId,
        });
      }
    }

    logger.info(`Monitoramento registrado: ${cemiterio.nome} - ${dados.periodo}`, { usuarioId });
    return this.buscarPorId(monitoramento.id, prefeituraId);
  }

  // Buscar por ID
  async buscarPorId(id, prefeituraId) {
    const mon = await prisma.monitoramento.findUnique({
      where: { id },
      include: {
        cemiterio: { select: { id: true, nome: true, cidade: true, uf: true, prefeituraId: true } },
      },
    });
    if (!mon) throw Object.assign(new Error('Monitoramento não encontrado'), { statusCode: 404 });
    if (prefeituraId && mon.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }
    return mon;
  }

  // Listar monitoramentos
  async listar(prefeituraId, { pagina = 1, limite = 20, cemiterioId, status } = {}) {
    const where = { cemiterio: { prefeituraId } };
    if (cemiterioId) where.cemiterioId = cemiterioId;
    if (status) where.status = status;

    const [total, monitoramentos] = await Promise.all([
      prisma.monitoramento.count({ where }),
      prisma.monitoramento.findMany({
        where,
        include: {
          cemiterio: { select: { id: true, nome: true, cidade: true } },
        },
        orderBy: { dataColeta: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: monitoramentos,
      paginacao: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    };
  }

  // Histórico de um cemitério (para gráficos)
  async historico(cemiterioId, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: cemiterioId } });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    const registros = await prisma.monitoramento.findMany({
      where: { cemiterioId },
      orderBy: { dataColeta: 'asc' },
      select: {
        id: true,
        periodo: true,
        dataColeta: true,
        nivelNecrochorume: true,
        phSolo: true,
        nivelLencolFreatico: true,
        percentualOcupacao: true,
        novosSepultamentos: true,
        exumacoes: true,
        ossariosUtilizados: true,
        alertaContaminacao: true,
        alertaSuperlotacao: true,
        status: true,
      },
    });

    // Calcular tendências
    const tendencias = this._calcularTendencias(registros);

    return {
      cemiterio: { id: cemiterio.id, nome: cemiterio.nome },
      totalRegistros: registros.length,
      registros,
      tendencias,
    };
  }

  // IA Preditiva: risco de interdição
  async previsaoRisco(cemiterioId, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: cemiterioId } });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    const registros = await prisma.monitoramento.findMany({
      where: { cemiterioId },
      orderBy: { dataColeta: 'asc' },
      take: 12, // últimos 12 registros
    });

    if (registros.length < 2) {
      return {
        previsao: 'INSUFICIENTE',
        mensagem: 'Dados insuficientes para previsão. Necessário ao menos 2 registros de monitoramento.',
        riscosIdentificados: [],
      };
    }

    const riscos = [];
    let mesesAteInterdicao = null;

    // Analisar tendência de necrochorume
    const necro = registros.filter(r => r.nivelNecrochorume != null).map(r => r.nivelNecrochorume);
    if (necro.length >= 2) {
      const tendencia = this._tendenciaLinear(necro);
      if (tendencia.inclinacao > 0) {
        // Nível crescendo - projetar quando alcança limite crítico (>= 5 mg/L)
        const limiteAlerta = 5;
        if (necro[necro.length - 1] < limiteAlerta && tendencia.inclinacao > 0) {
          const mesesParaLimite = Math.ceil((limiteAlerta - necro[necro.length - 1]) / tendencia.inclinacao);
          riscos.push({
            tipo: 'CONTAMINACAO',
            probabilidade: Math.min(95, 50 + tendencia.inclinacao * 20),
            horizonte: `${mesesParaLimite} meses`,
            descricao: `Nível de necrochorume em tendência de alta. Pode atingir limite crítico em ~${mesesParaLimite} meses.`,
          });
          if (!mesesAteInterdicao || mesesParaLimite < mesesAteInterdicao) {
            mesesAteInterdicao = mesesParaLimite;
          }
        }
      }
    }

    // Analisar tendência de ocupação
    const ocupacao = registros.filter(r => r.percentualOcupacao != null).map(r => r.percentualOcupacao);
    if (ocupacao.length >= 2) {
      const tendencia = this._tendenciaLinear(ocupacao);
      if (tendencia.inclinacao > 0) {
        const mesesPara100 = Math.ceil((100 - ocupacao[ocupacao.length - 1]) / tendencia.inclinacao);
        if (mesesPara100 > 0 && mesesPara100 < 60) {
          riscos.push({
            tipo: 'SUPERLOTACAO',
            probabilidade: Math.min(95, 40 + tendencia.inclinacao * 5),
            horizonte: `${mesesPara100} meses`,
            descricao: `Taxa de ocupação crescendo ${tendencia.inclinacao.toFixed(1)}%/período. Superlotação estimada em ~${mesesPara100} meses.`,
          });
          if (!mesesAteInterdicao || mesesPara100 < mesesAteInterdicao) {
            mesesAteInterdicao = mesesPara100;
          }
        }
      }
    }

    // Analisar lençol freático (tendência de subida = risco)
    const lencol = registros.filter(r => r.nivelLencolFreatico != null).map(r => r.nivelLencolFreatico);
    if (lencol.length >= 2) {
      const tendencia = this._tendenciaLinear(lencol);
      if (tendencia.inclinacao < 0) { // nível diminuindo = subindo (mais perto da superfície)
        const mesesPara1_5 = Math.ceil((lencol[lencol.length - 1] - 1.5) / Math.abs(tendencia.inclinacao));
        if (mesesPara1_5 > 0 && lencol[lencol.length - 1] > 1.5) {
          riscos.push({
            tipo: 'LENCOL_FREATICO',
            probabilidade: Math.min(90, 30 + Math.abs(tendencia.inclinacao) * 30),
            horizonte: `${mesesPara1_5} meses`,
            descricao: `Lençol freático subindo. Pode violar limite CONAMA (1,5m) em ~${mesesPara1_5} meses.`,
          });
        }
      }
    }

    // Classificação geral
    let previsao = 'BAIXO';
    let mensagem = 'Risco baixo de interdição nos próximos 12 meses.';

    if (mesesAteInterdicao !== null) {
      if (mesesAteInterdicao <= 6) {
        previsao = 'CRITICO';
        mensagem = `RISCO CRÍTICO: Possibilidade de interdição em até ${mesesAteInterdicao} meses. Ação imediata necessária.`;
      } else if (mesesAteInterdicao <= 12) {
        previsao = 'ALTO';
        mensagem = `Risco alto de problemas em ${mesesAteInterdicao} meses. Recomendado iniciar medidas preventivas.`;
      } else if (mesesAteInterdicao <= 24) {
        previsao = 'MEDIO';
        mensagem = `Risco moderado. Tendências indicam problemas em ${mesesAteInterdicao} meses. Monitorar de perto.`;
      }
    }

    return {
      previsao,
      mensagem,
      mesesAteInterdicao,
      riscosIdentificados: riscos.sort((a, b) => b.probabilidade - a.probabilidade),
      baseadoEm: `${registros.length} registros de monitoramento`,
      dataAnalise: new Date().toISOString(),
    };
  }

  // Dashboard de sustentabilidade
  async dashboardSustentabilidade(prefeituraId) {
    const cemiterios = await prisma.cemiterio.findMany({
      where: { prefeituraId },
      select: {
        id: true, nome: true, totalSepulturas: true,
        sepulturasOcupadas: true, possuiOssario: true,
        percentualOcupacao: true, riscoNecrochorume: true,
      },
    });

    const ultimosMonitoramentos = await prisma.monitoramento.findMany({
      where: { cemiterio: { prefeituraId } },
      orderBy: { dataColeta: 'desc' },
      take: cemiterios.length * 2,
      include: { cemiterio: { select: { nome: true } } },
    });

    const totalSepulturas = cemiterios.reduce((s, c) => s + (c.totalSepulturas || 0), 0);
    const totalOcupadas = cemiterios.reduce((s, c) => s + (c.sepulturasOcupadas || 0), 0);
    const comOssario = cemiterios.filter(c => c.possuiOssario).length;

    return {
      indicadores: {
        totalCemiterios: cemiterios.length,
        capacidadeTotal: totalSepulturas,
        ocupacaoTotal: totalOcupadas,
        percentualOcupacaoGeral: totalSepulturas > 0 ? Math.round((totalOcupadas / totalSepulturas) * 100) : 0,
        comOssario,
        percentualOssario: cemiterios.length > 0 ? Math.round((comOssario / cemiterios.length) * 100) : 0,
        riscoMedioNecrochorume: cemiterios.length > 0
          ? Math.round(cemiterios.reduce((s, c) => s + (c.riscoNecrochorume || 0), 0) / cemiterios.length)
          : 0,
      },
      cemiterios: cemiterios.map(c => ({
        nome: c.nome,
        ocupacao: c.percentualOcupacao,
        risco: c.riscoNecrochorume,
        ossario: c.possuiOssario,
      })),
      ultimosMonitoramentos: ultimosMonitoramentos.slice(0, 5),
    };
  }

  // ---- Helpers ----

  _avaliarAlertas(dados, cemiterio) {
    const alertas = { contaminacao: false, superlotacao: false, manutencao: false, temAlerta: false, descricao: '' };
    const msgs = [];

    if (dados.nivelNecrochorume != null && dados.nivelNecrochorume > 3) {
      alertas.contaminacao = true;
      msgs.push(`Nível de necrochorume elevado: ${dados.nivelNecrochorume} mg/L (limite: 3 mg/L)`);
    }

    if (dados.phSolo != null && (dados.phSolo < 5.5 || dados.phSolo > 8.5)) {
      alertas.manutencao = true;
      msgs.push(`pH do solo fora da faixa ideal: ${dados.phSolo} (ideal: 5.5-8.5)`);
    }

    if (dados.percentualOcupacao != null && dados.percentualOcupacao > 90) {
      alertas.superlotacao = true;
      msgs.push(`Ocupação em ${dados.percentualOcupacao.toFixed(1)}% - risco de superlotação`);
    }

    if (dados.nivelLencolFreatico != null && dados.nivelLencolFreatico < 1.5) {
      alertas.contaminacao = true;
      msgs.push(`Lençol freático a ${dados.nivelLencolFreatico}m (mín. CONAMA: 1.5m)`);
    }

    alertas.temAlerta = alertas.contaminacao || alertas.superlotacao || alertas.manutencao;
    alertas.descricao = msgs.join('; ');
    return alertas;
  }

  _calcularTendencias(registros) {
    if (registros.length < 2) return null;

    const campos = ['nivelNecrochorume', 'percentualOcupacao', 'nivelLencolFreatico', 'phSolo'];
    const tendencias = {};

    for (const campo of campos) {
      const valores = registros.filter(r => r[campo] != null).map(r => r[campo]);
      if (valores.length >= 2) {
        const t = this._tendenciaLinear(valores);
        tendencias[campo] = {
          direcao: t.inclinacao > 0.01 ? 'SUBINDO' : t.inclinacao < -0.01 ? 'DESCENDO' : 'ESTAVEL',
          variacao: t.inclinacao,
          ultimoValor: valores[valores.length - 1],
          primeiroValor: valores[0],
        };
      }
    }

    return tendencias;
  }

  _tendenciaLinear(valores) {
    const n = valores.length;
    let somaX = 0, somaY = 0, somaXY = 0, somaX2 = 0;

    for (let i = 0; i < n; i++) {
      somaX += i;
      somaY += valores[i];
      somaXY += i * valores[i];
      somaX2 += i * i;
    }

    const inclinacao = (n * somaXY - somaX * somaY) / (n * somaX2 - somaX * somaX);
    const intercepto = (somaY - inclinacao * somaX) / n;

    return { inclinacao: isNaN(inclinacao) ? 0 : inclinacao, intercepto };
  }
}

module.exports = new MonitoramentoService();
