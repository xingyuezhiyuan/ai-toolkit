export type Lang = 'en' | 'zh';

export interface Dict {
  /** trimmed exact original -> translation */
  exact: Record<string, string>;
  /** skeleton (numbers normalized to '#') -> translation with {0},{1}.. backfill */
  templates: Record<string, string>;
  /** originals (trimmed or skeleton) deliberately left in English; suppresses miss logging */
  allowEnglish: string[];
}
