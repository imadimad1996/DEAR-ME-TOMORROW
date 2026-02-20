export type LocalizationParams = Record<string, string | number | undefined>;

export class Localization {
  constructor(private readonly dictionary: Record<string, string>) {}

  public t(key: string, params?: LocalizationParams): string {
    const template = this.dictionary[key] ?? key;
    if (!params) {
      return template;
    }
    return Object.entries(params).reduce((text, [name, value]) => {
      return text.replaceAll(`{${name}}`, String(value ?? ''));
    }, template);
  }
}
