import { useEffect, useState } from "react";
import { subscribe } from "../../lib/notification";

type Toast = { id: number; type: "success" | "error" | "info"; message: string; action?: { label: string; href?: string } };

export default function AlertContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let id = 1;
    const unsubscribe = subscribe((payload) => {
      const t: Toast = { id: id++, ...payload };
      setToasts((s) => [...s, t]);
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== t.id));
      }, 4500);
    });

    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-md transition-opacity ${
            t.type === "success" ? "bg-green-600 text-white" : t.type === "error" ? "bg-red-600 text-white" : "bg-slate-800 text-white"
          }`}
        >
          <div className="flex items-start gap-3">
            <p className="flex-1 leading-5">{t.message}</p>
            {t.action ? (
              t.action.href ? (
                <a
                  href={t.action.href}
                  className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  {t.action.label}
                </a>
              ) : (
                <span className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                  {t.action.label}
                </span>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
