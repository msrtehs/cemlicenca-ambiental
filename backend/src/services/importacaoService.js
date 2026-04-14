const XLSX = require('xlsx');
const prisma = require('../config/database');
const logger = require('../config/logger');
const fs = require('fs');

class ImportacaoService {
  // Importar planilha Excel com dados antigos de sepulturas
  async importarExcel(cemiterioId, caminhoArquivo, prefeituraId) {
    const cemiterio = await prisma.cemiterio.findUnique({ where: { id: cemiterioId } });
    if (!cemiterio || cemiterio.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Cemitério não encontrado'), { statusCode: 404 });
    }

    // Ler planilha
    const workbook = XLSX.readFile(caminhoArquivo);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const dados = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!dados || dados.length === 0) {
      throw Object.assign(new Error('Planilha vazia ou formato não reconhecido'), { statusCode: 400 });
    }

    // Processar e validar dados
    const resultado = this.processarDados(dados);

    // Salvar importação no banco
    const importacao = await prisma.dadoImportado.create({
      data: {
        cemiterioId,
        fonteOrigem: 'EXCEL',
        nomeArquivo: caminhoArquivo.split(/[/\\]/).pop(),
        dados: resultado.registrosValidos,
        totalRegistros: resultado.total,
        registrosValidos: resultado.validos,
        registrosErro: resultado.erros.length,
        erros: resultado.erros.length > 0 ? resultado.erros : undefined,
        status: resultado.erros.length === 0 ? 'CONCLUIDO' : 'CONCLUIDO',
      },
    });

    // Atualizar contagem de sepulturas do cemitério
    if (resultado.validos > 0) {
      const totalRegistros = resultado.registrosValidos.length;
      const ocupadas = resultado.registrosValidos.filter(r => r.status === 'OCUPADA').length;
      const abandonadas = resultado.registrosValidos.filter(r => r.status === 'ABANDONADA').length;

      await prisma.cemiterio.update({
        where: { id: cemiterioId },
        data: {
          totalSepulturas: totalRegistros,
          sepulturasOcupadas: ocupadas,
          sepulturasDisponiveis: totalRegistros - ocupadas,
          percentualOcupacao: totalRegistros > 0 ? (ocupadas / totalRegistros) * 100 : 0,
        },
      });
    }

    logger.info(`Importação Excel: ${resultado.validos}/${resultado.total} registros válidos para cemitério ${cemiterioId}`);

    return {
      importacaoId: importacao.id,
      totalRegistros: resultado.total,
      registrosValidos: resultado.validos,
      registrosComErro: resultado.erros.length,
      erros: resultado.erros.slice(0, 20), // máx 20 erros no retorno
      resumo: {
        ocupadas: resultado.registrosValidos.filter(r => r.status === 'OCUPADA').length,
        disponiveis: resultado.registrosValidos.filter(r => r.status === 'DISPONIVEL').length,
        abandonadas: resultado.registrosValidos.filter(r => r.status === 'ABANDONADA').length,
      },
    };
  }

  // Processar dados da planilha
  processarDados(dados) {
    const registrosValidos = [];
    const erros = [];
    const colunasDetectadas = this.detectarColunas(Object.keys(dados[0] || {}));

    for (let i = 0; i < dados.length; i++) {
      const linha = dados[i];
      const registro = {};
      const errosLinha = [];

      // Mapear colunas detectadas
      registro.numero = this.extrairValor(linha, colunasDetectadas.numero);
      registro.quadra = this.extrairValor(linha, colunasDetectadas.quadra);
      registro.lote = this.extrairValor(linha, colunasDetectadas.lote);
      registro.nome = this.extrairValor(linha, colunasDetectadas.nome);
      registro.dataEnterro = this.extrairData(linha, colunasDetectadas.dataEnterro);
      registro.dataExumacao = this.extrairData(linha, colunasDetectadas.dataExumacao);

      // Determinar status
      if (registro.dataExumacao) {
        registro.status = 'DISPONIVEL';
      } else if (registro.nome || registro.dataEnterro) {
        // Verificar se é abandonada (sem movimentação > 10 anos e sem dados)
        if (registro.dataEnterro) {
          const anos = (new Date() - new Date(registro.dataEnterro)) / (365.25 * 24 * 60 * 60 * 1000);
          registro.status = anos > 10 ? 'ABANDONADA' : 'OCUPADA';
        } else {
          registro.status = 'OCUPADA';
        }
      } else {
        registro.status = 'DISPONIVEL';
      }

      // Validar
      if (!registro.numero && !registro.quadra && !registro.lote) {
        errosLinha.push('Sem identificação (número, quadra ou lote)');
      }

      if (errosLinha.length > 0) {
        erros.push({ linha: i + 2, erros: errosLinha, dados: linha });
      } else {
        registrosValidos.push(registro);
      }
    }

    return {
      total: dados.length,
      validos: registrosValidos.length,
      registrosValidos,
      erros,
    };
  }

  // Detectar nomes de colunas automaticamente
  detectarColunas(colunas) {
    const mapeamento = {
      numero: null,
      quadra: null,
      lote: null,
      nome: null,
      dataEnterro: null,
      dataExumacao: null,
    };

    const padroes = {
      numero: /n[uú]mero|num|n[°º]|sepultura|cova|jazigo|gaveta/i,
      quadra: /quadra|setor|bloco|ala|se[çc][aã]o/i,
      lote: /lote|vaga|posi[çc][aã]o/i,
      nome: /nome|falecido|ocupante|defunto|titular/i,
      dataEnterro: /data.*enterro|data.*sepult|data.*[oó]bito|falecimento|sepultamento/i,
      dataExumacao: /data.*exuma|exuma[çc]/i,
    };

    for (const col of colunas) {
      for (const [campo, regex] of Object.entries(padroes)) {
        if (!mapeamento[campo] && regex.test(col)) {
          mapeamento[campo] = col;
        }
      }
    }

    // Fallback: usar primeiras colunas se não detectou
    if (!mapeamento.numero && colunas.length > 0) mapeamento.numero = colunas[0];
    if (!mapeamento.nome && colunas.length > 1) mapeamento.nome = colunas[1];

    return mapeamento;
  }

  extrairValor(linha, coluna) {
    if (!coluna) return null;
    const val = linha[coluna];
    return val !== null && val !== undefined ? String(val).trim() : null;
  }

  extrairData(linha, coluna) {
    if (!coluna) return null;
    const val = linha[coluna];
    if (!val) return null;

    // Tentar parsear data em vários formatos BR
    if (typeof val === 'number') {
      // Serial date do Excel
      const data = XLSX.SSF.parse_date_code(val);
      if (data) return new Date(data.y, data.m - 1, data.d).toISOString();
    }

    const str = String(val).trim();
    // DD/MM/YYYY
    const match = str.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (match) {
      const ano = match[3].length === 2 ? (parseInt(match[3]) > 50 ? 1900 + parseInt(match[3]) : 2000 + parseInt(match[3])) : parseInt(match[3]);
      return new Date(ano, parseInt(match[2]) - 1, parseInt(match[1])).toISOString();
    }

    return null;
  }
}

module.exports = new ImportacaoService();
