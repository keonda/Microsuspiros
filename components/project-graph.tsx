"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type GraphNode = { id: string; type: string; title: string; href: string };
type GraphEdge = { source: string; target: string; label: string };

export function ProjectGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [visible, setVisible] = useState<Record<string, boolean>>({ DOCUMENT: true, STORY_NOTE: true, RESEARCH_NOTE: true, RESOURCE: true, SCENE: true, STORY_ENTITY: true });
  const filtered = nodes.filter((node) => visible[node.type]);
  const positions = useMemo(() => {
    const center = { x: 360, y: 260 };
    const radius = 210;
    return new Map(
      filtered.map((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(filtered.length, 1);
        return [node.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }];
      })
    );
  }, [filtered]);
  const nodeIds = new Set(filtered.map((node) => node.id));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {Object.keys(visible).map((type) => (
          <label key={type} className="flex items-center gap-2 rounded-md bg-[var(--muted)] px-3 py-2 text-[var(--foreground)]">
            <input type="checkbox" checked={visible[type]} onChange={(event) => setVisible((value) => ({ ...value, [type]: event.target.checked }))} />
            {type.replace("_", " ").toLowerCase()}
          </label>
        ))}
      </div>
      <svg viewBox="0 0 720 520" className="h-[520px] w-full rounded-lg bg-[var(--muted)]">
        {edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge, index) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          return <line key={`${edge.source}-${edge.target}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#9c7b72" strokeOpacity="0.45" strokeWidth="2" />;
        })}
        {filtered.map((node) => {
          const pos = positions.get(node.id)!;
          return (
            <g key={node.id}>
              <circle cx={pos.x} cy={pos.y} r="34" fill={colorFor(node.type)} />
              <foreignObject x={pos.x - 64} y={pos.y + 40} width="128" height="48">
                <Link href={node.href} className="block text-center text-xs font-semibold leading-tight text-[var(--foreground)]">
                  {node.title}
                </Link>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function colorFor(type: string) {
  if (type === "DOCUMENT") return "#9c7b72";
  if (type === "STORY_NOTE") return "#75886f";
  if (type === "RESEARCH_NOTE") return "#c5a65a";
  if (type === "SCENE") return "#b46d57";
  if (type === "STORY_ENTITY") return "#7ea9be";
  return "#57636a";
}
