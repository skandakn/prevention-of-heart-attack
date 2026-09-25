import fs from "fs";
import path from "path";
import {
  createEmptyPatientRecord,
  PatientRecord,
  PatientRecordUpdate,
} from "@/lib/patient-record";

export interface UserSubscription {
  userId: string;
  subscriptionStatus: "active" | "inactive" | "pending" | "cancelled";
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  subscriptionPlan: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "subscriptions.json");

// Initial default state
const defaultState: Record<string, UserSubscription> = {
  "demo-user-1": {
    userId: "demo-user-1",
    subscriptionStatus: "inactive",
    subscriptionPlan: "Free",
    updatedAt: new Date().toISOString(),
  },
};

function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating data directory:", err);
  }
}

const PREMIUM_ACCOUNTS = [
  "skandakn13@gmail.com",
  "schiru330@gmail.com",
];

function isWhitelistedUser(userId?: string): boolean {
  if (!userId) return false;
  const lower = userId.toLowerCase();
  return (
    PREMIUM_ACCOUNTS.some((email) => lower === email.toLowerCase()) ||
    lower.includes("skandakn13") ||
    lower.includes("schiru330")
  );
}

export function getSubscription(userId: string = "demo-user-1"): UserSubscription {
  if (isWhitelistedUser(userId)) {
    return {
      userId,
      subscriptionStatus: "active",
      subscriptionPlan: "Pro (Competition Access)",
      updatedAt: new Date().toISOString(),
    };
  }

  ensureDirectoryExists();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const fileData = fs.readFileSync(STORE_FILE, "utf-8");
      const store = JSON.parse(fileData);
      return store[userId] || {
        userId,
        subscriptionStatus: "inactive",
        subscriptionPlan: "Free",
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("Error reading subscription store:", err);
  }
  return defaultState[userId] || {
    userId,
    subscriptionStatus: "inactive",
    subscriptionPlan: "Free",
    updatedAt: new Date().toISOString(),
  };
}

export function updateSubscription(userId: string = "demo-user-1", updates: Partial<UserSubscription>): UserSubscription {
  ensureDirectoryExists();
  let store: Record<string, UserSubscription> = {};
  try {
    if (fs.existsSync(STORE_FILE)) {
      const fileData = fs.readFileSync(STORE_FILE, "utf-8");
      store = JSON.parse(fileData);
    }
  } catch {
    store = {};
  }

  const current = store[userId] || {
    userId,
    subscriptionStatus: "inactive",
    subscriptionPlan: "Free",
    updatedAt: new Date().toISOString(),
  };

  const updated: UserSubscription = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  store[userId] = updated;

  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing subscription store:", err);
  }

  return updated;
}
const PATIENT_RECORD_FILE = path.join(DATA_DIR, "patient-records.json");
export function getPatientRecord(userId = "demo-user-1"): PatientRecord {
  ensureDirectoryExists();
  try {
    const records: Record<string, PatientRecord> = fs.existsSync(PATIENT_RECORD_FILE)
      ? JSON.parse(fs.readFileSync(PATIENT_RECORD_FILE, "utf-8")) : {};
    return records[userId] || createEmptyPatientRecord(userId);
  } catch {
    return createEmptyPatientRecord(userId);
  }
}
export function updatePatientRecord(userId: string, updates: PatientRecordUpdate): PatientRecord {
  ensureDirectoryExists();
  let records: Record<string, PatientRecord> = {};
  try {
    if (fs.existsSync(PATIENT_RECORD_FILE)) records = JSON.parse(fs.readFileSync(PATIENT_RECORD_FILE, "utf-8"));
  } catch {
    records = {};
  }
  const current = records[userId] || createEmptyPatientRecord(userId);
  const record: PatientRecord = { ...current, ...updates, userId, updatedAt: new Date().toISOString() };
  records[userId] = record;
  fs.writeFileSync(PATIENT_RECORD_FILE, JSON.stringify(records, null, 2), "utf-8");
  return record;
}
