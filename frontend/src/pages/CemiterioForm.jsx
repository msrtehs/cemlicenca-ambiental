import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiArrowLeft, FiArrowRight, FiCheck } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TIPOS_SOLO = [
  { value: 'ARENOSO', label: 'Arenoso' },
  { value: 'ARGILOSO', label: 'Argiloso' },
  { value: 'SILTOSO', label: 'Siltoso' },
  { value: 'MISTO', label: 'Misto' },
];

const ETAPAS = [
  { id: 1, titulo: 'Dados Básicos' },
  { id: 2, titulo: 'Dados Ambientais' },
  { id: 3, titulo: 'Dados Judiciais' },
  { id: 4, titulo: 'Revisão' },
];

const INITIAL_STATE = {
  nome: '', endereco: '', cidade: '', uf: '', cep: '',
  latitude: '', longitude: '',
  areaTotal: '', totalSepulturas: '', sepulturasOcupadas: '',
  tipoSolo: 'ARGILOSO', nivelLencolFreatico: '', distanciaCorpoHidrico: '',
  possuiDrenagem: false, possuiImpermeabilizacao: false,
  possuiLiminar: false, prazoLiminar: '', observacoesLiminar: '',
  observacoes: '',
};

export default function CemiterioForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingDados, setLoadingDados] = useState(!!id);
  const [form, setForm] = useState(INITIAL_STATE);

  useEffect(() => {
    if (id) {
      api.get(`/cemiterios/${id}`).then(({ data }) => {
        setForm({
          nome: data.nome || '',
          endereco: data.endereco || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          cep: data.cep || '',
          latitude: data.latitude ?? '',
          longitude: data.longitude ?? '',
          areaTotal: data.areaTotal ?? '',
          totalSepulturas: data.totalSepulturas ?? '',
          sepulturasOcupadas: data.sepulturasOcupadas ?? '',
          tipoSolo: data.tipoSolo || 'ARGILOSO',
          nivelLencolFreatico: data.nivelLencolFreatico ?? '',
          distanciaCorpoHidrico: data.distanciaCorpoHidrico ?? '',
          possuiDrenagem: data.possuiDrenagem || false,
          possuiImpermeabilizacao: data.possuiImpermeabilizacao || false,
          possuiLiminar: data.possuiLiminar || false,
          prazoLiminar: data.prazoLiminar ? data.prazoLiminar.split('T')[0] : '',
          observacoesLiminar: data.observacoesLiminar || '',
          observacoes: data.observacoes || '',
        });
      }).catch(() => {
        toast.error('Erro ao carregar cemitério');
        navigate('/cemiterios');
      }).finally(() => setLoadingDados(false));
    }
  }, [id]);

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        areaTotal: form.areaTotal ? parseFloat(form.areaTotal) : undefined,
        totalSepulturas: form.totalSepulturas ? parseInt(form.totalSepulturas) : undefined,
        sepulturasOcupadas: form.sepulturasOcupadas ? parseInt(form.sepulturasOcupadas) : undefined,
        nivelLencolFreatico: form.nivelLencolFreatico ? parseFloat(form.nivelLencolFreatico) : undefined,
        distanciaCorpoHidrico: form.distanciaCorpoHidrico ? parseFloat(form.distanciaCorpoHidrico) : undefined,
        prazoLiminar: form.prazoLiminar || undefined,
      };

      // Remove campos vazios
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });

      if (id) {
        await api.put(`/cemiterios/${id}`, payload);
        toast.success('Cemitério atualizado!');
      } else {
        const { data } = await api.post('/cemiterios', payload);
        toast.success('Cemitério cadastrado com sucesso!');
        navigate(`/cemiterios/${data.id}`);
        return;
      }
      navigate(`/cemiterios/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDados) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'Editar Cemitério' : 'Novo Cemitério'}
        </h1>
        <p className="text-gray-500 mt-1">
          {id ? 'Atualize as informações do cemitério' : 'Cadastre um novo cemitério para iniciar o licenciamento'}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {ETAPAS.map((e, i) => (
          <div key={e.id} className="flex items-center flex-1">
            <button
              onClick={() => setEtapa(e.id)}
              className={`flex items-center gap-2 ${etapa >= e.id ? 'text-primary-700' : 'text-gray-400'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                etapa > e.id ? 'bg-primary-600 text-white' :
                etapa === e.id ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {etapa > e.id ? <FiCheck size={16} /> : e.id}
              </div>
              <span className="hidden sm:block text-sm font-medium">{e.titulo}</span>
            </button>
            {i < ETAPAS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${etapa > e.id ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Formulários por etapa */}
      <div className="card">
        {etapa === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Básicos</h3>
            <div>
              <label className="label-field">Nome do Cemitério *</label>
              <input className="input-field" placeholder="Ex: Cemitério Municipal São José"
                value={form.nome} onChange={e => set('nome', e.target.value)} required />
            </div>
            <div>
              <label className="label-field">Endereço</label>
              <input className="input-field" placeholder="Rua, número, bairro"
                value={form.endereco} onChange={e => set('endereco', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="label-field">Cidade *</label>
                <input className="input-field" placeholder="Cidade"
                  value={form.cidade} onChange={e => set('cidade', e.target.value)} required />
              </div>
              <div>
                <label className="label-field">UF *</label>
                <select className="input-field" value={form.uf} onChange={e => set('uf', e.target.value)} required>
                  <option value="">UF</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">CEP</label>
                <input className="input-field" placeholder="00000-000"
                  value={form.cep} onChange={e => set('cep', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Latitude</label>
                <input type="number" step="any" className="input-field" placeholder="-8.1234"
                  value={form.latitude} onChange={e => set('latitude', e.target.value)} />
              </div>
              <div>
                <label className="label-field">Longitude</label>
                <input type="number" step="any" className="input-field" placeholder="-36.4567"
                  value={form.longitude} onChange={e => set('longitude', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-field">Área Total (m²)</label>
                <input type="number" className="input-field" placeholder="5000"
                  value={form.areaTotal} onChange={e => set('areaTotal', e.target.value)} />
              </div>
              <div>
                <label className="label-field">Total de Sepulturas</label>
                <input type="number" className="input-field" placeholder="500"
                  value={form.totalSepulturas} onChange={e => set('totalSepulturas', e.target.value)} />
              </div>
              <div>
                <label className="label-field">Sepulturas Ocupadas</label>
                <input type="number" className="input-field" placeholder="350"
                  value={form.sepulturasOcupadas} onChange={e => set('sepulturasOcupadas', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Ambientais</h3>
            <p className="text-sm text-gray-500 mb-4">
              Informações ambientais conforme CONAMA 335/2003. Essenciais para o cálculo de risco de necrochorume.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Tipo de Solo *</label>
                <select className="input-field" value={form.tipoSolo} onChange={e => set('tipoSolo', e.target.value)}>
                  {TIPOS_SOLO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Solo arenoso tem maior permeabilidade e risco</p>
              </div>
              <div>
                <label className="label-field">Nível do Lençol Freático (m)</label>
                <input type="number" step="0.1" className="input-field" placeholder="1.5"
                  value={form.nivelLencolFreatico} onChange={e => set('nivelLencolFreatico', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">CONAMA exige mínimo 1,5m</p>
              </div>
              <div>
                <label className="label-field">Distância do Corpo Hídrico (m)</label>
                <input type="number" step="1" className="input-field" placeholder="200"
                  value={form.distanciaCorpoHidrico} onChange={e => set('distanciaCorpoHidrico', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">CONAMA exige mínimo 200m de rios/nascentes</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <input type="checkbox" checked={form.possuiDrenagem}
                  onChange={e => set('possuiDrenagem', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Possui sistema de drenagem pluvial</p>
                  <p className="text-xs text-gray-500">Sistema para escoamento de águas pluviais</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <input type="checkbox" checked={form.possuiImpermeabilizacao}
                  onChange={e => set('possuiImpermeabilizacao', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Possui impermeabilização de fundo</p>
                  <p className="text-xs text-gray-500">Camada impermeável para proteger o solo</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Judiciais</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se o cemitério possui liminar judicial para regularização ambiental, informe os dados abaixo.
            </p>
            <label className="flex items-center gap-3 cursor-pointer p-4 bg-red-50 rounded-lg border border-red-200">
              <input type="checkbox" checked={form.possuiLiminar}
                onChange={e => set('possuiLiminar', e.target.checked)}
                className="rounded border-red-300 text-red-600 focus:ring-red-500 w-5 h-5" />
              <div>
                <p className="text-sm font-bold text-red-800">Possui liminar judicial</p>
                <p className="text-xs text-red-600">Cemitério está sob determinação judicial para regularização</p>
              </div>
            </label>

            {form.possuiLiminar && (
              <div className="space-y-4 pl-4 border-l-4 border-red-300 ml-2">
                <div>
                  <label className="label-field">Prazo da Liminar</label>
                  <input type="date" className="input-field"
                    value={form.prazoLiminar} onChange={e => set('prazoLiminar', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Observações da Liminar</label>
                  <textarea className="input-field" rows={3}
                    placeholder="Número do processo, vara, determinações..."
                    value={form.observacoesLiminar} onChange={e => set('observacoesLiminar', e.target.value)} />
                </div>
              </div>
            )}

            <div className="mt-6">
              <label className="label-field">Observações Gerais</label>
              <textarea className="input-field" rows={3}
                placeholder="Informações adicionais sobre o cemitério..."
                value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        {etapa === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revisão dos Dados</h3>
            <p className="text-sm text-gray-500 mb-4">Confira todos os dados antes de salvar.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Resumo label="Nome" valor={form.nome} />
              <Resumo label="Cidade/UF" valor={`${form.cidade}/${form.uf}`} />
              <Resumo label="Endereço" valor={form.endereco} />
              <Resumo label="Área Total" valor={form.areaTotal ? `${form.areaTotal} m²` : '-'} />
              <Resumo label="Sepulturas" valor={form.totalSepulturas ? `${form.sepulturasOcupadas || 0} / ${form.totalSepulturas}` : '-'} />
              <Resumo label="Tipo de Solo" valor={TIPOS_SOLO.find(t => t.value === form.tipoSolo)?.label} />
              <Resumo label="Lençol Freático" valor={form.nivelLencolFreatico ? `${form.nivelLencolFreatico}m` : '-'} />
              <Resumo label="Dist. Corpo Hídrico" valor={form.distanciaCorpoHidrico ? `${form.distanciaCorpoHidrico}m` : '-'} />
              <Resumo label="Drenagem" valor={form.possuiDrenagem ? 'Sim' : 'Não'} />
              <Resumo label="Impermeabilização" valor={form.possuiImpermeabilizacao ? 'Sim' : 'Não'} />
              <Resumo label="Liminar Judicial" valor={form.possuiLiminar ? `Sim${form.prazoLiminar ? ` - até ${new Date(form.prazoLiminar + 'T12:00').toLocaleDateString('pt-BR')}` : ''}` : 'Não'} destaque={form.possuiLiminar} />
            </div>

            {form.possuiLiminar && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
                <p className="text-sm font-bold text-red-800 mb-1">Atenção: Cemitério com Liminar</p>
                <p className="text-xs text-red-600">
                  Este cemitério será priorizado no sistema. O licenciamento terá fluxo acelerado.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navegação */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          {etapa > 1 ? (
            <button onClick={() => setEtapa(e => e - 1)}
              className="btn-outline flex items-center gap-2">
              <FiArrowLeft size={16} /> Voltar
            </button>
          ) : (
            <button onClick={() => navigate('/cemiterios')}
              className="btn-outline flex items-center gap-2">
              <FiArrowLeft size={16} /> Cancelar
            </button>
          )}

          {etapa < 4 ? (
            <button onClick={() => setEtapa(e => e + 1)}
              className="btn-primary flex items-center gap-2"
              disabled={etapa === 1 && (!form.nome || !form.cidade || !form.uf)}>
              Próximo <FiArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="btn-primary flex items-center gap-2">
              <FiSave size={16} /> {loading ? 'Salvando...' : (id ? 'Atualizar' : 'Cadastrar Cemitério')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumo({ label, valor, destaque }) {
  return (
    <div className={`p-3 rounded-lg ${destaque ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-medium ${destaque ? 'text-red-800' : 'text-gray-900'}`}>{valor || '-'}</p>
    </div>
  );
}
