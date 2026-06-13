import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Wallet, Home } from 'lucide-react';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-800/80 backdrop-blur-md border-b border-dark-500/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center group-hover:shadow-lg group-hover:shadow-accent-500/25 transition-shadow">
              <img src="/logo.png" alt="SplitEase Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-semibold text-white">
              Split<span className="text-accent-400">Ease</span>
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <Link to="/" className="text-dark-200 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
              <Home size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <div className="h-5 w-px bg-dark-500/50" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-dark-100">{user?.name}</p>
                <p className="text-xs text-dark-300">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-dark-300 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
