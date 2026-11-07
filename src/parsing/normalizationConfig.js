/**
 * NormalizationConfig - Configuration for normalizing wages, distances, and unknown units
 */
export class NormalizationConfig {
  targetDistanceUnit = 'km';

  targetWageFrequency = 'yearly';

  constructor() {
    // Default configuration
    // yearly, monthly, weekly
    // km, m, mi, yd
    this.unknownUnitMultipliers = {}; // unit -> multiplier
  }

  /**
   * Create from user settings
   * @param settings - User settings object
   * @returns New instance
   */
  static fromSettings(settings = {}) {
    const config = new NormalizationConfig();

    if (settings.targetWageFrequency) {
      config.targetWageFrequency = settings.targetWageFrequency;
    }

    if (settings.targetDistanceUnit) {
      config.targetDistanceUnit = settings.targetDistanceUnit;
    }

    if (settings.unknownUnitMultipliers) {
      config.unknownUnitMultipliers = { ...settings.unknownUnitMultipliers };
    }

    return config;
  }

  /**
   * Get distance unit multiplier
   * @param fromUnit - Source unit (km, m, mi, yd)
   * @returns Multiplier to convert to target unit
   */
  getDistanceMultiplier(fromUnit) {
    // Convert everything to km first, then to target
    const toKm = {
      km: 1,
      m: 0.001,
      mi: 1.60934,
      yd: 0.0009144
    };

    const fromKm = toKm[fromUnit] || 1;
    const toTarget = 1 / (toKm[this.targetDistanceUnit] || 1);

    return fromKm * toTarget;
  }
  /**
   * Get unknown unit multiplier
   * @param unit - Unknown unit identifier
   * @returns Multiplier or null if not defined
   */
  getUnknownUnitMultiplier(unit) {
    return this.unknownUnitMultipliers[unit] || null;
  }
  /**
   * Get wage frequency multiplier
   * @param fromFrequency - Source frequency (yearly, monthly, weekly)
   * @returns Multiplier to convert to target frequency
   */
  getWageMultiplier(fromFrequency) {
    const multipliers = {
      monthly: { monthly: 1, weekly: 12 / 52, yearly: 12 },
      weekly: { monthly: 52 / 12, weekly: 1, yearly: 52 },
      yearly: { monthly: 1 / 12, weekly: 1 / 52, yearly: 1 }
    };

    const from = multipliers[fromFrequency] || multipliers.yearly;
    return from[this.targetWageFrequency] || 1;
  }
}
