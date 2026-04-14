const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const env = require('../config/env');
const logger = require('../config/logger');

class RelatorioService {
  // Gerar relatório anual de conformidade para MP/TCE
  async gerarRelatorioAnual(cemiterioId, ano, prefeituraId, usuarioId) {
    const cemiterio = await prisma.cemiterio.findUnique({
      where: { id: cemiterioId },
      include: { prefeitura: true },
    });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    // Buscar monitoramentos do ano
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59);

    const monitoramentos = await prisma.monitoramento.findMany({
      where: {
        cemiterioId,
        dataColeta: { gte: inicioAno, lte: fimAno },
      },
      orderBy: { dataColeta: 'asc' },
    });

    // Buscar licenciamento vigente
    const licenciamento = await prisma.licenciamento.findFirst({
      where: { cemiterioId, status: 'LICENCA_EMITIDA' },
      orderBy: { dataEmissao: 'desc' },
    });

    // Gerar PDF
    const outputDir = path.join(env.upload.dir, cemiterioId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const nomeArquivo = `relatorio_anual_${ano}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(outputDir, nomeArquivo);

    await this._gerarPDFRelatorioAnual(caminhoCompleto, cemiterio, monitoramentos, licenciamento, ano);

    // Salvar referência
    const documento = await prisma.documento.create({
      data: {
        cemiterioId,
        usuarioId,
        tipo: 'RELATORIO_MONITORAMENTO',
        titulo: `Relatório Anual de Conformidade ${ano} - ${cemiterio.nome}`,
        descricao: `${monitoramentos.length} coletas no período`,
        caminho: caminhoCompleto,
        status: 'GERADO',
      },
    });

    logger.info(`Relatório anual ${ano} gerado: ${cemiterio.nome}`, { usuarioId });

    return {
      documento,
      downloadUrl: `/uploads/${cemiterioId}/${nomeArquivo}`,
      resumo: {
        periodo: `${ano}`,
        totalColetas: monitoramentos.length,
        alertas: monitoramentos.filter(m => m.status === 'ALERTA').length,
        licencaVigente: !!licenciamento,
      },
    };
  }

  // Exportar dados para CSV
  async exportarCSV(cemiterioId, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: cemiterioId } });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    const monitoramentos = await prisma.monitoramento.findMany({
      where: { cemiterioId },
      orderBy: { dataColeta: 'asc' },
    });

    const header = 'Período;Data Coleta;Necrochorume (mg/L);pH Solo;Lençol Freático (m);Ocupação (%);Novos Sepultamentos;Exumações;Ossários;Alerta Contaminação;Alerta Superlotação;Status\n';

    const linhas = monitoramentos.map(m =>
      `${m.periodo};${new Date(m.dataColeta).toLocaleDateString('pt-BR')};${m.nivelNecrochorume ?? ''};${m.phSolo ?? ''};${m.nivelLencolFreatico ?? ''};${m.percentualOcupacao ?? ''};${m.novosSepultamentos ?? ''};${m.exumacoes ?? ''};${m.ossariosUtilizados ?? ''};${m.alertaContaminacao ? 'SIM' : 'NÃO'};${m.alertaSuperlotacao ? 'SIM' : 'NÃO'};${m.status}`
    ).join('\n');

    return {
      conteudo: header + linhas,
      nomeArquivo: `monitoramento_${cemiterio.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  // ---- PDF ----
  async _gerarPDFRelatorioAnual(caminho, cemiterio, monitoramentos, licenciamento, ano) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminho);
      doc.pipe(stream);

      // Cabeçalho
      doc.fontSize(10).font('Helvetica').fillColor('#666')
        .text(cemiterio.prefeitura.nome.toUpperCase(), { align: 'center' })
        .text(`${cemiterio.prefeitura.cidade || cemiterio.cidade}/${cemiterio.prefeitura.uf || cemiterio.uf}`, { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#166534')
        .text(`RELATÓRIO ANUAL DE CONFORMIDADE AMBIENTAL`, { align: 'center' });
      doc.fontSize(12).text(`Exercício ${ano}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.strokeColor('#16a34a').lineWidth(2).moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(11).font('Helvetica').fillColor('#333')
        .text(`Cemitério: ${cemiterio.nome}`, { align: 'center' })
        .text(`${cemiterio.endereco} - ${cemiterio.cidade}/${cemiterio.uf}`, { align: 'center' });
      doc.moveDown(1);

      // 1. Situação da Licença
      this._secao(doc, '1. SITUAÇÃO DA LICENÇA AMBIENTAL');
      if (licenciamento) {
        doc.fontSize(10).font('Helvetica');
        this._campo(doc, 'Tipo', licenciamento.tipo);
        this._campo(doc, 'Nº Licença', licenciamento.numeroLicenca || 'Não informado');
        this._campo(doc, 'Órgão', licenciamento.orgaoAmbiental || 'Não informado');
        this._campo(doc, 'Emissão', licenciamento.dataEmissao ? new Date(licenciamento.dataEmissao).toLocaleDateString('pt-BR') : '-');
        this._campo(doc, 'Validade', licenciamento.dataValidade ? new Date(licenciamento.dataValidade).toLocaleDateString('pt-BR') : '-');
        this._campo(doc, 'Status', 'VIGENTE');
      } else {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626')
          .text('ATENÇÃO: Cemitério sem licença ambiental vigente.');
        doc.fillColor('#000');
      }
      doc.moveDown();

      // 2. Resumo de Monitoramentos
      this._secao(doc, '2. MONITORAMENTOS REALIZADOS');
      if (monitoramentos.length === 0) {
        doc.fontSize(10).font('Helvetica').text('Nenhum monitoramento registrado no período.');
      } else {
        doc.fontSize(10).font('Helvetica')
          .text(`Total de coletas: ${monitoramentos.length}`)
          .text(`Alertas emitidos: ${monitoramentos.filter(m => m.status === 'ALERTA').length}`);
        doc.moveDown(0.5);

        // Tabela simplificada
        doc.fontSize(9).font('Helvetica-Bold');
        const headers = ['Período', 'Necrochor.', 'pH', 'Lençol', 'Ocupação', 'Status'];
        const colWidths = [80, 70, 50, 60, 70, 70];
        let x = 60;
        for (let i = 0; i < headers.length; i++) {
          doc.text(headers[i], x, doc.y, { width: colWidths[i], continued: i < headers.length - 1 });
          x += colWidths[i];
        }
        doc.moveDown(0.3);
        doc.strokeColor('#ccc').lineWidth(0.5).moveTo(60, doc.y).lineTo(535, doc.y).stroke();
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(8);
        for (const m of monitoramentos.slice(0, 12)) {
          x = 60;
          const vals = [
            m.periodo,
            m.nivelNecrochorume != null ? `${m.nivelNecrochorume} mg/L` : '-',
            m.phSolo != null ? `${m.phSolo}` : '-',
            m.nivelLencolFreatico != null ? `${m.nivelLencolFreatico}m` : '-',
            m.percentualOcupacao != null ? `${m.percentualOcupacao.toFixed(1)}%` : '-',
            m.status,
          ];
          for (let i = 0; i < vals.length; i++) {
            doc.text(vals[i], x, doc.y, { width: colWidths[i], continued: i < vals.length - 1 });
            x += colWidths[i];
          }
          doc.moveDown(0.2);
        }
      }
      doc.moveDown();

      // 3. Indicadores
      if (monitoramentos.length > 0) {
        this._secao(doc, '3. EVOLUÇÃO DOS INDICADORES');

        const necroValues = monitoramentos.filter(m => m.nivelNecrochorume != null);
        if (necroValues.length > 0) {
          const media = necroValues.reduce((s, m) => s + m.nivelNecrochorume, 0) / necroValues.length;
          const max = Math.max(...necroValues.map(m => m.nivelNecrochorume));
          const min = Math.min(...necroValues.map(m => m.nivelNecrochorume));
          doc.fontSize(10).font('Helvetica');
          this._campo(doc, 'Necrochorume - Média', `${media.toFixed(2)} mg/L`);
          this._campo(doc, 'Necrochorume - Máximo', `${max.toFixed(2)} mg/L`);
          this._campo(doc, 'Necrochorume - Mínimo', `${min.toFixed(2)} mg/L`);
        }

        const sepultamentos = monitoramentos.reduce((s, m) => s + (m.novosSepultamentos || 0), 0);
        const exumacoes = monitoramentos.reduce((s, m) => s + (m.exumacoes || 0), 0);
        this._campo(doc, 'Total sepultamentos no ano', String(sepultamentos));
        this._campo(doc, 'Total exumações no ano', String(exumacoes));
        this._campo(doc, 'Ocupação atual', `${cemiterio.percentualOcupacao?.toFixed(1) || 'N/I'}%`);
        doc.moveDown();
      }

      // 4. Conclusão
      this._secao(doc, monitoramentos.length > 0 ? '4. CONCLUSÃO E RECOMENDAÇÕES' : '3. CONCLUSÃO');
      const alertas = monitoramentos.filter(m => m.status === 'ALERTA').length;
      doc.fontSize(10).font('Helvetica').text(
        alertas === 0
          ? `Durante o exercício de ${ano}, o cemitério "${cemiterio.nome}" manteve-se dentro dos parâmetros de conformidade ambiental estabelecidos pelas Resoluções CONAMA 335/2003, 368/2006 e 402/2008. Recomenda-se a continuidade do programa de monitoramento.`
          : `Durante o exercício de ${ano}, foram identificados ${alertas} alerta(s) nos monitoramentos do cemitério "${cemiterio.nome}". Recomenda-se a adoção das medidas corretivas indicadas nos relatórios de monitoramento específicos, bem como a intensificação do programa de acompanhamento ambiental.`,
        { lineGap: 2, align: 'justify' }
      );

      // Rodapé
      doc.moveDown(2);
      doc.fontSize(10).text(`${cemiterio.cidade}/${cemiterio.uf}, ${new Date().toLocaleDateString('pt-BR')}`);
      doc.moveDown(2);
      doc.text('_'.repeat(45));
      doc.text('Responsável Técnico');

      doc.moveDown(2);
      doc.fontSize(7).fillColor('#999')
        .text('Relatório gerado automaticamente pelo CemLicença Ambiental', { align: 'center' })
        .text('Este documento atende às exigências de prestação de contas ao MP e TCE.', { align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  _secao(doc, titulo) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#15803d').text(titulo);
    doc.strokeColor('#86efac').lineWidth(0.5).moveTo(60, doc.y + 2).lineTo(535, doc.y + 2).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#000');
  }

  _campo(doc, label, valor) {
    doc.fontSize(10).font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(valor || 'N/I');
  }
}

module.exports = new RelatorioService();
