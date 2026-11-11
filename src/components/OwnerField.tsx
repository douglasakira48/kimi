"use client";

/** Escolha de quem é a despesa: Casa (sem dono) ou um dos moradores. */
export default function OwnerField({
  members,
  value,
  onChange,
}: {
  members: { user_id: string; display_name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = [{ id: "", label: "Casa" }, ...members.map((m) => ({ id: m.user_id, label: m.display_name }))];
  return (
    <div className="field">
      <span className="label" id="owner-label">De quem é</span>
      <div className="chips" role="group" aria-labelledby="owner-label">
        {opts.map((o) => (
          <button key={o.id || "casa"} type="button" className={`chip ${value === o.id ? "on" : ""}`}
            aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
