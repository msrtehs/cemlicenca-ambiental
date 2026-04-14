const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const env = require('./config/env');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

const app = express();

// Segurança
app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting - proteção contra abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limit mais restrito para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rotas da API
app.use('/api', routes);

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// Iniciar tarefas agendadas (cron)
const cronService = require('./services/cronService');
cronService.iniciar();

// Iniciar servidor
app.listen(env.port, () => {
  logger.info(`CemLicença API rodando na porta ${env.port} (${env.nodeEnv})`);
  console.log(`\n  CemLicença Ambiental API`);
  console.log(`  Ambiente: ${env.nodeEnv}`);
  console.log(`  URL: http://localhost:${env.port}`);
  console.log(`  Health: http://localhost:${env.port}/api/health\n`);
});

module.exports = app;
