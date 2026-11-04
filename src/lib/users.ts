import crypto from "node:crypto";
import dns from "node:dns/promises";
import { kvGet, kvSet } from "./store";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface OtpEntry {
  codeHash: string;
  purpose: "signup" | "reset";
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

const DISPOSABLE_DOMAINS = new Set([
  "yopmail.com",
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "sharklasers.com",
  "trashmail.com",
  "maildrop.cc",
  "getnada.com",
  "mohmal.com",
  "dispostable.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "mailnesia.com",
  "mintemail.com",
  "mytemp.email",
  "emailondeck.com",
  "burnermail.io",
  "inboxkitten.com",
]);

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmal.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "hotmial.com": "hotmail.com",
  "iclod.com": "icloud.com",
};

/**
 * Validates that an email has a realistic username/domain structure, is not a known typo
 * or disposable email provider, and has live DNS MX mail servers capable of receiving mail.
 */
export async function validateDeliverableEmail(rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  if (email.length > 160) {
    throw new Error("Please enter a valid email address.");
  }

  // Require at least 2 chars before @, at least 2 chars in domain label, and a real 2+ letter TLD
  const match = /^([a-z0-9._%+-]{2,})@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,12}))$/.exec(email);
  if (!match) {
    throw new Error(
      "Please enter a complete, valid email address (for example, yourname@gmail.com)."
    );
  }

  const [, localPart, domain, tld] = match;
  const hostLabel = domain.split(".")[0] || "";
  if (hostLabel.length < 2 || tld.length < 2) {
    throw new Error("That email domain is invalid. Please enter a real email address.");
  }
  if (/^([a-z0-9])\1+$/.test(localPart) && localPart.length <= 2) {
    // allow normal 2-letter initials if domain is valid, checked via MX below
  }

  if (DOMAIN_TYPOS[domain]) {
    throw new Error(`Did you mean @${DOMAIN_TYPOS[domain]}? Please check your email spelling.`);
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new Error("Temporary or disposable email addresses are not allowed. Please use your personal or work email.");
  }

  // Live DNS MX check so fake domains like r@g.c or user@fake123.com are rejected immediately
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0 || !mx.some((r) => r.exchange && r.exchange.length > 1)) {
      throw new Error("NO_MX");
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (
      (err as Error).message === "NO_MX" ||
      code === "ENOTFOUND" ||
      code === "ENODATA" ||
      code === "ESERVFAIL" ||
      code === "EBADNAME"
    ) {
      throw new Error(
        `The domain "@${domain}" cannot receive emails. Please enter a real, active email address.`
      );
    }
    // If local sandbox DNS is offline during dev, still block suspicious short domains (< 4 chars before TLD)
    if (hostLabel.length < 3) {
      throw new Error(`The domain "@${domain}" is not a valid email provider.`);
    }
  }

  return email;
}

async function readUsers(): Promise<StoredUser[]> {
  return kvGet<StoredUser[]>("users", []);
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await kvSet("users", users);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function findUserByEmail(emailInput: string): Promise<StoredUser | undefined> {
  const email = emailInput.trim().toLowerCase();
  const users = await readUsers();
  return users.find((u) => u.email === email);
}

export function generateEmailOtp(emailInput: string, purpose: "signup" | "reset"): string {
  const email = emailInput.trim().toLowerCase();
  const code = String(crypto.randomInt(100000, 999999));
  otpStore.set(`${purpose}:${email}`, {
    codeHash: hashOtp(code),
    purpose,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  return code;
}

export function verifyEmailOtp(emailInput: string, purpose: "signup" | "reset", codeInput: string): void {
  const email = emailInput.trim().toLowerCase();
  const key = `${purpose}:${email}`;
  const entry = otpStore.get(key);

  if (!entry || Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    throw new Error("Verification code has expired or was not requested. Please request a new 6-digit code.");
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(key);
    throw new Error("Too many incorrect code attempts. Please request a new 6-digit code.");
  }

  const cleanCode = codeInput.trim();
  const a = Buffer.from(hashOtp(cleanCode), "hex");
  const b = Buffer.from(entry.codeHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    otpStore.set(key, entry);
    throw new Error("Incorrect 6-digit verification code. Please check your email and try again.");
  }

  otpStore.delete(key);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; name: string; email: string }> {
  const name = input.name.trim();
  const password = input.password;

  if (!name || name.length < 2 || name.length > 80) {
    throw new Error("Please enter your full name (2–80 characters).");
  }
  const email = await validateDeliverableEmail(input.email);

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
    throw new Error("No account found with this email. Please create an account or sign in with Google.");
  }

  const computed = hashPassword(passwordInput, user.salt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Incorrect password. Please try again or click 'Forgot password?'.");
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function resetUserPassword(input: {
  email: string;
  newPassword: string;
  nameFallback?: string;
}): Promise<{ id: string; name: string; email: string }> {
  const email = await validateDeliverableEmail(input.email);
  const newPassword = input.newPassword;
  if (newPassword.length < 6 || newPassword.length > 128) {
    throw new Error("New password must be between 6 and 128 characters long.");
  }

  const users = await readUsers();
  const idx = users.findIndex((u) => u.email === email);
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(newPassword, salt);

  if (idx === -1) {
    // If user previously only used Google Sign-In and now sets a password, create their password entry
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: input.nameFallback || email.split("@")[0],
      email,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await writeUsers(users);
    return { id: newUser.id, name: newUser.name, email: newUser.email };
  }

  users[idx].salt = salt;
  users[idx].passwordHash = passwordHash;
  await writeUsers(users);
  return { id: users[idx].id, name: users[idx].name, email: users[idx].email };
}
