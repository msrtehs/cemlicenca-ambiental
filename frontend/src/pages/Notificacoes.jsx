import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiCheckCircle, FiAlertTriangle, FiInfo, FiClock } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const TIPO_ICON = {
  LIMINAR: FiAlertTriangle,
  RISCO: FiAlertTriangle,
  VENCIMENTO: FiClock,
  PAGAMENTO: FiClock,
  default: FiInfo,
};

const TIPO_COLOR = {
  LIMINAR: 'text-red-600 bg-red-50',
  RISCO: 'text-orange-600 bg-orange-50',
  VENCIMENTO: 'text-yellow-600 bg-yellow-50',
  PAGAMENTO: 'text-blue-600 bg-blue-50',
  default: 'text-gray-600 bg-gray-50',
};

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [notRes, countRes] = await Promise.all([
        api.get('/notificacoes'),
        api.get('/notificacoes/contagem').catch(() => ({ data: { naoLidas: 0 } })),
      ]);
      setNotificacoes(Array.isArray(notRes.data) ? notRes.data : notRes.data.dados || []);
      setNaoLidas(countRes.data?.naoLidas || 0);
    } catch {
      console.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }

  async function marcarComoLida(notifId) {
    try {
      await api.put(`/notificacoes/${notifId}/lida`);
      carregar();
    } catch {
      toast.error('Erro ao marcar como lida');
    }
  }

  async function marcarTodasComoLidas() {
    try {
      await api.put('/notificacoes/lidas');
      toast.success('Todas marcadas como lidas');
      carregar();
    } catch {
      toast.error('Erro ao marcar todas');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 mt-1">
            {naoLidas > 0 ? `${naoLidas} notificação(ões) não lida(s)` : 'Todas as notificações foram lidas'}
          </p>
        </div>
        {naoLidas > 0 && (
          <button onClick={marcarTodasComoLidas}
            className="btn-outline flex items-center gap-2 w-fit">
            <FiCheckCircle size={16} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : notificacoes.length === 0 ? (
        <div className="card text-center py-12">
          <FiBell size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notificacoes.map(notif => {
            const Icon = TIPO_ICON[notif.tipo] || TIPO_ICON.default;
            const colorClass = TIPO_COLOR[notif.tipo] || TIPO_COLOR.default;

            return (
              <div key={notif.id}
                className={`card flex items-start gap-4 transition-all ${
                  !notif.lida ? 'border-l-4 border-primary-500 bg-primary-50/30' : ''
                }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm ${!notif.lida ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notif.titulo || notif.tipo}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">{notif.mensagem}</p>
                    </div>
                    {!notif.lida && (
                      <button onClick={() => marcarComoLida(notif.id)}
                        className="p-1 hover:bg-gray-200 rounded flex-shrink-0" title="Marcar como lida">
                        <FiCheck size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{notif.canal || 'INTERNO'}</span>
                    <span>{new Date(notif.criadoEm).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
