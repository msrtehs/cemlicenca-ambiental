const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/database');

// Middleware de autenticação JWT
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.secret);

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      include: { prefeitura: true },
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    req.usuario = usuario;
    req.prefeituraId = usuario.prefeituraId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware de autorização por perfil
const autorizar = (...perfis) => {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({
        error: 'Acesso negado. Perfil insuficiente.',
        perfilNecessario: perfis,
        perfilAtual: req.usuario.perfil,
      });
    }
    next();
  };
};

// Middleware que garante acesso apenas aos dados da própria prefeitura
const restringirPrefeitura = (req, res, next) => {
  // Consultor pode acessar múltiplas prefeituras
  if (req.usuario.perfil === 'CONSULTOR') {
    return next();
  }

  const prefeituraIdParam = req.params.prefeituraId || req.body.prefeituraId;
  if (prefeituraIdParam && prefeituraIdParam !== req.prefeituraId) {
    return res.status(403).json({ error: 'Acesso negado a dados de outra prefeitura' });
  }

  next();
};

module.exports = { auth, autorizar, restringirPrefeitura };
