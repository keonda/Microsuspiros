import type { ShiftState } from "@/types/shift";

export interface AiSuggestionProvider {
  suggestNextPrompt(state: ShiftState): Promise<string | null>;
  predictShortages(state: ShiftState): Promise<string[]>;
  cleanOcrItemName(rawText: string): Promise<string>;
}

export class PlaceholderAiSuggestionProvider implements AiSuggestionProvider {
  async suggestNextPrompt() {
    // TODO Phase 2: use routine history to suggest reminders and checklist adjustments.
    return null;
  }

  async predictShortages() {
    // TODO Phase 2: predict shortages by day/time and recent restock history.
    return [];
  }

  async cleanOcrItemName(rawText: string) {
    // TODO Phase 2: plug in Google Vision, Gemini, OpenAI, or another OCR/name cleanup provider.
    return rawText.trim();
  }
}
