export type EventStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type AttendeeStatus = "unused" | "used" | "blocked" | "cancelled";

export type ScanResult =
  | "VALID_CHECKED_IN"
  | "ALREADY_USED"
  | "INVALID_QR"
  | "EVENT_INACTIVE"
  | "ATTENDEE_BLOCKED";

export interface EventRecord {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  status: EventStatus;
  createdAt: string;
}

export interface AttendeeRecord {
  id: string;
  eventId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  designation?: string;
  category?: string;
  notes?: string;
  qrToken: string;
  status: AttendeeStatus;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt: string;
}

export interface ScanLogRecord {
  id: string;
  eventId: string;
  attendeeId?: string;
  scannerUserId?: string;
  qrTokenHash?: string;
  result: ScanResult;
  message?: string;
  createdAt: string;
}

export interface DBShape {
  events: EventRecord[];
  attendees: AttendeeRecord[];
  scanLogs: ScanLogRecord[];
}
