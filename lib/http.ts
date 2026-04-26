import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return apiError(error.errors[0]?.message ?? "Invalid request", 422);
  }
  console.error(error);
  return apiError("Something went wrong", 500);
}
