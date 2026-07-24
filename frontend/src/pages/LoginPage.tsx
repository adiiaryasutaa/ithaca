import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { setAuthSession, type AuthUser } from '@/lib/auth';

type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function continueWithGoogle() {
    setGoogleLoading(true);
    try {
      const data = await apiFetch<{ url: string }>('/auth/google/url', { skipAuth: true });
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google login failed');
      setGoogleLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      });
      setAuthSession(data.accessToken, data.refreshToken, data.user);
      navigate('/all-files');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-5">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary text-white">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Login</h1>
            <p className="text-sm text-muted-foreground">Access your Ithaca gateway.</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button disabled={loading}>{loading ? 'Logging in...' : 'Login'}</Button>
        </form>
        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-accent" />
            or
            <span className="h-px flex-1 bg-accent" />
          </div>
          <Button variant="outline" disabled={googleLoading} onClick={continueWithGoogle}>
            <GoogleLogo />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </Button>
        </div>
      </Card>
    </main>
  );
}
