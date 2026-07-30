import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { setAuthSession, type AuthUser } from '@/lib/auth';

type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

const STATUS_MESSAGES: Record<string, string> = {
  unknown_account: 'No Ithaca account exists for that Google address. Ask an admin to create one.',
  account_disabled: 'This account has been disabled.',
};

export function GoogleAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Google sign-in...');
  const token = params.get('token');
  const status = params.get('status');

  useEffect(() => {
    if (status || !token) {
      const failure =
        (status ? STATUS_MESSAGES[status] : undefined) ??
        'Google sign-in failed. Please try again.';
      setMessage(failure);
      toast.error(failure);
      return;
    }

    apiFetch<AuthResponse>('/auth/google/exchange', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        setAuthSession(data.accessToken, data.refreshToken, data.user);
        navigate('/all-files', { replace: true });
      })
      .catch((error) => {
        const errMessage =
          error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
        setMessage(errMessage);
        toast.error(errMessage);
      });
  }, [navigate, status, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-5">
      <Card className="w-full max-w-sm p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-white">
          <HardDrive className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold">Google Sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </Card>
    </main>
  );
}
