import { useState, type SVGProps } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BrainCircuit,
  ShieldCheck,
  Database,
  Server,
  Activity,
  Container,
  LayoutDashboard,
  Zap,
  Copy,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Inline mark instead of lucide-react's "Github" icon — Lucide deprecated
// and later removed its brand/logo icons, so importing it can resolve to
// `undefined` depending on the installed version and crash the render.
function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.02 1.76 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.6.23 2.77.12 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

// Single restrained accent — used in exactly three places (hero aura,
// terminal card top edge, CTA border). Everything else stays monochrome.
const SPECTRUM =
  "linear-gradient(90deg, #3291FF 0%, #B14EFF 35%, #FF4ECD 65%, #FF8A00 100%)";

const stack = [
  "React",
  "TypeScript",
  "Express",
  "Prisma",
  "PostgreSQL",
  "Better Auth",
  "Socket.IO",
  "Docker",
  "Tailwind",
  "Bun",
];

const features = [
  {
    icon: BrainCircuit,
    title: "AI workflows",
    description:
      "Chain tool calls, agents, and structured generations without wiring it all by hand.",
    large: true,
  },
  {
    icon: Activity,
    title: "Realtime",
    description: "Live cursors, presence, and state sync over Socket.IO, out of the box.",
    large: true,
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    description: "Email, Google, and GitHub sign-in powered by Better Auth.",
  },
  {
    icon: Database,
    title: "Database",
    description: "PostgreSQL with a typed Prisma schema, migrations included.",
  },
  {
    icon: Server,
    title: "Backend",
    description: "Express and TypeScript APIs, structured for growth.",
  },
  {
    icon: LayoutDashboard,
    title: "Frontend",
    description: "React, Tailwind, and shadcn/ui, wired together and themeable.",
  },
  {
    icon: Container,
    title: "Docker",
    description: "One compose file, identical containers from laptop to prod.",
  },
  {
    icon: Zap,
    title: "Performance",
    description: "Bun runtime and a build tuned to stay fast as the app grows.",
  },
];

const INSTALL_CMD = "bunx create-ai-forge@latest my-app";

export default function LandingPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — fail silently, button just won't confirm
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-black text-white">
      {/* Background — fixed, so it always fills the viewport regardless of
          scroll position or how tall the page ends up being. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.15] blur-[140px]"
          style={{ backgroundImage: SPECTRUM }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          }}
        />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3.5 w-3.5 rotate-45 rounded-[3px]"
              style={{ backgroundImage: SPECTRUM }}
              aria-hidden
            />
            <span className="text-[15px] font-semibold tracking-tight">
              AI<span className="text-neutral-500">Forge</span>
            </span>
          </div>

          <nav className="hidden gap-8 text-sm text-neutral-400 md:flex">
            <a className="transition hover:text-white" href="#features">
              Features
            </a>
            <a className="transition hover:text-white" href="#stack">
              Stack
            </a>
            <a className="transition hover:text-white" href="#">
              Pricing
            </a>
            <a className="transition hover:text-white" href="#">
              Docs
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden text-sm text-neutral-300 hover:text-white sm:inline-flex"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-white text-black hover:bg-neutral-200"
              onClick={() => navigate("/register")}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-neutral-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Open source · v1.0 now available
          </div>

          <h1 className="max-w-4xl text-[2.75rem] font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Ship AI products
            <br />
            without the boilerplate.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-neutral-400 md:text-lg">
            AI-Forge is a batteries-included starter for AI applications —
            auth, realtime, a typed database layer, and deployment, ready on
            day one.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="group rounded-full bg-white text-black hover:bg-neutral-200"
              onClick={() => navigate("/register")}
            >
              Start building
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/5"
            >
              <GithubMark className="mr-2 h-4 w-4" />
              Star on GitHub
            </Button>
          </div>

          {/* Signature element: install command */}
          <div
            className="mt-14 w-full max-w-lg overflow-hidden rounded-2xl p-px"
            style={{ backgroundImage: SPECTRUM, backgroundSize: "200% 100%" }}
          >
            <div className="flex items-center justify-between rounded-2xl bg-[#0a0a0a] px-5 py-3.5">
              <code className="font-mono text-sm text-neutral-300">
                <span className="mr-2 select-none text-neutral-600">$</span>
                {INSTALL_CMD}
              </code>
              <button
                onClick={copyCommand}
                aria-label="Copy install command"
                className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stack marquee */}
      <section id="stack" className="border-y border-white/10 py-10">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-neutral-600">
          Powered by
        </p>
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
          }}
        >
          <div className="animate-marquee flex w-max gap-4">
            {[...stack, ...stack].map((item, i) => (
              <div
                key={`${item}-${i}`}
                className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-neutral-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-28">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Everything the stack needs.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-500">
            Each piece works standalone, and better together.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 ${
                feature.large ? "sm:col-span-2" : ""
              }`}
            >
              <feature.icon className="mb-5 h-5 w-5 text-neutral-300" />
              <h3 className="mb-2 text-[15px] font-medium text-white">
                {feature.title}
              </h3>
              <p className="text-sm leading-6 text-neutral-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="rounded-[28px] p-px" style={{ backgroundImage: SPECTRUM }}>
          <div className="rounded-[28px] bg-black px-10 py-16 text-center sm:px-16">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Start building today.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-neutral-500">
              Clone the starter, add your API keys, and you have a working AI
              app in minutes.
            </p>
            <Button
              size="lg"
              className="mt-8 rounded-full bg-white text-black hover:bg-neutral-200"
              onClick={() => navigate("/register")}
            >
              Create account
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { heading: "Product", links: ["Features", "Stack", "Pricing", "Changelog"] },
              { heading: "Developers", links: ["Docs", "API reference", "GitHub", "Status"] },
              { heading: "Company", links: ["About", "Blog", "Careers"] },
              { heading: "Legal", links: ["Privacy", "Terms"] },
            ].map((col) => (
              <div key={col.heading}>
                <p className="mb-4 text-sm font-medium text-white">{col.heading}</p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-neutral-500 transition hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-neutral-600 sm:flex-row">
            <span>© 2026 AI-Forge</span>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rotate-45 rounded-[2px]"
                style={{ backgroundImage: SPECTRUM }}
                aria-hidden
              />
              <span>Built in the open.</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 26s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>
    </main>
  );
}