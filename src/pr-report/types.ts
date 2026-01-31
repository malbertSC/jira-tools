// Inline content that can be rendered differently per format
export type ReportInline =
  | string
  | { type: 'link'; text: string; url: string }
  | { type: 'user'; name: string }  // @mentions
  | { type: 'emoji'; name: string }
  | { type: 'strikethrough'; content: ReportInline[] };

// Block-level content
export type ReportBlock =
  | { type: 'header'; text: string; emoji?: string }
  | { type: 'section'; content: ReportInline[] }
  | { type: 'list'; items: ReportInline[][] }
  | { type: 'divider' }
  | { type: 'context'; content: ReportInline[] };  // small/muted text

export type Report = ReportBlock[];
