const usuarioService = require('../services/usuarioService');
const { schemas } = require('../utils/validators');

class UsuarioController {
  // GET /api/prefeituras/:prefeituraId/usuarios
  async listar(req, res, next) {
    try {
      const resultado = await usuarioService.listarPorPrefeitura(
        req.prefeituraId,
        {
          pagina: parseInt(req.query.pagina) || 1,
          limite: parseInt(req.query.limite) || 50,
        }
      );
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/prefeituras/:prefeituraId/usuarios/:id
  async buscarPorId(req, res, next) {
    try {
      const usuario = await usuarioService.buscarPorId(req.params.id, req.prefeituraId);
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/prefeituras/:prefeituraId/usuarios
  async criar(req, res, next) {
    try {
      const dados = schemas.criarUsuario.parse(req.body);
      const usuario = await usuarioService.criar(dados, req.prefeituraId, req.usuario.id);
      res.status(201).json(usuario);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/prefeituras/:prefeituraId/usuarios/:id
  async atualizar(req, res, next) {
    try {
      const usuario = await usuarioService.atualizar(
        req.params.id,
        req.body,
        req.prefeituraId,
        req.usuario.id
      );
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/prefeituras/:prefeituraId/usuarios/:id
  async desativar(req, res, next) {
    try {
      await usuarioService.desativar(req.params.id, req.prefeituraId, req.usuario.id);
      res.json({ message: 'Usuário desativado com sucesso' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsuarioController();
