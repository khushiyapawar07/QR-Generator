"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

interface EventRecord {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  status: string;
}

export default function AdminPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadEvents() {
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data.data ?? []);
  }

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents(data.data ?? []));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, venue, startsAt, timezone: "Asia/Kolkata" }),
      });
      setName("");
      setVenue("");
      setStartsAt("");
      await loadEvents();
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(eventId: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;
    setLoading(true);
    try {
      await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      await loadEvents();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Create events and manage attendee upload + scanner access.</p>
      </div>

      <form onSubmit={onCreate} className="card grid gap-3 p-5 md:grid-cols-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Event name"
          className="input"
          required
        />
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Venue"
          className="input"
          required
        />
        <input
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          type="datetime-local"
          className="input"
          required
        />
        <button
          disabled={loading}
          className="btn-primary disabled:opacity-60"
          type="submit"
        >
          {loading ? "Creating..." : "Create Event"}
        </button>
      </form>

      <div className="grid gap-4">
        {events.map((eventRow) => (
          <div key={eventRow.id} className="card p-5">
            <p className="text-lg font-semibold text-slate-900">{eventRow.name}</p>
            <p className="text-sm text-slate-600">
              {eventRow.venue} · {new Date(eventRow.startsAt).toLocaleString()} · {eventRow.status}
            </p>
            <div className="mt-3 flex gap-2">
              <Link className="btn-secondary text-sm" href={`/admin/events/${eventRow.id}/upload`}>
                Upload Attendees
              </Link>
              <Link className="btn-secondary text-sm" href={`/scanner/${eventRow.id}`}>
                Open Scanner
              </Link>
              <button
                className="btn-secondary text-sm text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => onDelete(eventRow.id)}
                disabled={loading}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
