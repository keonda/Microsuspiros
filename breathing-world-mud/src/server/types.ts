import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export type ParsedCommand =
  | { action: "look" }
  | { action: "go"; direction: Direction }
  | { action: "inventory" }
  | { action: "take"; target: string }
  | { action: "drop"; target: string }
  | { action: "examine"; target: string }
  | { action: "talk"; target: string }
  | { action: "attack"; target: string }
  | { action: "use"; target: string }
  | { action: "rest" }
  | { action: "help" }
  | { action: "search" }
  | { action: "unknown"; raw: string };
