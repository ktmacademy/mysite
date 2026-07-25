import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  BookOpen,
  FileText,
  ListChecks,
  GraduationCap,
  WifiOff,
  BadgeCheck,
  Download,
  Star,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getPlayStoreApp } from "@/lib/playstore";
import { GooglePlayBadge } from "./GooglePlayBadge";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Real-time-ish: re-render (and re-pull the live Play numbers) at most every 30 min.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Download CTEVT Plus — Notes, Past Papers & Syllabus | KTM Academy",
  description:
    "Get CTEVT Plus free on Google Play. Class notes, past questions and full syllabus for every CTEVT diploma & pre-diploma program — study offline, anytime.",
  openGraph: {
    title: "Download CTEVT Plus — the app built for CTEVT students",
    description:
      "Notes, past questions and syllabus for every CTEVT program. Free on Google Play.",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: BookOpen,
    title: "Complete class notes",
    body: "Chapter-wise notes for every semester, written to match the CTEVT curriculum.",
  },
  {
    icon: FileText,
    title: "Past & board questions",
    body: "Years of solved past papers so you walk into exams knowing exactly what to expect.",
  },
  {
    icon: ListChecks,
    title: "Full official syllabus",
    body: "The complete, up-to-date syllabus for your program — always a tap away.",
  },
  {
    icon: GraduationCap,
    title: "Entrance & Loksewa prep",
    body: "Dedicated sections to prepare for entrance exams and Loksewa with confidence.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "Download once and study anywhere — no internet needed to open your notes.",
  },
  {
    icon: BadgeCheck,
    title: "100% free",
    body: "No paywalls, no subscription. Everything a CTEVT student needs, at zero cost.",
  },
];

const PROGRAMS = [
  "Civil Engineering",
  "Computer Engineering",
  "Electrical",
  "Electronics",
  "Mechanical",
  "IT",
  "Architecture",
  "Geomatics",
  "Hydropower",
  "General Medicine (HA)",
  "Staff Nurse",
  "Lab Technology",
  "Radiography",
  "Pharmacy",
  "Dental Science",
  "Agriculture (JT/JTA)",
  "Veterinary",
  "Forestry",
  "Hotel Management",
  "Pre-Diploma / TSLC",
];

const STEPS = [
  {
    n: "1",
    title: "Install free",
    body: "Grab CTEVT Plus from Google Play in seconds — it is light and installs fast.",
  },
  {
    n: "2",
    title: "Pick your program",
    body: "Choose your faculty and semester to instantly load the right notes and papers.",
  },
  {
    n: "3",
    title: "Study & score",
    body: "Read online or offline, revise past questions, and walk into exams prepared.",
  },
];

export default async function AppLandingPage() {
  const app = await getPlayStoreApp();
  const installsLabel = app.installs
    ? `${app.installs.toLocaleString("en-US")}+`
    : app.downloads;

  return (
    <main className={`${poppins.className} min-h-screen bg-white text-slate-900`}>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-[#1963a7]"
          >
            <GraduationCap className="h-6 w-6" />
            <span className="text-lg">KTM Academy</span>
          </Link>
          <GooglePlayBadge href={app.url} className="scale-90 sm:scale-100" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(135deg, #1963a7 0%, #2f7fc7 55%, #93afd3 100%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          {/* Copy */}
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium ring-1 ring-white/25">
              <Sparkles className="h-4 w-4" /> The #1 app for CTEVT students
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              Ace every CTEVT exam with {app.name}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/90">
              Notes, past questions and the full syllabus for your program —
              online or offline, completely free. Join thousands of students
              already studying smarter.
            </p>

            {/* Live social proof */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 ring-1 ring-white/25">
                <Download className="h-5 w-5" />
                <span className="text-sm">
                  <b className="text-base">{installsLabel}</b> downloads
                </span>
              </div>
              {app.score ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 ring-1 ring-white/25">
                  <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
                  <span className="text-sm">
                    <b className="text-base">{app.score.toFixed(1)}</b> on Google
                    Play
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 ring-1 ring-white/25">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm">
                    <b className="text-base">{app.contentRating}</b> · safe for all
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <GooglePlayBadge href={app.url} />
              <span className="text-sm text-white/80">
                Free · {app.category} · {app.downloads} installs
              </span>
            </div>
          </div>

          {/* Phone mockup with the LIVE app icon */}
          <div className="flex justify-center md:justify-end">
            <div className="relative w-[260px] rounded-[2.5rem] border-[10px] border-slate-900/90 bg-slate-900 shadow-2xl">
              <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-700" />
              <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#1963a7] to-[#123f6b] px-5 pb-8 pt-12 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={app.icon}
                  alt={`${app.name} app icon`}
                  className="mx-auto rounded-3xl shadow-lg ring-1 ring-white/20"
                  style={{ height: 104, width: 104 }}
                />
                <div className="mt-4 text-lg font-bold text-white">
                  {app.name}
                </div>
                <div className="text-xs text-white/70">{app.developer}</div>
                <div className="mt-5 space-y-2 text-left">
                  {["Notes", "Past Questions", "Syllabus"].map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white"
                    >
                      <BadgeCheck className="h-4 w-4 text-emerald-300" /> {t}
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-white py-2 text-sm font-semibold text-[#1963a7]">
                  Open
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live stats bar */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-slate-200 px-5 py-8 sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Downloads", value: installsLabel },
            { label: "Category", value: app.category },
            { label: "Content rating", value: app.contentRating },
            { label: "Price", value: "Free" },
          ].map((s) => (
            <div key={s.label} className="px-2 text-center">
              <div className="text-2xl font-extrabold text-[#1963a7]">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="pb-4 text-center text-xs text-slate-400">
          Live figures pulled from the Google Play listing
          {app.live ? "" : " (cached)"}.
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Everything you need to pass — in one app
          </h2>
          <p className="mt-3 text-slate-600">
            {app.name} puts your entire CTEVT course in your pocket, so you can
            study on the bus, at home, or the night before the exam.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1963a7]/10 text-[#1963a7]">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Built for every CTEVT program
            </h2>
            <p className="mt-3 text-slate-600">
              Engineering, Health, Agriculture, Hotel Management and more —
              whatever diploma or pre-diploma you are studying, it is covered.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {PROGRAMS.map((p) => (
              <span
                key={p}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Start studying in under a minute
          </h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1963a7] text-xl font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20">
        <div
          className="mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-14 text-center text-white shadow-xl"
          style={{
            background: "linear-gradient(135deg, #1963a7 0%, #123f6b 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={app.icon}
            alt={`${app.name} icon`}
            className="mx-auto rounded-2xl shadow-lg ring-1 ring-white/20"
            style={{ height: 80, width: 80 }}
          />
          <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
            Download {app.name} free today
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Join the {installsLabel} students who study smarter with the app made
            for CTEVT. It only takes a tap.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <GooglePlayBadge href={app.url} />
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-[#1963a7] shadow-lg transition hover:-translate-y-0.5"
            >
              View on Google Play
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-[#1963a7]">
            <GraduationCap className="h-5 w-5" /> KTM Academy
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="hover:text-[#1963a7]">
              Home
            </Link>
            <a href="/privacy.html" className="hover:text-[#1963a7]">
              Privacy
            </a>
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1963a7]"
            >
              Google Play
            </a>
            <a
              href="mailto:ctevtplusofficial@gmail.com"
              className="hover:text-[#1963a7]"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
