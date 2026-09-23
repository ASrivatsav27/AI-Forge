import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

import { useProject } from "@/hooks/useProject";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

import { FaReact } from "react-icons/fa";

import {
  SiNextdotjs,
  SiExpress,
  SiMongodb,
  SiPostgresql,
} from "react-icons/si";

type Environment =
  | "next"
  | "next-db"
  | "react"
  | "react-express"
  | "react-express-db";

type Database = "postgresql" | "mongodb";

const environments = [
  {
    id: "next" as Environment,
    name: "Next.js",
    description: "Full-stack React framework",
    logos: ["next"],
  },
  {
    id: "next-db" as Environment,
    name: "Next.js + DB",
    description: "Full-stack + database",
    logos: ["next"],
  },
  {
    id: "react" as Environment,
    name: "React",
    description: "React + Vite",
    logos: ["react"],
  },
  {
    id: "react-express" as Environment,
    name: "React + Express",
    description: "Full-stack MVC",
    logos: ["react", "express"],
  },
  {
    id: "react-express-db" as Environment,
    name: "React + Express + DB",
    description: "Full-stack + database",
    logos: ["react", "express"],
  },
];

function FrameworkLogo({ type }: { type: string }) {
  const baseClasses =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-black";

  switch (type) {
    case "next":
      return (
        <div className={baseClasses}>
          <SiNextdotjs className="text-xl text-white" />
        </div>
      );

    case "react":
      return (
        <div className={baseClasses}>
          <FaReact className="text-xl text-cyan-400" />
        </div>
      );

    case "express":
      return (
        <div className={baseClasses}>
          <SiExpress className="text-lg text-white" />
        </div>
      );

    case "postgres":
      return (
        <div className={baseClasses}>
          <SiPostgresql className="text-lg text-blue-400" />
        </div>
      );

    case "mongodb":
      return (
        <div className={baseClasses}>
          <SiMongodb className="text-lg text-emerald-500" />
        </div>
      );

    default:
      return null;
  }
}

function getDatabaseLogo(database: Database) {
  return database === "mongodb" ? "mongodb" : "postgres";
}

// ─── Setup Agent prompt ───────────────────────────────────────────────────────
//
// This string goes to the Setup Agent ONLY via setupContext.setupPrompt.
// The Coding Agent reads only `prompt` (the user's app requirements) and
// never sees this — so there is no risk of setup instructions telling it
// not to build the backend or database.
//
function getSetupAgentPrompt(
  environment: Environment,
  database: Database
): string {
  switch (environment) {
    case "next":
      return `Scaffold a Next.js project at the workspace root using:
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias '@/*'
Install all dependencies, then start the dev server bound to all interfaces:
npm run dev -- --hostname 0.0.0.0
Wait for preview verification, then call finish. Do not create any application files or implement any features.`;

    case "next-db":
      return `Scaffold a Next.js project at the workspace root using:
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias '@/*'
Install all dependencies, then start the dev server bound to all interfaces:
npm run dev -- --hostname 0.0.0.0
Wait for preview verification, then call finish. Do not configure the database, create schemas, or implement any application features — the Coding Agent handles all of that.`;

    case "react":
      return `Scaffold a React + Vite project in a frontend/ subdirectory using:
npm create vite@latest frontend -- --template react-ts --no-interactive
Then install dependencies:
cd frontend && npm install
Then start the dev server bound to all interfaces:
cd frontend && npm run dev -- --host 0.0.0.0
Wait for preview verification, then call finish. Do not implement any application features.`;

    case "react-express":
      return `Scaffold a React + Vite project in a frontend/ subdirectory using:
npm create vite@latest frontend -- --template react-ts --no-interactive
Then install dependencies:
cd frontend && npm install
Then start the dev server bound to all interfaces:
cd frontend && npm run dev -- --host 0.0.0.0
Wait for preview verification, then call finish. Do NOT create a backend/ directory, do NOT scaffold Express, and do NOT implement any application features — the Coding Agent creates the full React + Express MVC structure after setup.`;

    case "react-express-db":
      return database === "mongodb"
        ? `Scaffold a React + Vite project in a frontend/ subdirectory using:
npm create vite@latest frontend -- --template react-ts --no-interactive
Then install dependencies:
cd frontend && npm install
Then start the dev server bound to all interfaces:
cd frontend && npm run dev -- --host 0.0.0.0
Wait for preview verification, then call finish. Do NOT create a backend/ directory, do NOT scaffold Express or MongoDB, and do NOT implement any application features — the Coding Agent creates the full React + Express + MongoDB MVC structure after setup.`
        : `Scaffold a React + Vite project in a frontend/ subdirectory using:
npm create vite@latest frontend -- --template react-ts --no-interactive
Then install dependencies:
cd frontend && npm install
Then start the dev server bound to all interfaces:
cd frontend && npm run dev -- --host 0.0.0.0
Wait for preview verification, then call finish. Do NOT create a backend/ directory, do NOT scaffold Express or PostgreSQL/Prisma, and do NOT implement any application features — the Coding Agent creates the full React + Express + PostgreSQL MVC structure after setup.`;

    default:
      return "";
  }
}

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    handleCreateProject,
    handleGetAllProjects,
    projects,
    handleDeleteProject,
    loading,
  } = useProject();

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [environment, setEnvironment] =
    useState<Environment>("next");

  const [database, setDatabase] =
    useState<Database>("postgresql");

  const [connectionString, setConnectionString] =
    useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      await handleGetAllProjects();
    };

    fetchProjects();
  }, []);

  const { isPending } = authClient.useSession();

  async function handleLogout() {
    await authClient.signOut();
    navigate("/login");
  }

  const needsDatabase =
    environment === "next-db" ||
    environment === "react-express-db";

  function handleEnvironmentChange(
    newEnvironment: Environment
  ) {
    setEnvironment(newEnvironment);
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const project = await handleCreateProject({
      name,

      prompt: prompt.trim(),

      setupPrompt: getSetupAgentPrompt(environment, database),

      framework:
        environment === "next" ||
        environment === "next-db"
          ? "Next.js"
          : "React",

      backend:
        environment === "react-express" ||
        environment === "react-express-db"
          ? "Express"
          : undefined,

      database:
        needsDatabase
          ? database
          : undefined,

      architecture:
        environment === "react-express" ||
        environment === "react-express-db"
          ? "MVC"
          : undefined,

      connectionString:
        needsDatabase
          ? connectionString
          : undefined,
    });

    setName("");
    setPrompt("");
    setEnvironment("next");
    setDatabase("postgresql");
    setConnectionString("");
    setDialogOpen(false);

    navigate(`/workspace/${project.id}`);
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-sm text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800/80 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              AI Forge
            </h1>

            <p className="text-xs text-zinc-500">
              Your development workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-zinc-200">
                  + New Project
                </Button>
              </DialogTrigger>

              <DialogContent
                className="
                  w-[calc(100vw-3rem)]
                  max-w-4xl
                  max-h-[85vh]
                  overflow-y-auto
                  border-zinc-800
                  bg-zinc-950
                  text-white
                  p-6
                  sm:rounded-xl
                "
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl">
                    Create a new project
                  </DialogTitle>

                  <DialogDescription className="text-zinc-400">
                    Choose your development environment and
                    describe what you want to build.
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Project name
                    </label>

                    <Input
                      placeholder="My awesome project"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      required
                      className="
                        border-zinc-800
                        bg-zinc-900
                        text-white
                        placeholder:text-zinc-600
                        focus-visible:ring-zinc-500
                      "
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-zinc-300">
                        Development environment
                      </label>

                      <p className="mt-1 text-xs text-zinc-500">
                        Choose the stack AI Forge should set up.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {environments.map((env) => {
                        const selected =
                          environment === env.id;

                        return (
                          <button
                            key={env.id}
                            type="button"
                            onClick={() =>
                              handleEnvironmentChange(
                                env.id
                              )
                            }
                            className={`
                              rounded-xl
                              border
                              p-4
                              text-left
                              transition-all
                              ${
                                selected
                                  ? "border-white bg-zinc-900"
                                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/60"
                              }
                            `}
                          >
                            <div className="mb-4 flex items-center gap-2">
                              {env.logos.map(
                                (logo, index) => (
                                  <div
                                    key={`${env.id}-${logo}`}
                                    className="flex items-center gap-2"
                                  >
                                    {index > 0 && (
                                      <span className="text-zinc-600">
                                        +
                                      </span>
                                    )}

                                    <FrameworkLogo
                                      type={logo}
                                    />
                                  </div>
                                )
                              )}

                              {needsDatabase &&
                                env.id === environment && (
                                  <>
                                    <span className="text-zinc-600">
                                      +
                                    </span>

                                    <FrameworkLogo
                                      type={getDatabaseLogo(
                                        database
                                      )}
                                    />
                                  </>
                                )}
                            </div>

                            <h3 className="font-medium text-white">
                              {env.name}
                            </h3>

                            <p className="mt-1 text-xs text-zinc-500">
                              {env.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {needsDatabase && (
                    <div
                      className="
                        rounded-xl
                        border
                        border-zinc-800
                        bg-zinc-900/40
                        p-4
                      "
                    >
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-white">
                          Database configuration
                        </h3>

                        <p className="mt-1 text-xs text-zinc-500">
                          Choose your database and provide its
                          connection string.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDatabase("postgresql")
                          }
                          className={`
                            rounded-lg
                            border
                            p-4
                            text-left
                            transition-all
                            ${
                              database === "postgresql"
                                ? "border-white bg-zinc-900"
                                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-zinc-800
                                bg-black
                              "
                            >
                              <SiPostgresql className="text-lg text-blue-400" />
                            </div>

                            <div>
                              <p className="text-sm font-medium">
                                PostgreSQL
                              </p>

                              <p className="text-xs text-zinc-500">
                                SQL database
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDatabase("mongodb")
                          }
                          className={`
                            rounded-lg
                            border
                            p-4
                            text-left
                            transition-all
                            ${
                              database === "mongodb"
                                ? "border-white bg-zinc-900"
                                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-zinc-800
                                bg-black
                              "
                            >
                              <SiMongodb className="text-lg text-emerald-500" />
                            </div>

                            <div>
                              <p className="text-sm font-medium">
                                MongoDB
                              </p>

                              <p className="text-xs text-zinc-500">
                                NoSQL database
                              </p>
                            </div>
                          </div>
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                          Connection string
                        </label>

                        <Input
                          type="password"
                          placeholder={
                            database === "postgresql"
                              ? "postgresql://..."
                              : "mongodb+srv://..."
                          }
                          value={connectionString}
                          onChange={(e) =>
                            setConnectionString(
                              e.target.value
                            )
                          }
                          required={needsDatabase}
                          className="
                            border-zinc-800
                            bg-zinc-900
                            text-white
                            placeholder:text-zinc-600
                            focus-visible:ring-zinc-500
                          "
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      What do you want to build?
                    </label>

                    <p className="text-xs text-zinc-500">
                      Describe your application — features, pages,
                      data models, and any other requirements.
                    </p>

                    <textarea
                      placeholder="Build a modern dashboard with authentication, a sidebar, analytics, and..."
                      value={prompt}
                      onChange={(e) =>
                        setPrompt(e.target.value)
                      }
                      required
                      rows={7}
                      className="
                        flex
                        w-full
                        resize-none
                        rounded-md
                        border
                        border-zinc-800
                        bg-zinc-900
                        px-3
                        py-3
                        text-sm
                        text-white
                        outline-none
                        placeholder:text-zinc-600
                        focus:border-zinc-600
                        focus:ring-1
                        focus:ring-zinc-600
                      "
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !name.trim() ||
                      !prompt.trim() ||
                      (needsDatabase &&
                        !connectionString.trim())
                    }
                    className="
                      w-full
                      bg-white
                      text-black
                      hover:bg-zinc-200
                    "
                  >
                    {loading
                      ? "Creating project..."
                      : "Create Project"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="
                text-zinc-400
                hover:bg-zinc-900
                hover:text-white
              "
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-semibold tracking-tight">
            Your Projects
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Build, edit, and ship your projects with AI.
          </p>
        </div>

        {projects.length === 0 ? (
          <div
            className="
              flex
              min-h-[400px]
              flex-col
              items-center
              justify-center
              rounded-xl
              border
              border-dashed
              border-zinc-800
              bg-zinc-950/40
              text-center
            "
          >
            <div
              className="
                mb-5
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-xl
                border
                border-zinc-800
                bg-zinc-900
                text-2xl
              "
            >
              ✦
            </div>

            <h3 className="text-lg font-medium">
              No projects yet
            </h3>

            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Create your first project and let AI Forge
              set up your development environment.
            </p>

            <Button
              onClick={() => setDialogOpen(true)}
              className="
                mt-6
                bg-white
                text-black
                hover:bg-zinc-200
              "
            >
              Create your first project
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span
                className="
                  text-xs
                  uppercase
                  tracking-wider
                  text-zinc-600
                "
              >
                {projects.length}{" "}
                {projects.length === 1
                  ? "project"
                  : "projects"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="
                    group
                    border-zinc-800
                    bg-zinc-950
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-zinc-700
                    hover:bg-zinc-900/80
                  "
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-white">
                          {project.name}
                        </h3>

                        <p className="mt-1 font-mono text-[10px] text-zinc-600">
                          {project.id.slice(0, 8)}
                        </p>
                      </div>

                      <div
                        className="
                          mt-1
                          h-2
                          w-2
                          shrink-0
                          rounded-full
                          bg-emerald-500
                          shadow-[0_0_8px_rgba(34,197,94,0.5)]
                        "
                      />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        border-t
                        border-zinc-800
                        pt-4
                      "
                    >
                      <Button
                        onClick={() =>
                          navigate(
                            `/workspace/${project.id}`
                          )
                        }
                        className="
                          bg-white
                          text-black
                          hover:bg-zinc-200
                        "
                      >
                        Open IDE
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await handleDeleteProject({
                            id: project.id,
                          });
                        }}
                        className="
                          text-zinc-600
                          hover:bg-red-950/30
                          hover:text-red-400
                        "
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}