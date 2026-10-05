"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

export type ToastTone = "info" | "success" | "warning" | "danger";
export type Toast = { id: string; tone: ToastTone; message: string };

type Ctx = { push: (t: Omit<Toast, "id"> & { ttlMs?: number }) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used within <ToastProvider>");
  return c;
}

const Stack = styled.div`
  position: fixed;
  z-index: ${({ theme }) => theme.z.sticky};
  right: 1rem;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 360px;
`;

const Row = styled.div<{ $tone: ToastTone }>`
  padding: 0.9rem 1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ $tone }) =>
    $tone === "success"
      ? "#065f46"
      : $tone === "warning"
        ? "#92400e"
        : $tone === "danger"
          ? "#991b1b"
          : "#1e3a8a"};
  color: #fff;
  box-shadow: ${({ theme }) => theme.shadow.lift};
  font-size: 0.92rem;
`;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) clearTimeout(h);
    timers.current.delete(id);
  }, []);

  const push: Ctx["push"] = useCallback(
    (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, tone: t.tone, message: t.message }]);
      const h = setTimeout(() => dismiss(id), t.ttlMs ?? 4000);
      timers.current.set(id, h);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      for (const h of timers.current.values()) clearTimeout(h);
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <Stack role="status" aria-live="polite" aria-atomic="true">
            {toasts.map((t) => (
              <Row key={t.id} $tone={t.tone} onClick={() => dismiss(t.id)}>
                {t.message}
              </Row>
            ))}
          </Stack>,
          document.body
        )}
    </ToastCtx.Provider>
  );
}
