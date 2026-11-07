import {
  addAudit,
  loadLdcMappingsDb,
  loadLdcSettingsDb,
  saveLdcMappingsDb,
  saveLdcSettingsDb
} from './storage/db';

const LDC_SETTINGS_KEY = 'fm24-evaluator-ldc-v1'; // gitleaks:allow (localStorage key name, not a secret)
const LDC_MAPPINGS_KEY = 'fm24-evaluator-ldc-mappings-v1';

export async function loadMappings() {
  try {
    const fromDb = await loadLdcMappingsDb();
    if (fromDb) return fromDb;
  } catch (error) {
    console.warn('[LDC] Dexie load mappings failed', error);
  }
  try {
    const raw = localStorage.getItem(LDC_MAPPINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('[LDC] Local load mappings failed', error);
    return {};
  }
}

export async function loadSettings() {
  try {
    const fromDb = await loadLdcSettingsDb();
    if (fromDb) return fromDb;
  } catch (error) {
    console.warn('[LDC] Dexie load settings failed', error);
  }
  try {
    const raw = localStorage.getItem(LDC_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[LDC] Local load settings failed', error);
    return null;
  }
}

export async function saveMappings(mappings: any) {
  try {
    await saveLdcMappingsDb(mappings);
  } catch (error) {
    console.warn('[LDC] Dexie save mappings failed', error);
    addAudit('ldc_mappings_save_error', { error: String(error), target: 'dexie' }, 'warn');
  }
  try {
    localStorage.setItem(LDC_MAPPINGS_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.warn('[LDC] Local save mappings failed', error);
    addAudit('ldc_mappings_save_error', { error: String(error), target: 'localStorage' }, 'warn');
  }
}

export async function saveSettings(data: any) {
  try {
    await saveLdcSettingsDb(data);
  } catch (error) {
    console.warn('[LDC] Dexie save settings failed', error);
    addAudit('ldc_save_error', { error: String(error), target: 'dexie' }, 'warn');
  }
  try {
    localStorage.setItem(LDC_SETTINGS_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[LDC] Local save settings failed', error);
    addAudit('ldc_save_error', { error: String(error), target: 'localStorage' }, 'warn');
  }
}
