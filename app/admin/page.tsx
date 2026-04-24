import { updateUserAdminAction } from "@/actions/writer-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { projects: true } } } });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-bold">Admin</h1>
      <div className="mt-5 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment text-xs uppercase tracking-[0.14em] text-stone-500">
            <tr><th className="p-3">User</th><th className="p-3">Projects</th><th className="p-3">Role</th><th className="p-3">Disabled</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="p-3"><strong>{user.displayName}</strong><br /><span className="text-stone-500">{user.email}</span></td>
                <td className="p-3">{user._count.projects}</td>
                <td className="p-3" colSpan={3}>
                  <form action={updateUserAdminAction.bind(null, user.id)} className="flex flex-wrap items-center gap-3">
                    <select className="rounded-md border border-stone-200 px-3 py-2" name="role" defaultValue={user.role}>
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <label className="flex items-center gap-2"><input name="disabled" type="checkbox" defaultChecked={user.disabled} /> Disabled</label>
                    <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-parchment">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
