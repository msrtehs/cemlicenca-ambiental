const prisma = require('../config/database');
const logger = require('../config/logger');
const nodemailer = require('nodemailer');
const env = require('../config/env');

class NotificacaoService {
  constructor() {
    // Configurar transporte de email
    if (env.smtp.user) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }
  }

  // Criar e enviar notificação
  async criar({ prefeituraId, tipo, canal, titulo, mensagem, destinatario }) {
    const notificacao = await prisma.notificacao.create({
      data: {
        prefeituraId,
        tipo,
        canal,
        titulo,
        mensagem,
        destinatario,
      },
    });

    // Enviar pelo canal apropriado
    try {
      switch (canal) {
        case 'EMAIL':
          await this.enviarEmail(destinatario, titulo, mensagem);
          break;
        case 'WHATSAPP':
          await this.enviarWhatsApp(destinatario, mensagem);
          break;
        case 'SMS':
          await this.enviarSMS(destinatario, mensagem);
          break;
        case 'INTERNO':
          // Notificação interna - apenas salvar no banco
          break;
      }

      await prisma.notificacao.update({
        where: { id: notificacao.id },
        data: { enviada: true, enviadaEm: new Date() },
      });
    } catch (error) {
      logger.error(`Falha ao enviar notificação ${canal}:`, error.message);
    }

    return notificacao;
  }

  // Listar notificações da prefeitura
  async listar(prefeituraId, { pagina = 1, limite = 20, apenasNaoLidas = false } = {}) {
    const where = { prefeituraId };
    if (apenasNaoLidas) {
      where.lida = false;
    }

    const [total, notificacoes] = await Promise.all([
      prisma.notificacao.count({ where }),
      prisma.notificacao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: notificacoes,
      paginacao: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  // Marcar como lida
  async marcarComoLida(id, prefeituraId) {
    const notificacao = await prisma.notificacao.findUnique({ where: { id } });

    if (!notificacao || notificacao.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Notificação não encontrada'), { statusCode: 404 });
    }

    return prisma.notificacao.update({
      where: { id },
      data: { lida: true, lidaEm: new Date() },
    });
  }

  // Marcar todas como lidas
  async marcarTodasComoLidas(prefeituraId) {
    await prisma.notificacao.updateMany({
      where: { prefeituraId, lida: false },
      data: { lida: true, lidaEm: new Date() },
    });
  }

  // Contar não lidas
  async contarNaoLidas(prefeituraId) {
    return prisma.notificacao.count({
      where: { prefeituraId, lida: false },
    });
  }

  // --- Alertas automáticos ---

  // Alerta de prazo de liminar
  async alertarPrazoLiminar(cemiterio) {
    if (!cemiterio.possuiLiminar || !cemiterio.prazoLiminar) return;

    const diasRestantes = Math.ceil(
      (new Date(cemiterio.prazoLiminar) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if (diasRestantes <= 30 && diasRestantes > 0) {
      const prefeitura = await prisma.prefeitura.findUnique({
        where: { id: cemiterio.prefeituraId },
      });

      const urgencia = diasRestantes <= 7 ? 'URGENTE' : diasRestantes <= 15 ? 'IMPORTANTE' : 'ATENÇÃO';

      await this.criar({
        prefeituraId: cemiterio.prefeituraId,
        tipo: 'PRAZO_LIMINAR',
        canal: 'INTERNO',
        titulo: `${urgencia}: Prazo de liminar - ${cemiterio.nome}`,
        mensagem: `O cemitério "${cemiterio.nome}" possui liminar com vencimento em ${diasRestantes} dias (${new Date(cemiterio.prazoLiminar).toLocaleDateString('pt-BR')}). Agilize o processo de licenciamento para evitar multas.`,
        destinatario: prefeitura.email || 'sistema',
      });

      // Se urgente, enviar por email também
      if (diasRestantes <= 15 && prefeitura.email) {
        await this.criar({
          prefeituraId: cemiterio.prefeituraId,
          tipo: 'PRAZO_LIMINAR',
          canal: 'EMAIL',
          titulo: `${urgencia}: Prazo liminar ${cemiterio.nome} - ${diasRestantes} dias`,
          mensagem: `Prezado(a),\n\nO cemitério "${cemiterio.nome}" possui liminar do Ministério Público com vencimento em ${diasRestantes} dias.\n\nData limite: ${new Date(cemiterio.prazoLiminar).toLocaleDateString('pt-BR')}\n\nRecomendamos acessar o sistema CemLicença para agilizar o processo de licenciamento ambiental.\n\nAtenciosamente,\nCemLicença Ambiental`,
          destinatario: prefeitura.email,
        });
      }
    }
  }

  // Alerta de vencimento de licença
  async alertarVencimentoLicenca(licenciamento) {
    if (!licenciamento.dataValidade) return;

    const diasRestantes = Math.ceil(
      (new Date(licenciamento.dataValidade) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if (diasRestantes <= 60 && diasRestantes > 0) {
      const cemiterio = await prisma.cemiterio.findUnique({
        where: { id: licenciamento.cemiterioId },
      });

      await this.criar({
        prefeituraId: cemiterio.prefeituraId,
        tipo: 'PRAZO_LICENCA',
        canal: 'INTERNO',
        titulo: `Licença vence em ${diasRestantes} dias - ${cemiterio.nome}`,
        mensagem: `A licença ${licenciamento.tipo} do cemitério "${cemiterio.nome}" vence em ${new Date(licenciamento.dataValidade).toLocaleDateString('pt-BR')}. Inicie o processo de renovação.`,
        destinatario: 'sistema',
      });
    }
  }

  // --- Envio por canal ---

  async enviarEmail(destinatario, assunto, corpo) {
    if (!this.transporter) {
      logger.warn('SMTP não configurado, email não enviado');
      return;
    }

    await this.transporter.sendMail({
      from: `"CemLicença Ambiental" <${env.smtp.user}>`,
      to: destinatario,
      subject: assunto,
      text: corpo,
      html: this.formatarHtmlEmail(assunto, corpo),
    });

    logger.info(`Email enviado para ${destinatario}: ${assunto}`);
  }

  async enviarWhatsApp(telefone, mensagem) {
    if (!env.whatsapp.apiUrl) {
      logger.warn('WhatsApp API não configurada');
      return;
    }

    const response = await fetch(env.whatsapp.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.whatsapp.apiToken}`,
      },
      body: JSON.stringify({
        phone: telefone.replace(/[^\d]/g, ''),
        message: mensagem,
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    logger.info(`WhatsApp enviado para ${telefone}`);
  }

  async enviarSMS(telefone, mensagem) {
    // Placeholder para integração SMS (ex: Twilio, Zenvia)
    logger.warn('SMS não implementado ainda');
  }

  formatarHtmlEmail(titulo, corpo) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Inter', Arial, sans-serif; background: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #16a34a, #166534); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CemLicença Ambiental</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1f2937; margin-top: 0;">${titulo}</h2>
            <div style="color: #4b5563; line-height: 1.6; white-space: pre-line;">${corpo}</div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; text-align: center; color: #9ca3af; font-size: 12px;">
            CemLicença Ambiental - Licenciamento Automatizado para Cemitérios
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new NotificacaoService();
