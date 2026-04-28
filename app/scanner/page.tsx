export default function ScannerHomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
      <div className="card p-6">
        <h1 className="text-3xl font-bold text-slate-900">Scanner</h1>
        <p className="mt-2 text-slate-600">
        Open scanner directly from admin event cards, or paste `/scanner/[eventId]` in URL.
        </p>
        <a className="btn-secondary mt-4 inline-block" href="/admin">
          Go to Admin
        </a>
      </div>
    </div>
  );
}
