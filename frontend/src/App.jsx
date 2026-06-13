import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import AddExpense from './pages/AddExpense';
import ImportCSV from './pages/ImportCSV';
import Balances from './pages/Balances';
import SettlePage from './pages/SettlePage';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-pulse text-dark-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-dark-900">
      {user && <Navbar />}
      <main className={user ? 'pt-16' : ''}>
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" replace /> : <LoginPage />
          } />
          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/groups/:id" element={
            <ProtectedRoute><GroupDetail /></ProtectedRoute>
          } />
          <Route path="/groups/:id/add-expense" element={
            <ProtectedRoute><AddExpense /></ProtectedRoute>
          } />
          <Route path="/groups/:id/import" element={
            <ProtectedRoute><ImportCSV /></ProtectedRoute>
          } />
          <Route path="/groups/:id/balances" element={
            <ProtectedRoute><Balances /></ProtectedRoute>
          } />
          <Route path="/groups/:id/settle" element={
            <ProtectedRoute><SettlePage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
