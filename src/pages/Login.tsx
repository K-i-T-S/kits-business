import BrandPanel from '@/components/login/BrandPanel';
import LoginForm from '@/components/login/LoginForm';
import '@/styles/login.css';

interface LoginProps {
  onLogin?: () => void;
}

export default function Login({ onLogin }: LoginProps): React.ReactElement {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <BrandPanel />
      <LoginForm onLogin={onLogin} />
    </div>
  );
}
