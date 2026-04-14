import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiCheckCircle, FiClock, FiFileText, FiAlertTriangle, FiArrowLeft,
  FiPlay, FiDownload, FiHash, FiXCircle
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';

export default function LicenciamentoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lic, setLic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [showExigencias, setShowExigencias] = useState(false);
  const [protocolo, setProtocolo] = useState({ numeroProtocolo: '', dataProtocolo: '', orgaoAmbiental: '' });
  const [exigencias, setExigencias] = useState({ descricao: '', prazo: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { carregar(); }, [id]);

  async function carregar() {
    setLoading(true);
    try {
      const [licRes, docsRes] = await Promise.all([
        api.get(`/licenciamentos/${id}`),
        api.get(`/licenciamentos/${id}/documentos`).catch(() => ({ data: [] })),
      ]);
      setLic(licRes.data);
      setDocumentos(docsRes.data || []);
    } catch {
      toast.error('Licenciamento não encontrado');
      navigate('/licenciamentos');
    } finally {
      setLoading(false);
    }
  }

  async function avancarEtapa() {
    if (!confirm('Confirma avançar para a próxima etapa?')) return;
    setActionLoading(true);
    try {
      await api.post(`/licenciamentos/${id}/avancar`);
      toast.success('Etapa avançada com sucesso!');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao avançar etapa');
    } finally {
      setActionLoading(false);
    }
  }

  async function salvarProtocolo(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post(`/licenciamentos/${id}/protocolo`, protocolo);
      toast.success('Protocolo registrado!');
      setShowProtocolo(false);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar protocolo');
    } finally {
      setActionLoading(false);
    }
  }

  async function salvarExigencias(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post(`/licenciamentos/${id}/exigencias`, exigencias);
      toast.success('Exigências registradas!');
      setShowExigencias(false);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar exigências');
    } finally {
      setActionLoading(false);
    }
  }

  async function gerarTodosDocumentos() {
    setActionLoading(true);
    try {
      const { data } = await api.post(`/licenciamentos/${id}/documentos/gerar-todos`);
      toast.success(`${data.length || 0} documento(s) gerado(s)!`);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar documentos');
    } finally {
      setActionLoading(false);
    }
  }

  async function gerarDocumento(tipo) {
    setActionLoading(true);
    try {
      await api.post(`/licenciamentos/${id}/documentos/gerar`, { tipo });
      toast.success('Documento gerado!');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar documento');
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelar() {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;
    try {
      await api.post(`/licenciamentos/${id}/cancelar`, { motivo });
      toast.success('Licenciamento cancelado');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar');
    }
  }

  if (loading || !lic) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const etapas = lic.etapas || [];
  const etapaAtual = etapas.find(e => e.status === 'EM_ANDAMENTO');
  const finalizado = ['LICENCA_EMITIDA', 'INDEFERIDO', 'CANCELADO'].includes(lic.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/licenciamentos" className="hover:text-primary-600 flex items-center gap-1">
          <FiArrowLeft size={14} /> Licenciamentos
        </Link>
        <span>/</span>
        <span className="text-gray-900">{lic.cemiterio?.nome}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{lic.cemiterio?.nome}</h1>
            <StatusBadge status={lic.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>Tipo: <strong>{lic.tipo}</strong></span>
            {lic.numeroProtocolo && <span>Protocolo: <strong>{lic.numeroProtocolo}</strong></span>}
            {lic.orgaoAmbiental && <span>Órgão: {lic.orgaoAmbiental}</span>}
            <span>Criado em: {new Date(lic.criadoEm).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        {!finalizado && (
          <div className="flex gap-2">
            <button onClick={cancelar} className="btn-outline text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1 text-sm">
              <FiXCircle size={14} /> Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Progresso */}
      {lic.progresso != null && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Progresso do Licenciamento</h3>
            <span className="text-sm font-bold text-primary-700">{lic.progresso.percentual ?? lic.progresso}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${lic.progresso.percentual ?? lic.progresso}%` }} />
          </div>
          {lic.diasRestantesLiminar != null && lic.diasRestantesLiminar > 0 && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
              <FiAlertTriangle size={14} />
              {lic.diasRestantesLiminar} dias restantes para prazo da liminar
            </p>
          )}
        </div>
      )}

      {/* Etapas */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Etapas do Processo</h3>
        <div className="space-y-3">
          {etapas.map((etapa, i) => {
            const concluida = etapa.status === 'CONCLUIDA';
            const emAndamento = etapa.status === 'EM_ANDAMENTO';
            const pendente = etapa.status === 'PENDENTE';

            return (
              <div key={etapa.id || i} className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                concluida ? 'bg-green-50 border-green-200' :
                emAndamento ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  concluida ? 'bg-green-500 text-white' :
                  emAndamento ? 'bg-primary-600 text-white animate-pulse' :
                  'bg-gray-300 text-white'
                }`}>
                  {concluida ? <FiCheckCircle size={16} /> :
                   emAndamento ? <FiPlay size={14} /> :
                   <span className="text-xs font-bold">{etapa.ordem || i + 1}</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${concluida ? 'text-green-800' : emAndamento ? 'text-primary-800' : 'text-gray-500'}`}>
                      {etapa.nome || etapa.titulo}
                    </p>
                    {concluida && etapa.concluidaEm && (
                      <span className="text-xs text-green-600">
                        {new Date(etapa.concluidaEm).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {etapa.descricao && (
                    <p className="text-sm text-gray-500 mt-1">{etapa.descricao}</p>
                  )}
                  {etapa.observacao && (
                    <p className="text-sm text-gray-400 mt-1 italic">{etapa.observacao}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ações */}
        {!finalizado && (
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            <button onClick={avancarEtapa} disabled={actionLoading}
              className="btn-primary flex items-center gap-2">
              <FiPlay size={16} /> {actionLoading ? 'Processando...' : 'Avançar Etapa'}
            </button>
            <button onClick={() => setShowProtocolo(true)}
              className="btn-outline flex items-center gap-2">
              <FiHash size={16} /> Registrar Protocolo
            </button>
            <button onClick={() => setShowExigencias(true)}
              className="btn-outline flex items-center gap-2">
              <FiAlertTriangle size={16} /> Registrar Exigências
            </button>
          </div>
        )}
      </div>

      {/* Modal Protocolo */}
      {showProtocolo && (
        <Modal title="Registrar Protocolo" onClose={() => setShowProtocolo(false)}>
          <form onSubmit={salvarProtocolo} className="space-y-4">
            <div>
              <label className="label-field">Número do Protocolo *</label>
              <input className="input-field" required placeholder="Ex: CPRH-2026-001234"
                value={protocolo.numeroProtocolo}
                onChange={e => setProtocolo({ ...protocolo, numeroProtocolo: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Data do Protocolo</label>
              <input type="date" className="input-field"
                value={protocolo.dataProtocolo}
                onChange={e => setProtocolo({ ...protocolo, dataProtocolo: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Órgão Ambiental</label>
              <input className="input-field" placeholder="Ex: CPRH"
                value={protocolo.orgaoAmbiental}
                onChange={e => setProtocolo({ ...protocolo, orgaoAmbiental: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowProtocolo(false)} className="btn-outline">Cancelar</button>
              <button type="submit" disabled={actionLoading} className="btn-primary">
                {actionLoading ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Exigências */}
      {showExigencias && (
        <Modal title="Registrar Exigências" onClose={() => setShowExigencias(false)}>
          <form onSubmit={salvarExigencias} className="space-y-4">
            <div>
              <label className="label-field">Descrição das Exigências *</label>
              <textarea className="input-field" rows={4} required
                placeholder="Descreva as exigências do órgão ambiental..."
                value={exigencias.descricao}
                onChange={e => setExigencias({ ...exigencias, descricao: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Prazo para Atendimento</label>
              <input type="date" className="input-field"
                value={exigencias.prazo}
                onChange={e => setExigencias({ ...exigencias, prazo: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowExigencias(false)} className="btn-outline">Cancelar</button>
              <button type="submit" disabled={actionLoading} className="btn-primary">
                {actionLoading ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Documentos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Documentos do Licenciamento</h3>
          {!finalizado && (
            <button onClick={gerarTodosDocumentos} disabled={actionLoading}
              className="btn-primary text-sm flex items-center gap-2">
              <FiFileText size={14} /> Gerar Todos
            </button>
          )}
        </div>

        {/* Tipos de documento individual */}
        {!finalizado && (
          <div className="flex flex-wrap gap-2 mb-4">
            {['RCA', 'PCA', 'LP_REQUERIMENTO', 'LO_REQUERIMENTO', 'LAUDO_SOLO', 'LAUDO_AGUA', 'PLANO_ENCERRAMENTO'].map(tipo => (
              <button key={tipo} onClick={() => gerarDocumento(tipo)} disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors">
                {tipo.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {documentos.length > 0 ? (
          <div className="space-y-2">
            {documentos.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-primary-600" size={18} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.titulo}</p>
                    <p className="text-xs text-gray-500">
                      {doc.tipo} · v{doc.versao || 1} · {new Date(doc.criadoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                {doc.caminho && (
                  <a href={`/api/documentos/${doc.id}/download`}
                    className="p-2 hover:bg-gray-200 rounded transition-colors" target="_blank" rel="noopener noreferrer">
                    <FiDownload size={16} className="text-gray-600" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhum documento gerado. Clique em "Gerar Todos" para criar automaticamente.
          </p>
        )}
      </div>

      {/* Licença Final */}
      {lic.status === 'LICENCA_EMITIDA' && (
        <div className="card border-2 border-green-500 bg-green-50">
          <div className="flex items-center gap-3 mb-3">
            <FiCheckCircle size={24} className="text-green-600" />
            <h3 className="text-lg font-bold text-green-800">Licença Emitida</h3>
          </div>
          {lic.dataValidade && (
            <p className="text-sm text-green-700">
              Válida até: <strong>{new Date(lic.dataValidade).toLocaleDateString('pt-BR')}</strong>
            </p>
          )}
          {lic.numeroLicenca && (
            <p className="text-sm text-green-700 mt-1">
              Número: <strong>{lic.numeroLicenca}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
