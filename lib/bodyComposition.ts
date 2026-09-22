/**
 * Body Composition calculation engine — isolated from UI.
 *
 * PENDING APPROVAL: The formulas below use the Mifflin-St Jeor equation for BMR
 * and standard activity multipliers for TDEE. These are widely-used estimation
 * formulas but have NOT been reviewed/approved by a qualified professional for
 * production use. The UI frames all outputs as estimates. Do NOT treat these
 * as medical guidance. Final guardrails must be locked separately.
 */

import type {
  BodyCompositionSubtype,
  FatLossCalculationResult,
  FatLossGoalAmount,
} from '@/components/identity/flow/types';

export interface FatLossInput {
  goalAmount: FatLossGoalAmount;
  currentWeightLbs: number;
  heightInches: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very';
  pace: 'steady' | 'recommended' | 'faster';
}

const LBS_PER_KG = 2.20462;
const INCHES_PER_CM = 0.393701;

const ACTIVITY_MULTIPLIERS: Record<FatLossInput['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

const PACE_DEFICITS: Record<FatLossInput['pace'], number> = {
  steady: 300,
  recommended: 500,
  faster: 750,
};

const MIN_SAFE_CALORIES_MALE = 1500;
const MIN_SAFE_CALORIES_FEMALE = 1200;
const MAX_WEEKLY_RATE_LBS = 2;

function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

function inchesToCm(inches: number): number {
  return inches / INCHES_PER_CM;
}

/**
 * Mifflin-St Jeor BMR equation.
 * Male:   10*kg + 6.25*cm - 5*age + 5
 * Female: 10*kg + 6.25*cm - 5*age - 161
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

function calculateMaintenance(bmr: number, activityLevel: FatLossInput['activityLevel']): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

function calculateProtein(weightLbs: number): number {
  const weightKg = lbsToKg(weightLbs);
  return Math.round(weightKg * 1.6);
}

/**
 * Derive target weight from goal amount and current weight.
 * - "lose" type: currentWeight - goalAmount.lbs
 * - "reach" type: goalAmount.lbs is the destination weight
 */
export function deriveTargetWeight(goalAmount: FatLossGoalAmount, currentWeightLbs: number): number {
  if (goalAmount.type === 'lose') {
    return Math.round((currentWeightLbs - goalAmount.lbs) * 10) / 10;
  }
  return goalAmount.lbs;
}

/**
 * Parse a fat-loss goal string to extract the goal amount.
 * Handles patterns like "Lose 20 lbs", "Drop 15 pounds", "Get down to 160 lbs".
 */
export function parseFatLossGoal(label: string): FatLossGoalAmount | null {
  const lower = label.toLowerCase().trim();

  const loseMatch = lower.match(/(?:lose|drop|shed|cut)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)/);
  if (loseMatch) {
    const lbs = parseFloat(loseMatch[1]);
    if (!isNaN(lbs) && lbs > 0) return { type: 'lose', lbs };
  }

  const reachMatch = lower.match(/(?:get|go|down)\s*(?:down|to)?\s*(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)/);
  if (reachMatch) {
    const lbs = parseFloat(reachMatch[1]);
    if (!isNaN(lbs) && lbs > 0) return { type: 'reach', lbs };
  }

  const weightMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)\s*(?:lighter|less|lower|weight loss)/);
  if (weightMatch) {
    const lbs = parseFloat(weightMatch[1]);
    if (!isNaN(lbs) && lbs > 0) return { type: 'lose', lbs };
  }

  return null;
}

/**
 * Check whether a goal label is a muscle-gain goal that should NOT route
 * through fat-loss math.
 */
export function isMuscleGainGoal(label: string): boolean {
  const lower = label.toLowerCase().trim();
  return /\b(gain|build|add|put on)\s+(?:\d+\s*(?:lbs?|pounds?)?)?\s*(?:muscle|mass|lean)/.test(lower)
    || /\b(?:muscle|lean mass|lean muscle)\b.*\b(?:gain|build|add|put on)\b/.test(lower);
}

/**
 * Check whether a goal label is a recomposition goal.
 */
export function isRecompositionGoal(label: string): boolean {
  const lower = label.toLowerCase().trim();
  return /\b(?:recomp|recomposition)\b/.test(lower)
    || (/\blose\s+fat\b/.test(lower) && /\b(?:build|gain)\s+(?:muscle|lean)\b/.test(lower));
}

export function calculateFatLoss(input: FatLossInput): FatLossCalculationResult {
  const warnings: string[] = [];

  const weightKg = lbsToKg(input.currentWeightLbs);
  const heightCm = inchesToCm(input.heightInches);

  const bmr = calculateBMR(weightKg, heightCm, input.age, input.sex);
  const maintenance = calculateMaintenance(bmr, input.activityLevel);

  let deficit = PACE_DEFICITS[input.pace];
  let calorieTarget = maintenance - deficit;

  const minSafe = input.sex === 'male' ? MIN_SAFE_CALORIES_MALE : MIN_SAFE_CALORIES_FEMALE;
  if (calorieTarget < minSafe) {
    calorieTarget = minSafe;
    deficit = maintenance - minSafe;
    warnings.push(`Calorie target adjusted to a safe minimum of ${minSafe} for your sex.`);
  }

  const targetWeight = deriveTargetWeight(input.goalAmount, input.currentWeightLbs);
  const totalLbsToLose = Math.max(0, input.currentWeightLbs - targetWeight);

  const dailyDeficit = Math.max(0, deficit);
  const weeklyRateLbs = Math.min(MAX_WEEKLY_RATE_LBS, Math.round((dailyDeficit * 7 / 3500) * 10) / 10);
  const estimatedWeeks = weeklyRateLbs > 0 ? Math.ceil(totalLbsToLose / weeklyRateLbs) : 0;

  if (weeklyRateLbs >= MAX_WEEKLY_RATE_LBS) {
    warnings.push('Capped at a maximum recommended rate of 2 lbs/week.');
  }

  if (totalLbsToLose <= 0) {
    warnings.push('Your current weight already meets or is below the target weight.');
  }

  const proteinGrams = calculateProtein(input.currentWeightLbs);

  return {
    bmr,
    maintenanceCalories: maintenance,
    suggestedCalorieTarget: calorieTarget,
    suggestedProteinGrams: proteinGrams,
    estimatedWeeklyRateLbs: weeklyRateLbs,
    estimatedWeeks,
    startingWeightLbs: input.currentWeightLbs,
    targetWeightLbs: targetWeight,
    warnings,
  };
}

/**
 * Detect body composition subtype from a goal label.
 * Returns null if the goal is not a body composition goal.
 */
export function detectBodyCompositionSubtype(label: string): BodyCompositionSubtype | null {
  if (isMuscleGainGoal(label)) return 'muscle_gain';
  if (isRecompositionGoal(label)) return 'recomposition';

  const lower = label.toLowerCase().trim();
  const fatLossPatterns = [
    /(?:lose|drop|shed|cut)\s+\d+/,
    /(?:lose|drop|shed|cut)\s+(?:fat|weight|lbs?|pounds?)/,
    /(?:get|go)\s+(?:down|to)\s+\d+\s*(?:lbs?|pounds?)/,
    /\d+\s*(?:lbs?|pounds?)\s*(?:lighter|less|lower|weight loss)/,
    /weight\s*loss/,
    /fat\s*loss/,
  ];
  if (fatLossPatterns.some(re => re.test(lower))) return 'fat_loss';

  return null;
}
