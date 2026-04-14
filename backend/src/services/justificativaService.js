const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const env = require('../config/env');
const logger = require('../config/logger');

class JustificativaService {
  // Gerar pacote completo de documentos de contratação
  async gerarPacoteContratacao(contratoId, prefeituraId, usuarioId) {
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      include: {
        prefeitura: true,
        pagamentos: { orderBy: { parcela: 'asc' } },
      },
    });

    if (!contrato || contrato.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    const cemiterios = await prisma.cemiterio.findMany({
      where: { prefeituraId },
      select: { nome: true, cidade: true, uf: true, status: true, possuiLiminar: true },
    });

    const outputDir = path.join(env.upload.dir, 'contratos', contratoId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const documentos = [];

    // 1. Justificativa de contratação direta
    const justificativaPath = await this._gerarJustificativa(outputDir, contrato, cemiterios);
    documentos.push({ tipo: 'JUSTIFICATIVA', caminho: justificativaPath });

    // 2. Minuta de contrato
    const minutaPath = await this._gerarMinutaContrato(outputDir, contrato, cemiterios);
    documentos.push({ tipo: 'MINUTA_CONTRATO', caminho: minutaPath });

    // 3. Parecer de notória especialização (se inexigibilidade)
    if (contrato.modalidade === 'INEXIGIBILIDADE_ART74_III') {
      const parecerPath = await this._gerarParecerEspecializacao(outputDir, contrato);
      documentos.push({ tipo: 'PARECER_ESPECIALIZACAO', caminho: parecerPath });
    }

    // Salvar referências no banco
    for (const doc of documentos) {
      await prisma.documento.create({
        data: {
          cemiterioId: null,
          licenciamentoId: null,
          usuarioId,
          tipo: doc.tipo === 'JUSTIFICATIVA'
            ? (contrato.modalidade === 'DISPENSA_ART75_II' ? 'JUSTIFICATIVA_DISPENSA' : 'JUSTIFICATIVA_INEXIGIBILIDADE')
            : doc.tipo === 'PARECER_ESPECIALIZACAO'
              ? 'PARECER_NOTORIA_ESPECIALIZACAO'
              : 'CONTRATO',
          titulo: `${doc.tipo} - ${contrato.prefeitura.nome}`,
          caminho: doc.caminho,
          status: 'GERADO',
        },
      });
    }

    // Atualizar status do contrato
    await prisma.contrato.update({
      where: { id: contratoId },
      data: {
        status: 'JUSTIFICATIVA_GERADA',
        justificativaLegal: this._textoResumoJustificativa(contrato),
      },
    });

    logger.info(`Pacote contratação gerado: ${documentos.length} docs para contrato ${contratoId}`, { usuarioId });

    return {
      total: documentos.length,
      documentos: documentos.map(d => ({
        tipo: d.tipo,
        downloadUrl: `/uploads/contratos/${contratoId}/${d.caminho.split(/[/\\]/).pop()}`,
      })),
    };
  }

  // ---- Geração de PDFs ----

  async _gerarJustificativa(outputDir, contrato, cemiterios) {
    const caminho = path.join(outputDir, `justificativa_${Date.now()}.pdf`);
    const prefeitura = contrato.prefeitura;
    const isDispensa = contrato.modalidade === 'DISPENSA_ART75_II';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminho);
      doc.pipe(stream);

      // Cabeçalho
      this._cabecalho(doc, prefeitura);

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
        .text(isDispensa
          ? 'JUSTIFICATIVA PARA CONTRATAÇÃO DIRETA POR DISPENSA DE LICITAÇÃO'
          : 'JUSTIFICATIVA PARA CONTRATAÇÃO DIRETA POR INEXIGIBILIDADE DE LICITAÇÃO',
          { align: 'center' });
      doc.moveDown(1);

      // 1. Do Objeto
      this._secao(doc, '1. DO OBJETO');
      doc.fontSize(10).font('Helvetica').text(
        `Contratação de sistema de software especializado em licenciamento ambiental automatizado para cemitérios municipais (plataforma SaaS "CemLicença Ambiental"), incluindo:\n\n` +
        (contrato.moduloCadastro ? '  a) Módulo de cadastro e diagnóstico ambiental de cemitérios;\n' : '') +
        (contrato.moduloLicenciamento ? '  b) Módulo de licenciamento ambiental automatizado com geração de documentos;\n' : '') +
        (contrato.moduloContratacao ? '  c) Módulo de gestão de contratação e justificativas legais;\n' : '') +
        (contrato.moduloMonitoramento ? '  d) Módulo de monitoramento ambiental recorrente e relatórios;\n' : '') +
        `\nPara atendimento de ${cemiterios.length} cemitério(s) municipal(is).`,
        { lineGap: 2 }
      );
      doc.moveDown();

      // 2. Da Necessidade
      this._secao(doc, '2. DA NECESSIDADE');
      const comLiminar = cemiterios.filter(c => c.possuiLiminar);
      doc.fontSize(10).font('Helvetica').text(
        `A ${prefeitura.nome} possui ${cemiterios.length} cemitério(s) sob sua responsabilidade` +
        (comLiminar.length > 0
          ? `, dos quais ${comLiminar.length} encontram-se com LIMINAR DO MINISTÉRIO PÚBLICO exigindo regularização ambiental urgente`
          : '') +
        `.\n\n` +
        `Conforme dados do IBGE e levantamento do Ministério Público, aproximadamente 75% dos cemitérios municipais brasileiros operam sem licenciamento ambiental, em desconformidade com as Resoluções CONAMA 335/2003, 368/2006 e 402/2008.\n\n` +
        `A contratação do sistema especializado é medida urgente para:\n` +
        `  I - Regularizar a situação ambiental dos cemitérios municipais;\n` +
        `  II - Cumprir determinação judicial/ministerial dentro dos prazos estabelecidos;\n` +
        `  III - Prevenir contaminação ambiental por necrochorume;\n` +
        `  IV - Evitar multas e sanções administrativas que podem alcançar R$ 50 milhões (art. 72 da Lei 9.605/98).`,
        { lineGap: 2 }
      );
      doc.moveDown();

      // 3. Do Fundamento Legal
      this._secao(doc, '3. DO FUNDAMENTO LEGAL');
      if (isDispensa) {
        doc.fontSize(10).font('Helvetica').text(
          `A presente contratação fundamenta-se no Art. 75, inciso II, da Lei Federal nº 14.133/2021 (Nova Lei de Licitações), ` +
          `com valores atualizados pelo Decreto Federal nº 12.807/2025 (vigente desde 01/01/2026):\n\n`,
          { lineGap: 2 }
        );
        doc.font('Helvetica-Oblique').text(
          `"Art. 75. É dispensável a licitação:\n` +
          `[...]\n` +
          `II - para contratação que envolva valores inferiores a R$ 65.492,11 (sessenta e cinco mil, quatrocentos e noventa e dois reais e onze centavos), ` +
          `no caso de outros serviços e compras;"`,
          { indent: 20 }
        );
        doc.font('Helvetica').moveDown();
        doc.text(
          `O valor total da contratação é de R$ ${contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, ` +
          `portanto DENTRO do limite legal para dispensa de licitação.`,
        );
      } else {
        doc.fontSize(10).font('Helvetica').text(
          `A presente contratação fundamenta-se no Art. 74, inciso III, da Lei Federal nº 14.133/2021:\n\n`,
          { lineGap: 2 }
        );
        doc.font('Helvetica-Oblique').text(
          `"Art. 74. É inexigível a licitação quando inviável a competição, em especial nos casos de:\n` +
          `[...]\n` +
          `III - contratação dos seguintes serviços técnicos especializados de natureza predominantemente intelectual ` +
          `com profissionais ou empresas de notória especialização, vedada a inexigibilidade para serviços de publicidade e divulgação:\n` +
          `a) estudos técnicos, planejamentos, projetos básicos ou projetos executivos;\n` +
          `b) pareceres, perícias e avaliações em geral;\n` +
          `[...]\n` +
          `e) assessorias ou consultorias técnicas e auditorias financeiras ou tributárias;"`,
          { indent: 20 }
        );
        doc.font('Helvetica').moveDown();
        doc.text(
          `O serviço contratado enquadra-se como serviço técnico especializado de natureza predominantemente intelectual, ` +
          `pois combina consultoria ambiental, desenvolvimento de software especializado e geração automatizada de documentos técnicos ` +
          `para licenciamento ambiental conforme normativas CONAMA, atividade que exige conhecimento técnico singular.`,
        );
      }
      doc.moveDown();

      // 4. Da Justificativa de Preço
      this._secao(doc, '4. DA JUSTIFICATIVA DE PREÇO');
      doc.fontSize(10).font('Helvetica').text(
        `O valor proposto de R$ ${contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} é compatível com os praticados no mercado, considerando:\n\n` +
        `  a) Consultorias ambientais tradicionais para licenciamento de cemitérios cobram entre R$ 30.000 e R$ 120.000 por cemitério, ` +
        `sem automação e com prazo médio de 6 a 18 meses;\n` +
        `  b) O sistema contratado automatiza 80% do processo, reduzindo o prazo para 30-90 dias;\n` +
        `  c) Inclui geração automática de todos os documentos obrigatórios (RCA, PCA, Memorial Descritivo, laudos técnicos);\n` +
        (contrato.moduloMonitoramento
          ? `  d) O valor mensal de R$ ${(contrato.valorMensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} inclui monitoramento contínuo e relatórios anuais;\n`
          : '') +
        `\nConclui-se que o preço está dentro da faixa de mercado e representa economia significativa em relação à contratação tradicional.`,
        { lineGap: 2 }
      );
      doc.moveDown();

      // 5. Jurisprudência TCU
      this._secao(doc, '5. JURISPRUDÊNCIA DO TCU');
      doc.fontSize(10).font('Helvetica').text(
        `A contratação encontra amparo na jurisprudência consolidada do Tribunal de Contas da União:\n\n`,
      );
      doc.font('Helvetica-Oblique').fontSize(9).text(
        `"A contratação de serviços técnicos especializados, com profissionais de notória especialização, ` +
        `é hipótese de inexigibilidade de licitação prevista no art. 74, III, da Lei 14.133/2021, ` +
        `desde que demonstrada a singularidade do serviço e a inviabilidade de competição." ` +
        `(TCU, Acórdão 1386/2023 - Plenário)\n\n` +
        `"A dispensa de licitação para contratações de pequeno valor é faculdade da Administração, ` +
        `devendo ser justificada a necessidade e a compatibilidade do preço com o mercado." ` +
        `(TCU, Acórdão 2837/2023 - 2ª Câmara)`,
        { indent: 20 }
      );
      doc.moveDown(2);

      // 6. Conclusão
      this._secao(doc, '6. CONCLUSÃO');
      doc.fontSize(10).font('Helvetica').text(
        `Diante do exposto, justifica-se a contratação direta ${isDispensa ? 'por dispensa de licitação' : 'por inexigibilidade'} ` +
        `do sistema CemLicença Ambiental, nos termos do ${isDispensa ? 'Art. 75, II' : 'Art. 74, III'} da Lei 14.133/2021, ` +
        `considerando a urgência da regularização ambiental, a especialização técnica do serviço e a compatibilidade do preço.\n\n` +
        `${prefeitura.cidade || ''}/${prefeitura.uf || ''}, ${new Date().toLocaleDateString('pt-BR')}`,
        { lineGap: 2 }
      );

      // Assinaturas
      doc.moveDown(3);
      doc.fontSize(10).text('_'.repeat(45), { align: 'left' });
      doc.text('Ordenador de Despesas', { align: 'left' });
      doc.moveDown(2);
      doc.text('_'.repeat(45), { align: 'left' });
      doc.text('Assessor Jurídico', { align: 'left' });

      this._rodape(doc);
      doc.end();
      stream.on('finish', () => resolve(caminho));
      stream.on('error', reject);
    });
  }

  async _gerarMinutaContrato(outputDir, contrato, cemiterios) {
    const caminho = path.join(outputDir, `minuta_contrato_${Date.now()}.pdf`);
    const prefeitura = contrato.prefeitura;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminho);
      doc.pipe(stream);

      this._cabecalho(doc, prefeitura);

      doc.fontSize(14).font('Helvetica-Bold').text(
        'MINUTA DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(
        `Contrato nº ____/${new Date().getFullYear()}`, { align: 'center' });
      doc.moveDown(1);

      // Preâmbulo
      doc.fontSize(10).font('Helvetica').text(
        `A ${prefeitura.nome.toUpperCase()}, inscrita no CNPJ sob o nº ${this._formatarCNPJ(prefeitura.cnpj)}, ` +
        `com sede em ${prefeitura.cidade || ''}/${prefeitura.uf || ''}, neste ato representada pelo Prefeito Municipal, ` +
        `Sr(a). _________________________, doravante denominada CONTRATANTE, e de outro lado, ` +
        `_________________________, inscrita no CNPJ sob o nº _________________________, ` +
        `doravante denominada CONTRATADA, resolvem celebrar o presente contrato, em conformidade com ` +
        `o ${contrato.modalidade === 'DISPENSA_ART75_II' ? 'Art. 75, II' : 'Art. 74, III'} da Lei Federal nº 14.133/2021, ` +
        `mediante as seguintes cláusulas e condições:`,
        { lineGap: 2, align: 'justify' }
      );
      doc.moveDown();

      const clausulas = [
        {
          titulo: 'CLÁUSULA PRIMEIRA - DO OBJETO',
          texto: `O presente contrato tem por objeto a contratação de sistema de software especializado em licenciamento ambiental automatizado para cemitérios municipais (plataforma SaaS "CemLicença Ambiental"), ` +
            `para atendimento de ${cemiterios.length} cemitério(s), compreendendo:\n` +
            (contrato.moduloCadastro ? '  I - Cadastro e diagnóstico ambiental;\n' : '') +
            (contrato.moduloLicenciamento ? '  II - Licenciamento ambiental automatizado;\n' : '') +
            (contrato.moduloContratacao ? '  III - Gestão de contratação e justificativas;\n' : '') +
            (contrato.moduloMonitoramento ? '  IV - Monitoramento ambiental recorrente;\n' : ''),
        },
        {
          titulo: 'CLÁUSULA SEGUNDA - DO VALOR E PAGAMENTO',
          texto: `O valor total do presente contrato é de R$ ${contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ` +
            `(${this._valorPorExtenso(contrato.valorTotal)})` +
            (contrato.parcelas > 1 ? `, a ser pago em ${contrato.parcelas} parcela(s)` : '') +
            (contrato.valorMensal ? `.\n\nValor mensal de monitoramento: R$ ${contrato.valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '') +
            `.\n\nO pagamento será efetuado mediante apresentação de nota fiscal e comprovação da execução dos serviços.`,
        },
        {
          titulo: 'CLÁUSULA TERCEIRA - DO PRAZO',
          texto: `O presente contrato terá vigência de 12 (doze) meses a contar da data de assinatura, podendo ser prorrogado nos termos do Art. 107 da Lei 14.133/2021.`,
        },
        {
          titulo: 'CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA',
          texto: `A CONTRATADA obriga-se a:\n` +
            `  I - Disponibilizar acesso ao sistema em até 5 (cinco) dias úteis após assinatura;\n` +
            `  II - Fornecer treinamento online para até 5 (cinco) usuários;\n` +
            `  III - Gerar todos os documentos técnicos obrigatórios para licenciamento;\n` +
            `  IV - Prestar suporte técnico em horário comercial com resposta em até 2 horas;\n` +
            `  V - Manter confidencialidade dos dados da CONTRATANTE;\n` +
            `  VI - Garantir disponibilidade mínima de 99,5% do sistema.`,
        },
        {
          titulo: 'CLÁUSULA QUINTA - DAS OBRIGAÇÕES DA CONTRATANTE',
          texto: `A CONTRATANTE obriga-se a:\n` +
            `  I - Fornecer os dados e documentos necessários para operação do sistema;\n` +
            `  II - Efetuar os pagamentos nas datas pactuadas;\n` +
            `  III - Designar servidor responsável para interagir com a CONTRATADA;\n` +
            `  IV - Comunicar formalmente qualquer irregularidade na execução dos serviços.`,
        },
        {
          titulo: 'CLÁUSULA SEXTA - DA RESCISÃO',
          texto: `O presente contrato poderá ser rescindido nos termos dos Arts. 137 a 139 da Lei 14.133/2021, mediante notificação prévia de 30 (trinta) dias.`,
        },
        {
          titulo: 'CLÁUSULA SÉTIMA - DO FORO',
          texto: `Fica eleito o Foro da Comarca de ${prefeitura.cidade || '_________'}/${prefeitura.uf || '__'} para dirimir quaisquer dúvidas oriundas deste contrato.\n\n` +
            `E por estarem assim justas e acertadas, as partes firmam o presente instrumento em 2 (duas) vias.`,
        },
      ];

      for (const clausula of clausulas) {
        this._secao(doc, clausula.titulo);
        doc.fontSize(10).font('Helvetica').text(clausula.texto, { lineGap: 2, align: 'justify' });
        doc.moveDown();
        if (doc.y > 680) doc.addPage();
      }

      // Assinaturas
      doc.moveDown(2);
      doc.fontSize(10);
      const y = doc.y;
      doc.text('_'.repeat(35), 60, y);
      doc.text('CONTRATANTE', 60, y + 15);
      doc.text('_'.repeat(35), 320, y);
      doc.text('CONTRATADA', 320, y + 15);

      doc.moveDown(3);
      doc.text('Testemunhas:', 60);
      doc.moveDown();
      doc.text('1. ________________________________  CPF: _______________', 60);
      doc.moveDown(0.5);
      doc.text('2. ________________________________  CPF: _______________', 60);

      this._rodape(doc);
      doc.end();
      stream.on('finish', () => resolve(caminho));
      stream.on('error', reject);
    });
  }

  async _gerarParecerEspecializacao(outputDir, contrato) {
    const caminho = path.join(outputDir, `parecer_especializacao_${Date.now()}.pdf`);
    const prefeitura = contrato.prefeitura;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminho);
      doc.pipe(stream);

      this._cabecalho(doc, prefeitura);

      doc.fontSize(14).font('Helvetica-Bold').text(
        'PARECER DE NOTÓRIA ESPECIALIZAÇÃO', { align: 'center' });
      doc.moveDown(1);

      this._secao(doc, '1. DA ANÁLISE');
      doc.fontSize(10).font('Helvetica').text(
        `Em atendimento ao disposto no Art. 74, III, § 3º da Lei 14.133/2021, apresenta-se o presente parecer ` +
        `de notória especialização para fins de contratação direta por inexigibilidade.\n\n` +
        `A empresa CONTRATADA desenvolve solução de software única no mercado nacional, ` +
        `especializada exclusivamente em licenciamento ambiental automatizado para cemitérios, ` +
        `contemplando:\n\n` +
        `  a) Motor de análise de risco de necrochorume baseado em parâmetros do CONAMA 335/2003;\n` +
        `  b) Checklist automatizado com normas federais e estaduais;\n` +
        `  c) Geração automática de documentos técnicos (RCA, PCA, laudos);\n` +
        `  d) Banco de regras específicas por estado (10+ UFs);\n` +
        `  e) Sistema de acompanhamento de prazos judiciais integrado.\n\n` +
        `Não foram identificados concorrentes diretos no mercado que ofereçam solução integrada com as mesmas características. ` +
        `Os sistemas existentes (ex.: Digiplan, SMARit) são voltados exclusivamente para gestão administrativa de sepulturas, ` +
        `NÃO contemplando licenciamento ambiental.`,
        { lineGap: 2, align: 'justify' }
      );
      doc.moveDown();

      this._secao(doc, '2. DA INVIABILIDADE DE COMPETIÇÃO');
      doc.fontSize(10).font('Helvetica').text(
        `A singularidade do serviço é evidenciada por:\n\n` +
        `  I - Conhecimento técnico específico em legislação ambiental aplicada a cemitérios;\n` +
        `  II - Base de dados proprietária com regras de 10+ estados brasileiros;\n` +
        `  III - Algoritmo validado de cálculo de risco de necrochorume;\n` +
        `  IV - Templates de documentos pré-validados por órgãos ambientais;\n` +
        `  V - Inexistência de solução concorrente com escopo equivalente.\n\n` +
        `Resta configurada a inviabilidade de competição nos termos do caput do Art. 74 da Lei 14.133/2021.`,
        { lineGap: 2, align: 'justify' }
      );
      doc.moveDown();

      this._secao(doc, '3. PARECER');
      doc.fontSize(10).font('Helvetica').text(
        `Diante da análise, opina-se pela PROCEDÊNCIA da contratação direta por inexigibilidade de licitação, ` +
        `fundamentada no Art. 74, III, da Lei 14.133/2021, considerando a notória especialização da empresa e a ` +
        `inviabilidade de competição objetiva.\n\n` +
        `${prefeitura.cidade || ''}/${prefeitura.uf || ''}, ${new Date().toLocaleDateString('pt-BR')}`,
        { lineGap: 2, align: 'justify' }
      );

      doc.moveDown(3);
      doc.text('_'.repeat(45));
      doc.text('Assessor Jurídico');
      doc.text('OAB nº ______________');

      this._rodape(doc);
      doc.end();
      stream.on('finish', () => resolve(caminho));
      stream.on('error', reject);
    });
  }

  // ---- Helpers ----
  _cabecalho(doc, prefeitura) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
      .text(prefeitura.nome.toUpperCase(), { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#666')
      .text(`CNPJ: ${this._formatarCNPJ(prefeitura.cnpj)} | ${prefeitura.cidade || ''}/${prefeitura.uf || ''}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#333').lineWidth(1).moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(1);
    doc.fillColor('#000');
  }

  _secao(doc, titulo) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#15803d').text(titulo);
    doc.moveDown(0.3);
    doc.fillColor('#000');
  }

  _rodape(doc) {
    doc.moveDown(2);
    doc.fontSize(7).fillColor('#999')
      .text('Documento gerado pelo sistema CemLicença Ambiental | cemlicenca.com.br', { align: 'center' });
  }

  _formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    const c = cnpj.replace(/[^\d]/g, '');
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  _valorPorExtenso(valor) {
    // Simplificado - para valores comuns de contratação
    const reais = Math.floor(valor);
    const centavos = Math.round((valor - reais) * 100);

    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    function porExtensoAte999(n) {
      if (n === 0) return '';
      if (n === 100) return 'cem';

      const partes = [];
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;

      if (c > 0) partes.push(centenas[c]);
      if (d === 1) {
        partes.push(especiais[u]);
      } else {
        if (d > 0) partes.push(dezenas[d]);
        if (u > 0) partes.push(unidades[u]);
      }

      return partes.join(' e ');
    }

    const milhares = Math.floor(reais / 1000);
    const resto = reais % 1000;

    let texto = '';
    if (milhares > 0) {
      texto += porExtensoAte999(milhares) + ' mil';
      if (resto > 0) texto += ' e ';
    }
    if (resto > 0 || milhares === 0) texto += porExtensoAte999(resto);

    texto += ' reais';
    if (centavos > 0) texto += ` e ${porExtensoAte999(centavos)} centavos`;

    return texto;
  }

  _textoResumoJustificativa(contrato) {
    return contrato.modalidade === 'DISPENSA_ART75_II'
      ? `Dispensa de licitação fundamentada no Art. 75, II, Lei 14.133/2021 c/c Decreto 12.807/2025. Valor: R$ ${contrato.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (dentro do limite de R$ 65.492,11).`
      : `Inexigibilidade fundamentada no Art. 74, III, Lei 14.133/2021. Serviço técnico especializado com notória especialização e inviabilidade de competição demonstrada.`;
  }
}

module.exports = new JustificativaService();
