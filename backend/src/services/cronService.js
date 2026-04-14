const cron = require('node-cron');
const prisma = require('../config/database');
const notificacaoService = require('./notificacaoService');
const logger = require('../config/logger');

class CronService {
  iniciar() {
    // Verificar prazos de liminares todos os dias às 8h
    cron.schedule('0 8 * * *', async () => {
      logger.info('CRON: Verificando prazos de liminares...');
      await this.verificarPrazosLiminares();
    });

    // Verificar vencimento de licenças toda segunda às 9h
    cron.schedule('0 9 * * 1', async () => {
      logger.info('CRON: Verificando vencimento de licenças...');
      await this.verificarVencimentoLicencas();
    });

    // Verificar pagamentos atrasados todo dia útil às 10h
    cron.schedule('0 10 * * 1-5', async () => {
      logger.info('CRON: Verificando pagamentos atrasados...');
      await this.verificarPagamentosAtrasados();
    });

    logger.info('CRON: Tarefas agendadas inicializadas');
  }

  async verificarPrazosLiminares() {
    try {
      const cemiterios = await prisma.cemiterio.findMany({
        where: {
          possuiLiminar: true,
          prazoLiminar: { gte: new Date() },
        },
      });

      for (const cemiterio of cemiterios) {
        await notificacaoService.alertarPrazoLiminar(cemiterio);
      }

      logger.info(`CRON: ${cemiterios.length} cemitérios com liminar verificados`);
    } catch (error) {
      logger.error('CRON: Erro ao verificar liminares', error);
    }
  }

  async verificarVencimentoLicencas() {
    try {
      const licenciamentos = await prisma.licenciamento.findMany({
        where: {
          status: 'LICENCA_EMITIDA',
          dataValidade: { gte: new Date() },
        },
      });

      for (const lic of licenciamentos) {
        await notificacaoService.alertarVencimentoLicenca(lic);
      }

      logger.info(`CRON: ${licenciamentos.length} licenças verificadas`);
    } catch (error) {
      logger.error('CRON: Erro ao verificar licenças', error);
    }
  }

  async verificarPagamentosAtrasados() {
    try {
      const pagamentosAtrasados = await prisma.pagamento.findMany({
        where: {
          status: 'PENDENTE',
          dataVencimento: { lt: new Date() },
        },
        include: {
          contrato: {
            include: { prefeitura: true },
          },
        },
      });

      for (const pagamento of pagamentosAtrasados) {
        await prisma.pagamento.update({
          where: { id: pagamento.id },
          data: { status: 'ATRASADO' },
        });

        await notificacaoService.criar({
          prefeituraId: pagamento.contrato.prefeituraId,
          tipo: 'VENCIMENTO_PAGAMENTO',
          canal: 'INTERNO',
          titulo: `Pagamento atrasado - Parcela ${pagamento.parcela}`,
          mensagem: `A parcela ${pagamento.parcela} no valor de R$ ${pagamento.valor.toFixed(2)} venceu em ${new Date(pagamento.dataVencimento).toLocaleDateString('pt-BR')}.`,
          destinatario: pagamento.contrato.prefeitura.email || 'sistema',
        });
      }

      logger.info(`CRON: ${pagamentosAtrasados.length} pagamentos atrasados processados`);
    } catch (error) {
      logger.error('CRON: Erro ao verificar pagamentos', error);
    }
  }
}

module.exports = new CronService();
