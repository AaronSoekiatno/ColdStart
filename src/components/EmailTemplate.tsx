import hermesLogo from "@/assets/hermes-logo.png";

const EmailTemplate = () => {
  return (
    <div className="min-h-screen bg-email-bg py-8 px-4 font-sans">
      {/* Email Container */}
      <div className="mx-auto max-w-[600px] overflow-hidden rounded-2xl bg-email-card shadow-2xl">
        
        {/* Header with Logo */}
        <div className="relative bg-gradient-to-br from-email-card via-email-bg to-email-card px-8 py-12 text-center">
          <div className="absolute inset-0 opacity-20" 
               style={{
                 background: "radial-gradient(ellipse at center, hsl(40 90% 55% / 0.3) 0%, transparent 70%)"
               }} 
          />
          <div className="relative">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-email-bg p-2 shadow-lg ring-1 ring-email-border">
              <img 
                src={hermesLogo} 
                alt="Hermes Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-email-text">
              Hermes
            </h1>
            <p className="mt-2 text-sm uppercase tracking-[0.3em] text-email-gold">
              Is Now Live
            </p>
          </div>
        </div>

        {/* Decorative Line */}
        <div className="flex items-center justify-center gap-4 bg-email-bg/50 px-8 py-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-email-gold/50 to-transparent" />
          <div className="h-2 w-2 rotate-45 bg-email-gold" />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-email-gold/50 to-transparent" />
        </div>

        {/* Main Content */}
        <div className="px-8 py-10">
          <p className="text-center text-lg leading-relaxed text-email-text">
            We're thrilled to announce that <span className="font-semibold text-email-gold">Hermes</span> has officially launched! After months of development, we're excited to bring you a powerful new way to communicate and collaborate.
          </p>

          {/* Features Section */}
          <div className="mt-10">
            <h2 className="mb-6 text-center font-display text-2xl font-medium text-email-text">
              What's Inside
            </h2>
            
            <div className="space-y-4">
              {/* Feature 1 */}
              <div className="group rounded-xl border border-email-border bg-email-bg/40 p-5 transition-all hover:border-email-gold/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-email-gold/10 text-email-gold">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-email-text">Lightning-Fast Messaging</h3>
                    <p className="mt-1 text-sm leading-relaxed text-email-text-muted">
                      Experience real-time communication with zero latency. Your messages arrive instantly, every time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group rounded-xl border border-email-border bg-email-bg/40 p-5 transition-all hover:border-email-gold/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-email-gold/10 text-email-gold">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-email-text">End-to-End Encryption</h3>
                    <p className="mt-1 text-sm leading-relaxed text-email-text-muted">
                      Your privacy matters. Every conversation is protected with military-grade encryption.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group rounded-xl border border-email-border bg-email-bg/40 p-5 transition-all hover:border-email-gold/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-email-gold/10 text-email-gold">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-email-text">Team Collaboration</h3>
                    <p className="mt-1 text-sm leading-relaxed text-email-text-muted">
                      Create channels, share files, and work together seamlessly with built-in collaboration tools.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="group rounded-xl border border-email-border bg-email-bg/40 p-5 transition-all hover:border-email-gold/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-email-gold/10 text-email-gold">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-email-text">Cross-Platform Sync</h3>
                    <p className="mt-1 text-sm leading-relaxed text-email-text-muted">
                      Access your conversations from any device. Desktop, mobile, or web — it's all synchronized.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-10 text-center">
            <a 
              href="#" 
              className="inline-block rounded-full bg-gradient-to-r from-email-gold to-email-gold-soft px-10 py-4 font-semibold text-email-bg shadow-lg shadow-email-gold/25 transition-all hover:shadow-xl hover:shadow-email-gold/30"
            >
              Get Started Now
            </a>
            <p className="mt-4 text-sm text-email-text-muted">
              Free to use • No credit card required
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-email-border bg-email-bg/60 px-8 py-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-email-bg">
              <img 
                src={hermesLogo} 
                alt="Hermes" 
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-sm text-email-text-muted">
              © 2024 Hermes. All rights reserved.
            </p>
            <div className="mt-4 flex justify-center gap-6">
              <a href="#" className="text-xs text-email-text-muted transition-colors hover:text-email-gold">
                Privacy Policy
              </a>
              <a href="#" className="text-xs text-email-text-muted transition-colors hover:text-email-gold">
                Terms of Service
              </a>
              <a href="#" className="text-xs text-email-text-muted transition-colors hover:text-email-gold">
                Unsubscribe
              </a>
            </div>
            <p className="mt-6 text-xs text-email-text-muted/60">
              You're receiving this email because you signed up for Hermes updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplate;
