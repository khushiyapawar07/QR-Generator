 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface EventRecord {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  status: string;
}

export default function ScannerHomePage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents((data.data ?? []).filter((row: EventRecord) => row.status === "active")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-8">
      <div className="card p-6">
        <h1 className="text-3xl font-bold text-slate-900">Scanner</h1>
        <p className="mt-2 text-slate-600">Select an active event and start scanning. No admin page required.</p>
      </div>

      {loading && (
        <div className="card p-5 text-sm text-slate-600">
          Loading events...
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="card p-5 text-sm text-slate-600">
          No active events found. Ask admin team to create an active event first.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid gap-4">
          {events.map((eventRow) => (
            <div key={eventRow.id} className="card p-5">
              <p className="text-lg font-semibold text-slate-900">{eventRow.name}</p>
              <p className="text-sm text-slate-600">
                {eventRow.venue} · {new Date(eventRow.startsAt).toLocaleString()}
              </p>
              <div className="mt-3">
                <Link className="btn-primary text-sm" href={`/scanner/${eventRow.id}`}>
                  Start Scanner
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5 text-sm text-slate-600">
        If you already have an event link, open it directly using `/scanner/[eventId]`.
      </div>
    </div>
  );
}
