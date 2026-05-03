import { Trash2 } from "lucide-react";
import { deleteItem } from "@/lib/actions";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-1 text-ink/60 dark:text-white/60">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function DeleteButton({ type, id }: { type: string; id: string }) {
  return (
    <form action={deleteItem}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-soft px-3" title="Delete">
        <Trash2 size={15} />
      </button>
    </form>
  );
}

export function TextInput({ label, name, defaultValue, type = "text", required = false }: { label: string; name: string; defaultValue?: string | null; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      <input className="field" name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 4 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      <textarea className="field" name={name} rows={rows} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export function Checkbox({ label, name, defaultChecked = false }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input className="size-4 accent-moss" name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: string[] }) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option} value={option}>{option.replace("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}
