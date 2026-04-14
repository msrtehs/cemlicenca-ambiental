import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiAlertTriangle, FiFileText, FiCheckCircle, FiBell, FiPlus, FiArrowRight } from 'react-icons/fi';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data } = await api.get('/dashboard/resumo');
        setDados(data);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!dados) {
    return <p className="text-gray-500">Erro ao carregar dados do dashboard.</p>;
  }

  const { cards, alertas, cemiterios, prefeitura } = dados;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">{prefeitura?.nome}</p>
        </div>
        <Link to="/cemiterios/novo" className="btn-primary flex items-center gap-2 w-fit">
          <FiPlus size={18} /> Novo Cemitério
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo icon={FiMapPin} cor="primary" label="Cemitérios" valor={cards.totalCemiterios} />
        <CardResumo icon={FiAlertTriangle} cor="red" label="Com Liminar" valor={cards.comLiminar} />
        <CardResumo icon={FiFileText} cor="blue" label="Licenciamentos Ativos" valor={cards.licenciamentosAtivos} />
        <CardResumo icon={FiCheckCircle} cor="green" label="Licenciados" valor={cards.licenciamentosConcluidos} />
      </div>

      {/* Alertas urgentes */}
      {alertas && alertas.length > 0 && (
        <div className="card border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FiAlertTriangle className="text-red-500" /> Alertas Urgentes
          </h3>
          <div className="space-y-3">
            {alertas.map((alerta, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                alerta.urgencia === 'CRITICO' ? 'bg-red-50' : alerta.urgencia === 'ALTO' ? 'bg-orange-50' : 'bg-yellow-50'
              }`}>
                <StatusBadge status={alerta.urgencia} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alerta.cemiterio}</p>
                  <p className="text-sm text-gray-600">{alerta.mensagem}</p>
                </div>
                {alerta.diasRestantes && (
                  <span className="text-lg font-bold text-red-600">{alerta.diasRestantes}d</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de cemitérios */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Seus Cemitérios</h3>
          <Link to="/cemiterios" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Ver todos <FiArrowRight size={14} />
          </Link>
        </div>

        {cemiterios && cemiterios.length > 0 ? (
          <div className="space-y-3">
            {cemiterios.map(cem => (
              <Link key={cem.id} to={`/cemiterios/${cem.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    cem.liminar ? 'bg-red-500 animate-pulse' : (cem.risco || 0) > 70 ? 'bg-orange-500' : 'bg-green-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{cem.nome}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <StatusBadge status={cem.status} />
                      {cem.risco != null && (
                        <span className="text-xs text-gray-500">Risco: {cem.risco}%</span>
                      )}
                      {cem.ocupacao != null && (
                        <span className="text-xs text-gray-500">Ocupação: {cem.ocupacao?.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <FiArrowRight className="text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FiMapPin size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nenhum cemitério cadastrado ainda</p>
            <Link to="/cemiterios/novo" className="btn-primary inline-flex items-center gap-2">
              <FiPlus size={18} /> Cadastrar Primeiro Cemitério
            </Link>
          </div>
        )}
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/cemiterios/novo" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center group-hover:bg-primary-200 transition-colors">
              <FiMapPin className="text-primary-600" size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Cadastrar Cemitério</p>
              <p className="text-sm text-gray-500">2 min para completar</p>
            </div>
          </div>
        </Link>

        <Link to="/licenciamentos" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <FiFileText className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Iniciar Licenciamento</p>
              <p className="text-sm text-gray-500">30-90 dias para licença</p>
            </div>
          </div>
        </Link>

        <Link to="/contratos" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-terra-100 rounded-xl flex items-center justify-center group-hover:bg-terra-200 transition-colors">
              <FiBell className="text-terra-600" size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Gerar Contratação</p>
              <p className="text-sm text-gray-500">Justificativa em 5 min</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function CardResumo({ icon: Icon, cor, label, valor }) {
  const cores = {
    primary: 'bg-primary-50 text-primary-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cores[cor]}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{valor || 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
