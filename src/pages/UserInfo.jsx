import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { faitchUserDetails, insertUserDetail, updateUserRole, updateUserName, deleteUser } from "../supabase/users";

/* ---------- constants ---------- */

const PAGE_SIZE = 10;

const ROLE_STYLES = {
  Admin: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30",
  User:  "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30",
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-lime-400",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

/* ---------- helpers ---------- */

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

/* ---------- animation variants ---------- */

const rowVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.32, ease: "easeOut" },
  }),
};

/* ================================================================
   SMALL COMPONENTS
================================================================ */

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      ROLE_STYLES[role] || "bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/30"
    }`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {role || "Unknown"}
    </span>
  );
}

function PasswordCell({ value }) {
  const [show, setShow] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setShow((s) => !s); }}
      className="group/pw inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
    >
      <span>{show ? value : "••••••••"}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-600 group-hover/pw:text-slate-400">
        {show ? "hide" : "show"}
      </span>
    </button>
  );
}

/* ---------- RoleToggleCell ---------- */

function RoleToggleCell({ user, onRoleUpdated }) {
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const nextRole = user.role === "Admin" ? "User" : "Admin";

  const handleToggle = async (e) => {
    e.stopPropagation();
    setSaving(true);
    setErrMsg(null);
    const { data, error } = await updateUserRole(user.id, nextRole);
    setSaving(false);
    if (error) {
      setErrMsg("Update failed");
      setTimeout(() => setErrMsg(null), 3000);
      return;
    }
    onRoleUpdated(user.id, data.role);
  };

  return (
    <div className="flex items-center gap-2">
      <RoleBadge role={user.role} />
      <button
        onClick={handleToggle}
        disabled={saving}
        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
          saving
            ? "cursor-not-allowed border-slate-700 text-slate-600"
            : nextRole === "Admin"
              ? "border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
        }`}
      >
        {saving ? "Saving…" : `→ ${nextRole}`}
      </button>
      <AnimatePresence>
        {errMsg && (
          <motion.span
            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="text-[11px] text-red-400"
          >
            {errMsg}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- DeleteButton ---------- */

/**
 * Trash icon button — clicking it asks the parent to open the
 * confirm modal for this user. No Supabase call happens here.
 */
function DeleteButton({ user, onRequestDelete }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onRequestDelete(user); }}
      title="Delete user"
      className="rounded-md p-1.5 text-slate-600 transition-colors
                 hover:bg-red-500/10 hover:text-red-400"
    >
      {/* trash icon */}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

/* ---------- DeleteConfirmModal ---------- */

/**
 * Modal that appears when admin clicks the trash icon.
 * Shows user name + email, then confirms before calling deleteUser().
 */
function DeleteConfirmModal({ user, onConfirm, onCancel, deleting, errMsg }) {
  if (!user) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        >
          {/* Icon */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center
                          rounded-full bg-red-500/10 ring-1 ring-red-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                       01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                       00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h2 className="text-center text-lg font-semibold text-slate-100">Delete User</h2>
          <p className="mt-1 text-center text-sm text-slate-400">
            This will permanently remove:
          </p>

          {/* User preview */}
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-3 text-center">
            <p className="font-medium text-slate-100">{user.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            {user.salesmanId && (
              <p className="mt-1 font-mono text-xs text-slate-500">ID: {user.salesmanId}</p>
            )}
            <RoleBadge role={user.role} />
          </div>

          <p className="mt-3 text-center text-xs text-red-400">
            ⚠ This action cannot be undone.
          </p>

          {/* Error */}
          <AnimatePresence>
            {errMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden rounded-lg border border-red-500/30
                           bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {errMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm
                         text-slate-300 transition-colors hover:border-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <motion.button
              onClick={onConfirm}
              disabled={deleting}
              whileTap={{ scale: 0.97 }}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white
                         shadow-lg shadow-red-600/20 transition-colors hover:bg-red-500
                         disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, Delete"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- SkeletonRows ---------- */

function SkeletonRows({ cols = 7, rows = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-b border-slate-800/60">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-5 py-4">
          <div className="h-4 animate-pulse rounded-full bg-slate-800"
               style={{ width: `${55 + ((r + c) % 4) * 12}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/* ---------- KpiCard ---------- */

function KpiCard({ label, value, active, accent, onClick }) {
  const ACCENTS = {
    violet: { ring: "ring-violet-500/50", glow: "shadow-violet-500/20", grad: "from-violet-500/25 to-fuchsia-500/5", dot: "bg-violet-400", text: "text-violet-300" },
    rose:   { ring: "ring-rose-500/50",   glow: "shadow-rose-500/20",   grad: "from-rose-500/25 to-orange-500/5",   dot: "bg-rose-400",   text: "text-rose-300"   },
    emerald:{ ring: "ring-emerald-500/50",glow: "shadow-emerald-500/20",grad: "from-emerald-500/25 to-lime-400/5",  dot: "bg-emerald-400",text: "text-emerald-300"},
  }[accent];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex-1 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left
                  backdrop-blur transition-shadow sm:p-5 ${ACCENTS.grad} ${
        active
          ? `border-transparent ring-2 ${ACCENTS.ring} shadow-lg ${ACCENTS.glow}`
          : "border-slate-800 shadow-none hover:border-slate-700"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${ACCENTS.dot}`} />
        {label}
      </div>
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`mt-2 text-2xl font-semibold sm:text-3xl ${active ? ACCENTS.text : "text-slate-100"}`}
      >
        {value}
      </motion.div>
      {active && (
        <motion.div layoutId="kpi-active-underline"
          className={`absolute inset-x-0 bottom-0 h-0.5 ${ACCENTS.dot}`} />
      )}
    </motion.button>
  );
}

/* ---------- AddUserModal ---------- */

function AddUserModal({ open, onClose, onCreated }) {
  const emptyForm = { name: "", email: "", password: "", role: "User", salesmanId: "" };
  const [form, setForm]             = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState(null);

  useEffect(() => {
    if (open) { setForm(emptyForm); setFormError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Name, email, and password are required.");
      return;
    }
    if (form.role === "User" && !form.salesmanId.trim()) {
      setFormError("Salesman ID is required for the User role.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await insertUserDetail({
      name: form.name.trim(), email: form.email.trim(),
      password: form.password, role: form.role,
      salesmanId: form.role === "User" ? form.salesmanId.trim() : null,
    });
    setSubmitting(false);
    if (error) { setFormError(error.message || "Failed to create user."); return; }
    onCreated(data);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-slate-100">Add New User</h2>
            <p className="mt-1 text-xs text-slate-500">Inserts a new row into Supabase.</p>

            <div className="mt-5 space-y-4">
              {[
                { key: "name",     label: "Name",     type: "text",  placeholder: "Jane Doe"          },
                { key: "email",    label: "Email",    type: "email", placeholder: "jane@example.com"  },
                { key: "password", label: "Password", type: "text",  placeholder: "Choose a password" },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
                  <input type={type} value={form[key]} onChange={update(key)} placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2
                               text-sm text-slate-100 outline-none font-mono
                               focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20" />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
                <div className="flex gap-2">
                  {["User", "Admin"].map((r) => (
                    <button type="button" key={r}
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        form.role === r
                          ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >{r}</button>
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {form.role === "User" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <label className="mb-1 block text-xs font-medium text-slate-400">Salesman ID</label>
                    <input value={form.salesmanId} onChange={update("salesmanId")} placeholder="SA1234"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2
                                 font-mono text-sm text-slate-100 outline-none
                                 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {formError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden rounded-lg border border-rose-500/30
                             bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {formError}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm
                           text-slate-300 transition-colors hover:border-slate-600">
                Cancel
              </button>
              <motion.button type="submit" disabled={submitting} whileTap={{ scale: 0.97 }}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white
                           shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-500
                           disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Adding…" : "Add User"}
              </motion.button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- NameCell ---------- */

function NameCell({ user, onNameUpdated }) {
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState(user.name);
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setValue(user.name);
  }, [user.name, editing]);

  const startEdit = (e) => {
    e.stopPropagation();
    setErrMsg(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setValue(user.name);
    setEditing(false);
    setErrMsg(null);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === user.name) {
      setEditing(false);
      setValue(user.name);
      return;
    }
    setSaving(true);
    setErrMsg(null);
    const { data, error } = await updateUserName(user.id, trimmed);
    setSaving(false);
    if (error) {
      setErrMsg("Save failed");
      setTimeout(() => setErrMsg(null), 3000);
      return;
    }
    onNameUpdated(user.id, data.name);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.12, rotate: 4 }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                      bg-gradient-to-br text-xs font-bold text-white shadow-lg ${
            AVATAR_GRADIENTS[user.id % AVATAR_GRADIENTS.length]
          }`}>
          {initials(user.name)}
        </motion.div>
        <div className="group/name flex items-center gap-1.5">
          <div>
            <p className="font-medium text-slate-100">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={startEdit}
            title="Edit name"
            className="rounded-md p-1 text-slate-600 opacity-0 transition-opacity
                       hover:bg-slate-800 hover:text-slate-300 group-hover/name:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 
                       16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 
                       011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <motion.div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                    bg-gradient-to-br text-xs font-bold text-white shadow-lg ${
        AVATAR_GRADIENTS[user.id % AVATAR_GRADIENTS.length]
      }`}>
        {initials(user.name)}
      </motion.div>
      <div>
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-40 rounded-md border border-violet-500/50 bg-slate-800 px-2 py-1
                       text-sm text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <button onClick={save} disabled={saving}
            className="rounded-md p-1 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
          <button onClick={cancelEdit} disabled={saving}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-800 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{user.email}</p>
        <AnimatePresence>
          {errMsg && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-0.5 text-[11px] text-red-400">
              {errMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


/* ================================================================
   MAIN PAGE
================================================================ */

export default function UserInfo() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [query, setQuery]           = useState("");
  const [roleFilter, setRoleFilter] = useState(null);
  const [sort, setSort]             = useState({ key: "id", dir: "asc" });
  const [selectedId, setSelectedId] = useState(null);
  const [scrolled, setScrolled]     = useState(false);
  const [page, setPage]             = useState(1);
  const [isAddOpen, setIsAddOpen]   = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState(null);  // user object to delete
  const [deleting, setDeleting]         = useState(false);
  const [deleteErr, setDeleteErr]       = useState(null);

  const scrollRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25 });

  /* ── fetch on mount ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await faitchUserDetails();
      if (error) setErrorMsg(error.message || "Failed to fetch users.");
      setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  /* ── KPI counts ── */
  const totalCount = users.length;
  const adminCount = useMemo(() => users.filter((u) => u.role === "Admin").length, [users]);
  const userCount  = useMemo(() => users.filter((u) => u.role === "User").length,  [users]);

  /* ── filter + sort ── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = roleFilter ? users.filter((u) => u.role === roleFilter) : [...users];
    if (q) list = list.filter((u) => [u.name, u.email, u.role].join(" ").toLowerCase().includes(q));
    list.sort((a, b) => {
      const { key, dir } = sort;
      const va = a[key] ?? ""; const vb = b[key] ?? "";
      const res = typeof va === "number" && typeof vb === "number"
        ? va - vb : String(va).localeCompare(String(vb));
      return dir === "asc" ? res : -res;
    });
    return list;
  }, [users, query, roleFilter, sort]);

  useEffect(() => { setPage(1); }, [query, roleFilter, sort, users.length]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const toggleSort = (key) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const toggleRoleFilter = (role) => setRoleFilter((cur) => (cur === role ? null : role));

  /* ── optimistic role update ── */
  const handleRoleUpdated = (userId, newRole) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
  };

  /* ── delete handlers ── */
  const handleRequestDelete = (user) => {
    setDeleteTarget(user);
    setDeleteErr(null);
  };

  const handleCancelDelete = () => {
    if (deleting) return; // don't close while in progress
    setDeleteTarget(null);
    setDeleteErr(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteErr(null);

    const { error } = await deleteUser(deleteTarget.id);

    setDeleting(false);

    if (error) {
      setDeleteErr(error.message || "Failed to delete user. Please try again.");
      return;
    }

    // remove from local state — no re-fetch needed
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));

    // clear selection if the deleted user was selected
    if (selectedId === deleteTarget.id) setSelectedId(null);

    setDeleteTarget(null);
  };

  /* ── add user ── */
  const handleUserCreated = (newUser) => {
    if (newUser) setUsers((prev) => [newUser, ...prev]);
    setIsAddOpen(false);
  };

  /* ── pagination numbers ── */
  const pageNumbers = useMemo(() => {
    const span = 1;
    const nums = new Set([1, totalPages, currentPage]);
    for (let d = 1; d <= span; d++) { nums.add(currentPage - d); nums.add(currentPage + d); }
    return [...nums].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const columns = [
    { key: "id",         label: "ID"         },
    { key: "name",       label: "User"        },
    { key: "salesmanId", label: "Salesman ID" },
    { key: "role",       label: "Role",     sortable: false },
    { key: "created_at", label: "Created"     },
    { key: "password",   label: "Password", sortable: false },
    { key: "_actions",   label: "",         sortable: false },  // delete column
  ];

  const handleNameUpdated = (userId, newName) => {
  setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, name: newName } : u)));
};

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">User Directory</h1>
            <p className="mt-1 text-sm text-slate-400">
              {loading ? "Loading users…" : `${filtered.length} of ${users.length} users`}
              {" · "}fetched live from Supabase
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or role…"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 py-2.5 pl-10 pr-4
                           text-sm text-slate-200 placeholder-slate-500 outline-none backdrop-blur transition-all
                           focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 sm:w-72" />
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
            </div>

            <motion.button onClick={() => setIsAddOpen(true)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5
                         text-sm font-medium text-white shadow-lg shadow-violet-600/20
                         transition-colors hover:bg-violet-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add User
            </motion.button>
          </div>
        </motion.div>

        <AddUserModal open={isAddOpen} onClose={() => setIsAddOpen(false)} onCreated={handleUserCreated} />

        {/* Delete confirm modal */}
        {deleteTarget && (
          <DeleteConfirmModal
            user={deleteTarget}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
            deleting={deleting}
            errMsg={deleteErr}
          />
        )}

        {/* ── KPI row ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-3 sm:flex-row"
        >
          <KpiCard label="Total Records" value={totalCount} accent="violet"
            active={roleFilter === null}    onClick={() => setRoleFilter(null)} />
          <KpiCard label="Admin"         value={adminCount} accent="rose"
            active={roleFilter === "Admin"} onClick={() => toggleRoleFilter("Admin")} />
          <KpiCard label="User"          value={userCount}  accent="emerald"
            active={roleFilter === "User"}  onClick={() => toggleRoleFilter("User")} />
        </motion.div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden rounded-xl border border-rose-500/30
                         bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60
                     shadow-2xl shadow-black/40 backdrop-blur"
        >
          <motion.div style={{ scaleX: progress }}
            className="h-0.5 origin-left bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500" />

          <div ref={scrollRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
            className="max-h-[62vh] overflow-y-auto [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
            <table className="w-full border-collapse text-left text-sm">

              <thead className={`sticky top-0 z-10 bg-slate-900/95 backdrop-blur transition-shadow duration-300 ${
                scrolled ? "shadow-lg shadow-black/50" : ""}`}>
                <tr className="border-b border-slate-700/80">
                  {columns.map((col) => (
                    <th key={col.key} className="px-5 py-3.5">
                      <button
                        disabled={col.sortable === false}
                        onClick={() => toggleSort(col.key)}
                        className={`group inline-flex items-center gap-1 text-xs font-semibold
                                    uppercase tracking-wider text-slate-400 transition-colors ${
                          col.sortable === false ? "cursor-default" : "hover:text-violet-300 active:scale-95"
                        }`}
                      >
                        {col.label}
                        {col.sortable !== false && (
                          <motion.span
                            animate={{
                              rotate:  sort.key === col.key && sort.dir === "desc" ? 180 : 0,
                              opacity: sort.key === col.key ? 1 : 0.25,
                            }}
                            className="text-[10px]"
                          >▲</motion.span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <SkeletonRows cols={columns.length} />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-14 text-center text-slate-500">
                      No users found{query ? ` for "${query}"` : ""}.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence mode="sync">
                    {paginated.map((user, i) => {
                      const isSelected = selectedId === user.id;
                      return (
                        <motion.tr
                          key={`${currentPage}-${user.id}`}
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, x: -20 }}
                          onClick={() => setSelectedId(isSelected ? null : user.id)}
                          whileHover={{ backgroundColor: "rgba(139, 92, 246, 0.08)", x: 4 }}
                          whileTap={{ scale: 0.995 }}
                          transition={{ type: "tween", duration: 0.15 }}
                          className={`cursor-pointer border-b border-slate-800/60 transition-colors ${
                            isSelected
                              ? "bg-violet-500/10 ring-1 ring-inset ring-violet-500/40"
                              : "odd:bg-slate-900/30"
                          }`}
                        >
                          {/* ID */}
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">#{user.id}</td>

                          {/* Avatar + name + email (editable) */}
<td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
  <NameCell user={user} onNameUpdated={handleNameUpdated} />
</td>

                          {/* Salesman ID */}
                          <td className="px-5 py-4">
                            <span className="rounded-md bg-slate-800/80 px-2 py-1 font-mono text-xs text-slate-300">
                              {user.salesmanId || "—"}
                            </span>
                          </td>

                          {/* Role toggle */}
                          <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                            <RoleToggleCell user={user} onRoleUpdated={handleRoleUpdated} />
                          </td>

                          {/* Created */}
                          <td className="px-5 py-4 text-xs text-slate-400">{formatDate(user.created_at)}</td>

                          {/* Password */}
                          <td className="px-5 py-4">
                            <PasswordCell value={user.password} />
                          </td>

                          {/* Delete */}
                          <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                            <DeleteButton user={user} onRequestDelete={handleRequestDelete} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="flex flex-col gap-3 border-t border-slate-800 px-5 py-3.5
                          sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Click a row to select · click a header to sort · 🗑 to delete</span>
              <AnimatePresence mode="wait">
                {selectedId !== null && (
                  <motion.span
                    key={selectedId}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="rounded-full bg-violet-500/10 px-3 py-1 font-medium
                               text-violet-300 ring-1 ring-violet-500/30"
                  >
                    Selected user #{selectedId}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="mr-2 text-xs text-slate-500">Page {currentPage} of {totalPages}</span>

                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="rounded-lg border border-slate-700/70 px-2.5 py-1.5 text-xs text-slate-300
                             transition-colors hover:border-violet-500/50 hover:text-violet-300
                             disabled:cursor-not-allowed disabled:opacity-30">
                  Prev
                </button>

                {pageNumbers.map((n, idx) => {
                  const prevN = pageNumbers[idx - 1];
                  const showEllipsis = prevN !== undefined && n - prevN > 1;
                  return (
                    <span key={n} className="flex items-center gap-1.5">
                      {showEllipsis && <span className="px-1 text-xs text-slate-600">…</span>}
                      <motion.button onClick={() => setPage(n)} whileTap={{ scale: 0.9 }}
                        className={`relative h-7 w-7 rounded-lg text-xs font-medium transition-colors ${
                          n === currentPage ? "text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}>
                        {n === currentPage && (
                          <motion.span layoutId="pagination-active"
                            className="absolute inset-0 rounded-lg bg-violet-500"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                        )}
                        <span className="relative">{n}</span>
                      </motion.button>
                    </span>
                  );
                })}

                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-700/70 px-2.5 py-1.5 text-xs text-slate-300
                             transition-colors hover:border-violet-500/50 hover:text-violet-300
                             disabled:cursor-not-allowed disabled:opacity-30">
                  Next
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}