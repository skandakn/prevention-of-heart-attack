import fs from "fs";
import path from "path";

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

export function getSubscription(userId: string = "demo-user-1"): UserSubscription {
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
