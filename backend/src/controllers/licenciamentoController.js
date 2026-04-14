const licenciamentoService = require('../services/licenciamentoService');
const documentoService = require('../services/documentoService');
const { schemas } = require('../utils/validators');

class LicenciamentoController {
  // POST /api/licenciamentos - Iniciar licenciamento
  async criar(req, res, next) {
    try {
      const dados = schemas.criarLicenciamento.parse(req.body);
      const resultado = await licenciamentoService.criar(dados, req.prefeituraId, req.usuario.id);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/licenciamentos - Listar
  async listar(req, res, next) {
    try {
      const resultado = await licenciamentoService.listar(req.prefeituraId, {
        pagina: parseInt(req.query.pagina) || 1,
        limite: parseInt(req.query.limite) || 20,
        status: req.query.status,
        cemiterioId: req.query.cemiterioId,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/licenciamentos/:id - Detalhes
  async buscarPorId(req, res, next) {
    try {
      const resultado = await licenciamentoService.buscarPorId(req.params.id, req.prefeituraId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/licenciamentos/:id/avancar - Avançar etapa
  async avancarEtapa(req, res, next) {
    try {
      const resultado = await licenciamentoService.avancarEtapa(
        req.params.id,
        req.prefeituraId,
        req.usuario.id,
        req.body.observacao
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/licenciamentos/:id/protocolo - Registrar protocolo
  async registrarProtocolo(req, res, next) {
    try {
      const { numeroProtocolo, dataProtocolo, orgaoAmbiental } = req.body;
      if (!numeroProtocolo) {
        return res.status(400).json({ error: 'Número do protocolo é obrigatório' });
      }
      const resultado = await licenciamentoService.registrarProtocolo(
        req.params.id,
        { numeroProtocolo, dataProtocolo, orgaoAmbiental },
        req.prefeituraId,
        req.usuario.id
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/licenciamentos/:id/exigencias - Registrar exigências
  async registrarExigencias(req, res, next) {
    try {
      const { descricao, prazo } = req.body;
      if (!descricao) {
        return res.status(400).json({ error: 'Descrição das exigências é obrigatória' });
      }
      const resultado = await licenciamentoService.registrarExigencias(
        req.params.id,
        { descricao, prazo },
        req.prefeituraId,
        req.usuario.id
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/licenciamentos/:id/cancelar - Cancelar
  async cancelar(req, res, next) {
    try {
      await licenciamentoService.cancelar(
        req.params.id,
        req.body.motivo || 'Cancelado pelo usuário',
        req.prefeituraId,
        req.usuario.id
      );
      res.json({ message: 'Licenciamento cancelado' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/licenciamentos/orgaos/:uf - Órgãos ambientais por UF
  async orgaosPorUF(req, res, next) {
    try {
      const orgaos = await licenciamentoService.obterOrgaoAmbiental(req.params.uf.toUpperCase());
      res.json(orgaos);
    } catch (error) {
      next(error);
    }
  }

  // --- Documentos do licenciamento ---

  // POST /api/licenciamentos/:id/documentos/gerar - Gerar 1 documento
  async gerarDocumento(req, res, next) {
    try {
      const { tipo } = req.body;
      if (!tipo) return res.status(400).json({ error: 'Tipo de documento é obrigatório' });

      const resultado = await documentoService.gerarDocumento(
        req.params.id,
        tipo,
        req.prefeituraId,
        req.usuario.id
      );
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/licenciamentos/:id/documentos/gerar-todos - Gerar todos
  async gerarTodosDocumentos(req, res, next) {
    try {
      const resultado = await documentoService.gerarTodosDocumentos(
        req.params.id,
        req.prefeituraId,
        req.usuario.id
      );
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/licenciamentos/:id/documentos - Listar documentos
  async listarDocumentos(req, res, next) {
    try {
      const documentos = await documentoService.listar(req.params.id, req.prefeituraId);
      res.json(documentos);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LicenciamentoController();
