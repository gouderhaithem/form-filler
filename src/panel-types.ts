export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export interface FieldReport {
  id: string;
  label: string;
  status: 'ready' | 'filled' | 'skipped' | 'incompatible';
  reason: string;
  value?: string;
  editable: boolean;
}
export interface ControlSnapshot { value: string; checked?: boolean; selected?: boolean[] }
export interface UndoEntry { element: Control; before: ControlSnapshot; after: ControlSnapshot }
export interface PanelPageState {
  elements: Map<string, Control>;
  ids: WeakMap<Control, string>;
  reports: Map<Control, FieldReport>;
  undo: UndoEntry[];
}
export interface PanelReply {
  ok: boolean;
  error?: string;
  tabId?: number;
  documentId?: string;
  origin?: string;
  fields?: FieldReport[];
  canUndo?: boolean;
  restored?: number;
  kept?: number;
}
