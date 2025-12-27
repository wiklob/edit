import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, WorkspaceProvider } from './lib';
import { Layout } from './components/layout';
import { ProtectedRoute, RequireWorkspace } from './components/common';
import { Dashboard, Articles, Pipeline, Calendar, Settings, Login, Workspaces } from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/workspaces"
              element={
                <ProtectedRoute>
                  <Workspaces />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RequireWorkspace>
                    <Layout />
                  </RequireWorkspace>
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="articles" element={<Articles />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
