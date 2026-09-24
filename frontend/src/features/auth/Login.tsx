import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

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
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.42 7.86 10.95.57.1.78-.25.78-.55v-2.14c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18a10.98 10.98 0 0 1 5.76 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.04.78 2.1v3.11c0 .3.21.66.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

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
      callbackURL: "http://localhost:3000/dashboard",
    });
  }

  async function loginGithub() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "http://localhost:3000/dashboard",
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
                onClick={() => setShowPassword(!showPassword)}
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
            type="button"
            variant="outline"
            className="mb-3 w-full gap-2"
            onClick={loginGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={loginGithub}
          >
            <GithubIcon />
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