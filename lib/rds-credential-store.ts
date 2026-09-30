import fs from "fs";
import path from "path";

const CREDENTIALS_FILE = path.join(process.cwd(), "data", "rds-credentials.json");

/**
 * Retrieves the stored master password for an RDS instance identifier.
 * Returns default "postgres" if none was saved.
 */
export function getRdsPassword(identifier: string): string {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
      if (data && typeof data === "object" && data[identifier]) {
        return String(data[identifier]);
      }
    }
  } catch {
    // Return default fallback on read failure
  }
  return "postgres";
}

/**
 * Persists the master password locally for an RDS instance identifier.
 */
export function saveRdsPassword(identifier: string, password: string): void {
  try {
    const dir = path.dirname(CREDENTIALS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let data: Record<string, string> = {};
    if (fs.existsSync(CREDENTIALS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
      } catch {
        data = {};
      }
    }
    data[identifier] = password;
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore write errors
  }
}

/**
 * Deletes stored credentials for a deleted RDS instance.
 */
export function deleteRdsPassword(identifier: string): void {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
      delete data[identifier];
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch {
    // Ignore delete errors
  }
}
