export type GoalType = 'business' | 'fitness' | 'health' | 'personal';
export type ActivityType = 'custom' | 'diet' | 'reading' | 'exercise';

export interface Goal {
  id: string;
  user_id: string | null;
  title: string;
  goal_type: GoalType;
  target_value: number;
  target_date: string;
  calculation_params: Record<string, any>;
  created_at: string;
  is_active: boolean;
  challenge_start_date: string | null;
  current_challenge_day: number;
  challenge_phase: 'challenge' | 'keep_going';
  last_completion_date: string | null;
  total_restarts: number;
  best_streak: number;
  celebration_seen: boolean;
  identity_statement: string | null;
  identity_dimensions: Record<string, any>[] | null;
  compass_vision: string | null;
  compass_declaration: string | null;
  compass_filter_question: string | null;
  grace_period_prompted_date: string | null;
  compound_score: number | null;
}

export interface DailyActivity {
  id: string;
  goal_id: string;
  activity_name: string;
  activity_type: ActivityType;
  target_count: number;
  order_position: number;
  created_at: string;
  what: string | null;
  when_time: string | null;
  where_location: string | null;
  schedule: Record<string, any> | null;
}

export interface DailyCompletion {
  id: string;
  goal_id: string;
  completion_date: string;
  activities_completed: string[];
  is_rest_day: boolean;
  completed_at: string | null;
  created_at: string;
  edited_at: string | null;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Encouragement {
  id: string;
  from_user_id: string;
  to_user_id: string;
  emoji: string;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Watcher {
  id: string;
  watcher_id: string;
  watched_id: string;
  created_at: string;
}

export interface EvidenceLog {
  id: string;
  goal_id: string;
  completion_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type ArchiveReason = 'completed' | 'restarted' | 'started_fresh';

export interface ChallengeArchive {
  id: string;
  user_id: string;
  goal_id: string | null;
  goal_title: string;
  start_date: string | null;
  end_date: string;
  days_completed: number;
  total_activities_completed: number;
  total_restarts: number;
  best_streak: number;
  reason: ArchiveReason;
  identity_statement: string | null;
  identity_dimensions: Record<string, any>[] | null;
  compass_vision: string | null;
  compass_declaration: string | null;
  compass_filter_question: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  goal_id: string;
  challenge_day: number;
  storage_url: string;
  is_milestone: boolean;
  is_shared_with_watchers: boolean;
  created_at: string;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial';

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan: string;
  provider: string;
  provider_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  day_end_time: string;
  morning_notifications: boolean;
  evening_notifications: boolean;
  save_progress_photos: boolean;
  created_at: string;
  updated_at: string;
}
