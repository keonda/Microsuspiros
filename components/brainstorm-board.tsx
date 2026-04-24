"use client";

import { useTransition } from "react";
import type { BrainstormCard, BrainstormColumn } from "@prisma/client";

type ColumnWithCards = BrainstormColumn & { cards: BrainstormCard[] };

export function BrainstormBoard({
  projectId,
  columns,
  moveCard
}: {
  projectId: string;
  columns: ColumnWithCards[];
  moveCard: (projectId: string, cardId: string, columnId: string) => Promise<void>;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="min-h-96 rounded-xl bg-parchment p-4 ring-1 ring-stone-200"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const cardId = event.dataTransfer.getData("text/plain");
            if (cardId) startTransition(() => void moveCard(projectId, cardId, column.id));
          }}
        >
          <h2 className="font-serif text-xl font-bold">{column.title}</h2>
          <div className="mt-4 space-y-3">
            {column.cards.map((card) => (
              <article
                key={card.id}
                id={card.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)}
                className="cursor-grab rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200"
                style={{ borderTop: `5px solid ${card.color}` }}
              >
                <h3 className="font-semibold">{card.title}</h3>
                {card.body ? <p className="mt-2 text-sm leading-6 text-stone-600">{card.body}</p> : null}
                {card.tagsText ? <p className="mt-3 text-xs text-cedar">{card.tagsText}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
