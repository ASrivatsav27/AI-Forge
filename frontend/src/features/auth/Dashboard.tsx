import { useNavigate } from "react-router-dom";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: session, isPending } = authClient.useSession();

  async function handleLogout() {
    await authClient.signOut();

    navigate("/login");
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950 text-white">
        <CardHeader>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-zinc-400">
            Better Auth is working successfully 🎉
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p>
              <span className="font-semibold">Name:</span>{" "}
              {session?.user?.name}
            </p>

            <p>
              <span className="font-semibold">Email:</span>{" "}
              {session?.user?.email}
            </p>

            <p>
              <span className="font-semibold">User ID:</span>{" "}
              {session?.user?.id}
            </p>
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}