/**
 * SchemaRegistry - Defines the "golden standard" - internal column IDs independent of language
 * Exports to: window.SchemaRegistry
 *
 * Defines:
 * - Internal column IDs (attribute_pace, statistic_xg, contract_wage, etc.)
 * - Data types for each column (Attribute 1-20, Statistic Float, Currency, Enum, String Pass-through)
 * - Metadata (required, can be empty)
 * - Categories for Global Anchors (physical, mental, goalkeeper, statistic)
 */
class SchemaRegistry {
  constructor() {
    this.schema = this._buildSchema();
    this.categoryIndex = this._buildCategoryIndex();
  }

  /**
   * Build category index for fast lookups
   * @returns Category index mapping category to array of schema IDs
   */
  _buildCategoryIndex() {
    const index = {};

    for (const [schemaId, schemaInfo] of Object.entries(this.schema)) {
      const category = schemaInfo.category;
      if (category) {
        if (!index[category]) {
          index[category] = [];
        }
        index[category].push(schemaId);
      }
    }

    return index;
  }

  /**
   * Build the complete schema definition
   * @returns Schema object
   */
  _buildSchema() {
    return {
      attribute_acceleration: {
        category: 'physical',
        id: 'attribute_acceleration',
        required: false,
        type: 'attribute'
      },
      // Goalkeeper Attributes
      attribute_aerial_reach: {
        category: 'goalkeeper',
        id: 'attribute_aerial_reach',
        required: false,
        type: 'attribute'
      },
      attribute_aggression: {
        category: 'mental',
        id: 'attribute_aggression',
        required: false,
        type: 'attribute'
      },
      attribute_agility: {
        category: 'physical',
        id: 'attribute_agility',
        required: false,
        type: 'attribute'
      },
      // Mental Attributes
      attribute_anticipation: {
        category: 'mental',
        id: 'attribute_anticipation',
        required: false,
        type: 'attribute'
      },
      attribute_balance: {
        category: 'physical',
        id: 'attribute_balance',
        required: false,
        type: 'attribute'
      },
      attribute_bravery: {
        category: 'mental',
        id: 'attribute_bravery',
        required: false,
        type: 'attribute'
      },
      attribute_command_of_area: {
        category: 'goalkeeper',
        id: 'attribute_command_of_area',
        required: false,
        type: 'attribute'
      },
      attribute_communication: {
        category: 'goalkeeper',
        id: 'attribute_communication',
        required: false,
        type: 'attribute'
      },
      attribute_composure: {
        category: 'mental',
        id: 'attribute_composure',
        required: false,
        type: 'attribute'
      },
      attribute_concentration: {
        category: 'mental',
        id: 'attribute_concentration',
        required: false,
        type: 'attribute'
      },
      // Technical Attributes
      attribute_corners: {
        category: 'technical',
        id: 'attribute_corners',
        required: false,
        type: 'attribute'
      },
      attribute_crossing: {
        category: 'technical',
        id: 'attribute_crossing',
        required: false,
        type: 'attribute'
      },
      attribute_decisions: {
        category: 'mental',
        id: 'attribute_decisions',
        required: false,
        type: 'attribute'
      },
      attribute_determination: {
        category: 'mental',
        id: 'attribute_determination',
        required: false,
        type: 'attribute'
      },
      attribute_dribbling: {
        category: 'technical',
        id: 'attribute_dribbling',
        required: false,
        type: 'attribute'
      },
      attribute_eccentricity: {
        category: 'goalkeeper',
        id: 'attribute_eccentricity',
        required: false,
        type: 'attribute'
      },
      attribute_finishing: {
        category: 'technical',
        id: 'attribute_finishing',
        required: false,
        type: 'attribute'
      },
      attribute_first_touch: {
        category: 'technical',
        id: 'attribute_first_touch',
        required: false,
        type: 'attribute'
      },
      attribute_flair: {
        category: 'mental',
        id: 'attribute_flair',
        required: false,
        type: 'attribute'
      },
      attribute_free_kicks: {
        category: 'technical',
        id: 'attribute_free_kicks',
        required: false,
        type: 'attribute'
      },
      attribute_handling: {
        category: 'goalkeeper',
        id: 'attribute_handling',
        required: false,
        type: 'attribute'
      },
      attribute_heading: {
        category: 'technical',
        id: 'attribute_heading',
        required: false,
        type: 'attribute'
      },

      attribute_jumping_reach: {
        category: 'physical',
        id: 'attribute_jumping_reach',
        required: false,
        type: 'attribute'
      },
      attribute_kicking: {
        category: 'goalkeeper',
        id: 'attribute_kicking',
        required: false,
        type: 'attribute'
      },
      attribute_leadership: {
        category: 'mental',
        id: 'attribute_leadership',
        required: false,
        type: 'attribute'
      },
      attribute_long_shots: {
        category: 'technical',
        id: 'attribute_long_shots',
        required: false,
        type: 'attribute'
      },
      attribute_long_throws: {
        category: 'technical',
        id: 'attribute_long_throws',
        required: false,
        type: 'attribute'
      },
      attribute_marking: {
        category: 'technical',
        id: 'attribute_marking',
        required: false,
        type: 'attribute'
      },
      attribute_natural_fitness: {
        category: 'physical',
        id: 'attribute_natural_fitness',
        required: false,
        type: 'attribute'
      },
      attribute_off_the_ball: {
        category: 'mental',
        id: 'attribute_off_the_ball',
        required: false,
        type: 'attribute'
      },

      attribute_one_on_ones: {
        category: 'goalkeeper',
        id: 'attribute_one_on_ones',
        required: false,
        type: 'attribute'
      },
      // Physical Attributes
      attribute_pace: {
        category: 'physical',
        id: 'attribute_pace',
        required: false,
        type: 'attribute'
      },
      attribute_passing: {
        category: 'technical',
        id: 'attribute_passing',
        required: false,
        type: 'attribute'
      },
      attribute_penalty_taking: {
        category: 'technical',
        id: 'attribute_penalty_taking',
        required: false,
        type: 'attribute'
      },
      attribute_positioning: {
        category: 'mental',
        id: 'attribute_positioning',
        required: false,
        type: 'attribute'
      },
      attribute_reflexes: {
        category: 'goalkeeper',
        id: 'attribute_reflexes',
        required: false,
        type: 'attribute'
      },
      attribute_rushing_out: {
        category: 'goalkeeper',
        id: 'attribute_rushing_out',
        required: false,
        type: 'attribute'
      },
      attribute_stamina: {
        category: 'physical',
        id: 'attribute_stamina',
        required: false,
        type: 'attribute'
      },
      attribute_strength: {
        category: 'physical',
        id: 'attribute_strength',
        required: false,
        type: 'attribute'
      },
      attribute_tackling: {
        category: 'technical',
        id: 'attribute_tackling',
        required: false,
        type: 'attribute'
      },
      attribute_teamwork: {
        category: 'mental',
        id: 'attribute_teamwork',
        required: false,
        type: 'attribute'
      },
      attribute_technique: {
        category: 'technical',
        id: 'attribute_technique',
        required: false,
        type: 'attribute'
      },
      attribute_tendency_to_punch: {
        category: 'goalkeeper',
        id: 'attribute_tendency_to_punch',
        required: false,
        type: 'attribute'
      },
      attribute_throwing: {
        category: 'goalkeeper',
        id: 'attribute_throwing',
        required: false,
        type: 'attribute'
      },

      attribute_vision: {
        category: 'mental',
        id: 'attribute_vision',
        required: false,
        type: 'attribute'
      },
      attribute_work_rate: {
        category: 'mental',
        id: 'attribute_work_rate',
        required: false,
        type: 'attribute'
      },
      basic_age: {
        category: 'basic',
        id: 'basic_age',
        required: false,
        type: 'integer'
      },
      basic_asking_price: {
        canBeNegative: false,
        category: 'basic',
        id: 'basic_asking_price',
        required: false,
        type: 'currency'
      },
      basic_based_in: {
        category: 'basic',
        id: 'basic_based_in',
        required: false,
        type: 'string'
      },
      basic_club: {
        category: 'basic',
        id: 'basic_club',
        required: false,
        type: 'string'
      },
      basic_contract_type: {
        category: 'basic',
        id: 'basic_contract_type',
        required: false,
        type: 'enum'
      },
      basic_contract_type_detail: {
        category: 'basic',
        id: 'basic_contract_type_detail',
        required: false,
        type: 'enum'
      },
      basic_division: {
        category: 'basic',
        id: 'basic_division',
        required: false,
        type: 'string'
      },
      basic_dob: {
        category: 'basic',
        id: 'basic_dob',
        required: false,
        type: 'date'
      },
      basic_eu_national: {
        category: 'basic',
        id: 'basic_eu_national',
        required: false,
        type: 'enum'
      },
      basic_expires: {
        category: 'basic',
        id: 'basic_expires',
        required: false,
        type: 'date'
      },
      basic_home_grown_status: {
        category: 'basic',
        id: 'basic_home_grown_status',
        required: false,
        type: 'enum'
      },
      basic_left_foot: {
        category: 'basic',
        id: 'basic_left_foot',
        required: false,
        type: 'enum'
      },
      basic_media_handling: {
        category: 'basic',
        id: 'basic_media_handling',
        required: false,
        type: 'string_pass_through'
      },

      // Basic Info
      basic_name: {
        category: 'basic',
        id: 'basic_name',
        required: true,
        type: 'string'
      },
      basic_nationality: {
        category: 'basic',
        id: 'basic_nationality',
        required: false,
        type: 'string'
      },
      basic_personality: {
        category: 'basic',
        id: 'basic_personality',
        required: false,
        type: 'string_pass_through'
      },
      basic_position: {
        category: 'basic',
        id: 'basic_position',
        required: false,
        type: 'enum'
      },
      basic_preferred_foot: {
        category: 'basic',
        id: 'basic_preferred_foot',
        required: false,
        type: 'string'
      },
      basic_right_foot: {
        category: 'basic',
        id: 'basic_right_foot',
        required: false,
        type: 'enum'
      },
      basic_sec_position: {
        category: 'basic',
        id: 'basic_sec_position',
        required: false,
        type: 'enum'
      },
      basic_second_nationality: {
        category: 'basic',
        id: 'basic_second_nationality',
        required: false,
        type: 'string'
      },
      basic_style: {
        category: 'basic',
        id: 'basic_style',
        required: false,
        type: 'enum'
      },
      basic_transfer_value: {
        canBeNegative: false,
        category: 'basic',
        id: 'basic_transfer_value',
        required: false,
        type: 'currency'
      },
      basic_uid: {
        category: 'basic',
        id: 'basic_uid',
        required: true,
        type: 'string'
      },
      basic_wage: {
        canBeNegative: false,
        category: 'basic',
        id: 'basic_wage',
        required: false,
        supportsFrequency: true,
        type: 'currency'
      },

      // Statistics
      statistic_apps: {
        category: 'statistic',
        id: 'statistic_apps',
        required: false,
        type: 'statistic'
      },
      statistic_assists: {
        category: 'statistic',
        id: 'statistic_assists',
        required: false,
        type: 'statistic'
      },
      statistic_average_rating: {
        category: 'statistic',
        id: 'statistic_average_rating',
        required: false,
        type: 'statistic'
      },
      statistic_blocks: {
        category: 'statistic',
        id: 'statistic_blocks',
        required: false,
        type: 'statistic'
      },
      statistic_chances_created_per_90: {
        category: 'statistic',
        id: 'statistic_chances_created_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_clean_sheets: {
        category: 'statistic',
        id: 'statistic_clean_sheets',
        required: false,
        type: 'statistic'
      },
      statistic_clear_cut_chances: {
        category: 'statistic',
        id: 'statistic_clear_cut_chances',
        required: false,
        type: 'statistic'
      },
      statistic_clearances: {
        category: 'statistic',
        id: 'statistic_clearances',
        required: false,
        type: 'statistic'
      },
      statistic_crosses_attempted: {
        category: 'statistic',
        id: 'statistic_crosses_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_crosses_completed: {
        category: 'statistic',
        id: 'statistic_crosses_completed',
        required: false,
        type: 'statistic'
      },
      statistic_distance: {
        category: 'statistic',
        id: 'statistic_distance',
        required: false,
        type: 'statistic'
      },
      statistic_dribbles: {
        category: 'statistic',
        id: 'statistic_dribbles',
        required: false,
        type: 'statistic'
      },
      statistic_fouls: {
        category: 'statistic',
        id: 'statistic_fouls',
        required: false,
        type: 'statistic'
      },
      statistic_fouls_against: {
        category: 'statistic',
        id: 'statistic_fouls_against',
        required: false,
        type: 'statistic'
      },
      statistic_free_kick_shots: {
        category: 'statistic',
        id: 'statistic_free_kick_shots',
        required: false,
        type: 'statistic'
      },
      statistic_goals: {
        category: 'statistic',
        id: 'statistic_goals',
        required: false,
        type: 'statistic'
      },
      statistic_goals_conceded: {
        category: 'statistic',
        id: 'statistic_goals_conceded',
        required: false,
        type: 'statistic'
      },
      statistic_goals_outside_box: {
        category: 'statistic',
        id: 'statistic_goals_outside_box',
        required: false,
        type: 'statistic'
      },
      statistic_headers_attempted: {
        category: 'statistic',
        id: 'statistic_headers_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_headers_won: {
        category: 'statistic',
        id: 'statistic_headers_won',
        required: false,
        type: 'statistic'
      },
      statistic_interceptions: {
        category: 'statistic',
        id: 'statistic_interceptions',
        required: false,
        type: 'statistic'
      },
      statistic_key_headers_per_90: {
        category: 'statistic',
        id: 'statistic_key_headers_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_key_passes: {
        category: 'statistic',
        id: 'statistic_key_passes',
        required: false,
        type: 'statistic'
      },
      statistic_key_tackles: {
        category: 'statistic',
        id: 'statistic_key_tackles',
        required: false,
        type: 'statistic'
      },
      statistic_mins: {
        category: 'statistic',
        id: 'statistic_mins',
        required: false,
        type: 'statistic'
      },
      statistic_mistakes_leading_to_goal: {
        category: 'statistic',
        id: 'statistic_mistakes_leading_to_goal',
        required: false,
        type: 'statistic'
      },
      statistic_offsides: {
        category: 'statistic',
        id: 'statistic_offsides',
        required: false,
        type: 'statistic'
      },
      statistic_open_play_crosses_attempted: {
        category: 'statistic',
        id: 'statistic_open_play_crosses_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_open_play_crosses_completed: {
        category: 'statistic',
        id: 'statistic_open_play_crosses_completed',
        required: false,
        type: 'statistic'
      },
      statistic_open_play_key_passes: {
        category: 'statistic',
        id: 'statistic_open_play_key_passes',
        required: false,
        type: 'statistic'
      },
      statistic_passes_attempted: {
        category: 'statistic',
        id: 'statistic_passes_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_passes_completed: {
        category: 'statistic',
        id: 'statistic_passes_completed',
        required: false,
        type: 'statistic'
      },
      statistic_penalties: {
        category: 'statistic',
        id: 'statistic_penalties',
        required: false,
        type: 'statistic'
      },
      statistic_penalties_faced: {
        category: 'statistic',
        id: 'statistic_penalties_faced',
        required: false,
        type: 'statistic'
      },
      statistic_penalties_saved: {
        category: 'statistic',
        id: 'statistic_penalties_saved',
        required: false,
        type: 'statistic'
      },
      statistic_penalties_scored: {
        category: 'statistic',
        id: 'statistic_penalties_scored',
        required: false,
        type: 'statistic'
      },
      statistic_player_of_match: {
        category: 'statistic',
        id: 'statistic_player_of_match',
        required: false,
        type: 'statistic'
      },
      statistic_possession_lost_per_90: {
        category: 'statistic',
        id: 'statistic_possession_lost_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_possession_won_per_90: {
        category: 'statistic',
        id: 'statistic_possession_won_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_pressures_attempted: {
        category: 'statistic',
        id: 'statistic_pressures_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_pressures_completed: {
        category: 'statistic',
        id: 'statistic_pressures_completed',
        required: false,
        type: 'statistic'
      },
      statistic_progressive_passes: {
        category: 'statistic',
        id: 'statistic_progressive_passes',
        required: false,
        type: 'statistic'
      },
      statistic_red_cards: {
        category: 'statistic',
        id: 'statistic_red_cards',
        required: false,
        type: 'statistic'
      },
      statistic_saves_held: {
        category: 'statistic',
        id: 'statistic_saves_held',
        required: false,
        type: 'statistic'
      },
      statistic_saves_parried: {
        category: 'statistic',
        id: 'statistic_saves_parried',
        required: false,
        type: 'statistic'
      },
      statistic_saves_tipped: {
        category: 'statistic',
        id: 'statistic_saves_tipped',
        required: false,
        type: 'statistic'
      },
      statistic_shots: {
        category: 'statistic',
        id: 'statistic_shots',
        required: false,
        type: 'statistic'
      },
      statistic_shots_blocked: {
        category: 'statistic',
        id: 'statistic_shots_blocked',
        required: false,
        type: 'statistic'
      },
      statistic_shots_on_target: {
        category: 'statistic',
        id: 'statistic_shots_on_target',
        required: false,
        type: 'statistic'
      },
      statistic_shots_outside_box_per_90: {
        category: 'statistic',
        id: 'statistic_shots_outside_box_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_sprints_per_90: {
        category: 'statistic',
        id: 'statistic_sprints_per_90',
        required: false,
        type: 'statistic'
      },
      statistic_tackles_attempted: {
        category: 'statistic',
        id: 'statistic_tackles_attempted',
        required: false,
        type: 'statistic'
      },
      statistic_tackles_completed: {
        category: 'statistic',
        id: 'statistic_tackles_completed',
        required: false,
        type: 'statistic'
      },
      statistic_xa: {
        category: 'statistic',
        id: 'statistic_xa',
        required: false,
        type: 'statistic'
      },
      statistic_xg: {
        category: 'statistic',
        id: 'statistic_xg',
        required: false,
        type: 'statistic'
      },
      statistic_xgp: {
        category: 'statistic',
        id: 'statistic_xgp',
        required: false,
        type: 'statistic'
      },
      statistic_yellow_cards: {
        category: 'statistic',
        id: 'statistic_yellow_cards',
        required: false,
        type: 'statistic'
      }
    };
  }

  /**
   * Get schema information for a schema ID
   * @param schemaId - Schema ID
   * @returns Schema information or null
   */
  get(schemaId) {
    return this.schema[schemaId] || null;
  }

  /**
   * Get all schema IDs
   * @returns Array of all schema IDs
   */
  getAllIds() {
    return Object.keys(this.schema);
  }

  /**
   * Get all schema IDs for a category
   * @param category - Category name (physical, mental, goalkeeper, statistic, etc.)
   * @returns Array of schema IDs
   */
  getByCategory(category) {
    return this.categoryIndex[category] || [];
  }

  /**
   * Get legacy header name for schema ID (for backward compatibility)
   * Maps schema IDs to old header names used in the existing system
   * @param schemaId - Schema ID
   * @returns Legacy header name or null
   */
  getLegacyHeaderName(schemaId) {
    const legacyMap = {
      attribute_acceleration: 'Acc',
      // Goalkeeper attributes
      attribute_aerial_reach: 'Aer',
      attribute_aggression: 'Agg',
      attribute_agility: 'Agi',
      // Mental attributes
      attribute_anticipation: 'Ant',
      attribute_balance: 'Bal',
      attribute_bravery: 'Bra',
      attribute_command_of_area: 'Cmd',
      attribute_communication: 'Com',
      attribute_composure: 'Cmp',
      attribute_concentration: 'Cnt',
      // Technical attributes
      attribute_corners: 'Cor',
      attribute_crossing: 'Cro',
      attribute_decisions: 'Dec',
      attribute_determination: 'Det',
      attribute_dribbling: 'Dri',
      attribute_eccentricity: 'Ecc',
      attribute_finishing: 'Fin',
      attribute_first_touch: 'Fir',
      attribute_flair: 'Fla',
      attribute_free_kicks: 'Fre',
      attribute_handling: 'Han',
      attribute_heading: 'Hea',

      attribute_jumping_reach: 'Jum',
      attribute_kicking: 'Kic',
      attribute_leadership: 'Ldr',
      attribute_long_shots: 'Lon',
      attribute_long_throws: 'L Th',
      attribute_marking: 'Mar',
      attribute_natural_fitness: 'Nat',
      attribute_off_the_ball: 'OtB',

      attribute_one_on_ones: '1v1',
      // Physical attributes
      attribute_pace: 'Pac',
      attribute_passing: 'Pas',
      attribute_penalty_taking: 'Pen',
      attribute_positioning: 'Pos',
      attribute_reflexes: 'Ref',
      attribute_rushing_out: 'TRO',
      attribute_stamina: 'Sta',
      attribute_strength: 'Str',
      attribute_tackling: 'Tck',
      attribute_teamwork: 'Tea',
      attribute_technique: 'Tec',
      attribute_tendency_to_punch: 'Pun',
      attribute_throwing: 'Thr',

      attribute_vision: 'Vis',
      attribute_work_rate: 'Wor',
      basic_asking_price: 'Asking Price',
      basic_based_in: 'Based In',
      basic_club: 'Club',
      basic_contract_type: 'F/PT',
      basic_contract_type_detail: 'Type',
      basic_division: 'Division',
      basic_dob: 'DoB',
      basic_eu_national: 'EU National',
      basic_expires: 'Expires',
      basic_home_grown_status: 'Home-Grown Status',
      basic_left_foot: 'Left Foot',
      basic_media_handling: 'Media Handling',

      // Basic info
      basic_name: 'Name',
      basic_nationality: 'Nationality',
      basic_personality: 'Personality',
      basic_position: 'Position',
      basic_right_foot: 'Right Foot',
      basic_sec_position: 'Sec. Position',
      basic_second_nationality: '2nd Nat',
      basic_style: 'Style',
      basic_transfer_value: 'Transfer Value',
      basic_uid: 'UID',
      basic_wage: 'Wage',

      // Statistics
      statistic_apps: 'Apps',
      statistic_assists: 'Ast',
      statistic_average_rating: 'Av Rat',
      statistic_blocks: 'Blk',
      statistic_chances_created_per_90: 'Ch C/90',
      statistic_clean_sheets: 'Clean Sheets',
      statistic_clear_cut_chances: 'CCC',
      statistic_clearances: 'Clear',
      statistic_crosses_attempted: 'Cr A',
      statistic_crosses_completed: 'Cr C',
      statistic_distance: 'Distance',
      statistic_dribbles: 'Drb',
      statistic_fouls: 'Fls',
      statistic_fouls_against: 'FA',
      statistic_free_kick_shots: 'FK Shots',
      statistic_goals: 'Gls',
      statistic_goals_conceded: 'Conc',
      statistic_goals_outside_box: 'Goals Outside Box',
      statistic_headers_attempted: 'Hdrs A',
      statistic_headers_won: 'Hdrs',
      statistic_interceptions: 'Itc',
      statistic_key_headers_per_90: 'K Hdrs/90',
      statistic_key_passes: 'K Pas',
      statistic_key_tackles: 'K Tck',
      statistic_mins: 'Mins',
      statistic_mistakes_leading_to_goal: 'Gl Mst',
      statistic_offsides: 'Off',
      statistic_open_play_crosses_attempted: 'OP-Crs A',
      statistic_open_play_crosses_completed: 'OP-Crs C',
      statistic_open_play_key_passes: 'OP-KP',
      statistic_passes_attempted: 'Pas A',
      statistic_passes_completed: 'Ps C',
      statistic_penalties: 'Pens',
      statistic_penalties_faced: 'Pens Faced',
      statistic_penalties_saved: 'Pens Saved',
      statistic_penalties_scored: 'Pens S',
      statistic_player_of_match: 'PoM',
      statistic_possession_lost_per_90: 'Poss Lost/90',
      statistic_possession_won_per_90: 'Poss Won/90',
      statistic_pressures_attempted: 'Pres A',
      statistic_pressures_completed: 'Pres C',
      statistic_progressive_passes: 'Pr Passes',
      statistic_red_cards: 'Red',
      statistic_saves_held: 'Svh',
      statistic_saves_parried: 'Svp',
      statistic_saves_tipped: 'Svt',
      statistic_shots: 'Shots',
      statistic_shots_blocked: 'Shts Blckd',
      statistic_shots_on_target: 'ShT',
      statistic_shots_outside_box_per_90: 'Shots Outside Box/90',
      statistic_sprints_per_90: 'Sprints/90',
      statistic_tackles_attempted: 'Tck A',
      statistic_tackles_completed: 'Tck C',
      statistic_xa: 'xA',
      statistic_xg: 'xG',
      statistic_xgp: 'xGP',
      statistic_yellow_cards: 'Yel'
    };

    return legacyMap[schemaId] || null;
  }

  /**
   * Get schema ID from legacy header name (reverse mapping)
   * @param legacyName - Legacy header name
   * @returns Schema ID or null
   */
  getSchemaIdFromLegacy(legacyName) {
    // Reverse lookup
    for (const schemaId of this.getAllIds()) {
      const legacy = this.getLegacyHeaderName(schemaId);
      if (legacy === legacyName) {
        return schemaId;
      }
    }
    return null;
  }

  /**
   * Check if schema ID exists
   * @param schemaId - Schema ID
   * @returns True if exists
   */
  has(schemaId) {
    return schemaId in this.schema;
  }
}

// Export to global scope
window.SchemaRegistry = SchemaRegistry;
