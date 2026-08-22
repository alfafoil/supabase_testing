import { Link } from "react-router-dom";
import { motion } from "framer-motion";

/* ---------------- module cards ---------------- */

const CARDS = [
  {
    to: "/sales-report",
    title: "Sales Report",
    desc: "KPIs, salesman / FY / month filters, records table and monthly debit graph.",
    accent: "from-orange-500 to-amber-400",
    shadow: "shadow-orange-500/30",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/users",
    title: "User Directory",
    desc: "Manage users, roles and salesman IDs fetched live from Supabase.",
    accent: "from-violet-500 to-fuchsia-500",
    shadow: "shadow-violet-500/30",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-6.9 4 4 0 004 6.9zM17 11a3 3 0 100-6" />
      </svg>
    ),
  },
];

/* ---------------- home page ---------------- */

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/30">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sale Manager</h1>
        <p className="mt-2 text-sm text-slate-500">
          React + Supabase demo — pick a module to get started.
        </p>
      </motion.div>

      <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.to}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: "easeOut" }}
          >
            <Link
              to={card.to}
              className="group block h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${card.accent} ${card.shadow}`}
              >
                {card.icon}
              </div>
              <h2 className="text-lg font-semibold text-slate-800">{card.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{card.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-600 transition-transform group-hover:translate-x-1">
                Open
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M21 12H3" />
                </svg>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}