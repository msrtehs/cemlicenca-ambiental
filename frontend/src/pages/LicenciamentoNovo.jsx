import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiFileText, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const TIPOS_LICENCA = [
  { value: 'LP', label: 'Licença Prévia (LP)', desc: 'Para cemitérios novos ou em fase de planejamento' },
  { value: 'LI', label: 'Licença de Instalação (LI)', desc: 'Para ampliações ou modificações estruturais' },
  { value: 'LO', label: 'Licença de Operação (LO)', desc: 'Para cemitérios em operação sem licença' },
  { value: 'LOS', label: 'Licença de Operação Simplificada', desc: 'Para cemitérios pequenos (< 5.000 m²)' },
  { value: 'LAR', label: 'Licença de Regularização (LAR)', desc: 'Para cemitérios irregulares ou com liminar' },
];

export default function LicenciamentoNovo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCemiterio = searchParams.get('cemiterioId');

  const [cemiterios, setCemiterios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cemiterioId: preselectedCemiterio || '',
    tipoLicenca: '',
    orgaoAmbiental: '',
    observacoes: '',
  });

  useEffect(() => {
    api.get('/cemiterios', { params: { limite: 100 } }).then(({ data }) => {
      setCemiterios(data.dados || data);
    }).catch(() => toast.error('Erro ao carregar cemitérios'));
  }, []);

  useEffect(() => {
    if (form.cemiterioId) {
      const cem = cemiterios.find(c => c.id === form.cemiterioId);
      if (cem?.uf) {
        api.get(`/licenciamentos/orgaos/${cem.uf}`).then(({ data }) => {
          if (data?.nome) setForm(f => ({ ...f, orgaoAmbiental: data.nome }));
        }).catch(() => {});
      }
      // Auto-suggest license type
      if (cem?.possuiLiminar) {
        setForm(f => ({ ...f, tipoLicenca: f.tipoLicenca || 'LAR' }));
      } else if (cem?.areaTotal && cem.areaTotal < 5000) {
        setForm(f => ({ ...f, tipoLicenca: f.tipoLicenca || 'LOS' }));
      }
    }
  }, [form.cemiterioId, cemiterios]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cemiterioId || !form.tipoLicenca) {
      toast.error('Selecione o cemitério e o tipo de licença');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/licenciamentos', form);
      toast.success('Licenciamento iniciado com sucesso!');
      navigate(`/licenciamentos/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar licenciamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Novo Licenciamento</h1>
        <p className="text-gray-500 mt-1">Inicie o processo de licenciamento ambiental para um cemitério</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label-field">Cemitério *</label>
          <select className="input-field" value={form.cemiterioId}
            onChange={e => setForm({ ...form, cemiterioId: e.target.value })} required>
            <option value="">Selecione o cemitério</option>
            {cemiterios.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.cidade}/{c.uf}
                {c.possuiLiminar ? ' (LIMINAR)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-field">Tipo de Licença *</label>
          <div className="space-y-2 mt-2">
            {TIPOS_LICENCA.map(tipo => (
              <label key={tipo.value}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  form.tipoLicenca === tipo.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" name="tipoLicenca" value={tipo.value}
                  checked={form.tipoLicenca === tipo.value}
                  onChange={e => setForm({ ...form, tipoLicenca: e.target.value })}
                  className="mt-1 text-primary-600 focus:ring-primary-500" />
                <div>
                  <p className="font-medium text-gray-900">{tipo.label}</p>
                  <p className="text-sm text-gray-500">{tipo.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {form.orgaoAmbiental && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Órgão Ambiental: </span>{form.orgaoAmbiental}
            </p>
          </div>
        )}

        <div>
          <label className="label-field">Observações</label>
          <textarea className="input-field" rows={3}
            placeholder="Informações adicionais sobre o licenciamento..."
            value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        </div>

        <div className="flex justify-between pt-4 border-t">
          <button type="button" onClick={() => navigate('/licenciamentos')}
            className="btn-outline flex items-center gap-2">
            <FiArrowLeft size={16} /> Voltar
          </button>
          <button type="submit" disabled={loading}
            className="btn-primary flex items-center gap-2">
            <FiFileText size={16} /> {loading ? 'Iniciando...' : 'Iniciar Licenciamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
