import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPendingLog, logConsumption } from "@/api/consumption";
import type { LogInput, PendingLog } from "@/api/consumption";

export function useConsumptionLog(scope: string) {
  const client = useQueryClient();
  const lock = useRef(false);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [pending, setPending] = useState<PendingLog | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const value = await getPendingLog(scope);
      if (currentScope.current === scope) { setPending(value); setStorageError(""); }
    }
    catch (e) {
      if (currentScope.current === scope) setStorageError(e instanceof Error ? e.message : "Could not check the previous log.");
    }
    finally { if (currentScope.current === scope) setChecking(false); }
  }, [scope]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function submit(input?: LogInput) {
    if (lock.current || checking || storageError) return null;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const rows = await logConsumption(scope, input);
      void client.invalidateQueries({ queryKey: ["pantry"] });
      void client.invalidateQueries({ queryKey: ["food-consumption"] });
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log food.");
      return null;
    } finally {
      await refresh();
      lock.current = false;
      setSaving(false);
    }
  }
  return { pending, checking, saving, error, storageError, refresh, submit };
}
