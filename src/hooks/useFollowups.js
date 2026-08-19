import { useState, useEffect, useCallback } from "react";
import {
  fetchUsersWithFollowups,
  addRemark,
  updateFollowup,
  createFollowup,
} from "../supabase/followups";

/**
 * useFollowups
 * ─────────────
 * Fetches all users with nested followup + remarks.
 * After every write (addRemark / updateFollowup / createFollowup)
 * we do a FULL REFETCH so the UI always shows what's actually in Supabase.
 * This avoids any mismatch between local state and the database.
 */
export function useFollowups() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ── fetch ─────────────────────────────────────────────────────────────── */
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchUsersWithFollowups();
    if (err) {
      setError(err.message || "Failed to fetch followups");
    } else {
      setUsers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  /* ── addRemark ──────────────────────────────────────────────────────────
     Inserts a new remark then refetches so remarks list is up to date.
  ── */
  const handleAddRemark = async (followupId, remark) => {
    const { data, error: err } = await addRemark(followupId, remark);
    if (err) return { error: err };
    await refetch();   // ← full refetch — ensures remarks show immediately
    return { data };
  };

  /* ── updateFollowup ─────────────────────────────────────────────────────
     Updates status / dates then refetches.
  ── */
  const handleUpdateFollowup = async (followupId, payload) => {
    const { data, error: err } = await updateFollowup(followupId, payload);
    if (err) return { error: err };
    await refetch();   // ← full refetch — ensures dates & status show immediately
    return { data };
  };

  /* ── createFollowup ─────────────────────────────────────────────────────
     Creates a new followup then refetches.
  ── */
  const handleCreateFollowup = async (userId, payload) => {
    const { data, error: err } = await createFollowup({ user_id: userId, ...payload });
    if (err) return { error: err };
    await refetch();   // ← full refetch
    return { data };
  };

  return {
    users,
    loading,
    error,
    refetch,
    addRemark:      handleAddRemark,
    updateFollowup: handleUpdateFollowup,
    createFollowup: handleCreateFollowup,
  };
}