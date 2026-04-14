require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-mude-em-producao',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  govbr: {
    clientId: process.env.GOVBR_CLIENT_ID,
    clientSecret: process.env.GOVBR_CLIENT_SECRET,
    redirectUri: process.env.GOVBR_REDIRECT_URI,
    authUrl: 'https://sso.acesso.gov.br/authorize',
    tokenUrl: 'https://sso.acesso.gov.br/token',
    userInfoUrl: 'https://sso.acesso.gov.br/userinfo',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL,
    apiToken: process.env.WHATSAPP_API_TOKEN,
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
