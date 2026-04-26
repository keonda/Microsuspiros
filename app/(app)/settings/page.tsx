import Link from "next/link";
import { SettingsPanel } from "@/components/SettingsPanel";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const [preferences, aiSettings] = await Promise.all([
    prisma.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } }),
    prisma.aiSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  ]);
  return (
    <main className="min-h-screen bg-paper p-6 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm text-clay dark:text-amber-300">
          Back to notes
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Settings</h1>
        <SettingsPanel
          preferences={preferences}
          aiSettings={{
            hasGroqKey: Boolean(aiSettings.groqApiKeyEncrypted),
            keyLastFour: aiSettings.keyLastFour,
            groqModel: aiSettings.groqModel
          }}
        />
      </div>
    </main>
  );
}
