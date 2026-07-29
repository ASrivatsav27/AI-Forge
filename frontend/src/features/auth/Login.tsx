import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate("/dashboard");
  }

  async function loginGoogle() {
    await authClient.signIn.social({
        provider: "google",
        callbackURL: "http://localhost:3000/dashboard"
    });
  }

  async function loginGithub() {
    await authClient.signIn.social({
        provider: "github",
        callbackURL: "http://localhost:3000/dashboard"
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950">
        <CardHeader>
          <h1 className="text-2xl font-bold text-white">
            Welcome back
          </h1>

          <p className="text-zinc-400">
            Login to your AIForge account.
          </p>
        </CardHeader>

        <CardContent>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            <div>
              <Label>Email</Label>

              <Input
                type="email"
                value={email}
                placeholder="john@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Password</Label>

              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="********"
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="mt-2 text-sm text-zinc-400"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? "Hide Password" : "Show Password"}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>

          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-500">
              OR
            </span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <Button
            variant="outline"
            className="mb-3 w-full"
            onClick={loginGoogle}
          >
            Continue with Google
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={loginGithub}
          >
            Continue with GitHub
          </Button>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-white hover:underline"
            >
              Register
            </Link>
          </p>

        </CardContent>
      </Card>
    </div>
  );
}