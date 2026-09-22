import { WhenPickerValue } from '../WhenPickerModal';

export type DecodePath = 'numbers' | 'practice' | 'starting' | 'body_composition';

export type BodyCompositionSubtype = 'fat_loss' | 'muscle_gain' | 'recomposition';

export interface FatLossGoalAmount {
  type: 'lose' | 'reach';
  lbs: number;
}

export interface BodyCompositionData {
  subtype: BodyCompositionSubtype;
  goalAmount?: FatLossGoalAmount;
  currentWeightLbs?: number;
  heightInches?: number;
  age?: number;
  sex?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
  pace?: 'steady' | 'recommended' | 'faster';
  calculationResult?: FatLossCalculationResult;
  selectedInputs?: BodyCompStackInput[];
  confirmedInputs?: BodyCompStackInput[];
}

export interface FatLossCalculationResult {
  bmr: number;
  maintenanceCalories: number;
  suggestedCalorieTarget: number;
  suggestedProteinGrams: number;
  estimatedWeeklyRateLbs: number;
  estimatedWeeks: number;
  startingWeightLbs: number;
  targetWeightLbs: number;
  warnings: string[];
}

export interface BodyCompStackInput {
  id: string;
  label: string;
  dailyInput: string;
  when: string;
  where: string;
  category: 'calories' | 'protein' | 'steps' | 'exercise' | 'nutrition_rule' | 'hydration' | 'bedtime';
  selected: boolean;
  valueDetail?: string;
}

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
  category: string;
  deadline: string;
  practiceSeed?: string;
  defaultPath: DecodePath;
  inheritedTarget?: string;
  estimatedMasteryHours?: number;
  numbersSubtype?: NumbersSubtype;
  directUnit?: string;
  targetResolution?: TargetResolution | null;
  dailyTrackingUnit?: { unit: string; perTargetUnit: number } | null;
  bodyCompData?: BodyCompositionData;
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
  originalGoalLabel?: string;
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
