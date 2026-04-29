import type { Direction, ParsedCommand } from "../types.js";

const directions: Record<string, Direction> = {
  n: "north",
  north: "north",
  s: "south",
  south: "south",
  e: "east",
  east: "east",
  w: "west",
  west: "west",
  u: "up",
  up: "up",
  d: "down",
  down: "down"
};

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return { action: "unknown", raw };
  if (directions[normalized]) return { action: "go", direction: directions[normalized] };
  if (normalized === "look" || normalized === "look around" || normalized === "l") return { action: "look" };
  if (normalized === "inventory" || normalized === "inv" || normalized === "i") return { action: "inventory" };
  if (normalized === "rest" || normalized === "sleep") return { action: "rest" };
  if (normalized === "help" || normalized === "?") return { action: "help" };

  const goMatch = normalized.match(/^(go|walk|move|travel|head)\s+(north|south|east|west|up|down|n|s|e|w|u|d)$/);
  if (goMatch) return { action: "go", direction: directions[goMatch[2]] };

  const patterns: Array<[RegExp, ParsedCommand["action"]]> = [
    [/^(take|grab|get|pick up)\s+(.+)$/, "take"],
    [/^(drop|leave)\s+(.+)$/, "drop"],
    [/^(examine|inspect|study|look at)\s+(.+)$/, "examine"],
    [/^(talk to|talk|speak with|speak to|ask)\s+(.+)$/, "talk"],
    [/^(attack|hit|strike|fight)\s+(.+)$/, "attack"],
    [/^(use|activate)\s+(.+)$/, "use"]
  ];

  for (const [pattern, action] of patterns) {
    const match = normalized.match(pattern);
    if (match?.[2]) return { action, target: match[2] } as ParsedCommand;
  }

  return { action: "unknown", raw };
}

