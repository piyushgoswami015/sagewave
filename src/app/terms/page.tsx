import Link from "next/link";

export const metadata = {
  title: "Terms of Service & DMCA Policy · Sagewave Studio",
  description: "Terms of Use, Creator Rights Affirmation, and DMCA Copyright Takedown Policy for Sagewave Audio Studio.",
};

export default function TermsPage() {
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container" style={{ maxWidth: 820 }}>
        <span className="eyebrow">Legal & Compliance</span>
        <h1 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", margin: "14px 0 18px" }}>
          Terms of Service & <em className="serif">DMCA Policy</em>
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 32 }}>
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="panel" style={{ display: "grid", gap: 26, lineHeight: 1.7 }}>
          <div>
            <h3>1. Purpose of Sagewave Audio Studio</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Sagewave provides browser-based audio engineering, neural stem separation, and personal media archiving
              utilities for musicians, podcasters, educators, and digital creators. Our tools are designed strictly for
              processing original recordings, backing up your own published social clips, or working with royalty-free,
              Creative Commons, or properly licensed media.
            </p>
          </div>

          <div>
            <h3>2. User Rights & Copyright Responsibility</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              By submitting any audio file or URL to Sagewave, you represent and warrant that: (a) you are the creator
              and copyright owner of the content, or (b) you have obtained express authorization from the rights holder
              or operate under a valid license or statutory exception. You agree not to use Sagewave to infringe the
              intellectual property rights of any third party or violate the terms of any third-party platform.
            </p>
          </div>

          <div>
            <h3>3. Ephemeral Processing (Zero Permanent Hosting)</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Sagewave is a transient processing utility, not a content hosting network or public file-sharing database.
              All uploaded audio files, transcoded MP3s, MP4 backups, and separated stems are stored in isolated,
              non-public temporary directories and are automatically deleted from our servers within 60 minutes.
            </p>
          </div>

          <div>
            <h3>4. DMCA Notice & Copyright Takedown Procedure</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Sagewave respects intellectual property rights and complies with the Digital Millennium Copyright Act
              (17 U.S.C. § 512). Although processed files expire automatically within 60 minutes and are never publicly
              listed, copyright owners may request immediate removal or blocklisting of specific URLs by sending a
              written notice containing:
            </p>
            <ul style={{ color: "var(--muted)", marginTop: 10, paddingLeft: 20, display: "grid", gap: 6 }}>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>The exact source URL or job identifier in question.</li>
              <li>Your contact information (name, organization, email address, and phone number).</li>
              <li>A statement of good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, under penalty of perjury, that the information in the notice is accurate and that you are authorized to act on behalf of the owner.</li>
            </ul>
            <p style={{ color: "var(--muted)", marginTop: 10 }}>
              Send DMCA notices to: <a href="mailto:wavethesage@gmail.com" style={{ textDecoration: "underline", color: "var(--forest)", fontWeight: 600 }}>wavethesage@gmail.com</a> (or via our{" "}
              <Link href="/about" style={{ textDecoration: "underline", color: "var(--forest)" }}>About & Contact</Link> page).
            </p>
          </div>

          <div>
            <h3>5. Disclaimer of Warranties</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Sagewave is provided on an “as-is” and “as-available” basis without warranties of any kind. Users assume
              full legal responsibility for how they use exported audio and video files.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
