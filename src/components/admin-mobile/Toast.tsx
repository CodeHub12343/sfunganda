"use client";

import styled, { keyframes } from "styled-components";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ToastTone = "info" | "success" | "warning" | "danger";

export type ToastInput = {
  tone?: ToastTone;
  title?: string;
  message: string;
  ttlMs?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = Required<Pick<ToastInput, "message">> &
  ToastInput & { id: string };

type Ctx = {
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useAdminToast(): Ctx {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useAdminToast must be used within <AdminToastProvider>");
  return c;
}

const slideIn = keyframes`
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const Stack = styled.div`
  position: fixed;
  z-index: var(--am-z-toast);
  top: calc(env(safe-area-inset-top) + 12px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(calc(100vw - 24px), 420px);
  pointer-events: none;
`;

const tones: Record<ToastTone, { bg: string; border: string; fg: string }> = {
  info: {
    bg: "var(--am-surface-raised)",
    border: "var(--am-info-600)",
    fg: "var(--am-info-600)",
  },
  success: {
    bg: "var(--am-surface-raised)",
    border: "var(--am-success-600)",
    fg: "var(--am-success-600)",
  },
  warning: {
    bg: "var(--am-surface-raised)",
    border: "var(--am-warning-600)",
    fg: "var(--am-warning-600)",
  },
  danger: {
    bg: "var(--am-surface-raised)",
    border: "var(--am-danger-600)",
    fg: "var(--am-danger-600)",
  },
};

const Row = styled.div<{ $tone: ToastTone }>`
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: ${({ $tone }) => tones[$tone].bg};
  color: var(--am-ink);
  border-radius: var(--am-radius-md);
  border: 1px solid var(--am-border);
  border-left: 4px solid ${({ $tone }) => tones[$tone].border};
  box-shadow: var(--am-shadow-2);
  animation: ${slideIn} var(--am-dur-base) var(--am-ease-emphasis);
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--am-ink);
`;

const Message = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: var(--am-ink-muted);
`;

const ActionBtn = styled.button<{ $tone: ToastTone }>`
  flex-shrink: 0;
  background: transparent;
  border: 0;
  color: ${({ $tone }) => tones[$tone].fg};
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--am-radius-sm);
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) {
      clearTimeout(h);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      const tone = t.tone ?? "info";
      setToasts((prev) => [...prev, { id, ...t, tone }]);
      const h = setTimeout(() => dismiss(id), t.ttlMs ?? 4000);
      timers.current.set(id, h);
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const timersSnapshot = timers.current;
    return () => {
      for (const h of timersSnapshot.values()) clearTimeout(h);
      timersSnapshot.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <Stack aria-live="polite" aria-atomic="false">
            {toasts.map((t) => {
              const tone = t.tone ?? "info";
              return (
                <Row
                  key={t.id}
                  $tone={tone}
                  role={tone === "danger" ? "alert" : "status"}
                >
                  <Body>
                    {t.title && <Title>{t.title}</Title>}
                    <Message>{t.message}</Message>
                  </Body>
                  {t.action && (
                    <ActionBtn
                      $tone={tone}
                      type="button"
                      onClick={() => {
                        t.action?.onClick();
                        dismiss(t.id);
                      }}
                    >
                      {t.action.label}
                    </ActionBtn>
                  )}
                </Row>
              );
            })}
          </Stack>,
          document.body
        )}
    </ToastCtx.Provider>
  );
}
