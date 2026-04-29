import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Plus, Trash2, MapPin, Sparkles, AlertTriangle, Phone,
  Camera, Smile, ShieldAlert, ShieldCheck, Navigation, Share2, Volume2, X, MapPinned,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Contact = { id: string; name: string; phone: string; relationship: string | null; priority: number };
type Alert = {
  id: string; alert_type: string; message: string | null;
  latitude: number | null; longitude: number | null;
  ai_analysis: any; severity: string | null; status: string;
  created_at: string; evidence_url?: string | null;
};
type Zone = {
  id: string; name: string; zone_type: "safe" | "danger";
  latitude: number; longitude: number; radius_m: number; notes: string | null;
};

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(20),
  relationship: z.string().trim().max(40).optional(),
});
const zoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  zone_type: z.enum(["safe", "danger"]),
  radius_m: z.coerce.number().int().min(20).max(5000),
  notes: z.string().trim().max(200).optional(),
});

const sevColor = (s?: string | null) => {
  if (s === "critical" || s === "high") return "bg-danger text-danger-foreground";
  if (s === "medium") return "bg-warn text-warn-foreground";
  if (s === "low" || s === "safe") return "bg-safe text-safe-foreground";
  return "bg-muted text-muted-foreground";
};

// Distance in meters between two coords (Haversine)
const distM = (a: GeolocationCoordinates, b: { latitude: number; longitude: number }) => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [livePos, setLivePos] = useState<GeolocationPosition | null>(null);
  const [zoneStatus, setZoneStatus] = useState<{ kind: "safe" | "danger" | "none"; name?: string }>({ kind: "none" });
  const [camOpen, setCamOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => { if (user) void loadAll(); }, [user]);

  // Live location watch
  useEffect(() => {
    if (!user || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setLivePos(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [user]);

  // Recompute zone status whenever pos or zones change
  useEffect(() => {
    if (!livePos) return setZoneStatus({ kind: "none" });
    const danger = zones.find((z) => z.zone_type === "danger" && distM(livePos.coords, z) <= z.radius_m);
    if (danger) {
      setZoneStatus({ kind: "danger", name: danger.name });
      return;
    }
    const safe = zones.find((z) => z.zone_type === "safe" && distM(livePos.coords, z) <= z.radius_m);
    setZoneStatus(safe ? { kind: "safe", name: safe.name } : { kind: "none" });
  }, [livePos, zones]);

  const loadAll = async () => {
    const [{ data: c }, { data: a }, { data: p }, { data: z }] = await Promise.all([
      supabase.from("emergency_contacts").select("*").order("priority"),
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
      supabase.from("safety_zones").select("*").order("created_at", { ascending: false }),
    ]);
    setContacts((c as Contact[]) ?? []);
    setAlerts((a as Alert[]) ?? []);
    setProfile(p ?? null);
    setZones((z as Zone[]) ?? []);
  };

  const addContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("emergency_contacts").insert({
      user_id: user!.id, name: parsed.data.name, phone: parsed.data.phone,
      relationship: parsed.data.relationship || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const removeContact = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const getLocation = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (livePos) return resolve(livePos);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p), () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });

  // ===== CAMERA =====
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      toast.error("Camera access denied");
    }
  };
  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  };
  const snap = async () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
    setPendingPhoto(blob);
    setPendingPreview(URL.createObjectURL(blob));
    closeCamera();
    toast.success("Photo captured — attach with next alert");
  };

  const uploadEvidence = async (): Promise<string | null> => {
    if (!pendingPhoto || !user) return null;
    const path = `${user.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("evidence").upload(path, pendingPhoto, {
      contentType: "image/jpeg", upsert: false,
    });
    if (error) { toast.error("Upload failed: " + error.message); return null; }
    return path;
  };

  // ===== ACTIONS =====
  const triggerSOS = async () => {
    if (contacts.length === 0) return toast.error("Add at least one emergency contact first");
    setSosBusy(true);
    const pos = await getLocation();
    const evidence = await uploadEvidence();
    const { error } = await supabase.from("alerts").insert({
      user_id: user!.id, alert_type: "sos",
      message: "SOS triggered from dashboard",
      severity: "critical",
      latitude: pos?.coords.latitude ?? null,
      longitude: pos?.coords.longitude ?? null,
      evidence_url: evidence,
    });
    setSosBusy(false);
    if (error) return toast.error(error.message);
    setPendingPhoto(null); setPendingPreview(null);
    toast.success(`SOS logged${pos ? " with location" : ""}. Notifying ${contacts.length} contact(s).`);
    loadAll();
  };

  const sendStatus = async (kind: "safe" | "unsafe" | "comfortable") => {
    const pos = await getLocation();
    const map: Record<string, { msg: string; sev: string; type: string }> = {
      safe: { msg: "I am safe ✅", sev: "safe", type: "status_safe" },
      unsafe: { msg: "I am UNSAFE — please check on me 🚨", sev: "high", type: "status_unsafe" },
      comfortable: { msg: "I feel comfortable 💜", sev: "low", type: "status_comfort" },
    };
    const m = map[kind];
    const evidence = kind === "unsafe" ? await uploadEvidence() : null;
    const { error } = await supabase.from("alerts").insert({
      user_id: user!.id, alert_type: m.type, message: m.msg, severity: m.sev,
      latitude: pos?.coords.latitude ?? null, longitude: pos?.coords.longitude ?? null,
      evidence_url: evidence,
    });
    if (error) return toast.error(error.message);
    if (evidence) { setPendingPhoto(null); setPendingPreview(null); }
    toast.success(`Sent: "${m.msg}"`);
    loadAll();
  };

  const shareLocation = async () => {
    const pos = await getLocation();
    if (!pos) return toast.error("Location unavailable");
    const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
    const text = `My current location: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: "AlertHer location", text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast.success("Location link copied");
  };

  const playSiren = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth"; o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.25;
      let t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        o.frequency.setValueAtTime(800, t);
        o.frequency.linearRampToValueAtTime(1500, t + 0.3);
        o.frequency.linearRampToValueAtTime(800, t + 0.6);
        t += 0.6;
      }
      o.start(); o.stop(t);
      toast.success("Siren activated");
    } catch { toast.error("Audio not supported"); }
  };

  const analyze = async () => {
    const text = analyzeText.trim();
    if (text.length < 3) return toast.error("Enter a message to analyze");
    if (text.length > 4000) return toast.error("Message too long");
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke("analyze-threat", { body: { message: text } });
    setAnalyzing(false);
    if (error) {
      const msg = (error as any).message || "AI analysis failed";
      if (msg.includes("429")) toast.error("Rate limit hit, wait a moment.");
      else if (msg.includes("402")) toast.error("AI credits exhausted.");
      else toast.error(msg);
      return;
    }
    if (data?.error) return toast.error(data.error);
    await supabase.from("alerts").insert({
      user_id: user!.id, alert_type: "threat", message: text,
      severity: data.severity, ai_analysis: data,
    });
    toast.success(`Analysis complete: ${data.severity.toUpperCase()}`);
    setAnalyzeText("");
    loadAll();
  };

  // ===== ZONES =====
  const addZone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = zoneSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const pos = await getLocation();
    if (!pos) return toast.error("Need current location to place zone");
    const { error } = await supabase.from("safety_zones").insert({
      user_id: user!.id,
      name: parsed.data.name, zone_type: parsed.data.zone_type,
      latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      radius_m: parsed.data.radius_m, notes: parsed.data.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`${parsed.data.zone_type === "danger" ? "Danger" : "Safe"} zone "${parsed.data.name}" added`);
    (e.target as HTMLFormElement).reset();
    loadAll();
  };

  const removeZone = async (id: string) => {
    const { error } = await supabase.from("safety_zones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setZones((p) => p.filter((z) => z.id !== id));
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const lat = livePos?.coords.latitude;
  const lon = livePos?.coords.longitude;
  const acc = livePos?.coords.accuracy;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-gradient">AlertHer</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Hi, {profile?.full_name || user.email}
          </span>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
            <LogOut /> Sign out
          </Button>
        </div>
      </header>

      {/* Live status banner */}
      <div className="container mb-4">
        <Card className={`p-4 flex items-center justify-between flex-wrap gap-3 border-2 ${
          zoneStatus.kind === "danger" ? "border-danger bg-danger/10" :
          zoneStatus.kind === "safe" ? "border-safe bg-safe/10" : "border-border"
        }`}>
          <div className="flex items-center gap-3">
            {zoneStatus.kind === "danger" ? <ShieldAlert className="h-6 w-6 text-danger" /> :
             zoneStatus.kind === "safe" ? <ShieldCheck className="h-6 w-6 text-safe" /> :
             <Navigation className="h-6 w-6 text-primary" />}
            <div>
              <div className="font-semibold">
                {zoneStatus.kind === "danger" && `⚠ Danger zone: ${zoneStatus.name}`}
                {zoneStatus.kind === "safe" && `✓ Safe zone: ${zoneStatus.name}`}
                {zoneStatus.kind === "none" && (livePos ? "Live tracking active" : "Awaiting location…")}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {lat != null ? `${lat.toFixed(6)}, ${lon!.toFixed(6)} · ±${Math.round(acc!)}m` : "—"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={shareLocation}><Share2 /> Share</Button>
            <Button variant="soft" size="sm" onClick={playSiren}><Volume2 /> Siren</Button>
          </div>
        </Card>
      </div>

      <main className="container pb-20 grid lg:grid-cols-3 gap-6">
        {/* SOS + Camera + quick status */}
        <Card className="lg:col-span-1 p-6 flex flex-col items-center text-center shadow-card animate-float-in">
          <h2 className="text-lg font-semibold mb-1">Emergency</h2>
          <p className="text-sm text-muted-foreground mb-4">One tap alerts contacts with your location & photo.</p>
          <button
            onClick={triggerSOS}
            disabled={sosBusy}
            className="h-32 w-32 rounded-full bg-gradient-sos text-primary-foreground font-bold text-2xl tracking-widest animate-pulse-sos disabled:opacity-60 transition-transform hover:scale-105 active:scale-95"
            aria-label="Trigger SOS"
          >
            {sosBusy ? "…" : "SOS"}
          </button>

          <div className="grid grid-cols-3 gap-2 w-full mt-6">
            <Button variant="soft" size="sm" onClick={() => sendStatus("safe")} className="flex-col h-auto py-3">
              <ShieldCheck className="text-safe" />
              <span className="text-xs mt-1">I'm safe</span>
            </Button>
            <Button variant="soft" size="sm" onClick={() => sendStatus("unsafe")} className="flex-col h-auto py-3">
              <ShieldAlert className="text-danger" />
              <span className="text-xs mt-1">I'm unsafe</span>
            </Button>
            <Button variant="soft" size="sm" onClick={() => sendStatus("comfortable")} className="flex-col h-auto py-3">
              <Smile className="text-primary" />
              <span className="text-xs mt-1">Comfortable</span>
            </Button>
          </div>

          <div className="w-full mt-4 border-t border-border pt-4">
            <Button variant="hero" className="w-full" onClick={openCamera}>
              <Camera /> Capture evidence
            </Button>
            {pendingPreview && (
              <div className="relative mt-3">
                <img src={pendingPreview} alt="Evidence" className="rounded-lg w-full" />
                <button
                  onClick={() => { setPendingPhoto(null); setPendingPreview(null); }}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1"
                  aria-label="Discard"
                ><X className="h-4 w-4" /></button>
                <p className="text-xs text-muted-foreground mt-1">Will attach to next alert</p>
              </div>
            )}
          </div>
        </Card>

        {/* AI threat detection */}
        <Card className="lg:col-span-2 p-6 shadow-card animate-float-in">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Threat Detection</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Paste a message — AI flags harassment, threats, coercion, or risky language.
          </p>
          <Textarea value={analyzeText} onChange={(e) => setAnalyzeText(e.target.value)}
            placeholder="Paste a message here…" rows={5} maxLength={4000} />
          <div className="flex justify-end mt-3">
            <Button variant="hero" onClick={analyze} disabled={analyzing}>
              {analyzing ? "Analyzing…" : "Analyze with AI"}
            </Button>
          </div>
        </Card>

        {/* Zones */}
        <Card className="lg:col-span-2 p-6 shadow-card animate-float-in">
          <div className="flex items-center gap-2 mb-4">
            <MapPinned className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Danger & Safe zones</h2>
          </div>
          <form onSubmit={addZone} className="grid sm:grid-cols-4 gap-3 mb-5">
            <div className="sm:col-span-2">
              <Label htmlFor="z-name">Zone name</Label>
              <Input id="z-name" name="name" placeholder="Home, Dark alley…" required />
            </div>
            <div>
              <Label htmlFor="z-type">Type</Label>
              <select id="z-type" name="zone_type" required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="safe">Safe</option>
                <option value="danger">Danger</option>
              </select>
            </div>
            <div>
              <Label htmlFor="z-rad">Radius (m)</Label>
              <Input id="z-rad" name="radius_m" type="number" defaultValue={200} min={20} max={5000} />
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="z-notes">Notes (optional)</Label>
              <Input id="z-notes" name="notes" placeholder="Why this zone matters…" />
            </div>
            <Button type="submit" variant="soft" className="sm:col-span-4">
              <Plus /> Add zone at my current location
            </Button>
          </form>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {zones.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No zones yet.</p>
            )}
            {zones.map((z) => {
              const here = livePos ? distM(livePos.coords, z) : null;
              const inside = here != null && here <= z.radius_m;
              return (
                <div key={z.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={z.zone_type === "danger" ? "bg-danger text-danger-foreground" : "bg-safe text-safe-foreground"}>
                        {z.zone_type}
                      </Badge>
                      <span className="font-medium">{z.name}</span>
                      {inside && <Badge className="bg-primary text-primary-foreground">You're here</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {z.latitude.toFixed(5)}, {z.longitude.toFixed(5)} · r={z.radius_m}m
                      {here != null && ` · ${Math.round(here)}m away`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <a href={`https://www.google.com/maps?q=${z.latitude},${z.longitude}`} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon"><MapPin /></Button>
                    </a>
                    <Button variant="ghost" size="icon" onClick={() => removeZone(z.id)} aria-label="Remove">
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Contacts */}
        <Card className="lg:col-span-1 p-6 shadow-card animate-float-in">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Trusted contacts</h2>
          </div>
          <form onSubmit={addContact} className="space-y-3 mb-5">
            <div><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" required /></div>
            <div><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" name="phone" type="tel" required /></div>
            <div><Label htmlFor="c-rel">Relationship (optional)</Label>
              <Input id="c-rel" name="relationship" placeholder="Mom, friend…" /></div>
            <Button type="submit" variant="soft" className="w-full"><Plus /> Add contact</Button>
          </form>
          <div className="space-y-2">
            {contacts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No contacts yet.</p>}
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone}{c.relationship ? ` · ${c.relationship}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeContact(c.id)} aria-label="Remove">
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Alert history */}
        <Card className="lg:col-span-3 p-6 shadow-card animate-float-in">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Alert history</h2>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No alerts yet. You're safe.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className={sevColor(a.severity)}>{a.severity ?? a.alert_type}</Badge>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{a.alert_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                {a.message && <p className="text-sm mb-2 line-clamp-3">{a.message}</p>}
                {a.ai_analysis && (
                  <div className="text-xs text-muted-foreground space-y-1 mt-2 border-t border-border pt-2">
                    <div><strong className="text-foreground">Category:</strong> {a.ai_analysis.category}</div>
                    <div><strong className="text-foreground">Summary:</strong> {a.ai_analysis.summary}</div>
                    <div><strong className="text-foreground">Recommended:</strong> {a.ai_analysis.recommended_action}</div>
                  </div>
                )}
                {a.latitude != null && a.longitude != null && (
                  <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 mt-2">
                    <MapPin className="h-3 w-3" /> {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                  </a>
                )}
                {a.evidence_url && (
                  <div className="mt-2"><EvidenceImg path={a.evidence_url} /></div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </main>

      {/* Camera modal */}
      {camOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <video ref={videoRef} className="max-h-[70vh] w-auto rounded-lg" playsInline muted />
          <div className="flex gap-3 mt-4">
            <Button variant="hero" size="lg" onClick={snap}><Camera /> Capture</Button>
            <Button variant="outline" size="lg" onClick={closeCamera}><X /> Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const EvidenceImg = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("evidence").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);
  if (!url) return null;
  return <img src={url} alt="Evidence" className="rounded-lg max-h-48 border border-border" />;
};

export default Dashboard;
