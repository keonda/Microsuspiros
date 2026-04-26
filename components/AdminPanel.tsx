"use client";

import { useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  disabled: boolean;
  _count: { notes: number; mediaFiles: number };
};

type Stats = { users: number; notes: number; mediaFiles: number; storageBytes: number };

export function AdminPanel({ initialUsers, stats }: { initialUsers: AdminUser[]; stats: Stats }) {
  const [users, setUsers] = useState(initialUsers);

  async function updateUser(userId: string, patch: Partial<AdminUser>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch })
    });
    const data = await response.json();
    if (response.ok) {
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, ...data.user } : user)));
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Users", stats.users],
          ["Notes", stats.notes],
          ["Media", stats.mediaFiles],
          ["Storage MB", (stats.storageBytes / 1024 / 1024).toFixed(2)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Content</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <select value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as AdminUser["role"] })} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={user.disabled} onChange={(event) => updateUser(user.id, { disabled: event.target.checked })} />
                    Disabled
                  </label>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {user._count.notes} notes · {user._count.mediaFiles} files
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
