import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { getGravatarUrl } from '@/lib/gravatar';
import type { AuthUser } from '@/lib/auth';

export function ProfileSummary({ user }: { user: AuthUser | null }) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    getGravatarUrl(user?.email, 96)
      .then(setImageUrl)
      .catch(() => setImageUrl(''));
  }, [user?.email]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3.5">
        {!imageUrl || imageFailed ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-sm border border-blue-400/20 sm:h-14 sm:w-14">
            {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="User avatar"
            className="h-12 w-12 rounded-sm object-cover sm:h-14 sm:w-14"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold">{user?.name ?? 'User'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.email ?? '-'}</p>
        </div>
      </div>
    </Card>
  );
}
