import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiTrendingUp, FiAlertTriangle, FiActivity } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function MonitoramentoHistorico() {
  const { cemiterioId } = useParams();
  const [historico, setHistorico] = useState(null);
  const [previsao, setPrevisao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cemiterio, setCemiterio] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/monitoramentos/historico/${cemiterioId}`),
      api.get(`/monitoramentos/previsao/${cemiterioId}`).catch(() => ({ data: null })),
      api.get(`/cemiterios/${cemiterioId}`).catch(() => ({ data: null })),
    ]).then(([histRes, prevRes, cemRes]) => {
      setHistorico(histRes.data);
      setPrevisao(prevRes.data);
      setCemiterio(cemRes.data);
    }).catch(() => {
      toast.error('Erro ao carregar dados');
    }).finally(() => setLoading(false));
  }, [cemiterioId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const dados = historico?.dados || historico?.registros || [];
  const tendencias = historico?.tendencias || {};

  const chartData = dados.map(d => ({
    periodo: d.periodo,
    necrochorume: d.nivelNecrochorume,
    ph: d.phSolo,
    ocupacao: d.percentualOcupacao,
    lencol: d.nivelLencolFreatico,
    sepultamentos: d.novosSepultamentos,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/monitoramento" className="hover:text-primary-600 flex items-center gap-1">
          <FiArrowLeft size={14} /> Monitoramento
        </Link>
        <span>/</span>
        <span className="text-gray-900">{cemiterio?.nome || 'Histórico'}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">
        Histórico — {cemiterio?.nome || 'Cemitério'}
      </h1>

      {/* Previsão IA */}
      {previsao && (
        <div className="card border-l-4 border-blue-500 bg-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <FiTrendingUp className="text-blue-600" size={20} />
            <h3 className="text-lg font-semibold text-blue-900">Previsão por IA (Regressão Linear)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {previsao.contaminacao != null && (
              <div className={`p-3 rounded-lg ${previsao.contaminacao <= 6 ? 'bg-red-100' : 'bg-blue-100'}`}>
                <p className="text-xs text-gray-600">Atingir contaminação (5 mg/L)</p>
                <p className={`text-lg font-bold ${previsao.contaminacao <= 6 ? 'text-red-700' : 'text-blue-700'}`}>
                  {previsao.contaminacao > 0 ? `${previsao.contaminacao} meses` : 'Risco atual'}
                </p>
              </div>
            )}
            {previsao.superlotacao != null && (
              <div className={`p-3 rounded-lg ${previsao.superlotacao <= 6 ? 'bg-red-100' : 'bg-blue-100'}`}>
                <p className="text-xs text-gray-600">Atingir superlotação (100%)</p>
                <p className={`text-lg font-bold ${previsao.superlotacao <= 6 ? 'text-red-700' : 'text-blue-700'}`}>
                  {previsao.superlotacao > 0 ? `${previsao.superlotacao} meses` : 'Risco atual'}
                </p>
              </div>
            )}
            {previsao.lencolCritico != null && (
              <div className={`p-3 rounded-lg ${previsao.lencolCritico <= 6 ? 'bg-red-100' : 'bg-blue-100'}`}>
                <p className="text-xs text-gray-600">Lençol abaixo de 1.5m</p>
                <p className={`text-lg font-bold ${previsao.lencolCritico <= 6 ? 'text-red-700' : 'text-blue-700'}`}>
                  {previsao.lencolCritico > 0 ? `${previsao.lencolCritico} meses` : 'Risco atual'}
                </p>
              </div>
            )}
          </div>
          {previsao.recomendacoes && previsao.recomendacoes.length > 0 && (
            <div className="mt-3 space-y-1">
              {previsao.recomendacoes.map((r, i) => (
                <p key={i} className="text-sm text-blue-800 flex items-start gap-2">
                  <FiAlertTriangle className="flex-shrink-0 mt-0.5" size={14} /> {r}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="card text-center py-12">
          <FiActivity size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Sem dados de monitoramento para gráficos</p>
          <Link to={`/monitoramento/novo?cemiterioId=${cemiterioId}`}
            className="btn-primary inline-flex items-center gap-2">
            Registrar Primeira Coleta
          </Link>
        </div>
      ) : (
        <>
          {/* Gráfico Necrochorume */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nível de Necrochorume (mg/L)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="necrochorume" stroke="#ef4444" strokeWidth={2}
                    name="Necrochorume" dot={{ r: 4 }} />
                  {/* Linha de limite */}
                  <Line type="monotone" dataKey={() => 3} stroke="#f97316" strokeDasharray="5 5"
                    name="Limite Alerta (3)" dot={false} />
                  <Line type="monotone" dataKey={() => 5} stroke="#ef4444" strokeDasharray="5 5"
                    name="Contaminação (5)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {tendencias?.necrochorume && (
              <TendenciaInfo tendencia={tendencias.necrochorume} label="Necrochorume" />
            )}
          </div>

          {/* Gráfico Ocupação */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ocupação do Cemitério (%)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ocupacao" stroke="#16a34a" strokeWidth={2}
                    name="Ocupação" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey={() => 90} stroke="#f97316" strokeDasharray="5 5"
                    name="Alerta (90%)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico pH e Lençol */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">pH do Solo</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                    <YAxis domain={[4, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ph" stroke="#8b5cf6" strokeWidth={2} name="pH" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sepultamentos por Período</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="sepultamentos" fill="#16a34a" name="Sepultamentos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TendenciaInfo({ tendencia, label }) {
  if (!tendencia) return null;
  const subindo = tendencia.inclinacao > 0;
  return (
    <div className={`mt-3 p-3 rounded-lg text-sm ${subindo ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
      <strong>Tendência de {label}:</strong>{' '}
      {subindo ? 'Em alta' : 'Estável/em queda'} — variação de{' '}
      {tendencia.inclinacao?.toFixed(3)} por período
    </div>
  );
}
