import { updateAISettingsAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await prisma.aISettings.findUnique({ where: { userId: user.id } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-bold">Settings</h1>
      <section className="mt-5 rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="font-serif text-2xl font-bold">AI Assistant</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Groq is optional. Your API key is encrypted before it is stored and is never sent to the browser.
        </p>
        <form action={updateAISettingsAction} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Provider
            <select className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2" name="provider" defaultValue={settings?.provider || "GROQ"}>
              <option value="GROQ">Groq</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Model
            <input className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2" name="model" defaultValue={settings?.model || "llama-3.1-8b-instant"} />
          </label>
          <label className="block text-sm font-medium">
            API key
            <input className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2" name="apiKey" type="password" placeholder={settings?.apiKeyEncrypted ? "Saved. Leave blank to keep current key." : "gsk_..."} />
          </label>
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Save AI settings</button>
        </form>
      </section>
    </main>
  );
}
