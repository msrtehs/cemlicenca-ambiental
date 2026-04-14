const authService = require('../services/authService');
const { schemas } = require('../utils/validators');
const env = require('../config/env');

class AuthController {
  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const dados = schemas.login.parse(req.body);
      const resultado = await authService.login(dados.email, dados.senha);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/registro
  async registro(req, res, next) {
    try {
      const { prefeitura, usuario } = req.body;

      const dadosPrefeitura = schemas.criarPrefeitura.parse(prefeitura);
      const dadosUsuario = schemas.criarUsuario.parse(usuario);

      if (!dadosUsuario.senha) {
        return res.status(400).json({ error: 'Senha é obrigatória no registro' });
      }

      const resultado = await authService.registrarPrefeitura(dadosPrefeitura, dadosUsuario);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/govbr - Redirecionar para Gov.br
  async govbrRedirect(req, res, next) {
    try {
      if (!env.govbr.clientId) {
        return res.status(503).json({ error: 'Integração Gov.br não configurada' });
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.govbr.clientId,
        redirect_uri: env.govbr.redirectUri,
        scope: 'openid email profile govbr_empresa',
      });

      const url = `${env.govbr.authUrl}?${params.toString()}`;
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/govbr/callback
  async govbrCallback(req, res, next) {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({ error: 'Código de autorização não fornecido' });
      }

      const resultado = await authService.loginGovBr(code);

      if (resultado.pendenteCadastro) {
        // Redirecionar para completar cadastro no frontend
        const params = new URLSearchParams({
          pendente: 'true',
          dados: Buffer.from(JSON.stringify(resultado.govbrData)).toString('base64'),
        });
        return res.redirect(`${env.frontendUrl}/registro/govbr?${params.toString()}`);
      }

      // Login bem sucedido - redirecionar com token
      res.redirect(`${env.frontendUrl}/auth/callback?token=${resultado.token}`);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/govbr/completar
  async completarRegistroGovBr(req, res, next) {
    try {
      const { govbrData, prefeitura } = req.body;
      const dadosPrefeitura = schemas.criarPrefeitura.parse(prefeitura);
      const resultado = await authService.completarRegistroGovBr(govbrData, dadosPrefeitura);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/me
  async me(req, res, next) {
    try {
      const usuario = await authService.buscarUsuarioLogado(req.usuario.id);
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/auth/me - Atualizar perfil
  async atualizarPerfil(req, res, next) {
    try {
      const { nome, email, cargo } = req.body;
      const prisma = require('../config/database');
      const usuario = await prisma.usuario.update({
        where: { id: req.usuario.id },
        data: {
          ...(nome && { nome }),
          ...(email && { email }),
          ...(cargo && { cargo }),
        },
        select: { id: true, nome: true, email: true, cargo: true, perfil: true },
      });
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/auth/senha
  async alterarSenha(req, res, next) {
    try {
      const { senhaAtual, novaSenha } = req.body;

      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
      }

      if (novaSenha.length < 6) {
        return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres' });
      }

      await authService.alterarSenha(req.usuario.id, senhaAtual, novaSenha);
      res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/onboarding - Perguntas rápidas do onboarding (45s)
  async onboarding(req, res, next) {
    try {
      const { quantosCemiterios, temLiminar, areaAproximada } = req.body;

      // Salvar dados do onboarding na prefeitura
      await require('../config/database').prefeitura.update({
        where: { id: req.prefeituraId },
        data: {
          // Armazenar como observação por enquanto
        },
      });

      res.json({
        message: 'Onboarding concluído',
        recomendacao: temLiminar
          ? 'URGENTE: Detectamos liminar do MP. Recomendamos iniciar o licenciamento imediatamente.'
          : `Registre seus ${quantosCemiterios || 1} cemitério(s) para começar o diagnóstico ambiental.`,
        proximoPasso: '/cemiterios/novo',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
