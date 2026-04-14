const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const env = require('../config/env');
const logger = require('../config/logger');

// Templates dos 12+ documentos obrigatórios
const TEMPLATES = {
  RCA: {
    titulo: 'RELATÓRIO DE CONTROLE AMBIENTAL - RCA',
    secoes: [
      'Identificação do Empreendedor',
      'Identificação do Empreendimento',
      'Diagnóstico Ambiental',
      'Descrição da Atividade',
      'Identificação dos Impactos Ambientais',
      'Medidas de Controle Ambiental',
      'Plano de Monitoramento',
      'Conclusão',
    ],
  },
  PCA: {
    titulo: 'PLANO DE CONTROLE AMBIENTAL - PCA',
    secoes: [
      'Introdução e Objetivos',
      'Caracterização do Empreendimento',
      'Programas de Controle Ambiental',
      'Programa de Monitoramento de Águas Subterrâneas',
      'Programa de Gerenciamento de Resíduos Sólidos',
      'Programa de Controle de Vetores',
      'Programa de Manutenção das Áreas Verdes',
      'Cronograma de Execução',
      'Responsável Técnico',
    ],
  },
  LP_REQUERIMENTO: {
    titulo: 'REQUERIMENTO DE LICENÇA PRÉVIA - LP',
    secoes: ['Dados do Requerente', 'Dados do Empreendimento', 'Documentos Anexos', 'Declaração'],
  },
  LO_REQUERIMENTO: {
    titulo: 'REQUERIMENTO DE LICENÇA DE OPERAÇÃO - LO',
    secoes: ['Dados do Requerente', 'Dados do Empreendimento', 'Condicionantes da LP/LI', 'Documentos Anexos', 'Declaração'],
  },
  LAUDO_SOLO: {
    titulo: 'LAUDO TÉCNICO DE CARACTERIZAÇÃO DO SOLO',
    secoes: ['Metodologia', 'Classificação do Solo', 'Permeabilidade', 'Análise Granulométrica', 'Conclusão'],
  },
  LAUDO_AGUA: {
    titulo: 'LAUDO DE QUALIDADE DAS ÁGUAS SUBTERRÂNEAS',
    secoes: ['Pontos de Coleta', 'Parâmetros Analisados', 'Resultados', 'Limites CONAMA 396/2008', 'Conclusão'],
  },
  PLANO_ENCERRAMENTO: {
    titulo: 'PLANO DE ENCERRAMENTO DE CEMITÉRIO',
    secoes: ['Diagnóstico da Situação Atual', 'Cronograma de Exumações', 'Medidas de Recuperação Ambiental', 'Monitoramento Pós-Encerramento'],
  },
};

class DocumentoService {
  // Gerar documento obrigatório
  async gerarDocumento(licenciamentoId, tipo, prefeituraId, usuarioId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: {
        cemiterio: {
          include: {
            prefeitura: true,
            checklistItens: true,
          },
        },
      },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    const template = TEMPLATES[tipo];
    if (!template) {
      throw Object.assign(new Error(`Tipo de documento não suportado: ${tipo}`), { statusCode: 400 });
    }

    const cemiterio = lic.cemiterio;
    const prefeitura = cemiterio.prefeitura;

    // Gerar PDF
    const outputDir = path.join(env.upload.dir, cemiterio.id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const nomeArquivo = `${tipo.toLowerCase()}_${lic.id}_v${Date.now()}.pdf`;
    const caminhoCompleto = path.join(outputDir, nomeArquivo);

    await this._gerarPDF(caminhoCompleto, template, lic, cemiterio, prefeitura);

    // Verificar versão (incrementar se já existe)
    const versaoAnterior = await prisma.documento.findFirst({
      where: { licenciamentoId, tipo },
      orderBy: { versao: 'desc' },
    });

    const documento = await prisma.documento.create({
      data: {
        licenciamentoId,
        cemiterioId: cemiterio.id,
        usuarioId,
        tipo,
        titulo: `${template.titulo} - ${cemiterio.nome}`,
        descricao: `Documento gerado para licenciamento ${lic.tipo}`,
        caminho: caminhoCompleto,
        versao: versaoAnterior ? versaoAnterior.versao + 1 : 1,
        status: 'GERADO',
        conteudoJson: {
          template: tipo,
          licenciamentoId,
          dataGeracao: new Date().toISOString(),
          dadosCemiterio: {
            nome: cemiterio.nome,
            cidade: cemiterio.cidade,
            uf: cemiterio.uf,
          },
        },
      },
    });

    logger.info(`Documento gerado: ${tipo} v${documento.versao} para licenciamento ${licenciamentoId}`, { usuarioId });

    return {
      documento,
      downloadUrl: `/uploads/${cemiterio.id}/${nomeArquivo}`,
    };
  }

  // Gerar TODOS os documentos obrigatórios de uma vez
  async gerarTodosDocumentos(licenciamentoId, prefeituraId, usuarioId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: { cemiterio: true },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    // Documentos obrigatórios depende do tipo e estado
    const regras = await prisma.regraEstadual.findFirst({
      where: { uf: lic.cemiterio.uf, ativo: true },
    });

    let tiposNecessarios = ['RCA', 'PCA', 'LAUDO_SOLO'];

    if (lic.tipo === 'LP') {
      tiposNecessarios.push('LP_REQUERIMENTO');
    } else if (lic.tipo === 'LO' || lic.tipo === 'LRO') {
      tiposNecessarios.push('LO_REQUERIMENTO');
    }

    if (regras?.requisitos?.exigeEIA) {
      tiposNecessarios.push('LAUDO_AGUA');
    }

    const documentosGerados = [];
    for (const tipo of tiposNecessarios) {
      try {
        const resultado = await this.gerarDocumento(licenciamentoId, tipo, prefeituraId, usuarioId);
        documentosGerados.push(resultado);
      } catch (err) {
        logger.error(`Erro ao gerar ${tipo}: ${err.message}`);
        documentosGerados.push({ tipo, erro: err.message });
      }
    }

    return {
      total: tiposNecessarios.length,
      gerados: documentosGerados.filter(d => !d.erro).length,
      erros: documentosGerados.filter(d => d.erro).length,
      documentos: documentosGerados,
    };
  }

  // Listar documentos de um licenciamento
  async listar(licenciamentoId, prefeituraId) {
    const lic = await prisma.licenciamento.findUnique({
      where: { id: licenciamentoId },
      include: { cemiterio: { select: { prefeituraId: true } } },
    });

    if (!lic || lic.cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Licenciamento não encontrado'), { statusCode: 404 });
    }

    return prisma.documento.findMany({
      where: { licenciamentoId },
      include: {
        usuario: { select: { nome: true, email: true } },
      },
      orderBy: [{ tipo: 'asc' }, { versao: 'desc' }],
    });
  }

  // Listar documentos por cemitério
  async listarPorCemiterio(cemiterioId, prefeituraId) {
    return prisma.documento.findMany({
      where: {
        cemiterioId,
        cemiterio: { prefeituraId },
      },
      include: {
        usuario: { select: { nome: true } },
        licenciamento: { select: { tipo: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Download de documento
  async download(documentoId, prefeituraId) {
    const doc = await prisma.documento.findUnique({
      where: { id: documentoId },
      include: {
        cemiterio: { select: { prefeituraId: true } },
        licenciamento: { include: { cemiterio: { select: { prefeituraId: true } } } },
      },
    });

    if (!doc) {
      throw Object.assign(new Error('Documento não encontrado'), { statusCode: 404 });
    }

    const docPrefeituraId = doc.cemiterio?.prefeituraId || doc.licenciamento?.cemiterio?.prefeituraId;
    if (docPrefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    if (!doc.caminho || !fs.existsSync(doc.caminho)) {
      throw Object.assign(new Error('Arquivo não encontrado no servidor'), { statusCode: 404 });
    }

    return {
      caminho: doc.caminho,
      nomeArquivo: `${doc.tipo}_${doc.titulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  // ---- Gerador de PDF ----
  async _gerarPDF(caminhoCompleto, template, licenciamento, cemiterio, prefeitura) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminhoCompleto);
      doc.pipe(stream);

      // Cabeçalho institucional
      doc.fontSize(10).font('Helvetica').fillColor('#666')
        .text(prefeitura.nome, { align: 'center' })
        .text(`CNPJ: ${this._formatarCNPJ(prefeitura.cnpj)}`, { align: 'center' })
        .text(`${prefeitura.cidade || cemiterio.cidade}/${prefeitura.uf || cemiterio.uf}`, { align: 'center' });

      doc.moveDown(1);

      // Título do documento
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#166534')
        .text(template.titulo, { align: 'center' });
      doc.moveDown(0.3);
      doc.strokeColor('#16a34a').lineWidth(2)
        .moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(0.5);

      // Subtítulo
      doc.fontSize(12).font('Helvetica').fillColor('#333')
        .text(`Cemitério: ${cemiterio.nome}`, { align: 'center' })
        .text(`Licenciamento: ${licenciamento.tipo} - Processo nº ${licenciamento.numeroProtocolo || 'Pendente'}`, { align: 'center' });
      doc.moveDown(1);

      // Seções do template
      doc.fillColor('#000');
      for (let i = 0; i < template.secoes.length; i++) {
        const secao = template.secoes[i];

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#15803d')
          .text(`${i + 1}. ${secao}`);
        doc.strokeColor('#86efac').lineWidth(0.5)
          .moveTo(60, doc.y + 2).lineTo(535, doc.y + 2).stroke();
        doc.moveDown(0.5);

        // Conteúdo dinâmico baseado na seção
        const conteudo = this._gerarConteudoSecao(secao, cemiterio, licenciamento, prefeitura);
        doc.fontSize(10).font('Helvetica').fillColor('#333')
          .text(conteudo, { lineGap: 3, align: 'justify' });
        doc.moveDown(1);

        // Quebrar página se necessário
        if (doc.y > 700) {
          doc.addPage();
        }
      }

      // Rodapé de assinatura
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#000')
        .text('_'.repeat(50), { align: 'center' })
        .text('Responsável Técnico', { align: 'center' })
        .text('ART/RRT nº ________________', { align: 'center' });

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999')
        .text(`Documento gerado pelo CemLicença Ambiental em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
        .text(`Ref: ${licenciamento.id}`, { align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  _gerarConteudoSecao(secao, cemiterio, licenciamento, prefeitura) {
    const s = secao.toLowerCase();

    if (s.includes('identificação do empreendedor') || s.includes('dados do requerente')) {
      return `Razão Social: ${prefeitura.nome}\n` +
        `CNPJ: ${this._formatarCNPJ(prefeitura.cnpj)}\n` +
        `Endereço: ${prefeitura.endereco || cemiterio.endereco}\n` +
        `Município/UF: ${prefeitura.cidade || cemiterio.cidade}/${prefeitura.uf || cemiterio.uf}\n` +
        `Email: ${prefeitura.email || 'Não informado'}\n` +
        `Telefone: ${prefeitura.telefone || 'Não informado'}`;
    }

    if (s.includes('identificação do empreendimento') || s.includes('dados do empreendimento') || s.includes('caracterização do empreendimento')) {
      return `Nome: ${cemiterio.nome}\n` +
        `Tipo: ${cemiterio.tipo}\n` +
        `Endereço: ${cemiterio.endereco}\n` +
        `Município/UF: ${cemiterio.cidade}/${cemiterio.uf}\n` +
        (cemiterio.latitude ? `Coordenadas: ${cemiterio.latitude}, ${cemiterio.longitude}\n` : '') +
        (cemiterio.areaTotal ? `Área Total: ${cemiterio.areaTotal} hectares\n` : '') +
        (cemiterio.anoFundacao ? `Ano de Fundação: ${cemiterio.anoFundacao}\n` : '') +
        (cemiterio.totalSepulturas ? `Total de Sepulturas: ${cemiterio.totalSepulturas}\n` : '') +
        (cemiterio.sepulturasOcupadas ? `Sepulturas Ocupadas: ${cemiterio.sepulturasOcupadas} (${cemiterio.percentualOcupacao?.toFixed(1)}%)\n` : '');
    }

    if (s.includes('diagnóstico ambiental') || s.includes('classificação do solo') || s.includes('metodologia')) {
      return `O diagnóstico ambiental do cemitério "${cemiterio.nome}" foi elaborado em conformidade com as resoluções CONAMA 335/2003, 368/2006 e 402/2008, além das normas estaduais aplicáveis ao estado de ${cemiterio.uf}.\n\n` +
        (cemiterio.tipoSolo ? `Tipo de Solo: ${cemiterio.tipoSolo}\n` : '') +
        (cemiterio.nivelLencolFreatico ? `Nível do Lençol Freático: ${cemiterio.nivelLencolFreatico} metros\n` : '') +
        (cemiterio.distanciaCorpoHidrico ? `Distância do Corpo Hídrico mais próximo: ${cemiterio.distanciaCorpoHidrico} metros\n` : '') +
        `Sistema de Drenagem: ${cemiterio.possuiDrenagem ? 'Presente' : 'Ausente'}\n` +
        (cemiterio.riscoNecrochorume ? `\nÍndice de Risco de Necrochorume: ${cemiterio.riscoNecrochorume}%` : '');
    }

    if (s.includes('impactos ambientais')) {
      return `Os principais impactos ambientais identificados na operação do cemitério são:\n\n` +
        `a) Contaminação do solo e águas subterrâneas por necrochorume;\n` +
        `b) Proliferação de micro-organismos patogênicos;\n` +
        `c) Geração de resíduos sólidos (coroas, flores, restos de construção);\n` +
        `d) Alteração da paisagem e impacto visual;\n` +
        `e) Possível contaminação de corpos hídricos próximos;\n` +
        `f) Riscos à saúde pública por vetores (insetos e roedores).\n\n` +
        `Os impactos foram avaliados considerando magnitude, importância e reversibilidade.`;
    }

    if (s.includes('medidas de controle') || s.includes('programas de controle')) {
      return `As seguintes medidas de controle ambiental são propostas:\n\n` +
        `1. Impermeabilização do fundo das sepulturas quando o nível do lençol freático for inferior a 2 metros;\n` +
        `2. Implantação de sistema de drenagem pluvial e de efluentes;\n` +
        `3. Instalação de poços de monitoramento para análise periódica das águas subterrâneas;\n` +
        `4. Programa de controle de vetores com periodicidade trimestral;\n` +
        `5. Destinação adequada de resíduos sólidos;\n` +
        `6. Manutenção de faixa non aedificandi de no mínimo 5 metros;\n` +
        `7. Programa de exumação e ossário para gestão de superlotação;\n` +
        `8. Treinamento de funcionários com EPIs adequados.`;
    }

    if (s.includes('monitoramento') && !s.includes('pós')) {
      return `O plano de monitoramento prevê:\n\n` +
        `- Análise semestral da qualidade das águas subterrâneas nos poços de monitoramento;\n` +
        `- Parâmetros: pH, condutividade elétrica, DBO, DQO, cloretos, nitratos, coliformes, metais pesados;\n` +
        `- Monitoramento trimestral de vetores;\n` +
        `- Relatório anual de conformidade ambiental;\n` +
        `- Controle mensal de sepultamentos e exumações;\n\n` +
        `Os resultados serão apresentados ao órgão ambiental conforme periodicidade definida na licença.`;
    }

    if (s.includes('conclusão')) {
      const conforme = (cemiterio.riscoNecrochorume || 0) <= 40;
      return conforme
        ? `Com base na análise realizada, conclui-se que o cemitério "${cemiterio.nome}" apresenta condições ${conforme ? 'adequadas' : 'que necessitam adequação'} para operação conforme a legislação ambiental vigente. As medidas de controle propostas são suficientes para mitigar os impactos ambientais identificados, desde que implementadas conforme o cronograma apresentado.`
        : `Com base na análise realizada, conclui-se que o cemitério "${cemiterio.nome}" necessita de adequações para atender aos requisitos mínimos da legislação ambiental vigente (CONAMA 335/2003). As medidas corretivas e de controle propostas neste documento devem ser implementadas com urgência, especialmente no que se refere à proteção do lençol freático e ao sistema de drenagem.`;
    }

    if (s.includes('documentos anexos')) {
      return `Documentos que acompanham este requerimento:\n\n` +
        `1. Memorial Descritivo do Empreendimento\n` +
        `2. Relatório de Controle Ambiental (RCA)\n` +
        `3. Plano de Controle Ambiental (PCA)\n` +
        `4. Laudo de Caracterização do Solo\n` +
        `5. Planta de localização e situação\n` +
        `6. ART/RRT do responsável técnico\n` +
        `7. Comprovante de propriedade ou cessão da área\n` +
        `8. Certidão da Prefeitura Municipal`;
    }

    if (s.includes('declaração')) {
      return `Declaro, sob as penas da lei, que as informações prestadas neste requerimento e seus anexos são verdadeiras e que estou ciente das responsabilidades legais decorrentes de declarações falsas.\n\n` +
        `${cemiterio.cidade}/${cemiterio.uf}, ${new Date().toLocaleDateString('pt-BR')}`;
    }

    // Conteúdo genérico
    return `[Conteúdo a ser preenchido pelo responsável técnico conforme especificidades do empreendimento e normas aplicáveis ao estado de ${cemiterio.uf}.]`;
  }

  _formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    const c = cnpj.replace(/[^\d]/g, '');
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
}

module.exports = new DocumentoService();
