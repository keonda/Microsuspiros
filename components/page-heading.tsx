export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-rose">MicroSuspiros Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-mist/68">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
