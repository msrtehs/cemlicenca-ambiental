import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiPlus, FiArrowRight, FiFileText } from 'react-icons/fi';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function ContratosList() {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/contratos').then(({ data }) => {
      setContratos(Array.isArray(data) ? data : data.dados || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratação</h1>
          <p className="text-gray-500 mt-1">Contratos e justificativas conforme Lei 14.133/2021</p>
        </div>
        <Link to="/contratos/calculadora" className="btn-primary flex items-center gap-2 w-fit">
          <FiDollarSign size={18} /> Calculadora de Valores
        </Link>
      </div>

      {/* Info Card */}
      <div className="card bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <FiFileText className="text-blue-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <p className="text-sm font-medium text-blue-800">Modalidades de Contratação</p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Dispensa (Art. 75, II):</strong> Valores até R$ 65.492,11 (Decreto 12.807/2025)
            </p>
            <p className="text-xs text-blue-600">
              <strong>Inexigibilidade (Art. 74, III):</strong> Serviço técnico especializado singular
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : contratos.length === 0 ? (
        <div className="card text-center py-12">
          <FiDollarSign size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Nenhum contrato cadastrado</p>
          <p className="text-sm text-gray-400 mb-4">Use a calculadora para simular valores e criar um contrato</p>
          <Link to="/contratos/calculadora" className="btn-primary inline-flex items-center gap-2">
            <FiPlus size={18} /> Simular Contratação
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map(c => (
            <Link key={c.id} to={`/contratos/${c.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700">
                    Contrato #{c.numero || c.id?.slice(0, 8)}
                  </p>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="font-medium text-gray-900">{formatCurrency(c.valorTotal)}</span>
                  <span>{c.modalidade?.replace(/_/g, ' ')}</span>
                  <span>{c.tipoContrato?.replace(/_/g, ' ')}</span>
                  <span>{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
                {c.resumoPagamentos && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                      <div className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(c.resumoPagamentos.pagas / Math.max(c.resumoPagamentos.total, 1)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">
                      {c.resumoPagamentos.pagas}/{c.resumoPagamentos.total} parcelas
                    </span>
                  </div>
                )}
              </div>
              <FiArrowRight className="text-gray-400 group-hover:text-primary-600 flex-shrink-0 ml-4" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
