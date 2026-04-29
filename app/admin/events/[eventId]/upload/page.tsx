"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

interface Attendee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  qrToken: string;
}

export default function UploadPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const pageSize = 100;
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAttendees(id: string, requestedPage = 1) {
    setLoadError(null);
    const res = await fetch(`/api/events/${id}/attendees?page=${requestedPage}&limit=${pageSize}`);
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.message ?? "Failed to load attendees.");
      return;
    }
    setAttendees(data.data ?? []);
    setTotal(data.total ?? 0);
    setHasMore(Boolean(data.hasMore));
    setPage(data.page ?? requestedPage);
  }

  useEffect(() => {
    void loadAttendees(eventId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function uploadFile() {
    if (!eventId || !file) return;
    const form = new FormData();
    form.append("file", file);
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/attendees/upload-excel`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setSummary(data);
      await loadAttendees(eventId, 1);
    } finally {
      setLoading(false);
    }
  }

  const checkedIn = useMemo(
    () => attendees.filter((attendee) => attendee.status === "used").length,
    [attendees],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Attendees</h1>
        <p className="text-sm text-slate-600">
          Upload `.xlsx`, `.xls`, or `.csv`. Required field: <strong>Name</strong>.
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input max-w-sm"
        />
        <button
          onClick={uploadFile}
          disabled={!file || loading}
          className="btn-primary disabled:opacity-60"
        >
          {loading ? "Uploading..." : "Upload + Generate QR"}
        </button>
        <a className="btn-secondary text-sm" href={`/api/events/${eventId}/attendees/export`}>
          Export CSV
        </a>
        <form method="post" action={`/api/events/${eventId}/qr/bulk-download`}>
          <button className="btn-secondary text-sm" type="submit">
            Download All Passes (ZIP)
          </button>
        </form>
        <Link className="btn-secondary text-sm" href={`/scanner/${eventId}`}>
          Open Scanner
        </Link>
      </div>

      {summary && (
        <div className="card space-y-2 p-4 text-sm">
          <p className="font-semibold text-slate-900">Upload Summary</p>
          <div className="grid gap-2 md:grid-cols-3">
            <p>Total rows: {String(summary.totalRows ?? "-")}</p>
            <p>Imported: {String(summary.importedRows ?? "-")}</p>
            <p>Failed: {String(summary.failedRows ?? "-")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">Total: {total}</div>
        <div className="card p-4">Checked In (this page): {checkedIn}</div>
        <div className="card p-4">Current Page Rows: {attendees.length}</div>
      </div>

      {loadError && <div className="card p-4 text-sm text-rose-600">{loadError}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Status</th>
              <th className="p-3">QR</th>
              <th className="p-3">Pass</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((attendee) => (
              <tr key={attendee.id} className="border-b">
                <td className="p-3">{attendee.name}</td>
                <td className="p-3">{attendee.company ?? "-"}</td>
                <td className="p-3">{attendee.status}</td>
                <td className="p-3">
                  <code className="text-xs">{`${attendee.qrToken.slice(0, 18)}...`}</code>
                </td>
                <td className="p-3">
                  <a
                    className="btn-secondary text-xs"
                    href={`/api/events/${eventId}/attendees/${attendee.id}/pass`}
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-60"
          disabled={page <= 1 || loading}
          onClick={() => void loadAttendees(eventId, page - 1)}
        >
          Previous
        </button>
        <p className="text-sm text-slate-600">Page {page}</p>
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-60"
          disabled={!hasMore || loading}
          onClick={() => void loadAttendees(eventId, page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
