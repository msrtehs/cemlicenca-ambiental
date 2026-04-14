const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const env = require('../config/env');
const logger = require('../config/logger');

class AuthService {
  // Login por email/senha
  async login(email, senha) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { prefeitura: true },
    });

    if (!usuario) {
      throw Object.assign(new Error('Email ou senha inválidos'), { statusCode: 401 });
    }

    if (!usuario.ativo) {
      throw Object.assign(new Error('Usuário desativado. Contate o administrador.'), { statusCode: 403 });
    }

    if (!usuario.senha) {
      throw Object.assign(new Error('Este usuário usa login via Gov.br. Use o botão Gov.br para entrar.'), { statusCode: 400 });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw Object.assign(new Error('Email ou senha inválidos'), { statusCode: 401 });
    }

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    const token = this.gerarToken(usuario);

    logger.info(`Login bem-sucedido: ${email}`);

    return {
      token,
      usuario: this.formatarUsuario(usuario),
    };
  }

  // Registro de nova prefeitura + admin
  async registrarPrefeitura(dadosPrefeitura, dadosUsuario) {
    // Verificar se CNPJ já existe
    const prefeituraExistente = await prisma.prefeitura.findUnique({
      where: { cnpj: dadosPrefeitura.cnpj.replace(/[^\d]/g, '') },
    });

    if (prefeituraExistente) {
      throw Object.assign(new Error('CNPJ já cadastrado no sistema'), { statusCode: 409 });
    }

    // Verificar se email já existe
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dadosUsuario.email },
    });

    if (emailExistente) {
      throw Object.assign(new Error('Email já cadastrado no sistema'), { statusCode: 409 });
    }

    // Criar prefeitura + usuário admin em transação
    const resultado = await prisma.$transaction(async (tx) => {
      const prefeitura = await tx.prefeitura.create({
        data: {
          cnpj: dadosPrefeitura.cnpj.replace(/[^\d]/g, ''),
          nome: dadosPrefeitura.nome,
          uf: dadosPrefeitura.uf,
          cidade: dadosPrefeitura.cidade,
          cep: dadosPrefeitura.cep,
          endereco: dadosPrefeitura.endereco,
          telefone: dadosPrefeitura.telefone,
          email: dadosPrefeitura.email || dadosUsuario.email,
          populacao: dadosPrefeitura.populacao,
          planoAtual: 'TRIAL',
        },
      });

      const senhaHash = await bcrypt.hash(dadosUsuario.senha, 10);

      const usuario = await tx.usuario.create({
        data: {
          prefeituraId: prefeitura.id,
          nome: dadosUsuario.nome,
          email: dadosUsuario.email,
          senha: senhaHash,
          cpf: dadosUsuario.cpf?.replace(/[^\d]/g, ''),
          cargo: dadosUsuario.cargo,
          perfil: 'ADMIN',
        },
        include: { prefeitura: true },
      });

      return { prefeitura, usuario };
    });

    const token = this.gerarToken(resultado.usuario);

    logger.info(`Nova prefeitura registrada: ${dadosPrefeitura.cnpj} - ${dadosPrefeitura.nome}`);

    return {
      token,
      usuario: this.formatarUsuario(resultado.usuario),
      prefeitura: resultado.prefeitura,
    };
  }

  // Login/registro via Gov.br (OAuth)
  async loginGovBr(codigoAutorizacao) {
    // 1. Trocar código por token no Gov.br
    const tokenData = await this.trocarCodigoGovBr(codigoAutorizacao);

    // 2. Buscar dados do usuário no Gov.br
    const dadosGovBr = await this.buscarDadosGovBr(tokenData.access_token);

    // 3. Buscar ou criar usuário
    let usuario = await prisma.usuario.findUnique({
      where: { govbrId: dadosGovBr.sub },
      include: { prefeitura: true },
    });

    if (!usuario) {
      // Tentar encontrar por CPF
      usuario = await prisma.usuario.findUnique({
        where: { cpf: dadosGovBr.cpf },
        include: { prefeitura: true },
      });

      if (usuario) {
        // Vincular Gov.br ao usuário existente
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: { govbrId: dadosGovBr.sub },
          include: { prefeitura: true },
        });
      }
    }

    if (!usuario) {
      // Usuário não encontrado - retornar dados para completar cadastro
      return {
        pendenteCadastro: true,
        govbrData: {
          govbrId: dadosGovBr.sub,
          nome: dadosGovBr.name,
          cpf: dadosGovBr.cpf,
          email: dadosGovBr.email,
        },
      };
    }

    if (!usuario.ativo) {
      throw Object.assign(new Error('Usuário desativado'), { statusCode: 403 });
    }

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    const token = this.gerarToken(usuario);

    return {
      token,
      usuario: this.formatarUsuario(usuario),
    };
  }

  // Completar registro Gov.br (quando não tem prefeitura vinculada)
  async completarRegistroGovBr(govbrData, dadosPrefeitura) {
    const cnpjLimpo = dadosPrefeitura.cnpj.replace(/[^\d]/g, '');

    // Verificar se já existe prefeitura com esse CNPJ
    let prefeitura = await prisma.prefeitura.findUnique({
      where: { cnpj: cnpjLimpo },
    });

    const resultado = await prisma.$transaction(async (tx) => {
      if (!prefeitura) {
        prefeitura = await tx.prefeitura.create({
          data: {
            cnpj: cnpjLimpo,
            nome: dadosPrefeitura.nome,
            uf: dadosPrefeitura.uf,
            cidade: dadosPrefeitura.cidade,
            email: govbrData.email,
            planoAtual: 'TRIAL',
          },
        });
      }

      const usuario = await tx.usuario.create({
        data: {
          prefeituraId: prefeitura.id,
          nome: govbrData.nome,
          email: govbrData.email,
          cpf: govbrData.cpf,
          govbrId: govbrData.govbrId,
          perfil: 'ADMIN',
        },
        include: { prefeitura: true },
      });

      return usuario;
    });

    const token = this.gerarToken(resultado);

    return {
      token,
      usuario: this.formatarUsuario(resultado),
    };
  }

  // Buscar dados do usuário logado
  async buscarUsuarioLogado(userId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { prefeitura: true },
    });

    if (!usuario) {
      throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    return this.formatarUsuario(usuario);
  }

  // Alterar senha
  async alterarSenha(userId, senhaAtual, novaSenha) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario.senha) {
      throw Object.assign(new Error('Usuário usa login Gov.br, não possui senha'), { statusCode: 400 });
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw Object.assign(new Error('Senha atual incorreta'), { statusCode: 401 });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({
      where: { id: userId },
      data: { senha: senhaHash },
    });

    logger.info(`Senha alterada: ${usuario.email}`);
  }

  // ---- Helpers privados ----

  gerarToken(usuario) {
    return jwt.sign(
      {
        userId: usuario.id,
        prefeituraId: usuario.prefeituraId,
        perfil: usuario.perfil,
      },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );
  }

  formatarUsuario(usuario) {
    const { senha, ...rest } = usuario;
    return rest;
  }

  // Trocar código de autorização por token no Gov.br
  async trocarCodigoGovBr(codigo) {
    if (!env.govbr.clientId) {
      throw Object.assign(new Error('Integração Gov.br não configurada'), { statusCode: 503 });
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: env.govbr.redirectUri,
    });

    const response = await fetch(env.govbr.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${env.govbr.clientId}:${env.govbr.clientSecret}`).toString('base64'),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      logger.error('Erro ao trocar código Gov.br', { status: response.status });
      throw Object.assign(new Error('Falha na autenticação Gov.br'), { statusCode: 502 });
    }

    return response.json();
  }

  // Buscar dados do usuário no Gov.br
  async buscarDadosGovBr(accessToken) {
    const response = await fetch(env.govbr.userInfoUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw Object.assign(new Error('Falha ao buscar dados do Gov.br'), { statusCode: 502 });
    }

    return response.json();
  }
}

module.exports = new AuthService();
