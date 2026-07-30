import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';

export type S3FormValues = {
  name: string;
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  quotaBytes: string;
};

export const emptyS3Form: S3FormValues = {
  name: '',
  bucket: '',
  region: 'us-east-1',
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false,
  quotaBytes: '',
};

export function S3ConnectDialog({
  open,
  values,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  values: S3FormValues;
  submitting: boolean;
  onChange: (values: S3FormValues) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof S3FormValues>(key: K, value: S3FormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <DummyModal
      open={open}
      title="Connect S3 Storage"
      description="Use any S3-compatible provider with custom endpoint support."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Input
          placeholder="Display name"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          required
        />
        <Input
          placeholder="Bucket"
          value={values.bucket}
          onChange={(event) => set('bucket', event.target.value)}
          required
        />
        <Input
          placeholder="Region"
          value={values.region}
          onChange={(event) => set('region', event.target.value)}
          required
        />
        <Input
          placeholder="Endpoint URL (optional)"
          value={values.endpoint}
          onChange={(event) => set('endpoint', event.target.value)}
        />
        <Input
          placeholder="Access key ID"
          value={values.accessKeyId}
          onChange={(event) => set('accessKeyId', event.target.value)}
          required
        />
        <Input
          placeholder="Secret access key"
          type="password"
          value={values.secretAccessKey}
          onChange={(event) => set('secretAccessKey', event.target.value)}
          required
        />
        <Input
          placeholder="Quota bytes (optional)"
          inputMode="numeric"
          value={values.quotaBytes}
          onChange={(event) => set('quotaBytes', event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={values.forcePathStyle}
            onChange={(event) => set('forcePathStyle', event.target.checked)}
          />
          Force path style
        </label>
        <div className="grid gap-3 sm:flex sm:justify-end">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Connecting...' : 'Connect S3'}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
