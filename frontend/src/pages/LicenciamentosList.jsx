import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiPlus, FiSearch, FiArrowRight, FiClock } from 'react-icons/fi';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function LicenciamentosList() {
  const [licenciamentos, setLicenciamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { carregar(); }, [pagina, statusFiltro]);

  async function carregar() {
    setLoading(true);
    try {
      const params = { pagina, limite: 20 };
      if (statusFiltro) params.status = statusFiltro;
      const { data } = await api.get('/licenciamentos', { params });
      setLicenciamentos(data.dados || data);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'PROJETO_BASICO', label: 'Projeto Básico' },
    { value: 'AGUARDANDO_PROTOCOLO', label: 'Aguardando Protocolo' },
    { value: 'PROTOCOLADO', label: 'Protocolado' },
    { value: 'EM_ANALISE', label: 'Em Análise' },
    { value: 'EXIGENCIAS', label: 'Exigências' },
    { value: 'APROVADO', label: 'Aprovado' },
    { value: 'LICENCA_EMITIDA', label: 'Licença Emitida' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licenciamentos</h1>
          <p className="text-gray-500 mt-1">Processos de licenciamento ambiental</p>
        </div>
        <Link to="/licenciamentos/novo" className="btn-primary flex items-center gap-2 w-fit">
          <FiPlus size={18} /> Novo Licenciamento
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(o => (
            <button key={o.value} onClick={() => { setStatusFiltro(o.value); setPagina(1); }}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                statusFiltro === o.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : licenciamentos.length === 0 ? (
        <div className="card text-center py-12">
          <FiFileText size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhum licenciamento encontrado</p>
          <Link to="/licenciamentos/novo" className="btn-primary inline-flex items-center gap-2">
            <FiPlus size={18} /> Iniciar Licenciamento
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {licenciamentos.map(lic => (
            <Link key={lic.id} to={`/licenciamentos/${lic.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700">
                    {lic.cemiterio?.nome || 'Cemitério'}
                  </p>
                  <StatusBadge status={lic.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>Tipo: {lic.tipo}</span>
                  {lic.numeroProtocolo && <span>Protocolo: {lic.numeroProtocolo}</span>}
                  <span className="flex items-center gap-1">
                    <FiClock size={14} />
                    {new Date(lic.criadoEm).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {lic.progresso != null && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                      <div className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${lic.progresso?.percentual ?? lic.progresso}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{lic.progresso?.percentual ?? lic.progresso}%</span>
                  </div>
                )}
              </div>
              <FiArrowRight className="text-gray-400 group-hover:text-primary-600 flex-shrink-0 ml-4" size={20} />
            </Link>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Anterior</button>
          <span className="px-4 py-2 text-sm text-gray-600">Página {pagina} de {Math.ceil(total / 20)}</span>
          <button disabled={pagina >= Math.ceil(total / 20)} onClick={() => setPagina(p => p + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Próxima</button>
        </div>
      )}
    </div>
  );
}
