import * as z from 'zod';

// Basic Types
export const CurrencySchema = z.number().nullable().optional();
export const AttributeSchema = z.number().min(1).max(20).nullable().optional();
export const StatisticSchema = z.union([z.number(), z.string().trim()]).nullable().optional();
export const DateSchema = z.union([z.date(), z.string().trim()]).nullable().optional();

// Player Schema Definition based on SchemaRegistry
export const PlayerSchema = z.looseObject({
  attribute_acceleration: AttributeSchema,
  // Goalkeeper Attributes
  attribute_aerial_reach: AttributeSchema,
  attribute_aggression: AttributeSchema,
  attribute_agility: AttributeSchema,
  // Mental Attributes
  attribute_anticipation: AttributeSchema,
  attribute_balance: AttributeSchema,
  attribute_bravery: AttributeSchema,
  attribute_command_of_area: AttributeSchema,
  attribute_communication: AttributeSchema,
  attribute_composure: AttributeSchema,
  attribute_concentration: AttributeSchema,
  // Technical Attributes
  attribute_corners: AttributeSchema,
  attribute_crossing: AttributeSchema,
  attribute_decisions: AttributeSchema,
  attribute_determination: AttributeSchema,
  attribute_dribbling: AttributeSchema,
  attribute_eccentricity: AttributeSchema,
  attribute_finishing: AttributeSchema,
  attribute_first_touch: AttributeSchema,
  attribute_flair: AttributeSchema,
  attribute_free_kicks: AttributeSchema,
  attribute_handling: AttributeSchema,
  attribute_heading: AttributeSchema,

  attribute_jumping_reach: AttributeSchema,
  attribute_kicking: AttributeSchema,
  attribute_leadership: AttributeSchema,
  attribute_long_shots: AttributeSchema,
  attribute_long_throws: AttributeSchema,
  attribute_marking: AttributeSchema,
  attribute_natural_fitness: AttributeSchema,
  attribute_off_the_ball: AttributeSchema,

  attribute_one_on_ones: AttributeSchema,
  // Physical Attributes
  attribute_pace: AttributeSchema,
  attribute_passing: AttributeSchema,
  attribute_penalty_taking: AttributeSchema,
  attribute_positioning: AttributeSchema,
  attribute_reflexes: AttributeSchema,
  attribute_rushing_out: AttributeSchema,
  attribute_stamina: AttributeSchema,
  attribute_strength: AttributeSchema,
  attribute_tackling: AttributeSchema,
  attribute_teamwork: AttributeSchema,
  attribute_technique: AttributeSchema,
  attribute_tendency_to_punch: AttributeSchema,
  attribute_throwing: AttributeSchema,

  attribute_vision: AttributeSchema,
  attribute_work_rate: AttributeSchema,
  basic_asking_price: CurrencySchema,
  basic_based_in: z.string().trim().optional(),
  basic_club: z.string().trim().optional(),
  basic_contract_type: z.string().trim().optional(),
  basic_contract_type_detail: z.string().trim().optional(),
  basic_division: z.string().trim().optional(),
  basic_dob: DateSchema,
  basic_eu_national: z.string().trim().optional(),
  basic_expires: DateSchema,
  basic_home_grown_status: z.string().trim().optional(),
  basic_left_foot: z.string().trim().optional(),
  basic_media_handling: z.string().trim().optional(),

  // Basic Info
  basic_name: z.string().trim(),
  basic_nationality: z.string().trim().optional(),
  basic_personality: z.string().trim().optional(),
  basic_position: z.string().trim().optional(),
  basic_right_foot: z.string().trim().optional(),
  basic_sec_position: z.string().trim().optional(),
  basic_second_nationality: z.string().trim().optional(),
  basic_style: z.string().trim().optional(),
  basic_transfer_value: CurrencySchema,
  basic_uid: z.string().trim(), // Required per SchemaRegistry (lines 31-36)
  basic_wage: CurrencySchema, // Supports frequency handling in processor

  // Metadata maintained by processor
  index: z.int().nonnegative().optional(), // Row index in original file
  rowId: z.string().trim().optional(), // Unique ID for table row keys
  // Statistics
  statistic_apps: StatisticSchema,
  statistic_assists: StatisticSchema,
  statistic_average_rating: StatisticSchema,
  statistic_blocks: StatisticSchema,
  statistic_chances_created_per_90: StatisticSchema,
  statistic_clean_sheets: StatisticSchema,
  statistic_clear_cut_chances: StatisticSchema,
  statistic_clearances: StatisticSchema,
  statistic_crosses_attempted: StatisticSchema,
  statistic_crosses_completed: StatisticSchema,
  statistic_distance: StatisticSchema,
  statistic_dribbles: StatisticSchema,
  statistic_fouls: StatisticSchema,
  statistic_fouls_against: StatisticSchema,
  statistic_free_kick_shots: StatisticSchema,
  statistic_goals: StatisticSchema,
  statistic_goals_conceded: StatisticSchema,
  statistic_goals_outside_box: StatisticSchema,
  statistic_headers_attempted: StatisticSchema,
  statistic_headers_won: StatisticSchema,
  statistic_interceptions: StatisticSchema,
  statistic_key_headers_per_90: StatisticSchema,
  statistic_key_passes: StatisticSchema,
  statistic_key_tackles: StatisticSchema,
  statistic_mins: StatisticSchema,
  statistic_mistakes_leading_to_goal: StatisticSchema,
  statistic_offsides: StatisticSchema,
  statistic_open_play_crosses_attempted: StatisticSchema,
  statistic_open_play_crosses_completed: StatisticSchema,
  statistic_open_play_key_passes: StatisticSchema,
  statistic_passes_attempted: StatisticSchema,
  statistic_passes_completed: StatisticSchema,
  statistic_penalties: StatisticSchema,
  statistic_penalties_faced: StatisticSchema,
  statistic_penalties_saved: StatisticSchema,
  statistic_penalties_scored: StatisticSchema,
  statistic_player_of_match: StatisticSchema,
  statistic_possession_lost_per_90: StatisticSchema,
  statistic_possession_won_per_90: StatisticSchema,
  statistic_pressures_attempted: StatisticSchema,
  statistic_pressures_completed: StatisticSchema,
  statistic_progressive_passes: StatisticSchema,
  statistic_red_cards: StatisticSchema,
  statistic_saves_held: StatisticSchema,
  statistic_saves_parried: StatisticSchema,
  statistic_saves_tipped: StatisticSchema,
  statistic_shots: StatisticSchema,
  statistic_shots_blocked: StatisticSchema,
  statistic_shots_on_target: StatisticSchema,
  statistic_shots_outside_box_per_90: StatisticSchema,
  statistic_sprints_per_90: StatisticSchema,
  statistic_tackles_attempted: StatisticSchema,
  statistic_tackles_completed: StatisticSchema,
  statistic_xa: StatisticSchema,
  statistic_xg: StatisticSchema,
  statistic_xgp: StatisticSchema,

  statistic_yellow_cards: StatisticSchema
}); // Allow unknown keys (Original Headers, Legacy Headers)

// File Metadata Schema
export const FileMetadataSchema = z.object({
  detectedLanguage: z.string().trim().optional(),
  // We keep the file reference generic as it might be a File object or proxy
  file: z.unknown().optional(),
  // Raw HTML content might be large, maybe we shouldn't keep it in memory for too long
  html: z.string().trim().optional(),
  missingOptional: z.array(z.string().trim()),
  missingRequired: z.array(z.string().trim()),
  name: z.string().trim(),
  parsedData: z.array(PlayerSchema),
  rowCount: z.int().nonnegative(),
  type: z.enum(['attr', 'stats', 'both', 'complete', 'unknown']),
  valid: z.boolean()
});
