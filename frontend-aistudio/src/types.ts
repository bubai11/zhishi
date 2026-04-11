export interface PlantCard {
  id: string;
  chinese_name: string;
  scientific_name: string;
  family: string;
  family_scientific_name?: string | null;
  cover_image: string | null;
  short_desc: string;
  category?: string | null;
}

export interface PlantListResponse {
  list: PlantCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlantStats {
  total_species: number;
  total_images: number;
  active_users: number;
}

export interface PlantDetailResponse {
  id: string;
  chinese_name: string;
  scientific_name: string;
  family_name: string;
  genus_name: string;
  cover_image: string | null;
  taxonomy: Record<string, string | null>;
  images: string[];
  model_url?: string | null;
  ecology: {
    light: number;
    water: number;
    temperature: number;
    air: number;
  };
  detail: {
    intro: string;
    morphology: string;
    ecology_importance: string;
    distribution_text: string;
  };
  observation_count: number;
  conservation_status?: string | null;
  iucn_category?: string | null;
  translation_source?: string | null;
  translation_confidence?: number;
}

export interface TaxaFamily {
  id: string;
  name: string;
  chinese_name?: string | null;
  scientific_name: string;
  species_count: number;
}

export interface TaxonomyNode {
  id: string;
  name: string;
  rank: string;
  scientific_name: string;
  description?: string | null;
  has_children?: boolean;
  children?: TaxonomyNode[];
}

export interface Genus {
  id: string;
  name: string;
  scientific_name: string;
  family_name: string;
  cover_image: string | null;
  species_count?: number;
}

export interface AnalyticsSummary {
  total_species: number;
  critical_regions: number;
  annual_growth_rate: string;
  protected_areas: number;
}

export interface DiversityItem {
  name: string;
  scientific_name?: string;
  percentage: number;
}

export interface RegionalData {
  region: string;
  density_label: string;
  species_count: number;
  trend: string;
}

export interface Alert {
  id?: number;
  plant_id?: number | null;
  title?: string;
  alert_month?: string;
  scientific_name?: string;
  old_category?: string | null;
  new_category?: string;
  change_type?: 'new_assessment' | 'downgraded' | 'upgraded' | 'new_addition';
  alert_reason?: string;
  alert_level?: 'high' | 'medium' | 'low';
  is_read?: boolean;
  is_dismissed?: boolean;
  plant?: {
    chinese_name?: string;
    scientific_name?: string;
  };
  threatenedSpecies?: {
    chinese_name?: string;
    red_list_category?: string;
  };
}

export interface AlertListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  data: Alert[];
}

export interface Favorite {
  plant_id: string;
  chinese_name: string;
  scientific_name: string;
  cover_image: string | null;
  category?: string | null;
  saved_at?: string;
}

export interface FavoriteStatus {
  plant_id: string;
  is_favorite: boolean;
}

export interface BrowseRecord {
  plant_id: string;
  plant_name: string;
  last_viewed_at: string;
  view_count: number;
}

export interface WeeklyActivity {
  day: string;
  value: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  option_ids: number[];
  analysis: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  date: string;
  score: number;
  topic: string;
}

export interface QuizSubmitPayload {
  answers: Array<{
    question_id: number;
    chosen_option_id: number;
  }>;
}

export interface QuizResult {
  score: number;
  total: number;
  correct_count: number;
  results: Array<{
    question_id: number;
    correct: boolean;
    correct_answer: number;
    analysis: string;
  }>;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  level: number;
  points: number;
  bio?: string;
}

export interface UserStats {
  avg_quiz_score: number;
  streak_days: number;
  badges_unlocked: number;
  favorites_count: number;
  notes_count: number;
  notifications_count: number;
}

export interface Achievement {
  name: string;
  icon: string;
  earned_at: string;
}

export interface LoginResult {
  token: string;
  username: string;
}
