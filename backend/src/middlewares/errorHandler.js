const logger = require('../config/logger');
const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');

const errorHandler = (err, req, res, _next) => {
  logger.error('Erro na requisição', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.usuario?.id,
  });

  // Erros de validação Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      detalhes: err.errors.map(e => ({
        campo: e.path.join('.'),
        mensagem: e.message,
      })),
    });
  }

  // Erros do Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const campo = err.meta?.target?.join(', ') || 'campo';
      return res.status(409).json({
        error: `Registro duplicado: ${campo} já existe`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
  }

  // Erro de arquivo muito grande
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo excede o tamanho máximo permitido (10MB)' });
  }

  // Erro genérico
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Erro interno do servidor' : err.message,
  });
};

module.exports = errorHandler;
