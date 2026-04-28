import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <section className="card p-8 md:p-12">
        <p className="mb-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Production-ready MVP
        </p>
        <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
          Smart QR Entry Management
          <span className="block text-blue-600">for Events and Conferences</span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Create events, upload Excel attendee lists, generate unique QR passes with attendee names, and
          allow one-time entry with instant scanner decisions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin" className="btn-primary">
            Open Admin Panel
          </Link>
          <Link href="/scanner" className="btn-secondary">
            Open Scanner
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-900">Excel Upload</p>
          <p className="mt-2 text-sm text-slate-600">Upload `.xlsx`, `.xls`, `.csv` with flexible column mapping.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-900">Named QR Passes</p>
          <p className="mt-2 text-sm text-slate-600">Every pass shows attendee name above QR and supports ZIP download.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-900">One-Time Check-in</p>
          <p className="mt-2 text-sm text-slate-600">First scan accepted, duplicate scans rejected instantly.</p>
        </div>
      </section>
    </div>
  );
}
