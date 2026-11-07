/**
 * AttributeParser - Parses attribute values (1-20, supports ranges)
 */
export class AttributeParser {
  /**
   * Clamp value to valid attribute range (1-20)
   * @param value - Value to clamp
   * @returns Clamped value
   */
  _clamp(value) {
    return Math.max(1, Math.min(20, Math.round(value)));
  }

  /**
   * Parse attribute value
   * @param value - Raw value string
   * @returns Parsed value (1-20) or null if invalid
   */
  parse(value) {
    if (!value || value === '' || value === '-' || value === 'N/A') {
      return null;
    }

    const str = String(value).trim();

    // Handle ranges (e.g., "12-15" -> take average or first value)
    if (str.includes('-')) {
      const parts = str.split('-').map((p) => p.trim());
      if (parts.length === 2) {
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);

        if (!isNaN(first) && !isNaN(second)) {
          // Return average, rounded
          const avg = Math.round((first + second) / 2);
          return this._clamp(avg);
        }
      }
    }

    // Parse single value
    const num = parseInt(str, 10);

    if (isNaN(num)) {
      return null;
    }

    return this._clamp(num);
  }
}
