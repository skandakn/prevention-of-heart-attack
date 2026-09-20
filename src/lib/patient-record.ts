export const BIOLOGICAL_SEX_OPTIONS = [
  "female",
  "male",
  "intersex",
  "prefer_not_to_say",
] as const;

export type BiologicalSex = (typeof BIOLOGICAL_SEX_OPTIONS)[number] | "";

export interface PatientRecord {
  userId: string;
  createdAt: string;
  updatedAt: string;
  dateOfBirth: string;
  biologicalSex: BiologicalSex;
  heightCm: number | null;
  weightKg: number | null;
  conditions: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  primaryCarePhysician: string;
  notes: string;
}

export type PatientRecordUpdate = Omit<PatientRecord, "userId" | "createdAt" | "updatedAt">;

const MAX_LIST_ITEMS = 30;
const MAX_LIST_ITEM_LENGTH = 120;
const MAX_TEXT_LENGTH = 2_000;

export function createEmptyPatientRecord(userId: string, timestamp = new Date().toISOString()): PatientRecord {
  return {
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    dateOfBirth: "",
    biologicalSex: "",
    heightCm: null,
    weightKg: null,
    conditions: [],
    medications: [],
    allergies: [],
    familyHistory: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    primaryCarePhysician: "",
    notes: "",
  };
}

function optionalText(value: unknown, field: string, maxLength = MAX_TEXT_LENGTH): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} is too long.`);
  return normalized;
}

function stringList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw new Error(`${field} must contain no more than ${MAX_LIST_ITEMS} entries.`);
  }
  return value.map((item) => optionalText(item, field, MAX_LIST_ITEM_LENGTH)).filter(Boolean);
}

function optionalMeasurement(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 500) {
    throw new Error(`${field} must be a valid positive number.`);
  }
  return value;
}

export function validatePatientRecordUpdate(value: unknown): PatientRecordUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A patient record object is required.");
  }
  const input = value as Record<string, unknown>;
  const dateOfBirth = optionalText(input.dateOfBirth, "Date of birth", 10);
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new Error("Date of birth must use YYYY-MM-DD.");
  }
  const biologicalSex = optionalText(input.biologicalSex, "Biological sex", 20) as BiologicalSex;
  if (biologicalSex && !BIOLOGICAL_SEX_OPTIONS.includes(biologicalSex as Exclude<BiologicalSex, "">)) {
    throw new Error("Biological sex is invalid.");
  }

  return {
    dateOfBirth,
    biologicalSex,
    heightCm: optionalMeasurement(input.heightCm, "Height"),
    weightKg: optionalMeasurement(input.weightKg, "Weight"),
    conditions: stringList(input.conditions, "Conditions"),
    medications: stringList(input.medications, "Medications"),
    allergies: stringList(input.allergies, "Allergies"),
    familyHistory: optionalText(input.familyHistory, "Family history"),
    emergencyContactName: optionalText(input.emergencyContactName, "Emergency contact name", 120),
    emergencyContactPhone: optionalText(input.emergencyContactPhone, "Emergency contact phone", 50),
    primaryCarePhysician: optionalText(input.primaryCarePhysician, "Primary care physician", 120),
    notes: optionalText(input.notes, "Notes"),
  };
}

export function isSafePatientRecordUserId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !["__proto__", "constructor", "prototype"].includes(value);
}
