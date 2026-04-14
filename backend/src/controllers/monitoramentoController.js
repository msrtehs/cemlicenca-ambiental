const monitoramentoService = require('../services/monitoramentoService');
const relatorioService = require('../services/relatorioService');
const { schemas } = require('../utils/validators');

class MonitoramentoController {
  // POST /api/monitoramentos - Criar registro
  async criar(req, res, next) {
    try {
      const dados = schemas.criarMonitoramento.parse(req.body);
      const resultado = await monitoramentoService.criar(dados, req.prefeituraId, req.usuario.id);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos - Listar
  async listar(req, res, next) {
    try {
      const resultado = await monitoramentoService.listar(req.prefeituraId, {
        pagina: parseInt(req.query.pagina) || 1,
        limite: parseInt(req.query.limite) || 20,
        cemiterioId: req.query.cemiterioId,
        status: req.query.status,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos/:id - Buscar por ID
  async buscarPorId(req, res, next) {
    try {
      const resultado = await monitoramentoService.buscarPorId(req.params.id, req.prefeituraId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos/historico/:cemiterioId - Histórico para gráficos
  async historico(req, res, next) {
    try {
      const resultado = await monitoramentoService.historico(req.params.cemiterioId, req.prefeituraId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos/previsao/:cemiterioId - IA Preditiva
  async previsaoRisco(req, res, next) {
    try {
      const resultado = await monitoramentoService.previsaoRisco(req.params.cemiterioId, req.prefeituraId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos/sustentabilidade - Dashboard sustentabilidade
  async dashboardSustentabilidade(req, res, next) {
    try {
      const resultado = await monitoramentoService.dashboardSustentabilidade(req.prefeituraId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/monitoramentos/relatorio-anual - Gerar relatório anual PDF
  async gerarRelatorioAnual(req, res, next) {
    try {
      const { cemiterioId, ano } = req.body;
      if (!cemiterioId || !ano) {
        return res.status(400).json({ error: 'cemiterioId e ano são obrigatórios' });
      }
      const resultado = await relatorioService.gerarRelatorioAnual(
        cemiterioId, parseInt(ano), req.prefeituraId, req.usuario.id
      );
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/monitoramentos/exportar/:cemiterioId - Exportar CSV
  async exportarCSV(req, res, next) {
    try {
      const { conteudo, nomeArquivo } = await relatorioService.exportarCSV(
        req.params.cemiterioId, req.prefeituraId
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.send('\uFEFF' + conteudo); // BOM para Excel reconhecer UTF-8
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MonitoramentoController();
