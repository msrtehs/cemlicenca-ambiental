import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [tab, setTab] = useState('login'); // 'login' | 'registro'
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Registro
  const [reg, setReg] = useState({
    cnpj: '', nomePrefeitura: '', uf: '', cidade: '',
    nomeUsuario: '', emailReg: '', senhaReg: '', cargo: '',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, senha);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { default: api } = await import('../services/api');
      const { data } = await api.post('/auth/registro', {
        prefeitura: {
          cnpj: reg.cnpj, nome: reg.nomePrefeitura,
          uf: reg.uf, cidade: reg.cidade,
        },
        usuario: {
          nome: reg.nomeUsuario, email: reg.emailReg,
          senha: reg.senhaReg, cargo: reg.cargo,
        },
      });
      localStorage.setItem('cemlicenca_token', data.token);
      toast.success('Prefeitura cadastrada com sucesso!');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleGovBr = async () => {
    try {
      const { default: api } = await import('../services/api');
      const { data } = await api.get('/auth/govbr');
      if (data.url) window.location.href = data.url;
      else toast.error('Integração Gov.br não configurada');
    } catch {
      toast.error('Integração Gov.br indisponível');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-terra-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-primary-700 font-bold text-2xl">C</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CemLicença Ambiental</h1>
          <p className="text-primary-200 mt-2">Licenciamento ambiental automatizado para cemitérios</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                tab === 'login' ? 'text-primary-700 border-b-2 border-primary-700 bg-primary-50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setTab('registro')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                tab === 'registro' ? 'text-primary-700 border-b-2 border-primary-700 bg-primary-50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cadastrar Prefeitura
            </button>
          </div>

          <div className="p-6">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label-field">Email</label>
                  <input type="email" className="input-field" placeholder="seu@email.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="label-field">Senha</label>
                  <input type="password" className="input-field" placeholder="Sua senha"
                    value={senha} onChange={e => setSenha(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">ou</span></div>
                </div>

                <button type="button" onClick={handleGovBr}
                  className="w-full py-3 px-4 border-2 border-blue-600 text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                  <img src="https://www.gov.br/favicon.ico" alt="" className="w-5 h-5" onError={e => e.target.style.display='none'} />
                  Entrar com Gov.br
                </button>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Demo: admin@cemlicenca.com.br / demo2026
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegistro} className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Cadastre sua prefeitura para começar o licenciamento ambiental dos cemitérios.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label-field">CNPJ da Prefeitura</label>
                    <input className="input-field" placeholder="00.000.000/0001-00"
                      value={reg.cnpj} onChange={e => setReg({...reg, cnpj: e.target.value})} required />
                  </div>
                  <div className="col-span-2">
                    <label className="label-field">Nome da Prefeitura</label>
                    <input className="input-field" placeholder="Prefeitura Municipal de..."
                      value={reg.nomePrefeitura} onChange={e => setReg({...reg, nomePrefeitura: e.target.value})} required />
                  </div>
                  <div>
                    <label className="label-field">UF</label>
                    <select className="input-field" value={reg.uf} onChange={e => setReg({...reg, uf: e.target.value})} required>
                      <option value="">UF</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
                        .map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Cidade</label>
                    <input className="input-field" placeholder="Cidade"
                      value={reg.cidade} onChange={e => setReg({...reg, cidade: e.target.value})} required />
                  </div>

                  <div className="col-span-2 border-t pt-4 mt-2">
                    <p className="text-xs text-gray-500 mb-3">Dados do Administrador</p>
                  </div>
                  <div className="col-span-2">
                    <label className="label-field">Nome completo</label>
                    <input className="input-field" placeholder="Seu nome"
                      value={reg.nomeUsuario} onChange={e => setReg({...reg, nomeUsuario: e.target.value})} required />
                  </div>
                  <div className="col-span-2">
                    <label className="label-field">Email</label>
                    <input type="email" className="input-field" placeholder="seu@email.com"
                      value={reg.emailReg} onChange={e => setReg({...reg, emailReg: e.target.value})} required />
                  </div>
                  <div>
                    <label className="label-field">Cargo</label>
                    <input className="input-field" placeholder="Secretário..."
                      value={reg.cargo} onChange={e => setReg({...reg, cargo: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-field">Senha</label>
                    <input type="password" className="input-field" placeholder="Min. 6 caracteres"
                      value={reg.senhaReg} onChange={e => setReg({...reg, senhaReg: e.target.value})} required minLength={6} />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
                  {loading ? 'Cadastrando...' : 'Cadastrar Prefeitura'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
