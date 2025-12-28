import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, WorkspaceProvider } from './lib';
import { Layout } from './components/layout';
import { ProtectedRoute, RequireWorkspace } from './components/common';
import { Home, Settings, WorkspaceSettings, Section, Page, Login, Workspaces } from './pages';

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
              <Route index element={<Home />} />
              <Route path="section/:id" element={<Section />} />
              <Route path="section/:id/page/:pageId" element={<Page />} />
              <Route path="workspace-settings" element={<WorkspaceSettings />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
