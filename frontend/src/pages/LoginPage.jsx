import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await authService.login(username, password);
      // Store user info for UI persistence
      localStorage.setItem('user', JSON.stringify(data.user));
      const { role } = data.user;

      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'closer' || role === 'setter') {
        navigate('/closer/dashboard');
      } else {
        // Fallback for other roles if they have access to the panel
        navigate('/closer/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-base tracking-widest italic uppercase">
            LEARNATION<span className="text-primary"> WORKERS</span>
          </h1>
          <p className="text-muted mt-2 font-medium uppercase tracking-tighter">Panel de Gestión</p>
        </div>

        <div className="bg-surface backdrop-blur-xl p-8 rounded-[2rem] border border-base shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Usuario</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted group-focus-within:text-primary transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 bg-main border border-base rounded-2xl text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                  placeholder="Nombre de usuario"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-4 bg-main border border-base rounded-2xl text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted hover:text-base transition-all"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              variant="primary"
              className="w-full h-16"
            >
              Iniciar Sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
