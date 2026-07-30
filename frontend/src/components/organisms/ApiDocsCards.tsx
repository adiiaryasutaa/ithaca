import { Card } from '@/components/ui/card';
import { CodeBlock } from '@/components/molecules/CodeBlock';
import { API_URL } from '@/lib/api';
import {
  downloadFileCurlExample,
  listFilesCurlExample,
  uploadCurlExample,
  uploadJsExample,
} from '@/lib/api-docs';

export function UploadApiDocs() {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-extrabold">Upload API Docs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Multipart upload uses the same storage routing as dashboard uploads. If a key is pinned to
          a folder, <code className="text-xs">folderId</code> must match the pinned folder or be
          omitted — a mismatched value returns{' '}
          <code className="text-xs">403 API_KEY_FOLDER_MISMATCH</code>.
        </p>
      </div>
      <div className="mt-4 grid gap-4 text-sm text-muted-foreground">
        <CodeBlock
          label="Endpoint"
          tone="inline"
          code={`POST ${API_URL}/api/v1/uploads`}
          copyValue={`${API_URL}/api/v1/uploads`}
        />
        <CodeBlock
          label="Auth Header"
          tone="inline"
          code="Authorization: Bearer 9d_live_xxx"
          copyable={false}
        />
        <CodeBlock label="cURL" code={uploadCurlExample} />
        <CodeBlock label="JavaScript" code={uploadJsExample} />
      </div>
    </Card>
  );
}

export function ReadApiDocs() {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-extrabold">Read API Docs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-mode keys can list and download files. Pinned keys only see their pinned file or the
          direct contents of their pinned folder.
        </p>
      </div>
      <div className="mt-4 grid gap-4 text-sm text-muted-foreground">
        <CodeBlock label="List files" code={listFilesCurlExample} />
        <CodeBlock label="Download a file" code={downloadFileCurlExample} />
      </div>
    </Card>
  );
}
