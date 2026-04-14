const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const logger = require('../config/logger');

class UsuarioService {
  // Listar usuários da prefeitura
  async listarPorPrefeitura(prefeituraId, { pagina = 1, limite = 50 } = {}) {
    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where: { prefeituraId } }),
      prisma.usuario.findMany({
        where: { prefeituraId },
        select: {
          id: true,
          nome: true,
          email: true,
          cpf: true,
          cargo: true,
          perfil: true,
          ativo: true,
          ultimoLogin: true,
          createdAt: true,
          govbrId: true,
        },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      dados: usuarios.map(u => ({
        ...u,
        loginGovBr: !!u.govbrId,
        govbrId: undefined,
      })),
      paginacao: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  // Buscar usuário por ID
  async buscarPorId(id, prefeituraId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        prefeituraId: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        perfil: true,
        ativo: true,
        ultimoLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!usuario) {
      throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    // Verificar se pertence à mesma prefeitura
    if (prefeituraId && usuario.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    return usuario;
  }

  // Criar novo usuário na prefeitura
  async criar(dados, prefeituraId, criadoPorId) {
    // Verificar se email já existe
    const existente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });

    if (existente) {
      throw Object.assign(new Error('Email já cadastrado'), { statusCode: 409 });
    }

    // Verificar CPF se fornecido
    if (dados.cpf) {
      const cpfExistente = await prisma.usuario.findUnique({
        where: { cpf: dados.cpf.replace(/[^\d]/g, '') },
      });
      if (cpfExistente) {
        throw Object.assign(new Error('CPF já cadastrado'), { statusCode: 409 });
      }
    }

    const dadosUsuario = {
      prefeituraId,
      nome: dados.nome,
      email: dados.email,
      cpf: dados.cpf?.replace(/[^\d]/g, ''),
      cargo: dados.cargo,
      perfil: dados.perfil || 'TECNICO',
    };

    // Se senha fornecida, hash
    if (dados.senha) {
      dadosUsuario.senha = await bcrypt.hash(dados.senha, 10);
    }

    const usuario = await prisma.usuario.create({
      data: dadosUsuario,
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        perfil: true,
        ativo: true,
        createdAt: true,
      },
    });

    logger.info(`Novo usuário criado: ${dados.email}`, { criadoPor: criadoPorId });

    return usuario;
  }

  // Atualizar usuário
  async atualizar(id, dados, prefeituraId, atualizadoPorId) {
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    if (usuario.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    const dadosAtualizacao = {};
    const camposPermitidos = ['nome', 'cargo', 'perfil', 'ativo'];

    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) {
        dadosAtualizacao[campo] = dados[campo];
      }
    }

    // Troca de senha (apenas admin pode para outros, ou o próprio)
    if (dados.novaSenha) {
      dadosAtualizacao.senha = await bcrypt.hash(dados.novaSenha, 10);
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: dadosAtualizacao,
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        perfil: true,
        ativo: true,
        updatedAt: true,
      },
    });

    logger.info(`Usuário atualizado: ${id}`, { atualizadoPor: atualizadoPorId });

    return atualizado;
  }

  // Desativar usuário (soft delete)
  async desativar(id, prefeituraId, desativadoPorId) {
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    if (usuario.prefeituraId !== prefeituraId) {
      throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Impedir desativar a si mesmo
    if (id === desativadoPorId) {
      throw Object.assign(new Error('Não é possível desativar sua própria conta'), { statusCode: 400 });
    }

    await prisma.usuario.update({
      where: { id },
      data: { ativo: false },
    });

    logger.info(`Usuário desativado: ${id}`, { desativadoPor: desativadoPorId });
  }
}

module.exports = new UsuarioService();
