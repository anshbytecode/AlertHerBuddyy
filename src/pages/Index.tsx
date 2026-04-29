import { Link } from "react-router-dom";
import { Shield, Bell, MapPin, Users, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  { icon: Shield, title: "One-Tap SOS", desc: "Instantly alert your circle with your live location when you need help." },
  { icon: Sparkles, title: "AI Threat Detection", desc: "Paste a message and let AI flag harassment, threats, or coercion in seconds." },
  { icon: Users, title: "Trusted Contacts", desc: "Curate the people who get notified the moment something feels wrong." },
  { icon: MapPin, title: "Live Location", desc: "Share your precise location with one tap — only your contacts can see it." },
  { icon: Bell, title: "Alert History", desc: "Every alert is logged with severity, AI analysis, and timestamps." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-gradient">AlertHer</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild variant="hero">
            <Link to="/auth">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{ backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          aria-hidden
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/40 via-background/70 to-background" aria-hidden />
        <div className="container py-24 md:py-32 text-center max-w-3xl mx-auto animate-float-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-4 py-1.5 text-sm text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Smart monitoring for personal safety
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your safety, <span className="text-gradient">always one tap away</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            AlertHer combines AI-powered threat detection, live location sharing, and trusted-contact alerts into one calm, beautiful safety companion.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/auth">
                Start protecting yourself <ArrowRight className="ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <a href="#features">See features</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for the moments that matter</h2>
          <p className="text-muted-foreground">Every feature is designed to be fast, private, and reassuring.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-glow transition-shadow"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-hero flex items-center justify-center mb-4">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-3xl bg-gradient-hero p-12 text-center text-primary-foreground shadow-glow">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Feel safer, starting tonight</h2>
          <p className="opacity-90 mb-8 max-w-xl mx-auto">Set up your trusted contacts in under a minute.</p>
          <Button asChild size="xl" variant="secondary">
            <Link to="/auth">Create your free account</Link>
          </Button>
        </div>
      </section>

      <footer className="container py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AlertHer · Smart Monitoring System
      </footer>
    </div>
  );
};

export default Index;
