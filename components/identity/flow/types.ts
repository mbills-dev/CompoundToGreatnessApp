import { WhenPickerValue } from '../WhenPickerModal';

export type DecodePath = 'numbers' | 'practice' | 'starting';

export interface FlowGoal {
  id: number;
  label: string;
  deriveLabel?: (currentTarget: string) => string;
  category: string;
  deadline: string;
  practiceSeed?: string;
  defaultPath: DecodePath;
  inheritedTarget?: string;
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
  what: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  isStandard?: boolean;
  decodePath: DecodePath;
  resolvedTargetStr?: string;
  additionalInputs: AnchoredInput[];
}
