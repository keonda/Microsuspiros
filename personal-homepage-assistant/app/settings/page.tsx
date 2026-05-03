import { AppShell } from "@/components/app-shell";
import { PageTitle, TextInput } from "@/components/crud";
import { saveSettings } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireUser();
  const { saved } = await searchParams;
  const settings = await prisma.setting.findMany();
  const model = settings.find((item) => item.key === "groqModel")?.value ?? "llama-3.1-8b-instant";
  const hasKey = Boolean(settings.find((item) => item.key === "groqApiKey")?.value);

  return (
    <AppShell>
      <PageTitle title="Settings" subtitle="Private configuration stored in the database." />
      <form action={saveSettings} className="card max-w-2xl space-y-4">
        {saved && <p className="rounded-xl bg-moss/15 px-3 py-2 text-sm font-semibold text-moss">Settings saved.</p>}
        <div className="rounded-xl bg-ink/5 p-4 text-sm dark:bg-white/10">
          Groq API key status: <strong>{hasKey ? "saved in database" : "not configured"}</strong>
        </div>
        <TextInput label="Groq API key" name="groqApiKey" type="password" />
        <TextInput label="Groq model" name="groqModel" defaultValue={model} />
        <p className="text-sm text-ink/55 dark:text-white/55">Default model uses Groq’s production `llama-3.1-8b-instant`. You can paste another supported model ID here later.</p>
        <button className="btn btn-primary">Save AI settings</button>
      </form>
    </AppShell>
  );
}
