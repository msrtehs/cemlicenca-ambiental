const contratoService = require('../services/contratoService');
const justificativaService = require('../services/justificativaService');
const { schemas } = require('../utils/validators');

class ContratoController {
  // POST /api/contratos/calcular - Calculadora de valor
  async calcularValor(req, res, next) {
    try {
      const { cemiterios, moduloMonitoramento } = req.body;

      if (!cemiterios || !Array.isArray(cemiterios) || cemiterios.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um cemitério com área e módulos' });
      }

      const resultado = contratoService.calcularValor({
        modulosCemiterios: cemiterios,
        moduloMonitoramento: moduloMonitoramento || false,
      });

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/contratos - Criar contrato
  async criar(req, res, next) {
    try {
      const dados = schemas.criarContrato.parse(req.body);
      const contrato = await contratoService.criar(dados, req.prefeituraId, req.usuario.id);
      res.status(201).json(contrato);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/contratos - Listar contratos
  async listar(req, res, next) {
    try {
      const contratos = await contratoService.listar(req.prefeituraId);
      res.json(contratos);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/contratos/:id - Buscar por ID
  async buscarPorId(req, res, next) {
    try {
      const contrato = await contratoService.buscarPorId(req.params.id, req.prefeituraId);
      res.json(contrato);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/contratos/:id/status - Atualizar status
  async atualizarStatus(req, res, next) {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Status é obrigatório' });

      const contrato = await contratoService.atualizarStatus(
        req.params.id, status, req.prefeituraId, req.usuario.id
      );
      res.json(contrato);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/contratos/:id/justificativa - Gerar pacote de justificativa
  async gerarJustificativa(req, res, next) {
    try {
      const resultado = await justificativaService.gerarPacoteContratacao(
        req.params.id, req.prefeituraId, req.usuario.id
      );
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/contratos/:id/pagamentos/:pagamentoId - Registrar pagamento
  async registrarPagamento(req, res, next) {
    try {
      const resultado = await contratoService.registrarPagamento(
        req.params.pagamentoId,
        req.body,
        req.prefeituraId,
        req.usuario.id
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ContratoController();
