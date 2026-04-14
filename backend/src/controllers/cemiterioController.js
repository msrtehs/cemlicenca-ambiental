const cemiterioService = require('../services/cemiterioService');
const checklistService = require('../services/checklistService');
const importacaoService = require('../services/importacaoService');
const riscoService = require('../services/riscoService');
const pdfService = require('../services/pdfService');
const prisma = require('../config/database');
const { schemas } = require('../utils/validators');

class CemiterioController {
  // POST /api/cemiterios - Criar cemitério
  async criar(req, res, next) {
    try {
      const dados = schemas.criarCemiterio.parse(req.body);
      const cemiterio = await cemiterioService.criar(dados, req.prefeituraId, req.usuario.id);
      res.status(201).json(cemiterio);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/cemiterios - Listar cemitérios
  async listar(req, res, next) {
    try {
      const resultado = await cemiterioService.listar(req.prefeituraId, {
        pagina: parseInt(req.query.pagina) || 1,
        limite: parseInt(req.query.limite) || 20,
        status: req.query.status,
        busca: req.query.busca,
        comLiminar: req.query.comLiminar,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/cemiterios/estatisticas - Estatísticas
  async estatisticas(req, res, next) {
    try {
      const stats = await cemiterioService.obterEstatisticas(req.prefeituraId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/cemiterios/:id - Buscar por ID
  async buscarPorId(req, res, next) {
    try {
      const cemiterio = await cemiterioService.buscarPorId(req.params.id, req.prefeituraId);
      res.json(cemiterio);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/cemiterios/:id - Atualizar
  async atualizar(req, res, next) {
    try {
      const cemiterio = await cemiterioService.atualizar(
        req.params.id,
        req.body,
        req.prefeituraId,
        req.usuario.id
      );
      res.json(cemiterio);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/cemiterios/:id/arquivos - Upload de arquivos
  async uploadArquivo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const tipo = req.body.tipo || 'OUTRO';
      const arquivo = await cemiterioService.adicionarArquivo(
        req.params.id,
        req.file,
        tipo,
        req.prefeituraId
      );
      res.status(201).json(arquivo);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/cemiterios/:id/arquivos/:arquivoId - Remover arquivo
  async removerArquivo(req, res, next) {
    try {
      await cemiterioService.removerArquivo(req.params.arquivoId, req.prefeituraId);
      res.json({ message: 'Arquivo removido com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/cemiterios/:id/checklist - Obter checklist
  async obterChecklist(req, res, next) {
    try {
      const checklist = await checklistService.obterChecklist(req.params.id);
      res.json(checklist);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/cemiterios/:id/checklist/:itemId - Atualizar item do checklist
  async atualizarChecklist(req, res, next) {
    try {
      const item = await cemiterioService.atualizarChecklist(
        req.params.itemId,
        req.body,
        req.prefeituraId,
        req.usuario.id
      );
      res.json(item);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/cemiterios/:id/checklist/autopreencher - IA preenche automaticamente
  async autoPreencherChecklist(req, res, next) {
    try {
      const resultado = await checklistService.autoPreencherChecklist(req.params.id);
      res.json({
        message: `${resultado ? resultado.length : 0} itens preenchidos automaticamente`,
        itensAtualizados: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/cemiterios/:id/importar - Importar planilha Excel
  async importarExcel(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const resultado = await importacaoService.importarExcel(
        req.params.id,
        req.file.path,
        req.prefeituraId
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/cemiterios/:id/risco - Calcular risco de necrochorume
  async calcularRisco(req, res, next) {
    try {
      const cemiterio = await prisma.cemiterio.findUnique({
        where: { id: req.params.id },
      });

      if (!cemiterio || cemiterio.prefeituraId !== req.prefeituraId) {
        return res.status(404).json({ error: 'Cemitério não encontrado' });
      }

      const relatorio = riscoService.gerarRelatorioRisco(cemiterio);
      res.json(relatorio);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/cemiterios/:id/memorial - Gerar memorial descritivo PDF
  async gerarMemorial(req, res, next) {
    try {
      const cemiterio = await prisma.cemiterio.findUnique({
        where: { id: req.params.id },
      });

      if (!cemiterio || cemiterio.prefeituraId !== req.prefeituraId) {
        return res.status(404).json({ error: 'Cemitério não encontrado' });
      }

      const checklist = await checklistService.obterChecklist(req.params.id);
      const caminhoArquivo = await pdfService.gerarMemorialDescritivo(cemiterio, checklist);

      // Salvar referência no banco
      const documento = await prisma.documento.create({
        data: {
          cemiterioId: cemiterio.id,
          usuarioId: req.usuario.id,
          tipo: 'MEMORIAL_DESCRITIVO',
          titulo: `Memorial Descritivo - ${cemiterio.nome}`,
          descricao: `Memorial descritivo gerado automaticamente`,
          caminho: caminhoArquivo,
          status: 'GERADO',
        },
      });

      res.json({
        message: 'Memorial descritivo gerado com sucesso',
        documento,
        downloadUrl: `/uploads/${cemiterio.id}/${caminhoArquivo.split(/[/\\]/).pop()}`,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/cemiterios/:id/diagnostico - Gerar relatório diagnóstico PDF
  async gerarDiagnostico(req, res, next) {
    try {
      const cemiterio = await prisma.cemiterio.findUnique({
        where: { id: req.params.id },
      });

      if (!cemiterio || cemiterio.prefeituraId !== req.prefeituraId) {
        return res.status(404).json({ error: 'Cemitério não encontrado' });
      }

      const checklist = await checklistService.obterChecklist(req.params.id);
      const risco = riscoService.gerarRelatorioRisco(cemiterio);
      const caminhoArquivo = await pdfService.gerarRelatorioDiagnostico(cemiterio, checklist, risco);

      // Atualizar status do cemitério
      await prisma.cemiterio.update({
        where: { id: req.params.id },
        data: { status: 'DIAGNOSTICO' },
      });

      const documento = await prisma.documento.create({
        data: {
          cemiterioId: cemiterio.id,
          usuarioId: req.usuario.id,
          tipo: 'RELATORIO_DIAGNOSTICO',
          titulo: `Diagnóstico Ambiental - ${cemiterio.nome}`,
          descricao: `Risco: ${risco.riscoGeral}% (${risco.nivel})`,
          caminho: caminhoArquivo,
          conteudoJson: risco,
          status: 'GERADO',
        },
      });

      res.json({
        message: 'Diagnóstico ambiental gerado com sucesso',
        risco,
        documento,
        downloadUrl: `/uploads/${cemiterio.id}/${caminhoArquivo.split(/[/\\]/).pop()}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CemiterioController();
