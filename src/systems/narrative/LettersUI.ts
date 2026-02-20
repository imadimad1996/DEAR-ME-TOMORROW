import * as PIXI from 'pixi.js';
import { SlidePanel } from '../../ui/Panels';
import { UITheme } from '../../ui/UITheme';
import { Button } from '../../ui/Button';
import type { LetterEntry } from './LettersSystem';

export class LettersUI {
  public readonly container = new PIXI.Container();
  private readonly panel = new SlidePanel(900, 1080, 0x1a2d41);
  private readonly openButton: Button;
  private readonly closeButton: Button;
  private readonly list = new PIXI.Container();
  private readonly title = new PIXI.Text('Letters', UITheme.text.body);
  private readonly content = new PIXI.Text('', {
    ...UITheme.text.body,
    wordWrap: true,
    wordWrapWidth: 560,
  });
  private opened = false;
  private letterButtons: Button[] = [];
  private activeLetterId: string | null = null;

  constructor(
    private readonly onOpenLetter: (id: string) => LetterEntry | null,
    private readonly onCloseLetter: (id: string, skipped: boolean) => void,
  ) {
    this.panel.configure(90, 1200, 320);
    this.title.position.set(20, 16);
    this.list.position.set(20, 68);
    this.content.position.set(320, 84);

    this.closeButton = new Button('Close', () => this.toggle(false), 140, 56);
    this.closeButton.container.position.set(730, 16);

    this.panel.container.addChild(this.title, this.list, this.content, this.closeButton.container);

    this.openButton = new Button('Letters', () => this.toggle(!this.opened), 180, 64);
    this.openButton.container.position.set(870, 76);

    this.container.addChild(this.panel.container, this.openButton.container);
  }

  public setLetters(letters: LetterEntry[]): void {
    this.list.removeChildren();
    this.letterButtons = [];

    letters.forEach((letter, index) => {
      const button = new Button(letter.title, () => this.selectLetter(letter.id), 280, 60);
      button.container.position.set(0, index * 72);
      this.list.addChild(button.container);
      this.letterButtons.push(button);
    });
  }

  public update(deltaMs: number): void {
    this.panel.update(deltaMs);
    this.openButton.update(deltaMs);
    this.closeButton.update(deltaMs);
    this.letterButtons.forEach((button) => button.update(deltaMs));
  }

  private toggle(next: boolean): void {
    this.opened = next;
    this.panel.setOpen(next);

    if (!next && this.activeLetterId) {
      this.onCloseLetter(this.activeLetterId, false);
      this.activeLetterId = null;
    }
  }

  private selectLetter(id: string): void {
    if (this.activeLetterId && this.activeLetterId !== id) {
      this.onCloseLetter(this.activeLetterId, true);
    }

    const letter = this.onOpenLetter(id);
    if (!letter) {
      return;
    }
    this.activeLetterId = id;
    this.content.text = `Dear me, tomorrow...\n\n${letter.body}`;
  }
}
