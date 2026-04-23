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
  distribution_count: number;
  observation_count?: number;
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

export interface TaxonomySearchHit extends TaxonomyNode {
  matched_name?: string;
  match_source?: 'taxon' | 'plant';
  path?: TaxonomyNode[];
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
  threatened_species?: number;
  protected_areas: number;
}

export interface DiversityItem {
  name: string;
  scientific_name?: string;
  count?: number;
  percentage: number;
}

export interface RegionalData {
  area_code_l3?: string;
  region: string;
  region_zh?: string;
  density_label: string;
  species_count: number;
  introduced_count?: number;
  native_count?: number;
  protected_area_count?: number;
  high_risk_species_count?: number;
  trend: string;
}

export interface ProtectedAreaGroupCount {
  iucn_category?: string | null;
  site_type?: string | null;
  realm?: string | null;
  count: number;
}

export interface ProtectedArea {
  site_id: number;
  site_pid?: number | null;
  source_type?: string | null;
  site_type?: string | null;
  name_eng?: string | null;
  name_local?: string | null;
  designation?: string | null;
  designation_eng?: string | null;
  designation_type?: string | null;
  iucn_category?: string | null;
  status?: string | null;
  status_year?: number | null;
  iso3?: string | null;
  parent_iso3?: string | null;
  realm?: string | null;
  gis_area?: number | string | null;
  rep_area?: number | string | null;
  governance_type?: string | null;
  management_authority?: string | null;
  management_plan?: string | null;
  conservation_objective?: string | null;
  data_source?: string | null;
}

export interface ProtectedAreaStats {
  total: number;
  byCategory: ProtectedAreaGroupCount[];
  byType: ProtectedAreaGroupCount[];
  byRealm: ProtectedAreaGroupCount[];
}

export interface ProtectedAreaListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  data: ProtectedArea[];
}

export interface RegionProtectionSummary {
  area_code_l3: string;
  region: string;
  species_count: number;
  country_codes: string[];
  protected_area_count: number;
  high_risk_species_count: number;
  protection_prompt: string;
  species_records: Array<{
    id: number;
    chinese_name?: string | null;
    scientific_name?: string | null;
    family?: string | null;
    genus?: string | null;
    occurrence_status?: string | null;
  }>;
  high_risk_species: Array<{
    id: number;
    plant_id?: number | null;
    chinese_name?: string | null;
    scientific_name?: string | null;
    red_list_category?: string | null;
    population_trend?: string | null;
    conservation_actions?: string | null;
  }>;
  protected_areas: ProtectedArea[];
  protected_area_categories: Array<{ iucn_category: string; count: number }>;
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
