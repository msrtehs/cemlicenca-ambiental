const prisma = require('../config/database');

// Middleware de log de auditoria automático
const registrarAuditoria = (acao, entidade) => {
  return async (req, res, next) => {
    // Salva a função original de json para interceptar a resposta
    const originalJson = res.json.bind(res);

    res.json = async (data) => {
      // Só registra se a resposta foi bem sucedida
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await prisma.logAuditoria.create({
            data: {
              usuarioId: req.usuario?.id || null,
              acao,
              entidade,
              entidadeId: req.params.id || data?.id || null,
              detalhes: {
                method: req.method,
                path: req.originalUrl,
                body: req.method !== 'GET' ? sanitizarBody(req.body) : undefined,
              },
              ip: req.ip || req.connection?.remoteAddress,
              userAgent: req.headers['user-agent'],
            },
          });
        } catch (err) {
          // Não bloqueia a resposta por erro de auditoria
          console.error('Erro ao registrar auditoria:', err.message);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

// Remove campos sensíveis do body antes de salvar
function sanitizarBody(body) {
  if (!body) return undefined;
  const sanitizado = { ...body };
  delete sanitizado.senha;
  delete sanitizado.password;
  delete sanitizado.token;
  return sanitizado;
}

module.exports = { registrarAuditoria };
