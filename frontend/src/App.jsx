import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CemiteriosList from './pages/CemiteriosList';
import CemiterioForm from './pages/CemiterioForm';
import CemiterioDetail from './pages/CemiterioDetail';
import LicenciamentosList from './pages/LicenciamentosList';
import LicenciamentoDetail from './pages/LicenciamentoDetail';
import LicenciamentoNovo from './pages/LicenciamentoNovo';
import ContratosList from './pages/ContratosList';
import ContratoDetail from './pages/ContratoDetail';
import ContratoCalculadora from './pages/ContratoCalculadora';
import MonitoramentoList from './pages/MonitoramentoList';
import MonitoramentoForm from './pages/MonitoramentoForm';
import MonitoramentoHistorico from './pages/MonitoramentoHistorico';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Notificacoes from './pages/Notificacoes';

function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />

          <Route path="/cemiterios" element={<ProtectedPage><CemiteriosList /></ProtectedPage>} />
          <Route path="/cemiterios/novo" element={<ProtectedPage><CemiterioForm /></ProtectedPage>} />
          <Route path="/cemiterios/:id/editar" element={<ProtectedPage><CemiterioForm /></ProtectedPage>} />
          <Route path="/cemiterios/:id" element={<ProtectedPage><CemiterioDetail /></ProtectedPage>} />

          <Route path="/licenciamentos" element={<ProtectedPage><LicenciamentosList /></ProtectedPage>} />
          <Route path="/licenciamentos/novo" element={<ProtectedPage><LicenciamentoNovo /></ProtectedPage>} />
          <Route path="/licenciamentos/:id" element={<ProtectedPage><LicenciamentoDetail /></ProtectedPage>} />

          <Route path="/contratos" element={<ProtectedPage><ContratosList /></ProtectedPage>} />
          <Route path="/contratos/calculadora" element={<ProtectedPage><ContratoCalculadora /></ProtectedPage>} />
          <Route path="/contratos/:id" element={<ProtectedPage><ContratoDetail /></ProtectedPage>} />

          <Route path="/monitoramento" element={<ProtectedPage><MonitoramentoList /></ProtectedPage>} />
          <Route path="/monitoramento/novo" element={<ProtectedPage><MonitoramentoForm /></ProtectedPage>} />
          <Route path="/monitoramento/historico/:cemiterioId" element={<ProtectedPage><MonitoramentoHistorico /></ProtectedPage>} />

          <Route path="/relatorios" element={<ProtectedPage><Relatorios /></ProtectedPage>} />
          <Route path="/configuracoes" element={<ProtectedPage><Configuracoes /></ProtectedPage>} />
          <Route path="/notificacoes" element={<ProtectedPage><Notificacoes /></ProtectedPage>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
