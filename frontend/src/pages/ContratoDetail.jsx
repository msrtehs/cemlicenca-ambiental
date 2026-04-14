import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft, FiFileText, FiDollarSign, FiCheckCircle, FiDownload, FiClock
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';

export default function ContratoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { carregar(); }, [id]);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/contratos/${id}`);
      setContrato(data);
    } catch {
      toast.error('Contrato não encontrado');
      navigate('/contratos');
    } finally {
      setLoading(false);
    }
  }

  async function gerarJustificativa() {
    setActionLoading(true);
    try {
      const { data } = await api.post(`/contratos/${id}/justificativa`);
      toast.success('Pacote de justificativa gerado!');
      carregar();
      if (data.arquivos) {
        data.arquivos.forEach(arq => {
          if (arq.downloadUrl) window.open(arq.downloadUrl, '_blank');
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar justificativa');
    } finally {
      setActionLoading(false);
    }
  }

  async function atualizarStatus(status) {
    try {
      await api.put(`/contratos/${id}/status`, { status });
      toast.success('Status atualizado!');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    }
  }

  async function registrarPagamento(pagamentoId) {
    try {
      await api.post(`/contratos/${id}/pagamentos/${pagamentoId}`, {
        dataPagamento: new Date().toISOString(),
        comprovante: 'Registrado manualmente',
      });
      toast.success('Pagamento registrado!');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar pagamento');
    }
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (loading || !contrato) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const pagamentos = contrato.pagamentos || [];
  const pagas = pagamentos.filter(p => p.status === 'PAGO').length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/contratos" className="hover:text-primary-600 flex items-center gap-1">
          <FiArrowLeft size={14} /> Contratos
        </Link>
        <span>/</span>
        <span className="text-gray-900">Contrato #{contrato.numero || contrato.id?.slice(0, 8)}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Contrato #{contrato.numero || contrato.id?.slice(0, 8)}
            </h1>
            <StatusBadge status={contrato.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="text-lg font-bold text-gray-900">{formatCurrency(contrato.valorTotal)}</span>
            <span>{contrato.modalidade?.replace(/_/g, ' ')}</span>
            <span>{new Date(contrato.criadoEm).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {contrato.status === 'RASCUNHO' && (
            <button onClick={() => atualizarStatus('ATIVO')}
              className="btn-primary flex items-center gap-2">
              <FiCheckCircle size={16} /> Ativar Contrato
            </button>
          )}
          <button onClick={gerarJustificativa} disabled={actionLoading}
            className="btn-outline flex items-center gap-2">
            <FiFileText size={16} /> {actionLoading ? 'Gerando...' : 'Gerar Justificativa'}
          </button>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(contrato.valorTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">Valor Total</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(pagamentos.filter(p => p.status === 'PAGO').reduce((s, p) => s + (p.valor || 0), 0))}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pago</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(pagamentos.filter(p => p.status !== 'PAGO').reduce((s, p) => s + (p.valor || 0), 0))}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pendente</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-700">{pagas}/{pagamentos.length}</p>
          <p className="text-xs text-gray-500 mt-1">Parcelas Pagas</p>
        </div>
      </div>

      {/* Fundamentação Legal */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Fundamentação Legal</h3>
        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2">
          <p><strong>Modalidade:</strong> {contrato.modalidade?.replace(/_/g, ' ')}</p>
          {contrato.valorTotal <= 65492.11 ? (
            <>
              <p><strong>Base Legal:</strong> Art. 75, inciso II, Lei 14.133/2021</p>
              <p>Limite atualizado: R$ 65.492,11 conforme Decreto 12.807/2025</p>
            </>
          ) : (
            <>
              <p><strong>Base Legal:</strong> Art. 74, inciso III, Lei 14.133/2021</p>
              <p>Serviço técnico especializado de natureza singular</p>
            </>
          )}
        </div>
      </div>

      {/* Parcelas */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Parcelas</h3>
        {pagamentos.length > 0 ? (
          <div className="space-y-2">
            {pagamentos.map((pag, i) => (
              <div key={pag.id} className={`flex items-center justify-between p-4 rounded-lg border ${
                pag.status === 'PAGO' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    pag.status === 'PAGO' ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
                  }`}>
                    {pag.status === 'PAGO' ? <FiCheckCircle size={14} /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Parcela {i + 1}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{formatCurrency(pag.valor)}</span>
                      {pag.dataVencimento && (
                        <span className="flex items-center gap-1">
                          <FiClock size={12} />
                          Venc: {new Date(pag.dataVencimento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {pag.dataPagamento && (
                        <span className="text-green-600">
                          Pago em {new Date(pag.dataPagamento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {pag.status !== 'PAGO' && (
                  <button onClick={() => registrarPagamento(pag.id)}
                    className="btn-primary text-sm flex items-center gap-1">
                    <FiDollarSign size={14} /> Registrar Pgto
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma parcela registrada</p>
        )}
      </div>

      {/* Documentos Gerados */}
      {contrato.documentos && contrato.documentos.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos de Justificativa</h3>
          <div className="space-y-2">
            {contrato.documentos.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-primary-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.titulo}</p>
                    <p className="text-xs text-gray-500">{doc.tipo} · {new Date(doc.criadoEm).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {doc.caminho && (
                  <a href={doc.downloadUrl || '#'} className="p-2 hover:bg-gray-200 rounded" target="_blank" rel="noopener noreferrer">
                    <FiDownload size={16} className="text-gray-600" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
