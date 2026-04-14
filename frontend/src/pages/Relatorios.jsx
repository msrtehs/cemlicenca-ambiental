import { useState, useEffect } from 'react';
import { FiFileText, FiDownload, FiBarChart2 } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Relatorios() {
  const [cemiterios, setCemiterios] = useState([]);
  const [cemiterioId, setCemiterioId] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/cemiterios', { params: { limite: 100 } }).then(({ data }) => {
      setCemiterios(data.dados || data);
    });
    api.get('/dashboard/estatisticas').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const gerarRelatorioAnual = async () => {
    if (!cemiterioId) {
      toast.error('Selecione um cemitério');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/monitoramentos/relatorio-anual', { cemiterioId, ano });
      toast.success('Relatório anual gerado!');
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async () => {
    if (!cemiterioId) {
      toast.error('Selecione um cemitério');
      return;
    }
    try {
      const response = await api.get(`/monitoramentos/exportar/${cemiterioId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitoramento_${cemiterioId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exportado!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao exportar CSV');
    }
  };

  const anoOptions = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) anoOptions.push(y);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 mt-1">Geração de relatórios e exportação de dados</p>
      </div>

      {/* Seleção */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Selecionar Cemitério</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="label-field">Cemitério</label>
            <select className="input-field" value={cemiterioId}
              onChange={e => setCemiterioId(e.target.value)}>
              <option value="">Selecione o cemitério</option>
              {cemiterios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Ano</label>
            <select className="input-field" value={ano} onChange={e => setAno(parseInt(e.target.value))}>
              {anoOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Ações de Relatório */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={gerarRelatorioAnual} disabled={loading || !cemiterioId}
          className="card hover:shadow-md transition-shadow p-6 text-left disabled:opacity-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <FiFileText className="text-primary-600" size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Relatório Anual PDF</h3>
          </div>
          <p className="text-sm text-gray-500">
            Gera PDF completo com status de licenças, monitoramentos, indicadores e conclusões do ano.
          </p>
          <p className="text-xs text-primary-600 mt-3 font-medium">
            {loading ? 'Gerando...' : 'Clique para gerar'}
          </p>
        </button>

        <button onClick={exportarCSV} disabled={!cemiterioId}
          className="card hover:shadow-md transition-shadow p-6 text-left disabled:opacity-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FiDownload className="text-green-600" size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Exportar CSV</h3>
          </div>
          <p className="text-sm text-gray-500">
            Exporta todos os dados de monitoramento em formato CSV compatível com Excel.
          </p>
          <p className="text-xs text-green-600 mt-3 font-medium">Clique para exportar</p>
        </button>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visão Geral</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {stats.cemiteriosPorStatus && stats.cemiteriosPorStatus.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Cemitérios por Status</h4>
                <div className="space-y-2">
                  {stats.cemiteriosPorStatus.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{s.status?.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${Math.min((s.count / Math.max(...stats.cemiteriosPorStatus.map(x => x.count))) * 100, 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-6 text-right">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.licenciamentosPorStatus && stats.licenciamentosPorStatus.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Licenciamentos por Status</h4>
                <div className="space-y-2">
                  {stats.licenciamentosPorStatus.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{s.status?.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min((s.count / Math.max(...stats.licenciamentosPorStatus.map(x => x.count))) * 100, 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-6 text-right">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
