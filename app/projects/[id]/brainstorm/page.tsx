import { BrainstormBoard } from "@/components/brainstorm-board";
import { createBrainstormCardAction, moveBrainstormCardAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BrainstormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let board = await prisma.brainstormBoard.findFirst({ where: { projectId: id, userId: user.id } });
  if (!board) {
    board = await prisma.brainstormBoard.create({
      data: {
        title: "Corkboard",
        projectId: id,
        userId: user.id,
        columns: { create: ["Ideas", "Maybe", "Important", "Later"].map((title, sortOrder) => ({ title, sortOrder, projectId: id })) }
      }
    });
  }
  const columns = await prisma.brainstormColumn.findMany({
    where: { boardId: board.id },
    orderBy: { sortOrder: "asc" },
    include: { cards: { orderBy: { sortOrder: "asc" } } }
  });

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Brainstorm</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <BrainstormBoard projectId={id} columns={columns} moveCard={moveBrainstormCardAction} />
        <div className="space-y-4">
          {columns.map((column) => (
            <form key={column.id} action={createBrainstormCardAction.bind(null, id, column.id)} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
              <h2 className="font-serif font-bold">Add to {column.title}</h2>
              <input className="mt-3 w-full rounded-md border border-stone-200 px-3 py-2" name="title" placeholder="Card title" required />
              <textarea className="mt-3 min-h-20 w-full rounded-md border border-stone-200 px-3 py-2" name="body" placeholder="Idea" />
              <input className="mt-3 w-full rounded-md border border-stone-200 px-3 py-2" name="tagsText" placeholder="tags" />
              <input className="mt-3 h-10 w-full rounded-md border border-stone-200 px-3 py-2" name="color" type="color" defaultValue="#f2d7a2" />
              <button className="mt-3 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-parchment">Add card</button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
