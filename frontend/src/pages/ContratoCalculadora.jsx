import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDollarSign, FiPlus, FiTrash2, FiArrowLeft, FiCheck } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const MODULOS = [
  { id: 'cadastro', label: 'Cadastro e Diagnóstico', desc: 'Cadastramento completo, checklist CONAMA, análise de risco' },
  { id: 'licenciamento', label: 'Licenciamento Ambiental', desc: 'Geração de documentos, acompanhamento de processo' },
  { id: 'contratacao', label: 'Pacote de Contratação', desc: 'Justificativas legais, minutas, pareceres' },
];

export default function ContratoCalculadora() {
  const navigate = useNavigate();
  const [cemiteriosDisponiveis, setCemiteriosDisponiveis] = useState([]);
  const [cemiterios, setCemiterios] = useState([{ cemiterioId: '', area: '', modulos: ['cadastro', 'licenciamento', 'contratacao'] }]);
  const [moduloMonitoramento, setModuloMonitoramento] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    api.get('/cemiterios', { params: { limite: 100 } }).then(({ data }) => {
      setCemiteriosDisponiveis(data.dados || data);
    });
  }, []);

  const addCemiterio = () => {
    setCemiterios([...cemiterios, { cemiterioId: '', area: '', modulos: ['cadastro', 'licenciamento', 'contratacao'] }]);
  };

  const removeCemiterio = (i) => {
    if (cemiterios.length <= 1) return;
    setCemiterios(cemiterios.filter((_, idx) => idx !== i));
  };

  const updateCemiterio = (i, field, value) => {
    const updated = [...cemiterios];
    updated[i] = { ...updated[i], [field]: value };
    if (field === 'cemiterioId') {
      const cem = cemiteriosDisponiveis.find(c => c.id === value);
      if (cem?.areaTotal) updated[i].area = cem.areaTotal;
    }
    setCemiterios(updated);
  };

  const toggleModulo = (i, modulo) => {
    const updated = [...cemiterios];
    const mods = updated[i].modulos;
    if (mods.includes(modulo)) {
      updated[i].modulos = mods.filter(m => m !== modulo);
    } else {
      updated[i].modulos = [...mods, modulo];
    }
    setCemiterios(updated);
  };

  const calcular = async () => {
    const payload = {
      cemiterios: cemiterios.map(c => ({
        areaHa: parseFloat(c.area) || 0,
        modulos: c.modulos,
      })),
      moduloMonitoramento,
    };

    if (payload.cemiterios.some(c => c.area <= 0)) {
      toast.error('Informe a área de todos os cemitérios');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/contratos/calcular', payload);
      setResultado(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro no cálculo');
    } finally {
      setLoading(false);
    }
  };

  const criarContrato = async (parcelas) => {
    setCriando(true);
    try {
      const payload = {
        valorTotal: resultado.valorTotal,
        modalidade: resultado.modalidade,
        tipoContrato: resultado.tipoContrato || 'SERVICO_TECNICO',
        parcelas: parcelas,
        descricao: `Contratação CemLicença - ${cemiterios.length} cemitério(s)`,
      };
      const { data } = await api.post('/contratos', payload);
      toast.success('Contrato criado com sucesso!');
      navigate(`/contratos/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar contrato');
    } finally {
      setCriando(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calculadora de Contratação</h1>
          <p className="text-gray-500 mt-1">Simule valores e gere o contrato com justificativa legal</p>
        </div>
        <button onClick={() => navigate('/contratos')} className="btn-outline flex items-center gap-2">
          <FiArrowLeft size={16} /> Voltar
        </button>
      </div>

      {/* Cemitérios */}
      <div className="space-y-4">
        {cemiterios.map((cem, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cemitério {i + 1}</h3>
              {cemiterios.length > 1 && (
                <button onClick={() => removeCemiterio(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <FiTrash2 size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label-field">Selecionar Cemitério</label>
                <select className="input-field" value={cem.cemiterioId}
                  onChange={e => updateCemiterio(i, 'cemiterioId', e.target.value)}>
                  <option value="">Selecione (ou informe a área manualmente)</option>
                  {cemiteriosDisponiveis.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.areaTotal || '?'} m²</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Área Total (m²) *</label>
                <input type="number" className="input-field" placeholder="5000"
                  value={cem.area} onChange={e => updateCemiterio(i, 'area', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-field mb-2">Módulos</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MODULOS.map(mod => (
                  <label key={mod.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      cem.modulos.includes(mod.id) ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <input type="checkbox" checked={cem.modulos.includes(mod.id)}
                      onChange={() => toggleModulo(i, mod.id)}
                      className="mt-1 rounded text-primary-600 focus:ring-primary-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{mod.label}</p>
                      <p className="text-xs text-gray-500">{mod.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button onClick={addCemiterio}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2">
          <FiPlus size={18} /> Adicionar Cemitério
        </button>
      </div>

      {/* Monitoramento */}
      <label className="card flex items-center gap-4 cursor-pointer">
        <input type="checkbox" checked={moduloMonitoramento}
          onChange={e => setModuloMonitoramento(e.target.checked)}
          className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5" />
        <div>
          <p className="font-medium text-gray-900">Módulo de Monitoramento Ambiental</p>
          <p className="text-sm text-gray-500">R$ 1.200/mês — Coleta de dados, IA preditiva, alertas automáticos</p>
        </div>
      </label>

      {/* Botão Calcular */}
      <button onClick={calcular} disabled={loading}
        className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2">
        <FiDollarSign size={20} /> {loading ? 'Calculando...' : 'Calcular Valor'}
      </button>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          <div className="card border-2 border-primary-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Resultado da Simulação</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-primary-50 rounded-lg">
                <p className="text-3xl font-bold text-primary-700">{formatCurrency(resultado.valorTotal)}</p>
                <p className="text-sm text-primary-600 mt-1">Valor Total</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">
                  {resultado.modalidade?.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-blue-600 mt-1">Modalidade de Contratação</p>
              </div>
            </div>

            {resultado.detalhamento && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Detalhamento</h4>
                <div className="space-y-1 text-sm">
                  {resultado.detalhamento.map((item, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600">{item.descricao}</span>
                      <span className="font-medium">{formatCurrency(item.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.parcelas && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Opções de Pagamento</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {resultado.parcelas.map((p) => (
                    <button key={p.quantidade} onClick={() => criarContrato(p.quantidade)} disabled={criando}
                      className="p-3 bg-gray-50 hover:bg-primary-50 rounded-lg border hover:border-primary-300 transition-all text-center">
                      <p className="text-lg font-bold text-gray-900">{p.quantidade}x</p>
                      <p className="text-sm text-gray-600">{formatCurrency(p.valorParcela)}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">Clique em uma opção para criar o contrato</p>
              </div>
            )}
          </div>

          {/* Fundamentação Legal */}
          <div className="card bg-gray-50">
            <h4 className="font-medium text-gray-900 mb-2">Fundamentação Legal</h4>
            {resultado.valorTotal <= 65492.11 ? (
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Dispensa de Licitação — Art. 75, inciso II, Lei 14.133/2021</strong></p>
                <p>Valor dentro do limite de R$ 65.492,11 atualizado pelo Decreto 12.807/2025</p>
                <p className="text-xs text-gray-500 mt-2">
                  Jurisprudência: TCU Acórdão 1386/2023 e 2837/2023 — reconhecem a legitimidade da
                  contratação direta de serviços técnicos especializados de tecnologia
                </p>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Inexigibilidade — Art. 74, inciso III, Lei 14.133/2021</strong></p>
                <p>Serviço técnico especializado de natureza singular com notória especialização</p>
                <p className="text-xs text-gray-500 mt-2">
                  Sistema proprietário CemLicença com metodologia exclusiva para licenciamento ambiental
                  de cemitérios conforme CONAMA 335/2003
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
