import { useEffect } from 'react';

export default function ApiDocsPage() {
  useEffect(() => { document.title = 'Carbon Credit API | UAIU.LIVE'; }, []);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">UAIU Carbon Budget API</h1>
      <pre className="mt-4 rounded border border-border p-4 text-xs overflow-auto">{`GET /api/v1/budget\nGET /api/v1/trades\nGET /api/v1/trades/:tradeId\nPOST /api/v1/webhooks`}</pre>
      <p className="mt-3 text-sm text-muted-foreground">Execute CORSIA-eligible trades at UAIU.LIVE/X</p>
    </main>
  );
}
