"use client";

import { useTransition } from "react";
import { setVisaoAction } from "@/app/actions";

export default function VisaoFilter({
  members,
  current,
}: {
  members: { user_id: string; display_name: string }[];
  current: string;
}) {
  const [busy, start] = useTransition();
  const opts = [
    { id: "casal", label: "Casal" },
    ...members.map((m) => ({ id: m.user_id, label: m.display_name })),
    { id: "casa", label: "Casa" },
  ];
  return (
    <div className="chips" role="group" aria-label="Quem está vendo" style={{ opacity: busy ? 0.6 : 1 }}>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${current === o.id ? "on" : ""}`}
          aria-pressed={current === o.id}
          onClick={() => start(() => setVisaoAction(o.id))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
