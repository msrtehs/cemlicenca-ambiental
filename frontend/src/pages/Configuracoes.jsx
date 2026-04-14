import { useState, useEffect } from 'react';
import { FiUser, FiUsers, FiShield, FiSave, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const PERFIS = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'SECRETARIO', label: 'Secretário' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'CONTADOR', label: 'Contador' },
  { value: 'AUDITOR', label: 'Auditor' },
];

export default function Configuracoes() {
  const { usuario, carregarUsuario } = useAuth();
  const [tab, setTab] = useState('perfil');
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Perfil form
  const [perfil, setPerfil] = useState({ nome: '', email: '', cargo: '' });
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [savingPerfil, setSavingPerfil] = useState(false);

  // Novo usuário
  const [showNovoUser, setShowNovoUser] = useState(false);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', cpf: '', cargo: '', perfil: 'TECNICO', senha: '' });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (usuario) {
      setPerfil({ nome: usuario.nome || '', email: usuario.email || '', cargo: usuario.cargo || '' });
    }
  }, [usuario]);

  useEffect(() => {
    if (tab === 'usuarios') carregarUsuarios();
  }, [tab]);

  async function carregarUsuarios() {
    setLoadingUsers(true);
    try {
      const prefId = usuario?.prefeituraId || usuario?.prefeitura?.id;
      const { data } = await api.get(`/prefeituras/${prefId}/usuarios`);
      setUsuarios(Array.isArray(data) ? data : data.dados || []);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function salvarPerfil(e) {
    e.preventDefault();
    setSavingPerfil(true);
    try {
      await api.put('/auth/me', perfil);
      toast.success('Perfil atualizado!');
      carregarUsuario();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSavingPerfil(false);
    }
  }

  async function alterarSenha(e) {
    e.preventDefault();
    if (!senhaAtual || !novaSenha) {
      toast.error('Preencha a senha atual e a nova senha');
      return;
    }
    if (novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    try {
      await api.put('/auth/senha', { senhaAtual, novaSenha });
      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    }
  }

  async function criarUsuario(e) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const prefId = usuario?.prefeituraId || usuario?.prefeitura?.id;
      await api.post(`/prefeituras/${prefId}/usuarios`, novoUser);
      toast.success('Usuário criado!');
      setShowNovoUser(false);
      setNovoUser({ nome: '', email: '', cpf: '', cargo: '', perfil: 'TECNICO', senha: '' });
      carregarUsuarios();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setSavingUser(false);
    }
  }

  async function desativarUsuario(userId) {
    if (!confirm('Desativar este usuário?')) return;
    try {
      const prefId = usuario?.prefeituraId || usuario?.prefeitura?.id;
      await api.delete(`/prefeituras/${prefId}/usuarios/${userId}`);
      toast.success('Usuário desativado');
      carregarUsuarios();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao desativar');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { id: 'perfil', label: 'Meu Perfil', icon: FiUser },
            { id: 'usuarios', label: 'Usuários', icon: FiUsers },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'text-primary-700 border-primary-700' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Perfil */}
      {tab === 'perfil' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados do Perfil</h3>
            <form onSubmit={salvarPerfil} className="space-y-4">
              <div>
                <label className="label-field">Nome</label>
                <input className="input-field" value={perfil.nome}
                  onChange={e => setPerfil({ ...perfil, nome: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Email</label>
                <input className="input-field" type="email" value={perfil.email}
                  onChange={e => setPerfil({ ...perfil, email: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Cargo</label>
                <input className="input-field" value={perfil.cargo}
                  onChange={e => setPerfil({ ...perfil, cargo: e.target.value })} />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Perfil: <strong>{usuario?.perfil}</strong></p>
                <p className="text-sm text-gray-500">Prefeitura: <strong>{usuario?.prefeitura?.nome || '-'}</strong></p>
              </div>
              <button type="submit" disabled={savingPerfil}
                className="btn-primary flex items-center gap-2">
                <FiSave size={16} /> {savingPerfil ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h3>
            <form onSubmit={alterarSenha} className="space-y-4">
              <div>
                <label className="label-field">Senha Atual</label>
                <input type="password" className="input-field" value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Nova Senha</label>
                <input type="password" className="input-field" value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <button type="submit" className="btn-outline flex items-center gap-2">
                <FiShield size={16} /> Alterar Senha
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Usuários */}
      {tab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNovoUser(true)}
              className="btn-primary flex items-center gap-2">
              <FiPlus size={16} /> Novo Usuário
            </button>
          </div>

          {showNovoUser && (
            <div className="card border-2 border-primary-200">
              <h3 className="font-semibold text-gray-900 mb-4">Novo Usuário</h3>
              <form onSubmit={criarUsuario} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Nome *</label>
                  <input className="input-field" required value={novoUser.nome}
                    onChange={e => setNovoUser({ ...novoUser, nome: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Email *</label>
                  <input type="email" className="input-field" required value={novoUser.email}
                    onChange={e => setNovoUser({ ...novoUser, email: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">CPF</label>
                  <input className="input-field" placeholder="000.000.000-00" value={novoUser.cpf}
                    onChange={e => setNovoUser({ ...novoUser, cpf: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Cargo</label>
                  <input className="input-field" value={novoUser.cargo}
                    onChange={e => setNovoUser({ ...novoUser, cargo: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Perfil *</label>
                  <select className="input-field" value={novoUser.perfil}
                    onChange={e => setNovoUser({ ...novoUser, perfil: e.target.value })}>
                    {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Senha *</label>
                  <input type="password" className="input-field" required
                    placeholder="Mínimo 6 caracteres" value={novoUser.senha}
                    onChange={e => setNovoUser({ ...novoUser, senha: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNovoUser(false)} className="btn-outline">Cancelar</button>
                  <button type="submit" disabled={savingUser} className="btn-primary">
                    {savingUser ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div key={u.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <FiUser className="text-primary-600" size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.nome}</p>
                      <p className="text-sm text-gray-500">{u.email} · {u.perfil} · {u.cargo || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.ativo && <span className="badge-vermelho">Inativo</span>}
                    {u.id !== usuario?.id && u.ativo !== false && (
                      <button onClick={() => desativarUsuario(u.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded">
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {usuarios.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário encontrado</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
