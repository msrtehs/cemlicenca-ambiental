import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiActivity, FiArrowLeft, FiSave } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function MonitoramentoForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('cemiterioId');

  const [cemiterios, setCemiterios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cemiterioId: preselected || '',
    periodo: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    dataColeta: new Date().toISOString().split('T')[0],
    nivelNecrochorume: '',
    phSolo: '',
    nivelLencolFreatico: '',
    percentualOcupacao: '',
    novosSepultamentos: '',
    exumacoes: '',
    observacoes: '',
    responsavel: '',
  });

  useEffect(() => {
    api.get('/cemiterios', { params: { limite: 100 } }).then(({ data }) => {
      setCemiterios(data.dados || data);
    });
  }, []);

  useEffect(() => {
    if (form.cemiterioId) {
      const cem = cemiterios.find(c => c.id === form.cemiterioId);
      if (cem) {
        setForm(f => ({
          ...f,
          percentualOcupacao: f.percentualOcupacao || (cem.percentualOcupacao?.toFixed(1) ?? ''),
          nivelLencolFreatico: f.nivelLencolFreatico || (cem.nivelLencolFreatico ?? ''),
        }));
      }
    }
  }, [form.cemiterioId, cemiterios]);

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cemiterioId || !form.periodo) {
      toast.error('Selecione o cemitério e o período');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        nivelNecrochorume: form.nivelNecrochorume ? parseFloat(form.nivelNecrochorume) : undefined,
        phSolo: form.phSolo ? parseFloat(form.phSolo) : undefined,
        nivelLencolFreatico: form.nivelLencolFreatico ? parseFloat(form.nivelLencolFreatico) : undefined,
        percentualOcupacao: form.percentualOcupacao ? parseFloat(form.percentualOcupacao) : undefined,
        novosSepultamentos: form.novosSepultamentos ? parseInt(form.novosSepultamentos) : undefined,
        exumacoes: form.exumacoes ? parseInt(form.exumacoes) : undefined,
      };

      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });

      const { data } = await api.post('/monitoramentos', payload);
      toast.success('Monitoramento registrado!');

      if (data.alertas && data.alertas.length > 0) {
        data.alertas.forEach(a => toast.error(`Alerta: ${a.mensagem || a.tipo}`, { duration: 5000 }));
      }

      navigate('/monitoramento');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Coleta de Monitoramento</h1>
        <p className="text-gray-500 mt-1">Registre dados ambientais coletados em campo</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Cemitério e Período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Cemitério *</label>
            <select className="input-field" value={form.cemiterioId} required
              onChange={e => set('cemiterioId', e.target.value)}>
              <option value="">Selecione o cemitério</option>
              {cemiterios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Período *</label>
            <input type="month" className="input-field" value={form.periodo}
              onChange={e => set('periodo', e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Data da Coleta</label>
            <input type="date" className="input-field" value={form.dataColeta}
              onChange={e => set('dataColeta', e.target.value)} />
          </div>
          <div>
            <label className="label-field">Responsável pela Coleta</label>
            <input className="input-field" placeholder="Nome do técnico"
              value={form.responsavel} onChange={e => set('responsavel', e.target.value)} />
          </div>
        </div>

        <hr />

        {/* Dados Ambientais */}
        <h3 className="text-lg font-semibold text-gray-900">Dados Ambientais</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Nível de Necrochorume (mg/L)</label>
            <input type="number" step="0.01" className="input-field" placeholder="0.00"
              value={form.nivelNecrochorume} onChange={e => set('nivelNecrochorume', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Limite alerta: 3 mg/L · Contaminação: 5 mg/L
            </p>
          </div>
          <div>
            <label className="label-field">pH do Solo</label>
            <input type="number" step="0.1" className="input-field" placeholder="7.0"
              value={form.phSolo} onChange={e => set('phSolo', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Faixa normal: 5.5 a 8.5
            </p>
          </div>
          <div>
            <label className="label-field">Nível do Lençol Freático (m)</label>
            <input type="number" step="0.1" className="input-field" placeholder="1.5"
              value={form.nivelLencolFreatico} onChange={e => set('nivelLencolFreatico', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              CONAMA exige mínimo 1,5m
            </p>
          </div>
          <div>
            <label className="label-field">Percentual de Ocupação (%)</label>
            <input type="number" step="0.1" className="input-field" placeholder="75.0"
              value={form.percentualOcupacao} onChange={e => set('percentualOcupacao', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Alerta superlotação: &gt; 90%
            </p>
          </div>
        </div>

        <hr />

        {/* Dados Operacionais */}
        <h3 className="text-lg font-semibold text-gray-900">Dados Operacionais</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Novos Sepultamentos no Período</label>
            <input type="number" className="input-field" placeholder="0"
              value={form.novosSepultamentos} onChange={e => set('novosSepultamentos', e.target.value)} />
          </div>
          <div>
            <label className="label-field">Exumações no Período</label>
            <input type="number" className="input-field" placeholder="0"
              value={form.exumacoes} onChange={e => set('exumacoes', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label-field">Observações</label>
          <textarea className="input-field" rows={3}
            placeholder="Observações sobre condições encontradas em campo..."
            value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
        </div>

        {/* Ações */}
        <div className="flex justify-between pt-4 border-t">
          <button type="button" onClick={() => navigate('/monitoramento')}
            className="btn-outline flex items-center gap-2">
            <FiArrowLeft size={16} /> Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="btn-primary flex items-center gap-2">
            <FiSave size={16} /> {loading ? 'Salvando...' : 'Registrar Coleta'}
          </button>
        </div>
      </form>
    </div>
  );
}
