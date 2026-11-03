import tls from "node:tls";

const DEFAULT_FROM_EMAIL = process.env.SMTP_USER || "wavethesage@gmail.com";

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_PASS || process.env.RESEND_API_KEY);
}

/**
 * Minimal, dependency-free SMTPS (port 465 implicit TLS) client for Gmail / standard SMTP
 * plus optional Resend HTTP API support.
 */
export async function sendOtpEmail(opts: {
  to: string;
  code: string;
  purpose: "signup" | "reset";
}): Promise<void> {
  const subject =
    opts.purpose === "signup"
      ? `${opts.code} is your Sagewave verification code`
      : `${opts.code} is your Sagewave password reset code`;

  const heading =
    opts.purpose === "signup"
      ? "Verify your Sagewave Studio email"
      : "Reset your Sagewave Studio password";

  const subtext =
    opts.purpose === "signup"
      ? "Enter this 6-digit code on Sagewave to complete your account registration:"
      : "Enter this 6-digit code on Sagewave to choose a new password for your account:";

  const html = `
    <div style="font-family: Georgia, serif; background: #f3ecdc; padding: 36px 20px; color: #26291f;">
      <div style="max-width: 460px; margin: 0 auto; background: #fbf7ee; border: 1px solid rgba(29,58,42,0.18); border-radius: 20px; padding: 32px 28px;">
        <div style="font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #4d7a5a; font-family: sans-serif; font-weight: 600;">
          Sagewave Audio Studio
        </div>
        <h2 style="color: #1d3a2a; margin: 10px 0 12px; font-weight: 600; font-size: 22px;">
          ${heading}
        </h2>
        <p style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #6d6b5e; margin: 0 0 20px;">
          ${subtext}
        </p>
        <div style="background: #f3ecdc; border: 1.5px solid rgba(29,58,42,0.22); border-radius: 14px; padding: 16px; text-align: center; font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #1d3a2a;">
          ${opts.code}
        </div>
        <p style="font-family: sans-serif; font-size: 12px; color: #6d6b5e; margin: 20px 0 0; line-height: 1.5;">
          This code expires in 10 minutes. If you did not request this code, you can safely ignore this email.
        </p>
      </div>
    </div>
  `.trim();

  const text = `${heading}\n\n${subtext}\n\nCode: ${opts.code}\n\nThis code expires in 10 minutes.`;

  // 1) If Resend API key is configured, send via HTTPS
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Sagewave Studio <onboarding@resend.dev>",
        to: [opts.to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Email service error (${res.status}).`);
    }
    return;
  }

  // 2) Send via Gmail SMTPS (smtp.gmail.com:465) using SMTP_USER + SMTP_PASS
  const user = DEFAULT_FROM_EMAIL;
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!pass) {
    throw new Error("Email verification server is not configured yet. Please use 'Continue with Google' to sign in.");
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);

  await sendViaSmtps({
    host,
    port,
    user,
    pass,
    from: `Sagewave Studio <${user}>`,
    to: opts.to,
    subject,
    html,
  });
}

function sendViaSmtps(cfg: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: true },
      () => {
        /* connected */
      }
    );

    socket.setTimeout(15000);
    let buffer = "";
    let step = 0;

    const commands = [
      `EHLO sagewave.in`,
      `AUTH LOGIN`,
      Buffer.from(cfg.user, "utf8").toString("base64"),
      Buffer.from(cfg.pass, "utf8").toString("base64"),
      `MAIL FROM:<${cfg.user}>`,
      `RCPT TO:<${cfg.to}>`,
      `DATA`,
      [
        `From: ${cfg.from}`,
        `To: <${cfg.to}>`,
        `Subject: =?UTF-8?B?${Buffer.from(cfg.subject, "utf8").toString("base64")}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        Buffer.from(cfg.html, "utf8").toString("base64"),
        `.`,
      ].join("\r\n"),
      `QUIT`,
    ];

    const fail = (msg: string) => {
      try {
        socket.destroy();
      } catch {}
      reject(new Error(msg));
    };

    socket.on("timeout", () => fail("SMTP connection timed out."));
    socket.on("error", (err) => fail(`SMTP error: ${err.message}`));

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) continue;
        // Multi-line response continues with '-' at index 3 (e.g. "250-...")
        if (line.length >= 4 && line[3] === "-") continue;

        const code = parseInt(line.slice(0, 3), 10);
        if (code >= 400) {
          return fail(`Email delivery failed (${line}).`);
        }

        if (step < commands.length) {
          const cmd = commands[step++];
          socket.write(cmd + "\r\n");
        } else {
          socket.end();
          resolve();
        }
      }
    });
  });
}
