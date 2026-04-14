import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiPlus, FiArrowRight, FiBarChart2, FiAlertTriangle } from 'react-icons/fi';
import api from '../services/api';

export default function MonitoramentoList() {
  const [monitoramentos, setMonitoramentos] = useState([]);
  const [cemiterios, setCemiterios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cemiterioFiltro, setCemiterioFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/cemiterios', { params: { limite: 100 } }).then(({ data }) => {
      setCemiterios(data.dados || data);
    });
  }, []);

  useEffect(() => { carregar(); }, [pagina, cemiterioFiltro]);

  async function carregar() {
    setLoading(true);
    try {
      const params = { pagina, limite: 20 };
      if (cemiterioFiltro) params.cemiterioId = cemiterioFiltro;
      const { data } = await api.get('/monitoramentos', { params });
      setMonitoramentos(data.dados || data);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getAlertColor = (val, limites) => {
    if (val == null) return 'text-gray-400';
    if (val > limites.alto) return 'text-red-600';
    if (val > limites.medio) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoramento Ambiental</h1>
          <p className="text-gray-500 mt-1">Coleta de dados e acompanhamento ambiental</p>
        </div>
        <div className="flex gap-2">
          <Link to="/monitoramento/novo" className="btn-primary flex items-center gap-2 w-fit">
            <FiPlus size={18} /> Nova Coleta
          </Link>
        </div>
      </div>

      {/* Filtros e atalhos */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <select className="input-field flex-1" value={cemiterioFiltro}
          onChange={e => { setCemiterioFiltro(e.target.value); setPagina(1); }}>
          <option value="">Todos os cemitérios</option>
          {cemiterios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <div className="flex gap-2">
          {cemiterios.slice(0, 3).map(c => (
            <Link key={c.id} to={`/monitoramento/historico/${c.id}`}
              className="btn-outline text-sm flex items-center gap-1 whitespace-nowrap">
              <FiBarChart2 size={14} /> {c.nome?.slice(0, 20)}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : monitoramentos.length === 0 ? (
        <div className="card text-center py-12">
          <FiActivity size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhum registro de monitoramento</p>
          <Link to="/monitoramento/novo" className="btn-primary inline-flex items-center gap-2">
            <FiPlus size={18} /> Registrar Primeira Coleta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {monitoramentos.map(mon => (
            <div key={mon.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-gray-900">{mon.cemiterio?.nome || 'Cemitério'}</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {mon.periodo}
                    </span>
                    {mon.alertas && mon.alertas.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                        <FiAlertTriangle size={12} /> {mon.alertas.length} alerta(s)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Necrochorume</p>
                      <p className={`text-sm font-bold ${getAlertColor(mon.nivelNecrochorume, { medio: 2, alto: 3 })}`}>
                        {mon.nivelNecrochorume != null ? `${mon.nivelNecrochorume} mg/L` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">pH</p>
                      <p className={`text-sm font-bold ${mon.phSolo && (mon.phSolo < 5.5 || mon.phSolo > 8.5) ? 'text-red-600' : 'text-green-600'}`}>
                        {mon.phSolo ?? '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ocupação</p>
                      <p className={`text-sm font-bold ${getAlertColor(mon.percentualOcupacao, { medio: 80, alto: 90 })}`}>
                        {mon.percentualOcupacao != null ? `${mon.percentualOcupacao.toFixed(0)}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Novos Sepultamentos</p>
                      <p className="text-sm font-bold text-gray-900">{mon.novosSepultamentos ?? '-'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Coleta: {new Date(mon.dataColeta).toLocaleDateString('pt-BR')}
                    {mon.responsavel && ` · ${mon.responsavel}`}
                  </p>
                </div>
                <Link to={`/monitoramento/historico/${mon.cemiterioId || mon.cemiterio?.id}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                  <FiBarChart2 size={20} className="text-gray-400" />
                </Link>
              </div>
            </div>
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
