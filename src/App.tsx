import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ConcreteDesign } from './pages/ConcreteDesign';
import { SteelDesign } from './pages/SteelDesign';
import { Loads } from './pages/Loads';
import { Variables } from './pages/Variables';
import { Documents } from './pages/Documents';
import { VariablesProvider } from './context/VariablesContext';
import { ProjectHome } from './pages/ProjectHome';
import { SettingsPage } from './pages/SettingsPage';
import { VisualWorkspace } from './pages/VisualWorkspace';
import { applyWebsiteStyleSettings, getWebsiteStyleSettings } from './utils/websiteStyle';
import './styles/websiteTheme.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  React.useEffect(() => {
    applyWebsiteStyleSettings(getWebsiteStyleSettings());
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/qa/visual-workspace" element={<VisualWorkspace />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProjectHome />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="steel" element={<SteelDesign />} />
        <Route path="concrete" element={<ConcreteDesign />} />
        <Route path="loads" element={<Loads />} />
        <Route path="documents" element={<Documents />} />
        <Route path="visual-workspace" element={<VisualWorkspace />} />
        <Route path="variables" element={<Variables />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
      <Route path="/workspace/steel" element={<Navigate to="/steel" replace />} />
      <Route path="/workspace/concrete" element={<Navigate to="/concrete" replace />} />
      <Route path="/workspace/loads" element={<Navigate to="/loads" replace />} />
      <Route path="/workspace/documents" element={<Navigate to="/documents" replace />} />
      <Route path="/workspace/visual" element={<Navigate to="/visual-workspace" replace />} />
      <Route path="/workspace/variables" element={<Navigate to="/variables" replace />} />
      <Route path="/quick" element={<Navigate to="/dashboard" replace />} />
      <Route path="/quick/steel" element={<Navigate to="/steel" replace />} />
      <Route path="/quick/concrete" element={<Navigate to="/concrete" replace />} />
      <Route path="/quick/loads" element={<Navigate to="/loads" replace />} />
      <Route path="/quick/documents" element={<Navigate to="/documents" replace />} />
      <Route path="/quick/visual" element={<Navigate to="/visual-workspace" replace />} />
      <Route path="/quick/variables" element={<Navigate to="/variables" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VariablesProvider>
          <AppContent />
        </VariablesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
