const STATUS_CONFIG = {
  // Cemitério
  CADASTRO: { cor: 'bg-blue-100 text-blue-800', label: 'Cadastro' },
  DIAGNOSTICO: { cor: 'bg-yellow-100 text-yellow-800', label: 'Diagnóstico' },
  EM_LICENCIAMENTO: { cor: 'bg-orange-100 text-orange-800', label: 'Em Licenciamento' },
  LICENCIADO: { cor: 'bg-green-100 text-green-800', label: 'Licenciado' },
  MONITORAMENTO: { cor: 'bg-teal-100 text-teal-800', label: 'Monitoramento' },
  IRREGULAR: { cor: 'bg-red-100 text-red-800', label: 'Irregular' },
  INTERDITADO: { cor: 'bg-red-200 text-red-900', label: 'Interditado' },
  // Licenciamento
  PROJETO_BASICO: { cor: 'bg-blue-100 text-blue-800', label: 'Projeto Básico' },
  AGUARDANDO_PROTOCOLO: { cor: 'bg-yellow-100 text-yellow-800', label: 'Aguardando Protocolo' },
  PROTOCOLADO: { cor: 'bg-indigo-100 text-indigo-800', label: 'Protocolado' },
  EM_ANALISE: { cor: 'bg-purple-100 text-purple-800', label: 'Em Análise' },
  EXIGENCIAS: { cor: 'bg-orange-100 text-orange-800', label: 'Exigências' },
  APROVADO: { cor: 'bg-green-100 text-green-800', label: 'Aprovado' },
  LICENCA_EMITIDA: { cor: 'bg-green-200 text-green-900', label: 'Licença Emitida' },
  INDEFERIDO: { cor: 'bg-red-100 text-red-800', label: 'Indeferido' },
  CANCELADO: { cor: 'bg-gray-100 text-gray-800', label: 'Cancelado' },
  // Contrato
  RASCUNHO: { cor: 'bg-gray-100 text-gray-700', label: 'Rascunho' },
  JUSTIFICATIVA_GERADA: { cor: 'bg-blue-100 text-blue-800', label: 'Justificativa Gerada' },
  ENVIADO: { cor: 'bg-yellow-100 text-yellow-800', label: 'Enviado' },
  ASSINADO: { cor: 'bg-indigo-100 text-indigo-800', label: 'Assinado' },
  ATIVO: { cor: 'bg-green-100 text-green-800', label: 'Ativo' },
  ENCERRADO: { cor: 'bg-gray-200 text-gray-800', label: 'Encerrado' },
  // Monitoramento
  PENDENTE: { cor: 'bg-gray-100 text-gray-700', label: 'Pendente' },
  EM_COLETA: { cor: 'bg-blue-100 text-blue-800', label: 'Em Coleta' },
  CONCLUIDO: { cor: 'bg-green-100 text-green-800', label: 'Concluído' },
  ALERTA: { cor: 'bg-red-100 text-red-800', label: 'Alerta' },
  // Risco
  BAIXO: { cor: 'bg-green-100 text-green-800', label: 'Baixo' },
  MEDIO: { cor: 'bg-yellow-100 text-yellow-800', label: 'Médio' },
  ALTO: { cor: 'bg-orange-100 text-orange-800', label: 'Alto' },
  CRITICO: { cor: 'bg-red-100 text-red-800', label: 'Crítico' },
};

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || { cor: 'bg-gray-100 text-gray-700', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.cor} ${className}`}>
      {config.label}
    </span>
  );
}
