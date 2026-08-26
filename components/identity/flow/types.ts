import { WhenPickerValue } from '../WhenPickerModal';

export type DecodePath = 'numbers' | 'practice' | 'starting';

export type NumbersSubtype = 'funnel' | 'direct';

export interface TargetResolution {
  type: 'inferred' | 'ask';
  value?: number;
  unit?: string;
  question?: string;
  suggestions?: string[];
}

export interface FlowGoal {
  id: number;
  label: string;
  deriveLabel?: (currentTarget: string) => string;
  category: string;
  deadline: string;
  practiceSeed?: string;
  defaultPath: DecodePath;
  inheritedTarget?: string;
  estimatedMasteryHours?: number;
  numbersSubtype?: NumbersSubtype;
  directUnit?: string;
  targetResolution?: TargetResolution | null;
}

export interface AnchoredInput {
  dailyInput: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  isStandard?: boolean;
}

export interface LockedGoal {
  goalId: number;
  dailyInput: string;
  goalLabel: string;
  doneLooksText?: string;
  identityLine?: string;
  what: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  isStandard?: boolean;
  decodePath: DecodePath;
  resolvedTargetStr?: string;
  periodSuffix?: 'week' | 'month' | 'year';
  additionalInputs: AnchoredInput[];
}
