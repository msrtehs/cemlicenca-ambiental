const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // 1. Criar regras estaduais (principais estados com urgência judicial)
  const regrasEstaduais = [
    {
      uf: 'PE',
      orgaoAmbiental: 'CPRH',
      norma: 'Lei Estadual 14.249/2010 + CONAMA 335/2003',
      descricao: 'Agência Estadual de Meio Ambiente de Pernambuco. Mais rigorosa que a média nacional.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 120,
        taxaProtocolo: 350,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.cprh.pe.gov.br/',
    },
    {
      uf: 'SC',
      orgaoAmbiental: 'IMA',
      norma: 'IN 04/2014 + CONAMA 335/2003',
      descricao: 'Instituto do Meio Ambiente de Santa Catarina (antigo FATMA).',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 90,
        taxaProtocolo: 280,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.ima.sc.gov.br/',
    },
    {
      uf: 'CE',
      orgaoAmbiental: 'SEMACE',
      norma: 'Portaria SEMACE 154/2002 + CONAMA 335/2003',
      descricao: 'Superintendência Estadual do Meio Ambiente do Ceará.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 150,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 90,
        taxaProtocolo: 200,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.semace.ce.gov.br/',
    },
    {
      uf: 'SP',
      orgaoAmbiental: 'CETESB',
      norma: 'Resolução SMA 10/2017 + CONAMA 335/2003',
      descricao: 'Companhia Ambiental do Estado de São Paulo.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: true,
        exigeRCA: true,
        prazoAnalise: 180,
        taxaProtocolo: 500,
      },
      apiDisponivel: true,
      urlProtocolo: 'https://cetesb.sp.gov.br/',
    },
    {
      uf: 'MG',
      orgaoAmbiental: 'SEMAD',
      norma: 'DN COPAM 217/2017 + CONAMA 335/2003',
      descricao: 'Secretaria de Estado de Meio Ambiente e Desenvolvimento Sustentável de MG.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 120,
        taxaProtocolo: 320,
      },
      apiDisponivel: true,
      urlProtocolo: 'https://www.meioambiente.mg.gov.br/',
    },
    {
      uf: 'BA',
      orgaoAmbiental: 'INEMA',
      norma: 'Portaria INEMA 11.292/2016 + CONAMA 335/2003',
      descricao: 'Instituto do Meio Ambiente e Recursos Hídricos da Bahia.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 120,
        taxaProtocolo: 250,
      },
      apiDisponivel: false,
      urlProtocolo: 'http://www.inema.ba.gov.br/',
    },
    {
      uf: 'PR',
      orgaoAmbiental: 'IAT',
      norma: 'Resolução CEMA 094/2014 + CONAMA 335/2003',
      descricao: 'Instituto Água e Terra do Paraná.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 90,
        taxaProtocolo: 300,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.iat.pr.gov.br/',
    },
    {
      uf: 'RS',
      orgaoAmbiental: 'FEPAM',
      norma: 'Portaria FEPAM 053/2012 + CONAMA 335/2003',
      descricao: 'Fundação Estadual de Proteção Ambiental do Rio Grande do Sul.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 120,
        taxaProtocolo: 280,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.fepam.rs.gov.br/',
    },
    {
      uf: 'GO',
      orgaoAmbiental: 'SEMAD-GO',
      norma: 'IN SECIMA 05/2017 + CONAMA 335/2003',
      descricao: 'Secretaria de Estado de Meio Ambiente e Desenvolvimento Sustentável de Goiás.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: false,
        exigeRCA: true,
        prazoAnalise: 90,
        taxaProtocolo: 220,
      },
      apiDisponivel: false,
      urlProtocolo: 'https://www.meioambiente.go.gov.br/',
    },
    {
      uf: 'RJ',
      orgaoAmbiental: 'INEA',
      norma: 'DZ-1310/2004 + CONAMA 335/2003',
      descricao: 'Instituto Estadual do Ambiente do Rio de Janeiro.',
      requisitos: {
        distanciaMinLencol: 1.5,
        distanciaMinCorpoHidrico: 200,
        exigeEIA: true,
        exigeRCA: true,
        prazoAnalise: 150,
        taxaProtocolo: 450,
      },
      apiDisponivel: false,
      urlProtocolo: 'http://www.inea.rj.gov.br/',
    },
  ];

  for (const regra of regrasEstaduais) {
    await prisma.regraEstadual.upsert({
      where: { uf_norma: { uf: regra.uf, norma: regra.norma } },
      update: regra,
      create: regra,
    });
  }

  console.log(`${regrasEstaduais.length} regras estaduais inseridas.`);

  // 2. Criar prefeitura demo para testes
  const prefeituraDemo = await prisma.prefeitura.upsert({
    where: { cnpj: '11222333000181' },
    update: {},
    create: {
      cnpj: '11222333000181',
      nome: 'Prefeitura Municipal Demo',
      uf: 'PE',
      cidade: 'Custódia',
      email: 'demo@cemlicenca.com.br',
      populacao: 35000,
      planoAtual: 'TRIAL',
    },
  });

  // 3. Criar usuário admin demo
  const senhaHash = await bcrypt.hash('demo2026', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@cemlicenca.com.br' },
    update: {},
    create: {
      prefeituraId: prefeituraDemo.id,
      nome: 'Administrador Demo',
      email: 'admin@cemlicenca.com.br',
      senha: senhaHash,
      cargo: 'Secretário de Meio Ambiente',
      perfil: 'ADMIN',
    },
  });

  console.log('Prefeitura e usuário demo criados.');
  console.log('\n  Credenciais demo:');
  console.log('  Email: admin@cemlicenca.com.br');
  console.log('  Senha: demo2026\n');

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
