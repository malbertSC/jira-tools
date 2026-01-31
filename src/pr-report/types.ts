// Inline content that can be rendered differently per format
export type ReportInline =
  | string
  | { type: 'link'; text: string; url: string }
  | { type: 'pr-link'; repo: string; prNumber: number; url: string }
  | { type: 'user'; name: string }  // @mentions
  | { type: 'emoji'; name: string }
  | { type: 'strikethrough'; content: ReportInline[] };

// Block-level content
export type ReportBlock =
  | { type: 'header'; text: string; emoji?: string }
  | { type: 'section'; content: ReportInline[] }
  | { type: 'list'; items: ReportInline[][] }
  | { type: 'rocket-list'; items: ReportInline[][] }
  | { type: 'quote'; content: ReportInline[] }
  | { type: 'divider' }
  | { type: 'context'; content: ReportInline[] };

export type Report = ReportBlock[];
