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
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadAttendees(id: string) {
    const res = await fetch(`/api/events/${id}/attendees`);
    const data = await res.json();
    setAttendees(data.data ?? []);
  }

  useEffect(() => {
    fetch(`/api/events/${eventId}/attendees`)
      .then((res) => res.json())
      .then((data) => setAttendees(data.data ?? []));
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
      await loadAttendees(eventId);
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
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(summary, null, 2)}
        </pre>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">Total: {attendees.length}</div>
        <div className="card p-4">Checked In: {checkedIn}</div>
        <div className="card p-4">Pending: {attendees.length - checkedIn}</div>
      </div>

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
                  <code className="text-xs">{attendee.qrToken}</code>
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
    </div>
  );
}
