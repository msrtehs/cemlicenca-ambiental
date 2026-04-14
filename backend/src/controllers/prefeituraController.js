const prefeituraService = require('../services/prefeituraService');

class PrefeituraController {
  // GET /api/prefeituras
  async listar(req, res, next) {
    try {
      const { pagina, limite, uf, busca } = req.query;
      const resultado = await prefeituraService.listar({
        pagina: parseInt(pagina) || 1,
        limite: parseInt(limite) || 20,
        uf,
        busca,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/prefeituras/minha
  async minha(req, res, next) {
    try {
      const prefeitura = await prefeituraService.buscarPorId(req.prefeituraId);
      res.json(prefeitura);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/prefeituras/:id
  async buscarPorId(req, res, next) {
    try {
      const prefeitura = await prefeituraService.buscarPorId(req.params.id);
      res.json(prefeitura);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/prefeituras/:id
  async atualizar(req, res, next) {
    try {
      const prefeitura = await prefeituraService.atualizar(
        req.params.id,
        req.body,
        req.usuario.id
      );
      res.json(prefeitura);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/prefeituras/resumo
  async resumo(req, res, next) {
    try {
      const resumo = await prefeituraService.obterResumo(req.prefeituraId);
      res.json(resumo);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PrefeituraController();
