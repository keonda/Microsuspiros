import { AppShell } from "@/components/app-shell";
import { Checkbox, PageTitle, TextInput } from "@/components/crud";
import { saveSettings } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireUser();
  const { saved } = await searchParams;
  const settings = await prisma.setting.findMany();
  const model = settings.find((item) => item.key === "groqModel")?.value ?? "llama-3.1-8b-instant";
  const timeZone = settings.find((item) => item.key === "timeZone")?.value ?? defaultTimeZone;
  const hasKey = Boolean(settings.find((item) => item.key === "groqApiKey")?.value);
  const enabled = (key: string) => settings.find((item) => item.key === key)?.value !== "false";

  return (
    <AppShell>
      <PageTitle title="Settings" subtitle="Private configuration stored in the database." />
      <form action={saveSettings} className="card max-w-2xl space-y-5">
        {saved && <p className="rounded-xl bg-moss/15 px-3 py-2 text-sm font-semibold text-moss">Settings saved.</p>}
        <div>
          <h2 className="mb-3 text-lg font-bold">AI</h2>
          <div className="rounded-xl bg-ink/5 p-4 text-sm dark:bg-white/10">
            Groq API key status: <strong>{hasKey ? "saved in database" : "not configured"}</strong>
          </div>
        </div>
        <TextInput label="Groq API key" name="groqApiKey" type="password" />
        <TextInput label="Groq model" name="groqModel" defaultValue={model} />
        <p className="text-sm text-ink/55 dark:text-white/55">Default model uses Groq production `llama-3.1-8b-instant`. You can paste another supported model ID here later.</p>
        <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-3 text-lg font-bold">Time Zone</h2>
          <label className="grid gap-1.5">
            <span className="label">Timezone</span>
            <select className="field" name="timeZone" defaultValue={timeZone}>
              {["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Puerto_Rico", "UTC", "Europe/Madrid"].map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-sm text-ink/55 dark:text-white/55">Assistant actions use this for relative dates like tomorrow, today, this weekend, and next week.</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="mb-3 text-lg font-bold">Assistant Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox label="Creating items" name="assistantActionsCreate" defaultChecked={enabled("assistantActionsCreate")} />
            <Checkbox label="Updating items" name="assistantActionsUpdate" defaultChecked={enabled("assistantActionsUpdate")} />
            <Checkbox label="Deleting/archive actions" name="assistantActionsArchive" defaultChecked={enabled("assistantActionsArchive")} />
            <Checkbox label="Calendar actions" name="assistantActionsCalendar" defaultChecked={enabled("assistantActionsCalendar")} />
            <Checkbox label="Task actions" name="assistantActionsTask" defaultChecked={enabled("assistantActionsTask")} />
          </div>
        </div>
        <button className="btn btn-primary">Save AI settings</button>
      </form>
    </AppShell>
  );
}
