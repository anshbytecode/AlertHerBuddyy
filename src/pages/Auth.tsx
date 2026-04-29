import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const signUpSchema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
  phone: z.string().trim().min(6).max(20),
});
const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Welcome to AlertHer!");
      navigate("/dashboard");
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-gradient">AlertHer</span>
        </Link>
        <Card className="p-6 shadow-card">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="si-password">Password</Label>
                  <Input id="si-password" name="password" type="password" required />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" name="full_name" required />
                </div>
                <div>
                  <Label htmlFor="su-phone">Phone</Label>
                  <Input id="su-phone" name="phone" type="tel" required />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="su-password">Password</Label>
                  <Input id="su-password" name="password" type="password" required minLength={8} />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;