import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { FileItem } from '@/data/drive-data';

/**
 * Two kinds of link per file: Ithaca's own tokenized share URL, and — for Google Drive
 * files only — a Drive permission that makes the file publicly readable at its Drive URL.
 */
export function useShareLink() {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [gdrivePublicUrl, setGdrivePublicUrl] = useState('');
  const [makingPublic, setMakingPublic] = useState(false);

  async function share(file: FileItem | null) {
    if (!file?.id) return;
    const data = await apiFetch<{ url: string }>(`/files/${file.id}/share`, { method: 'POST' });
    setShareUrl(data.url);
    setCopied(false);
    setGdrivePublicUrl('');
    setMakingPublic(false);
    setOpen(true);
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Share link copied to clipboard.');
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function makePublic(file: FileItem | null) {
    if (!file?.id) return;
    setMakingPublic(true);
    try {
      const res = await apiFetch<{ url: string }>(`/files/${file.id}/public-permission`, {
        method: 'POST',
      });
      setGdrivePublicUrl(res.url);
      await navigator.clipboard.writeText(res.url);
      toast.success('Google Drive public link generated and copied to clipboard!');
    } catch (err: any) {
      toast.error('Failed to update Google Drive permission: ' + (err.message || err));
    } finally {
      setMakingPublic(false);
    }
  }

  // Context-menu shortcut: prefer the file's existing Drive view URL, and only mint an
  // Ithaca share link if the provider has none.
  async function copyDirectLink(file: FileItem | null) {
    if (!file?.id) return;
    try {
      const data = await apiFetch<{ url: string | null }>(`/files/${file.id}/view-url`);
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success('Google Drive link copied to clipboard!');
      } else {
        const shareData = await apiFetch<{ url: string }>(`/files/${file.id}/share`, {
          method: 'POST',
        });
        await navigator.clipboard.writeText(shareData.url);
        toast.success('Share link copied to clipboard!');
      }
    } catch (err: any) {
      toast.error('Failed to copy link: ' + (err.message || err));
    }
  }

  return {
    open,
    setOpen,
    shareUrl,
    copied,
    gdrivePublicUrl,
    makingPublic,
    share,
    copy,
    makePublic,
    copyDirectLink,
  };
}
