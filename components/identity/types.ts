export interface Dimension {
  category: string;
  label: string;
  vague: string;
  specific: string;
  icon: string;
  originalInput?: string;
  // Additive decode fields — only present for goals decoded via the new flow.
  decodePath?: 'numbers' | 'practice' | 'starting';
  resolvedTargetStr?: string;
  dailyNumber?: number;
  winNoun?: string;
  actionNoun?: string;
  ratio?: number;
  isStandard?: boolean;
}

export interface RefineSuggestion {
  question: string;
  suggestions: string[];
  template: string;
  identity: string;
  alreadySpecific?: boolean;
}

export interface TaskSuggestion {
  name: string;
  timeEstimate: string;
}

export interface TaskGroup {
  dimension: string;
  tasks: TaskSuggestion[];
}

export interface CompassData {
  vision: string;
  declaration: string;
  filterQuestion: string;
}

export interface RawInputEntry {
  what: string;
  when_time: string;
  where_location: string;
  schedule: import('./WhenPickerModal').WhenPickerValue | null;
}

export interface IdentityBuilderResult {
  identityStatement: string;
  dimensions: Dimension[];
  inputs: string[];
  rawInputs: RawInputEntry[];
  compass: CompassData;
}

export type IdentityStep =
  | 'vague-goal'
  | 'processing'
  | 'refine'
  | 'dimension-input'
  | 'review'
  | 'tasks'
  | 'commit'
  | 'compass-story'
  | 'compass-define'
  | 'compass-sharpen'
  // New mockup-flow steps
  | 'splash'
  | 'welcome-0'
  | 'welcome-1'
  | 'welcome-2'
  | 'goals-entry'
  | 'intro'
  | 'path-select'
  | 'goal-done-looks'
  | 'goal-fuel-redirect'
  | 'decode'
  | 'anchor'
  | 'add-input'
  | 'locked'
  | 'identity'
  | 'compass-domino'
  | 'compass-mechanism'
  | 'finale-0'
  | 'finale-1'
  | 'finale-2'
  | 'signature';

export const ADDITIONAL_DIMENSIONS: { category: string; label: string; icon: string; prompt: string }[] = [
  { category: 'relationships', label: 'Relationships / Family', icon: 'Heart', prompt: 'Be a better dad, partner, friend' },
  { category: 'faith', label: 'Purpose / Faith', icon: 'Star', prompt: 'Live with intention, serve others' },
  { category: 'lifestyle', label: 'Energy / Lifestyle', icon: 'Zap', prompt: 'Wake early, own your mornings' },
  { category: 'fitness', label: 'Fitness / Health', icon: 'Dumbbell', prompt: 'Get stronger, leaner, healthier' },
  { category: 'professional', label: 'Professional / Finances', icon: 'Briefcase', prompt: 'Earn more, build wealth' },
  { category: 'personal', label: 'Personal Growth', icon: 'Target', prompt: 'Learn, grow, improve daily' },
];
