const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

class PDFService {
  // Gerar Memorial Descritivo do Cemitério
  async gerarMemorialDescritivo(cemiterio, checklist) {
    const outputDir = path.join(env.upload.dir, cemiterio.id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const nomeArquivo = `memorial_descritivo_${cemiterio.id}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(outputDir, nomeArquivo);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminhoCompleto);
      doc.pipe(stream);

      // Cabeçalho
      this._cabecalho(doc, 'MEMORIAL DESCRITIVO');
      this._subtitulo(doc, `Cemitério: ${cemiterio.nome}`);
      doc.moveDown(0.5);

      // 1. Dados de Identificação
      this._secao(doc, '1. IDENTIFICAÇÃO DO EMPREENDIMENTO');
      this._campo(doc, 'Nome', cemiterio.nome);
      this._campo(doc, 'Tipo', this._formatarTipo(cemiterio.tipo));
      this._campo(doc, 'Endereço', cemiterio.endereco);
      this._campo(doc, 'Município/UF', `${cemiterio.cidade}/${cemiterio.uf}`);
      if (cemiterio.cep) this._campo(doc, 'CEP', cemiterio.cep);
      if (cemiterio.latitude && cemiterio.longitude) {
        this._campo(doc, 'Coordenadas', `${cemiterio.latitude}, ${cemiterio.longitude}`);
      }
      if (cemiterio.areaTotal) this._campo(doc, 'Área Total', `${cemiterio.areaTotal} hectares`);
      if (cemiterio.anoFundacao) this._campo(doc, 'Ano de Fundação', String(cemiterio.anoFundacao));
      doc.moveDown();

      // 2. Dados Ambientais
      this._secao(doc, '2. CARACTERIZAÇÃO AMBIENTAL');
      if (cemiterio.tipoSolo) this._campo(doc, 'Tipo de Solo', this._formatarSolo(cemiterio.tipoSolo));
      if (cemiterio.nivelLencolFreatico) this._campo(doc, 'Nível do Lençol Freático', `${cemiterio.nivelLencolFreatico} metros`);
      if (cemiterio.distanciaCorpoHidrico) this._campo(doc, 'Distância do Corpo Hídrico mais próximo', `${cemiterio.distanciaCorpoHidrico} metros`);
      this._campo(doc, 'Sistema de Drenagem', cemiterio.possuiDrenagem ? 'Sim' : 'Não');
      this._campo(doc, 'Ossário', cemiterio.possuiOssario ? 'Sim' : 'Não');
      this._campo(doc, 'Capela', cemiterio.possuiCapela ? 'Sim' : 'Não');
      doc.moveDown();

      // 3. Dados de Ocupação
      this._secao(doc, '3. DADOS DE OCUPAÇÃO');
      if (cemiterio.totalSepulturas) this._campo(doc, 'Total de Sepulturas', String(cemiterio.totalSepulturas));
      if (cemiterio.sepulturasOcupadas) this._campo(doc, 'Sepulturas Ocupadas', String(cemiterio.sepulturasOcupadas));
      if (cemiterio.sepulturasDisponiveis) this._campo(doc, 'Sepulturas Disponíveis', String(cemiterio.sepulturasDisponiveis));
      if (cemiterio.percentualOcupacao) this._campo(doc, 'Percentual de Ocupação', `${cemiterio.percentualOcupacao.toFixed(1)}%`);
      if (cemiterio.volumeEnterrosAnual) this._campo(doc, 'Volume de Enterros/Ano', String(cemiterio.volumeEnterrosAnual));
      doc.moveDown();

      // 4. Análise de Risco
      this._secao(doc, '4. ANÁLISE DE RISCO DE NECROCHORUME');
      if (cemiterio.riscoNecrochorume !== null && cemiterio.riscoNecrochorume !== undefined) {
        const nivel = this._classificarRisco(cemiterio.riscoNecrochorume);
        this._campo(doc, 'Índice de Risco', `${cemiterio.riscoNecrochorume}% (${nivel})`);
        doc.moveDown(0.3);

        const riscoService = require('./riscoService');
        const relatorio = riscoService.gerarRelatorioRisco(cemiterio);

        if (relatorio.problemas.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Problemas Identificados:', { underline: false });
          doc.font('Helvetica');
          for (const problema of relatorio.problemas) {
            doc.fontSize(9).text(`  • [${problema.gravidade}] ${problema.descricao}`, { indent: 10 });
          }
          doc.moveDown(0.3);
        }

        if (relatorio.recomendacoes.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Recomendações:');
          doc.font('Helvetica');
          for (const rec of relatorio.recomendacoes) {
            doc.fontSize(9).text(`  • ${rec}`, { indent: 10 });
          }
        }
      }
      doc.moveDown();

      // 5. Checklist de Conformidade (resumo)
      if (checklist && checklist.length > 0) {
        this._secao(doc, '5. RESUMO DE CONFORMIDADE AMBIENTAL');

        for (const grupo of checklist) {
          doc.fontSize(10).font('Helvetica-Bold').text(
            `${grupo.categoria}: ${grupo.conformes}/${grupo.total} conformes (${grupo.pendentes} pendentes)`,
          );
        }

        doc.moveDown();
        const totalItens = checklist.reduce((s, g) => s + g.total, 0);
        const totalConformes = checklist.reduce((s, g) => s + g.conformes, 0);
        const percentual = totalItens > 0 ? Math.round((totalConformes / totalItens) * 100) : 0;
        doc.fontSize(11).font('Helvetica-Bold').text(
          `Conformidade Geral: ${percentual}% (${totalConformes}/${totalItens})`,
        );
      }

      // 6. Situação Judicial
      if (cemiterio.possuiLiminar) {
        doc.moveDown();
        this._secao(doc, '6. SITUAÇÃO JUDICIAL');
        this._campo(doc, 'Liminar do Ministério Público', 'SIM');
        if (cemiterio.prazoLiminar) {
          const diasRestantes = Math.ceil((new Date(cemiterio.prazoLiminar) - new Date()) / (1000 * 60 * 60 * 24));
          this._campo(doc, 'Prazo', `${new Date(cemiterio.prazoLiminar).toLocaleDateString('pt-BR')} (${diasRestantes} dias restantes)`);
        }
      }

      // Rodapé
      doc.moveDown(2);
      doc.fontSize(8)
        .fillColor('#666')
        .text('─'.repeat(80), { align: 'center' })
        .text(`Documento gerado automaticamente pelo sistema CemLicença Ambiental em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
        .text('Baseado nas normas CONAMA 335/2003, 368/2006 e 402/2008', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(caminhoCompleto));
      stream.on('error', reject);
    });
  }

  // Gerar Relatório de Diagnóstico Ambiental
  async gerarRelatorioDiagnostico(cemiterio, checklist, risco) {
    const outputDir = path.join(env.upload.dir, cemiterio.id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const nomeArquivo = `diagnostico_ambiental_${cemiterio.id}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(outputDir, nomeArquivo);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const stream = fs.createWriteStream(caminhoCompleto);
      doc.pipe(stream);

      this._cabecalho(doc, 'RELATÓRIO DE DIAGNÓSTICO AMBIENTAL');
      this._subtitulo(doc, `Cemitério ${cemiterio.nome} - ${cemiterio.cidade}/${cemiterio.uf}`);
      doc.moveDown();

      // Sumário executivo
      this._secao(doc, 'SUMÁRIO EXECUTIVO');
      const nivelRisco = this._classificarRisco(risco.riscoGeral);
      doc.fontSize(10).font('Helvetica').text(
        `O presente diagnóstico ambiental do cemitério "${cemiterio.nome}", localizado em ${cemiterio.cidade}/${cemiterio.uf}, ` +
        `identificou um nível de risco ${nivelRisco} (${risco.riscoGeral}%) para contaminação por necrochorume. ` +
        `Foram analisados ${checklist.reduce((s, g) => s + g.total, 0)} itens de conformidade ambiental, ` +
        `dos quais ${checklist.reduce((s, g) => s + g.conformes, 0)} estão conformes. ` +
        (risco.conformidadeCONAMA
          ? 'O empreendimento atende aos requisitos mínimos da CONAMA 335/2003.'
          : 'O empreendimento NÃO atende aos requisitos mínimos da CONAMA 335/2003 e necessita de adequações.'),
        { lineGap: 2 }
      );
      doc.moveDown();

      // Problemas
      if (risco.problemas.length > 0) {
        this._secao(doc, 'PROBLEMAS IDENTIFICADOS');
        for (let i = 0; i < risco.problemas.length; i++) {
          const p = risco.problemas[i];
          doc.fontSize(10).font('Helvetica-Bold').text(`${i + 1}. [${p.gravidade}] ${p.descricao}`);
          doc.moveDown(0.3);
        }
        doc.moveDown();
      }

      // Recomendações
      if (risco.recomendacoes.length > 0) {
        this._secao(doc, 'RECOMENDAÇÕES TÉCNICAS');
        for (let i = 0; i < risco.recomendacoes.length; i++) {
          doc.fontSize(10).font('Helvetica').text(`${i + 1}. ${risco.recomendacoes[i]}`);
          doc.moveDown(0.2);
        }
        doc.moveDown();
      }

      // Checklist completo
      this._secao(doc, 'CHECKLIST DE CONFORMIDADE DETALHADO');
      for (const grupo of checklist) {
        doc.fontSize(10).font('Helvetica-Bold').text(`${grupo.categoria}`);
        for (const item of grupo.itens) {
          const icone = item.conforme === true ? '[OK]' : item.conforme === false ? '[NC]' : '[--]';
          doc.fontSize(9).font('Helvetica').text(`  ${icone} ${item.descricao}`);
          if (item.observacao) {
            doc.fontSize(8).fillColor('#666').text(`       Obs: ${item.observacao}`).fillColor('#000');
          }
        }
        doc.moveDown(0.5);
      }

      // Rodapé
      doc.moveDown(2);
      doc.fontSize(8)
        .fillColor('#666')
        .text('─'.repeat(80), { align: 'center' })
        .text(`Relatório gerado pelo CemLicença Ambiental em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })
        .text('Este relatório tem caráter indicativo. A responsabilidade técnica é do profissional habilitado (ART/RRT).', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(caminhoCompleto));
      stream.on('error', reject);
    });
  }

  // ---- Helpers de formatação ----
  _cabecalho(doc, titulo) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#166534').text(titulo, { align: 'center' });
    doc.moveDown(0.3);
    doc.strokeColor('#16a34a').lineWidth(2).moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#000');
  }

  _subtitulo(doc, texto) {
    doc.fontSize(12).font('Helvetica').fillColor('#555').text(texto, { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
  }

  _secao(doc, titulo) {
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#15803d').text(titulo);
    doc.strokeColor('#86efac').lineWidth(1).moveTo(60, doc.y + 2).lineTo(535, doc.y + 2).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#000');
  }

  _campo(doc, label, valor) {
    doc.fontSize(10);
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(valor || 'Não informado');
  }

  _formatarTipo(tipo) {
    const tipos = { MUNICIPAL: 'Municipal', DISTRITAL: 'Distrital', PARTICULAR: 'Particular', COMUNITARIO: 'Comunitário' };
    return tipos[tipo] || tipo;
  }

  _formatarSolo(tipo) {
    const solos = { ARENOSO: 'Arenoso', ARGILOSO: 'Argiloso', SILTOSO: 'Siltoso', MISTO: 'Misto', ROCHOSO: 'Rochoso', NAO_INFORMADO: 'Não informado' };
    return solos[tipo] || tipo;
  }

  _classificarRisco(valor) {
    if (valor >= 75) return 'CRÍTICO';
    if (valor >= 50) return 'ALTO';
    if (valor >= 25) return 'MÉDIO';
    return 'BAIXO';
  }
}

module.exports = new PDFService();
