const prisma = require('../config/database');
const logger = require('../config/logger');

// Base de checklist CONAMA 335/2003 + 368/2006 + 402/2008
const CHECKLIST_CONAMA_335 = [
  {
    codigo: 'CONAMA-335-ART3-I',
    descricao: 'O cemitério possui licenciamento ambiental do órgão competente?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART3-II',
    descricao: 'O nível inferior das sepulturas está a uma distância mínima de 1,5m do nível máximo do lençol freático?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART3-III',
    descricao: 'O cemitério possui zona de amortecimento (faixa non aedificandi) de no mínimo 5 metros de recuo?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART3-IV',
    descricao: 'A área do cemitério está a uma distância mínima de 200m de corpos de água (rios, lagos, nascentes)?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART4-I',
    descricao: 'Os sepultamentos são realizados com o fundo da sepultura acima de 1,5m do nível do lençol freático?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART4-II',
    descricao: 'Existe sistema de drenagem de águas pluviais e de efluentes nas áreas de sepultamento?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART4-III',
    descricao: 'O cemitério possui poços de monitoramento para controle de qualidade das águas subterrâneas?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART5',
    descricao: 'É realizada análise periódica (mínimo semestral) da qualidade da água nos poços de monitoramento?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART5-PAR1',
    descricao: 'Os parâmetros analisados incluem pH, condutividade elétrica, cloretos, metais pesados e indicadores microbiológicos?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART7',
    descricao: 'Os resíduos sólidos (flores, coroas, restos de construção) possuem destinação adequada?',
    obrigatorio: true,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-335-ART8',
    descricao: 'O plano de encerramento do cemitério (quando aplicável) foi elaborado e aprovado?',
    obrigatorio: false,
    categoria: 'CONAMA 335/2003',
  },
  {
    codigo: 'CONAMA-368-ART2',
    descricao: 'O Estudo Ambiental contemplou análise de solo na zona de sepultamento?',
    obrigatorio: true,
    categoria: 'CONAMA 368/2006',
  },
  {
    codigo: 'CONAMA-368-ART3',
    descricao: 'Os jazigos possuem dispositivos que impeçam o acúmulo de água e proliferação de vetores?',
    obrigatorio: true,
    categoria: 'CONAMA 368/2006',
  },
  {
    codigo: 'CONAMA-402-ART1',
    descricao: 'O cemitério realiza exumação de ossadas conforme período mínimo estabelecido (3-5 anos)?',
    obrigatorio: true,
    categoria: 'CONAMA 402/2008',
  },
  {
    codigo: 'CONAMA-402-ART2',
    descricao: 'Existe controle de vetores (insetos, roedores) com periodicidade adequada?',
    obrigatorio: true,
    categoria: 'CONAMA 402/2008',
  },
  {
    codigo: 'CONAMA-402-ART3',
    descricao: 'Os trabalhadores do cemitério possuem EPIs adequados e treinamento para manejo de resíduos?',
    obrigatorio: true,
    categoria: 'CONAMA 402/2008',
  },
];

// Requisitos extras por estado
const REQUISITOS_ESTADUAIS = {
  PE: [
    { codigo: 'CPRH-PE-001', descricao: 'Registro no cadastro de atividades potencialmente poluidoras da CPRH?', obrigatorio: true, categoria: 'CPRH-PE' },
    { codigo: 'CPRH-PE-002', descricao: 'Relatório de Controle Ambiental (RCA) elaborado conforme termos de referência da CPRH?', obrigatorio: true, categoria: 'CPRH-PE' },
    { codigo: 'CPRH-PE-003', descricao: 'Plano de Controle Ambiental (PCA) com medidas mitigadoras aprovado?', obrigatorio: true, categoria: 'CPRH-PE' },
  ],
  SC: [
    { codigo: 'IMA-SC-001', descricao: 'Estudo ambiental conforme IN 04/2014 do IMA/SC?', obrigatorio: true, categoria: 'IMA-SC' },
    { codigo: 'IMA-SC-002', descricao: 'Licença ambiental válida emitida pelo IMA ou município conveniado?', obrigatorio: true, categoria: 'IMA-SC' },
  ],
  SP: [
    { codigo: 'CETESB-SP-001', descricao: 'EIA/RIMA elaborado conforme Resolução SMA 10/2017?', obrigatorio: true, categoria: 'CETESB-SP' },
    { codigo: 'CETESB-SP-002', descricao: 'Registro no CADRI (Certificado de Aprovação para Destinação de Resíduos)?', obrigatorio: true, categoria: 'CETESB-SP' },
    { codigo: 'CETESB-SP-003', descricao: 'Monitoramento de águas subterrâneas conforme normas CETESB?', obrigatorio: true, categoria: 'CETESB-SP' },
  ],
  MG: [
    { codigo: 'SEMAD-MG-001', descricao: 'Classificação conforme DN COPAM 217/2017 (classe/porte)?', obrigatorio: true, categoria: 'SEMAD-MG' },
    { codigo: 'SEMAD-MG-002', descricao: 'FOB (Formulário de Orientação Básica) preenchido no SIAM?', obrigatorio: true, categoria: 'SEMAD-MG' },
  ],
  BA: [
    { codigo: 'INEMA-BA-001', descricao: 'Requerimento via portal SEIA do INEMA?', obrigatorio: true, categoria: 'INEMA-BA' },
    { codigo: 'INEMA-BA-002', descricao: 'Estudo ambiental conforme Portaria INEMA 11.292/2016?', obrigatorio: true, categoria: 'INEMA-BA' },
  ],
  CE: [
    { codigo: 'SEMACE-CE-001', descricao: 'Licenciamento conforme Portaria SEMACE 154/2002?', obrigatorio: true, categoria: 'SEMACE-CE' },
  ],
  PR: [
    { codigo: 'IAT-PR-001', descricao: 'Licenciamento ambiental conforme Resolução CEMA 094/2014?', obrigatorio: true, categoria: 'IAT-PR' },
    { codigo: 'IAT-PR-002', descricao: 'Cadastro no SGA (Sistema de Gestão Ambiental) do IAT?', obrigatorio: true, categoria: 'IAT-PR' },
  ],
  RS: [
    { codigo: 'FEPAM-RS-001', descricao: 'Licenciamento conforme Portaria FEPAM 053/2012?', obrigatorio: true, categoria: 'FEPAM-RS' },
  ],
  GO: [
    { codigo: 'SECIMA-GO-001', descricao: 'Licenciamento conforme IN SECIMA 05/2017?', obrigatorio: true, categoria: 'SECIMA-GO' },
  ],
  RJ: [
    { codigo: 'INEA-RJ-001', descricao: 'Licenciamento conforme DZ-1310/2004 do INEA?', obrigatorio: true, categoria: 'INEA-RJ' },
    { codigo: 'INEA-RJ-002', descricao: 'EIA/RIMA requerido para cemitérios novos no RJ?', obrigatorio: true, categoria: 'INEA-RJ' },
  ],
};

class ChecklistService {
  // Gerar checklist automático para um cemitério
  async gerarChecklist(cemiterioId, uf) {
    // Verificar se já existe checklist
    const existente = await prisma.checklistItem.count({ where: { cemiterioId } });
    if (existente > 0) {
      logger.info(`Checklist já existe para cemitério ${cemiterioId}`);
      return;
    }

    // Itens CONAMA (obrigatórios para todos)
    const itens = CHECKLIST_CONAMA_335.map(item => ({
      cemiterioId,
      ...item,
      conforme: null,
    }));

    // Itens estaduais
    const estaduais = REQUISITOS_ESTADUAIS[uf];
    if (estaduais) {
      for (const item of estaduais) {
        itens.push({
          cemiterioId,
          ...item,
          conforme: null,
        });
      }
    }

    await prisma.checklistItem.createMany({ data: itens });

    logger.info(`Checklist gerado: ${itens.length} itens para cemitério ${cemiterioId} (UF: ${uf})`);

    return itens.length;
  }

  // Obter checklist agrupado por categoria
  async obterChecklist(cemiterioId) {
    const itens = await prisma.checklistItem.findMany({
      where: { cemiterioId },
      orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }],
    });

    // Agrupar por categoria
    const agrupado = {};
    for (const item of itens) {
      if (!agrupado[item.categoria]) {
        agrupado[item.categoria] = {
          categoria: item.categoria,
          itens: [],
          total: 0,
          conformes: 0,
          naoConformes: 0,
          pendentes: 0,
        };
      }
      agrupado[item.categoria].itens.push(item);
      agrupado[item.categoria].total++;
      if (item.conforme === true) agrupado[item.categoria].conformes++;
      else if (item.conforme === false) agrupado[item.categoria].naoConformes++;
      else agrupado[item.categoria].pendentes++;
    }

    return Object.values(agrupado);
  }

  // Auto-preencher checklist com base nos dados do cemitério
  async autoPreencherChecklist(cemiterioId) {
    const cemiterio = await prisma.cemiterio.findUnique({
      where: { id: cemiterioId },
    });

    if (!cemiterio) return;

    const atualizacoes = [];

    // CONAMA-335-ART3-II: Nível lençol freático >= 1.5m
    if (cemiterio.nivelLencolFreatico) {
      atualizacoes.push({
        codigo: 'CONAMA-335-ART3-II',
        conforme: cemiterio.nivelLencolFreatico >= 1.5,
        observacao: `Nível lençol freático: ${cemiterio.nivelLencolFreatico}m (mínimo: 1.5m)`,
      });
    }

    // CONAMA-335-ART3-IV: Distância corpo hídrico >= 200m
    if (cemiterio.distanciaCorpoHidrico) {
      atualizacoes.push({
        codigo: 'CONAMA-335-ART3-IV',
        conforme: cemiterio.distanciaCorpoHidrico >= 200,
        observacao: `Distância do corpo hídrico: ${cemiterio.distanciaCorpoHidrico}m (mínimo: 200m)`,
      });
    }

    // CONAMA-335-ART4-II: Sistema de drenagem
    if (cemiterio.possuiDrenagem !== null) {
      atualizacoes.push({
        codigo: 'CONAMA-335-ART4-II',
        conforme: cemiterio.possuiDrenagem,
        observacao: cemiterio.possuiDrenagem ? 'Sistema de drenagem presente' : 'Sem sistema de drenagem',
      });
    }

    // Aplicar atualizações
    for (const att of atualizacoes) {
      await prisma.checklistItem.updateMany({
        where: { cemiterioId, codigo: att.codigo },
        data: {
          conforme: att.conforme,
          observacao: att.observacao,
          verificadoPor: 'SISTEMA_IA',
          verificadoEm: new Date(),
        },
      });
    }

    logger.info(`Checklist auto-preenchido: ${atualizacoes.length} itens para cemitério ${cemiterioId}`);

    return atualizacoes;
  }
}

module.exports = new ChecklistService();
