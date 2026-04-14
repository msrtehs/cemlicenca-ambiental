const { z } = require('zod');

// Validação de CNPJ
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

// Validação de CPF
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;

  return true;
}

// UFs válidas do Brasil
const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

// Schemas Zod reutilizáveis
const schemas = {
  // Prefeitura
  criarPrefeitura: z.object({
    cnpj: z.string().refine(validarCNPJ, 'CNPJ inválido'),
    nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
    uf: z.enum(UFS_VALIDAS, { errorMap: () => ({ message: 'UF inválida' }) }),
    cidade: z.string().min(2),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido').optional(),
    endereco: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().email('Email inválido').optional(),
    populacao: z.number().int().positive().optional(),
  }),

  // Usuário
  criarUsuario: z.object({
    nome: z.string().min(2),
    email: z.string().email('Email inválido'),
    senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').optional(),
    cpf: z.string().refine(v => !v || validarCPF(v), 'CPF inválido').optional(),
    cargo: z.string().optional(),
    perfil: z.enum(['ADMIN', 'SECRETARIO', 'TECNICO', 'CONTADOR', 'AUDITOR', 'CONSULTOR']).optional(),
  }),

  login: z.object({
    email: z.string().email('Email inválido'),
    senha: z.string().min(1, 'Senha obrigatória'),
  }),

  // Cemitério
  criarCemiterio: z.object({
    nome: z.string().min(2),
    tipo: z.enum(['MUNICIPAL', 'DISTRITAL', 'PARTICULAR', 'COMUNITARIO']).optional(),
    endereco: z.string().min(3),
    cidade: z.string().min(2),
    uf: z.enum(UFS_VALIDAS),
    cep: z.string().optional(),
    latitude: z.number().min(-33.75).max(5.27).optional(),
    longitude: z.number().min(-73.99).max(-34.79).optional(),
    areaTotal: z.number().positive().optional(),
    anoFundacao: z.number().int().min(1500).max(new Date().getFullYear()).optional(),
    tipoSolo: z.enum(['ARENOSO', 'ARGILOSO', 'SILTOSO', 'MISTO', 'ROCHOSO', 'NAO_INFORMADO']).optional(),
    nivelLencolFreatico: z.number().positive().optional(),
    distanciaCorpoHidrico: z.number().positive().optional(),
    volumeEnterrosAnual: z.number().int().nonnegative().optional(),
    totalSepulturas: z.number().int().nonnegative().optional(),
    sepulturasOcupadas: z.number().int().nonnegative().optional(),
    possuiOssario: z.boolean().optional(),
    possuiCapela: z.boolean().optional(),
    possuiDrenagem: z.boolean().optional(),
    possuiLiminar: z.boolean().optional(),
    prazoLiminar: z.string().datetime().optional(),
    observacoes: z.string().optional(),
  }),

  // Licenciamento
  criarLicenciamento: z.object({
    cemiterioId: z.string().uuid(),
    tipoLicenca: z.enum(['LP', 'LI', 'LO', 'LOS', 'LAR']),
    orgaoAmbiental: z.string().optional(),
    isExpress: z.boolean().optional(),
    observacoes: z.string().optional(),
  }),

  // Contrato
  criarContrato: z.object({
    modalidade: z.enum(['DISPENSA_ART75_II', 'INEXIGIBILIDADE_ART74_III', 'LICITACAO_PREGAO']),
    valorTotal: z.number().positive(),
    valorMensal: z.number().positive().optional(),
    parcelas: z.number().int().min(1).max(12).optional(),
    moduloCadastro: z.boolean().optional(),
    moduloLicenciamento: z.boolean().optional(),
    moduloContratacao: z.boolean().optional(),
    moduloMonitoramento: z.boolean().optional(),
    dataInicio: z.string().datetime(),
    dataFim: z.string().datetime().optional(),
  }),

  // Monitoramento
  criarMonitoramento: z.object({
    cemiterioId: z.string().uuid(),
    periodo: z.string(),
    dataColeta: z.string().datetime(),
    nivelNecrochorume: z.number().optional(),
    phSolo: z.number().min(0).max(14).optional(),
    nivelLencolFreatico: z.number().optional(),
    percentualOcupacao: z.number().min(0).max(100).optional(),
    novosSepultamentos: z.number().int().nonnegative().optional(),
    exumacoes: z.number().int().nonnegative().optional(),
    ossariosUtilizados: z.number().int().nonnegative().optional(),
  }),
};

module.exports = { validarCNPJ, validarCPF, UFS_VALIDAS, schemas };
