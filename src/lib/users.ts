import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; name: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;

  if (!name || name.length < 2 || name.length > 80) {
    throw new Error("Please enter your full name (2–80 characters).");
  }
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (password.length < 6 || password.length > 128) {
    throw new Error("Password must be between 6 and 128 characters long.");
  }

  const users = await readUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);
  return { id: newUser.id, name: newUser.name, email: newUser.email };
}

export async function verifyUserCredentials(
  emailInput: string,
  passwordInput: string
): Promise<{ id: string; name: string; email: string }> {
  const email = emailInput.trim().toLowerCase();
  if (email.length > 160 || passwordInput.length > 128) {
    throw new Error("Invalid credentials.");
  }
  const users = await readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    throw new Error("No account found with this email. Please create an account first.");
  }

  const computed = hashPassword(passwordInput, user.salt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Incorrect password. Please try again.");
  }

  return { id: user.id, name: user.name, email: user.email };
}
