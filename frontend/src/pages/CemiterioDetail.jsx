import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiEdit2, FiFileText, FiCheckCircle, FiAlertTriangle, FiUpload,
  FiTrash2, FiDownload, FiActivity, FiMapPin, FiRefreshCw
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';

const TABS = [
  { id: 'info', label: 'Informações', icon: FiMapPin },
  { id: 'checklist', label: 'Checklist CONAMA', icon: FiCheckCircle },
  { id: 'documentos', label: 'Documentos', icon: FiFileText },
  { id: 'risco', label: 'Análise de Risco', icon: FiActivity },
];

export default function CemiterioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [cem, setCem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [checklist, setChecklist] = useState([]);
  const [risco, setRisco] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { carregar(); }, [id]);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/cemiterios/${id}`);
      setCem(data);
    } catch {
      toast.error('Cemitério não encontrado');
      navigate('/cemiterios');
    } finally {
      setLoading(false);
    }
  }

  async function carregarChecklist() {
    try {
      const { data } = await api.get(`/cemiterios/${id}/checklist`);
      setChecklist(data);
    } catch {
      toast.error('Erro ao carregar checklist');
    }
  }

  async function carregarRisco() {
    try {
      const { data } = await api.get(`/cemiterios/${id}/risco`);
      setRisco(data);
    } catch {
      toast.error('Erro ao calcular risco');
    }
  }

  useEffect(() => {
    if (tab === 'checklist') carregarChecklist();
    if (tab === 'risco') carregarRisco();
  }, [tab]);

  async function toggleChecklist(itemId, conforme) {
    try {
      await api.put(`/cemiterios/${id}/checklist/${itemId}`, { conforme: !conforme });
      carregarChecklist();
    } catch {
      toast.error('Erro ao atualizar checklist');
    }
  }

  async function autoPreencherChecklist() {
    try {
      const { data } = await api.post(`/cemiterios/${id}/checklist/autopreencher`);
      toast.success(data.message);
      carregarChecklist();
    } catch {
      toast.error('Erro ao auto-preencher');
    }
  }

  async function uploadArquivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('tipo', 'OUTRO');
      await api.post(`/cemiterios/${id}/arquivos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Arquivo enviado!');
      carregar();
    } catch {
      toast.error('Erro no upload');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removerArquivo(arquivoId) {
    if (!confirm('Remover este arquivo?')) return;
    try {
      await api.delete(`/cemiterios/${id}/arquivos/${arquivoId}`);
      toast.success('Arquivo removido');
      carregar();
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function gerarMemorial() {
    try {
      const { data } = await api.post(`/cemiterios/${id}/memorial`);
      toast.success('Memorial descritivo gerado!');
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar memorial');
    }
  }

  async function gerarDiagnostico() {
    try {
      const { data } = await api.post(`/cemiterios/${id}/diagnostico`);
      toast.success(`Diagnóstico gerado! Risco: ${data.risco?.riscoGeral}%`);
      carregar();
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar diagnóstico');
    }
  }

  async function importarExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const { data } = await api.post(`/cemiterios/${id}/importar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${data.importados || 0} registros importados!`);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro na importação');
    }
  }

  if (loading || !cem) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{cem.nome}</h1>
            <StatusBadge status={cem.status} />
          </div>
          <p className="text-gray-500">{cem.endereco} · {cem.cidade}/{cem.uf}</p>
          {cem.possuiLiminar && (
            <div className="flex items-center gap-2 mt-2 text-red-600">
              <FiAlertTriangle />
              <span className="text-sm font-medium">
                Liminar judicial
                {cem.prazoLiminar && ` — vence em ${new Date(cem.prazoLiminar).toLocaleDateString('pt-BR')}`}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/cemiterios/${id}/editar`} className="btn-outline flex items-center gap-2">
            <FiEdit2 size={16} /> Editar
          </Link>
          <button onClick={gerarDiagnostico} className="btn-primary flex items-center gap-2">
            <FiFileText size={16} /> Gerar Diagnóstico
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Área" valor={cem.areaTotal ? `${cem.areaTotal.toLocaleString('pt-BR')} m²` : '-'} />
        <StatCard label="Ocupação" valor={cem.percentualOcupacao != null ? `${cem.percentualOcupacao.toFixed(0)}%` : '-'}
          cor={cem.percentualOcupacao > 90 ? 'text-red-600' : cem.percentualOcupacao > 70 ? 'text-orange-600' : 'text-green-600'} />
        <StatCard label="Risco Necrochorume" valor={cem.riscoNecrochorume != null ? `${cem.riscoNecrochorume}%` : '-'}
          cor={cem.riscoNecrochorume > 70 ? 'text-red-600' : cem.riscoNecrochorume > 40 ? 'text-orange-600' : 'text-green-600'} />
        <StatCard label="Sepulturas" valor={cem.totalSepulturas ? `${cem.sepulturasOcupadas || 0}/${cem.totalSepulturas}` : '-'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'text-primary-700 border-primary-700' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Ambientais</h3>
            <dl className="space-y-3">
              <Info label="Tipo de Solo" valor={cem.tipoSolo} />
              <Info label="Nível Lençol Freático" valor={cem.nivelLencolFreatico ? `${cem.nivelLencolFreatico}m` : '-'}
                alerta={cem.nivelLencolFreatico && cem.nivelLencolFreatico < 1.5} />
              <Info label="Distância Corpo Hídrico" valor={cem.distanciaCorpoHidrico ? `${cem.distanciaCorpoHidrico}m` : '-'}
                alerta={cem.distanciaCorpoHidrico && cem.distanciaCorpoHidrico < 200} />
              <Info label="Drenagem Pluvial" valor={cem.possuiDrenagem ? 'Sim' : 'Não'} />
              <Info label="Impermeabilização" valor={cem.possuiImpermeabilizacao ? 'Sim' : 'Não'} />
            </dl>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Arquivos</h3>
              <div className="flex gap-2">
                <label className="btn-outline flex items-center gap-2 cursor-pointer text-sm">
                  <FiUpload size={14} /> {uploading ? 'Enviando...' : 'Upload'}
                  <input ref={fileInput} type="file" className="hidden" onChange={uploadArquivo} disabled={uploading} />
                </label>
                <label className="btn-outline flex items-center gap-2 cursor-pointer text-sm">
                  <FiUpload size={14} /> Importar Excel
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} />
                </label>
              </div>
            </div>
            {cem.arquivos && cem.arquivos.length > 0 ? (
              <div className="space-y-2">
                {cem.arquivos.map(arq => (
                  <div key={arq.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <FiFileText className="text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{arq.nomeOriginal}</p>
                        <p className="text-xs text-gray-500">{arq.tipo}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <a href={`/api/uploads/${id}/${arq.caminho?.split(/[/\\]/).pop()}`}
                        className="p-2 hover:bg-gray-200 rounded" target="_blank" rel="noopener noreferrer">
                        <FiDownload size={14} />
                      </a>
                      <button onClick={() => removerArquivo(arq.id)} className="p-2 hover:bg-red-100 rounded text-red-500">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum arquivo enviado</p>
            )}
          </div>

          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={gerarMemorial}
                className="p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-left">
                <p className="font-medium text-primary-800">Gerar Memorial Descritivo</p>
                <p className="text-xs text-primary-600 mt-1">PDF com dados completos do cemitério</p>
              </button>
              <Link to={`/licenciamentos/novo?cemiterioId=${id}`}
                className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                <p className="font-medium text-blue-800">Iniciar Licenciamento</p>
                <p className="text-xs text-blue-600 mt-1">Processo de licenciamento ambiental</p>
              </Link>
              <Link to={`/monitoramento/novo?cemiterioId=${id}`}
                className="p-4 bg-terra-50 rounded-lg hover:bg-terra-100 transition-colors">
                <p className="font-medium text-terra-800">Registrar Monitoramento</p>
                <p className="text-xs text-terra-600 mt-1">Coleta de dados ambientais</p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {tab === 'checklist' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Checklist CONAMA 335/2003</h3>
              {checklist.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {checklist.flat ?
                    (() => {
                      const items = Array.isArray(checklist[0]) ? checklist.flat() :
                        checklist.reduce((acc, g) => [...acc, ...(g.itens || [g])], []);
                      const conformes = items.filter(i => i.conforme).length;
                      return `${conformes}/${items.length} itens conformes`;
                    })()
                    : ''
                  }
                </p>
              )}
            </div>
            <button onClick={autoPreencherChecklist}
              className="btn-outline flex items-center gap-2 text-sm">
              <FiRefreshCw size={14} /> Auto-preencher
            </button>
          </div>

          {checklist.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Checklist não gerado ainda</p>
          ) : (
            <div className="space-y-6">
              {(Array.isArray(checklist[0]?.itens) ? checklist : [{ categoria: 'Geral', itens: checklist }]).map((grupo, gi) => (
                <div key={gi}>
                  {grupo.categoria && (
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                      {grupo.categoria}
                    </h4>
                  )}
                  <div className="space-y-2">
                    {(grupo.itens || []).map(item => (
                      <div key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          item.conforme ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => toggleChecklist(item.id, item.conforme)}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          item.conforme ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                        }`}>
                          {item.conforme && <FiCheckCircle size={12} />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${item.conforme ? 'text-green-800' : 'text-gray-900'}`}>
                            {item.descricao}
                          </p>
                          {item.norma && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.norma}</p>
                          )}
                          {item.observacao && (
                            <p className="text-xs text-gray-400 mt-1 italic">{item.observacao}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documentos' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos Gerados</h3>
          {cem.documentos && cem.documentos.length > 0 ? (
            <div className="space-y-2">
              {cem.documentos.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiFileText className="text-primary-600" size={20} />
                    <div>
                      <p className="font-medium text-gray-900">{doc.titulo}</p>
                      <p className="text-xs text-gray-500">{doc.tipo} · {new Date(doc.criadoEm).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {doc.caminho && (
                    <a href={`/api/uploads/${id}/${doc.caminho.split(/[/\\]/).pop()}`}
                      className="btn-outline text-sm flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                      <FiDownload size={14} /> Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiFileText size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Nenhum documento gerado ainda</p>
              <button onClick={gerarMemorial} className="btn-primary">Gerar Memorial Descritivo</button>
            </div>
          )}
        </div>
      )}

      {tab === 'risco' && (
        <div className="space-y-6">
          {risco ? (
            <>
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Análise de Risco de Necrochorume</h3>
                <div className="flex items-center gap-6 mb-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                    risco.riscoGeral > 70 ? 'bg-red-500' : risco.riscoGeral > 40 ? 'bg-orange-500' : 'bg-green-500'
                  }`}>
                    {risco.riscoGeral}%
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">Nível: {risco.nivel}</p>
                    <p className="text-gray-500 mt-1">{risco.descricao || 'Índice calculado com base em 5 fatores ambientais'}</p>
                  </div>
                </div>

                {risco.fatores && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Fatores de Risco</h4>
                    {risco.fatores.map((f, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-32 text-sm text-gray-600">{f.nome}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div className={`h-3 rounded-full ${
                            f.valor > 70 ? 'bg-red-500' : f.valor > 40 ? 'bg-orange-500' : 'bg-green-500'
                          }`} style={{ width: `${f.valor}%` }} />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{f.valor}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {risco.problemas && risco.problemas.length > 0 && (
                <div className="card border-l-4 border-red-500">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Problemas Identificados</h3>
                  <ul className="space-y-2">
                    {risco.problemas.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <FiAlertTriangle className="mt-0.5 flex-shrink-0" size={14} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {risco.recomendacoes && risco.recomendacoes.length > 0 && (
                <div className="card border-l-4 border-primary-500">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recomendações</h3>
                  <ul className="space-y-2">
                    {risco.recomendacoes.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <FiCheckCircle className="mt-0.5 flex-shrink-0 text-primary-600" size={14} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-12">
              <FiActivity size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Carregando análise de risco...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, valor, cor }) {
  return (
    <div className="card text-center">
      <p className={`text-2xl font-bold ${cor || 'text-gray-900'}`}>{valor}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function Info({ label, valor, alerta }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`text-sm font-medium ${alerta ? 'text-red-600' : 'text-gray-900'}`}>
        {valor}
        {alerta && <FiAlertTriangle className="inline ml-1" size={14} />}
      </dd>
    </div>
  );
}
