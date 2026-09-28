import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 21.65c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.65Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.73a5.85 5.85 0 0 1 0-3.46V7.74H3.29a9.74 9.74 0 0 0 0 8.52l3.25-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.24c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.31 14.63 2.35 12 2.35a9.74 9.74 0 0 0-8.71 5.39l3.25 2.53C7.31 7.96 9.46 6.24 12 6.24Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.42 7.86 10.95.57.1.78-.25.78-.55v-2.14c0-.3.21-.65.78-.55 4.57-1.53 7.86-5.86 7.86-10.95C23.5 5.65 18.35.5 12 .5Zm0 18.16c-1.03 0-1.97-.3-2.77-.83-.17-.1-.35-.04-.35.17v1.85c0 .16-.06.25-.2.21C5.4 18.93 3 15.73 3 12 3 7.03 7.03 3 12 3s9 4.03 9 9c0 3.73-2.4 6.93-5.68 8.06-.14.04-.2-.05-.2-.21V18c0-.21-.18-.27-.35-.17-.8.53-1.74.83-2.77.83Z" />
    </svg>
  );
}

function getOAuthCallbackURL() {
  if (window.location.hostname === "localhost") {
    return "http://localhost:3000/dashboard";
  }

  return "https://app.adapasrivatsav.in/dashboard";
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await authClient.signUp.email({
      name,
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

  async function signupGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: getOAuthCallbackURL(),
    });
  }

  async function signupGithub() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: getOAuthCallbackURL(),
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950">
        <CardHeader>
          <h1 className="text-2xl font-bold text-white">
            Create Account
          </h1>

          <p className="text-zinc-400">
            Create your AIForge account.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <Label>Name</Label>

              <Input
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label>Email</Label>

              <Input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Password</Label>

              <Input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-2 text-sm text-zinc-400"
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
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
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
            type="button"
            variant="outline"
            className="mb-3 w-full gap-2"
            onClick={signupGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={signupGithub}
          >
            <GithubIcon />
            Continue with GitHub
          </Button>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-white hover:underline"
            >
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}