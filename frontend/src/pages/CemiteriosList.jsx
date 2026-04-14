import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiPlus, FiSearch, FiFilter, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'CADASTRO', label: 'Cadastro' },
  { value: 'DIAGNOSTICO', label: 'Diagnóstico' },
  { value: 'EM_LICENCIAMENTO', label: 'Em Licenciamento' },
  { value: 'LICENCIADO', label: 'Licenciado' },
  { value: 'IRREGULAR', label: 'Irregular' },
  { value: 'INTERDITADO', label: 'Interditado' },
];

export default function CemiteriosList() {
  const [cemiterios, setCemiterios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [comLiminar, setComLiminar] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    carregar();
  }, [pagina, statusFiltro, comLiminar]);

  async function carregar() {
    setLoading(true);
    try {
      const params = { pagina, limite: 20 };
      if (busca) params.busca = busca;
      if (statusFiltro) params.status = statusFiltro;
      if (comLiminar) params.comLiminar = true;
      const { data } = await api.get('/cemiterios', { params });
      setCemiterios(data.dados || data);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleBusca = (e) => {
    e.preventDefault();
    setPagina(1);
    carregar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cemitérios</h1>
          <p className="text-gray-500 mt-1">{total} cemitério(s) cadastrado(s)</p>
        </div>
        <Link to="/cemiterios/novo" className="btn-primary flex items-center gap-2 w-fit">
          <FiPlus size={18} /> Novo Cemitério
        </Link>
      </div>

      {/* Filtros */}
      <div className="card">
        <form onSubmit={handleBusca} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Buscar por nome do cemitério..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <select
            className="input-field w-full sm:w-48"
            value={statusFiltro}
            onChange={e => { setStatusFiltro(e.target.value); setPagina(1); }}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={comLiminar}
              onChange={e => { setComLiminar(e.target.checked); setPagina(1); }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <FiAlertTriangle size={14} className="text-red-500" />
            Com liminar
          </label>
          <button type="submit" className="btn-primary whitespace-nowrap">
            <FiFilter size={16} className="inline mr-1" /> Filtrar
          </button>
        </form>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : cemiterios.length === 0 ? (
        <div className="card text-center py-12">
          <FiMapPin size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhum cemitério encontrado</p>
          <Link to="/cemiterios/novo" className="btn-primary inline-flex items-center gap-2">
            <FiPlus size={18} /> Cadastrar Primeiro Cemitério
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cemiterios.map(cem => (
            <Link
              key={cem.id}
              to={`/cemiterios/${cem.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                  cem.possuiLiminar ? 'bg-red-500 animate-pulse' :
                  (cem.riscoNecrochorume || 0) > 70 ? 'bg-orange-500' :
                  (cem.riscoNecrochorume || 0) > 40 ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                    {cem.nome}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <StatusBadge status={cem.status} />
                    {cem.possuiLiminar && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                        <FiAlertTriangle size={12} /> Liminar
                      </span>
                    )}
                    {cem.riscoNecrochorume != null && (
                      <span className="text-xs text-gray-500">Risco: {cem.riscoNecrochorume}%</span>
                    )}
                    {cem.percentualOcupacao != null && (
                      <span className="text-xs text-gray-500">Ocupação: {cem.percentualOcupacao?.toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {cem.endereco && `${cem.endereco}`}
                    {cem.areaTotal && ` · ${cem.areaTotal.toLocaleString('pt-BR')} m²`}
                  </p>
                </div>
              </div>
              <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" size={20} />
            </Link>
          ))}
        </div>
      )}

      {/* Paginação */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={pagina <= 1}
            onClick={() => setPagina(p => p - 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Página {pagina} de {Math.ceil(total / 20)}
          </span>
          <button
            disabled={pagina >= Math.ceil(total / 20)}
            onClick={() => setPagina(p => p + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
