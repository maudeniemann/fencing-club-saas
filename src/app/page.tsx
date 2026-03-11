import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TryDemoButton } from "@/components/demo/try-demo-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary"
            >
              <path d="M14.5 2l6 6-8 8-6-6z" />
              <path d="M9 12l-5 5" />
              <path d="M4 17l-1 5 5-1" />
            </svg>
            <span className="text-lg font-bold tracking-tight">
              Fencing Club Manager
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              How It Works
            </Link>
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log In
            </Link>
            <Link
              href="#get-started"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
            Run Your Fencing Club
            <br />
            <span className="text-primary">Like a Pro</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Scheduling, payments, lesson tracking, and club management — all in
            one place. Built for coaches, players, and club administrators.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#get-started"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full sm:w-auto"
            >
              Start Free
            </Link>
            <TryDemoButton />
            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-base font-medium hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-auto"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Get Started — Role Selection */}
      <section id="get-started" className="py-20 sm:py-28 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              How Will You Use the Platform?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Select your role to get started. You can always change this later.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Link
              href="/auth/login?role=admin"
              className="group rounded-xl border-2 border-border bg-white p-6 text-center space-y-3 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 p-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold">Club Admin</h3>
              <p className="text-sm text-muted-foreground">
                Create or join a club as an administrator
              </p>
              <div className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground group-hover:bg-primary/90 transition-colors">
                Get Started
              </div>
            </Link>
            <Link
              href="/auth/login?role=coach"
              className="group rounded-xl border-2 border-border bg-white p-6 text-center space-y-3 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 p-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="M14.5 2l6 6-8 8-6-6z" />
                  <path d="M9 12l-5 5" />
                  <path d="M4 17l-1 5 5-1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold">Coach</h3>
              <p className="text-sm text-muted-foreground">
                Join a club to teach and manage lessons
              </p>
              <div className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground group-hover:bg-primary/90 transition-colors">
                Get Started
              </div>
            </Link>
            <Link
              href="/auth/login?role=player"
              className="group rounded-xl border-2 border-border bg-white p-6 text-center space-y-3 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 p-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold">Player</h3>
              <p className="text-sm text-muted-foreground">
                Join a club to book lessons and track progress
              </p>
              <div className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground group-hover:bg-primary/90 transition-colors">
                Get Started
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything Your Club Needs
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              From scheduling to payments, manage every aspect of your fencing
              club with ease.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              }
              title="Smart Scheduling"
              description="Coaches set their availability, players book instantly. Conflict detection prevents double-bookings automatically."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              }
              title="Integrated Payments"
              description="Collect lesson fees automatically via Stripe. Handle cancellations, refunds, and no-show charges seamlessly."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Coach Management"
              description="Manage coach profiles, set commission rates, calculate payouts, and track earnings — all from one dashboard."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              title="Lesson Logs"
              description="Coaches log drills, focus areas, bout scores, and notes after each lesson. Players track their progress over time."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M16 3h5v5" />
                  <path d="M8 3H3v5" />
                  <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
                  <path d="m15 9 6-6" />
                </svg>
              }
              title="Waitlist & Backfill"
              description="When a slot cancels, the next player on the waitlist gets notified automatically. No more empty slots."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <line x1="12" x2="12" y1="20" y2="10" />
                  <line x1="18" x2="18" y1="20" y2="4" />
                  <line x1="6" x2="6" y1="20" y2="16" />
                </svg>
              }
              title="Revenue Analytics"
              description="Track revenue, booking trends, and coach performance with real-time dashboards and reports."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for Every Role
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you run the club, teach, or train — we&apos;ve got you covered.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <RoleCard
              role="Club Admin"
              items={[
                "Create your club in seconds",
                "Manage members and coaches",
                "Configure venues and lesson types",
                "Connect Stripe for payments",
                "Track revenue and payouts",
                "Resolve disputes",
              ]}
            />
            <RoleCard
              role="Coach"
              items={[
                "Set your weekly availability",
                "Receive instant booking notifications",
                "Log lessons with detailed notes",
                "Track earnings and forecasts",
                "Message students directly",
                "Manage your profile and specialties",
              ]}
            />
            <RoleCard
              role="Player"
              items={[
                "Browse coaches and book lessons",
                "Pay securely with saved cards",
                "View lesson history and logs",
                "Track your fencing progress",
                "Join waitlists for full slots",
                "Message your coaches",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to Modernize Your Club?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Join clubs that have streamlined their operations with Fencing Club
            Manager. Get started in under 5 minutes.
          </p>
          <div className="mt-8">
            <Link
              href="#get-started"
              className="inline-flex items-center justify-center rounded-md bg-white text-primary px-8 py-3 text-base font-medium hover:bg-white/90 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-primary"
              >
                <path d="M14.5 2l6 6-8 8-6-6z" />
                <path d="M9 12l-5 5" />
                <path d="M4 17l-1 5 5-1" />
              </svg>
              <span className="text-sm font-semibold">Fencing Club Manager</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Fencing Club Manager. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-3">
      <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function RoleCard({ role, items }: { role: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h3 className="text-xl font-bold text-center">{role}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-green-600 mt-0.5 shrink-0"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
