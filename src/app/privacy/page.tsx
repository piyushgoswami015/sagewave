export const metadata = {
  title: "Privacy Policy · Sagewave Studio",
  description: "How Sagewave handles Google Sign-In, temporary audio files, cookies, and advertising privacy.",
};

export default function PrivacyPage() {
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container" style={{ maxWidth: 820 }}>
        <span className="eyebrow">Privacy & Data Protection</span>
        <h1 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", margin: "14px 0 18px" }}>
          Privacy <em className="serif">Policy</em>
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 32 }}>
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="panel" style={{ display: "grid", gap: 26, lineHeight: 1.7 }}>
          <div>
            <h3>1. Information We Collect</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              When you choose to sign in with Google OAuth, we receive your basic profile information (name, email
              address, and profile picture URL) solely to display your active session in the navigation bar. We do not
              sell, rent, or share your personal information with third parties.
            </p>
          </div>

          <div>
            <h3>2. Temporary Media & Audio Files</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Audio files uploaded for stem separation and media streams processed through our creator utilities are
              stored in an isolated temporary directory (`sagewave-jobs`) using a random UUID. Files are never publicly
              indexed and are automatically deleted by our background cleanup sweep after 60 minutes.
            </p>
          </div>

          <div>
            <h3>3. Cookies & Google AdSense</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              We use essential session cookies (`next-auth.session-token`) to keep you signed in. When advertising is
              enabled, third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits
              to this website or other websites. Google’s use of advertising cookies enables it and its partners to
              serve ads to users based on their visit to our site and/or other sites on the Internet. Users may opt out
              of personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "underline", color: "var(--forest)" }}
              >
                Google Ads Settings
              </a>.
            </p>
          </div>

          <div>
            <h3>4. Data Security & Contact</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              All communication between your browser and Sagewave is encrypted over HTTPS in production, and file
              access tokens use cryptographically random UUIDs. For privacy inquiries or data deletion requests,
              contact <a href="mailto:wavethesage@gmail.com" style={{ textDecoration: "underline", color: "var(--forest)", fontWeight: 600 }}>wavethesage@gmail.com</a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
