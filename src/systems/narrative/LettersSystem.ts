import type { Analytics } from '../analytics/Analytics';
import { AnalyticsEvents } from '../analytics/Events';

export interface LetterEntry {
  id: string;
  title: string;
  body: string;
}

export interface LetterProgress {
  id: string;
  opened: boolean;
  readMs: number;
  skipped: boolean;
}

export class LettersSystem {
  private readonly letters: LetterEntry[];
  private readonly progress = new Map<string, LetterProgress>();
  private openedAt = new Map<string, number>();

  constructor(letters: LetterEntry[], private readonly analytics: Analytics) {
    this.letters = letters;
    letters.forEach((entry) => {
      this.progress.set(entry.id, {
        id: entry.id,
        opened: false,
        readMs: 0,
        skipped: false,
      });
    });
  }

  public getLetters(): LetterEntry[] {
    return this.letters;
  }

  public getProgress(): LetterProgress[] {
    return Array.from(this.progress.values());
  }

  public loadProgress(entries: LetterProgress[]): void {
    entries.forEach((entry) => {
      const current = this.progress.get(entry.id);
      if (!current) {
        return;
      }
      current.opened = entry.opened;
      current.readMs = entry.readMs;
      current.skipped = entry.skipped;
    });
  }

  public openLetter(id: string): LetterEntry | null {
    const letter = this.letters.find((entry) => entry.id === id);
    if (!letter) {
      return null;
    }
    const progress = this.progress.get(id);
    if (progress && !progress.opened) {
      progress.opened = true;
      this.analytics.log(AnalyticsEvents.LETTERS_OPENED, { id });
    }
    this.openedAt.set(id, Date.now());
    return letter;
  }

  public closeLetter(id: string, skipped: boolean): void {
    const progress = this.progress.get(id);
    const openedAt = this.openedAt.get(id);
    if (!progress || openedAt == null) {
      return;
    }

    const delta = Date.now() - openedAt;
    progress.readMs += delta;
    progress.skipped = skipped || progress.skipped;

    this.analytics.log(AnalyticsEvents.LETTER_READ_TIME, {
      id,
      readMs: delta,
    });

    if (skipped) {
      this.analytics.log(AnalyticsEvents.LETTER_SKIP, { id });
    }

    this.openedAt.delete(id);
  }
}
