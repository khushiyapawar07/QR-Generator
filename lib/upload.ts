import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";

const emailSchema = z.string().email();

const aliases = {
  name: ["name", "full name", "client name", "attendee name", "guest name"],
  phone: ["phone", "mobile", "mobile number", "contact", "contact number"],
  email: ["email", "email id", "email address", "mail"],
  company: ["company", "company name", "organization", "organisation"],
  designation: ["designation", "role", "position", "title"],
  category: ["category", "type", "group"],
  notes: ["notes", "remarks", "comment"],
} as const;

export interface ParsedRow {
  rowNumber: number;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  designation?: string;
  category?: string;
  notes?: string;
}

export interface UploadError {
  rowNumber: number;
  reason: string;
}

export interface UploadParseResult {
  rows: ParsedRow[];
  errors: UploadError[];
  totalRows: number;
  duplicateRows: number;
}

export function parseUpload(fileName: string, fileBuffer: Buffer): UploadParseResult {
  const lower = fileName.toLowerCase();
  let rawRows: Record<string, unknown>[] = [];

  if (lower.endsWith(".csv")) {
    const text = fileBuffer.toString("utf8");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rawRows = parsed.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(fileBuffer, { type: "buffer" });
    const first = wb.SheetNames[0];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], {
      defval: "",
    });
  } else {
    throw new Error("Invalid file type. Use .xlsx, .xls or .csv");
  }

  const mapped = rawRows.map((row, index) => mapRow(row, index + 2));
  const errors: UploadError[] = [];
  const validRows: ParsedRow[] = [];
  const seen = new Set<string>();
  let duplicateRows = 0;

  for (const row of mapped) {
    if (!row.name) {
      errors.push({ rowNumber: row.rowNumber, reason: "Name is required" });
      continue;
    }

    if (row.email && !emailSchema.safeParse(row.email).success) {
      errors.push({ rowNumber: row.rowNumber, reason: "Invalid email format" });
      continue;
    }

    const key = `${row.name.toLowerCase()}|${row.email?.toLowerCase() ?? ""}|${row.phone ?? ""}`;
    if (seen.has(key)) {
      duplicateRows += 1;
      errors.push({ rowNumber: row.rowNumber, reason: "Duplicate row in uploaded file" });
      continue;
    }

    seen.add(key);
    validRows.push(row);
  }

  return {
    rows: validRows,
    errors,
    totalRows: rawRows.length,
    duplicateRows,
  };
}

function mapRow(raw: Record<string, unknown>, rowNumber: number): ParsedRow {
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key.toLowerCase().trim(), String(value ?? "").trim()]),
  );

  const name = getValue(normalized, aliases.name);
  const phone = cleanPhone(getValue(normalized, aliases.phone));
  const email = getValue(normalized, aliases.email)?.toLowerCase();

  return {
    rowNumber,
    name: name ?? "",
    phone,
    email,
    company: getValue(normalized, aliases.company),
    designation: getValue(normalized, aliases.designation),
    category: getValue(normalized, aliases.category),
    notes: getValue(normalized, aliases.notes),
  };
}

function getValue(
  row: Record<string, string>,
  validKeys: readonly string[],
): string | undefined {
  for (const key of validKeys) {
    const value = row[key];
    if (value) return value;
  }
  return undefined;
}

function cleanPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || undefined;
}
