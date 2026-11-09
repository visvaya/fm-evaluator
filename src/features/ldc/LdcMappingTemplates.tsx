import { useEffect, useState } from 'react';

import { useUiText } from '@/hooks/useUiText';
import { showConfirmModal } from '@/ui/ldcModalHelpers';

import {
  loadMappingTemplates,
  saveMappingTemplates,
  templateNames,
  withoutTemplate,
  withTemplate
} from './ldcTemplatesModel';

import type { MappingTemplates } from './ldcTemplatesModel';
import type { LegacyLeagueMappings } from '@/config/ldcConfig';

interface LdcMappingTemplatesProps {
  /** The draft mappings shown in the panel, saved as a template. */
  getDraftMappings: () => LegacyLeagueMappings;
  hasDraftMappings: boolean;
  /** Replaces the draft with a template; the panel's Apply keeps it, Cancel drops it. */
  onLoadTemplate: (mappings: LegacyLeagueMappings) => void;
}

// A message key, translated at render so a language change also changes the shown status.
interface TemplateStatus {
  isError: boolean;
  key: string;
  name?: string;
}

const BUTTON_CLASS =
  'rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50';
const FIELD_CLASS =
  'min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-primary';

export function LdcMappingTemplates({
  getDraftMappings,
  hasDraftMappings,
  onLoadTemplate
}: Readonly<LdcMappingTemplatesProps>) {
  const t = useUiText();
  // null until read; stays null when the saved templates cannot be read, so nothing overwrites them.
  const [templates, setTemplates] = useState<MappingTemplates | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<TemplateStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      const result = await loadMappingTemplates();
      if (controller.signal.aborted) return;
      if (result.kind === 'templates') {
        setTemplates(result.templates);
      } else {
        setStatus({ isError: true, key: 'ldc_template_read_error' });
      }
    };
    void read();
    return () => {
      controller.abort();
    };
  }, []);

  // Writes the whole set and shows the outcome; the shown list changes only after a write.
  const store = async (next: MappingTemplates, success: TemplateStatus, nextSelected: string) => {
    const result = await saveMappingTemplates(next);
    if (result.kind === 'error') {
      setStatus({ isError: true, key: 'ldc_template_save_error' });
      return false;
    }
    setTemplates(next);
    setSelected(nextSelected);
    setStatus(success);
    return true;
  };

  const saveTemplate = () => {
    const trimmed = name.trim();
    if (templates === null || trimmed.length === 0) return;
    const save = async () => {
      const next = withTemplate(templates, trimmed, getDraftMappings());
      const success = { isError: false, key: 'ldc_template_saved', name: trimmed };
      if (await store(next, success, trimmed)) setName('');
    };
    if (Object.hasOwn(templates, trimmed)) {
      showConfirmModal(
        t('ldc_template_overwrite_confirm_title'),
        t('ldc_template_overwrite_confirm_msg', 'ui', { name: trimmed }),
        () => void save()
      );
      return;
    }
    void save();
  };

  const loadTemplate = () => {
    const mappings = templates?.[selected];
    if (!mappings) return;
    onLoadTemplate(mappings);
    setStatus({ isError: false, key: 'ldc_template_loaded', name: selected });
  };

  const deleteTemplate = () => {
    if (templates === null || !Object.hasOwn(templates, selected)) return;
    const deleted = selected;
    showConfirmModal(
      t('ldc_template_delete_confirm_title'),
      t('ldc_template_delete_confirm_msg', 'ui', { name: deleted }),
      () =>
        void store(
          withoutTemplate(templates, deleted),
          { isError: false, key: 'ldc_template_deleted', name: deleted },
          ''
        )
    );
  };

  const names = templates === null ? [] : templateNames(templates);
  const hasSelection = names.includes(selected);

  return (
    <section
      aria-labelledby="ldc-templates-title"
      className="mb-3 rounded-xl border border-border bg-surface/20 px-4 py-3"
    >
      <h4 id="ldc-templates-title" className="mb-2 text-xs font-semibold text-text-secondary">
        {t('ldc_templates_title')}
      </h4>
      <div className="mb-2 flex flex-wrap gap-2">
        <input
          id="ldc-template-name"
          type="text"
          value={name}
          maxLength={100}
          aria-label={t('ldc_template_name_placeholder')}
          placeholder={t('ldc_template_name_placeholder')}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className={FIELD_CLASS}
        />
        <button
          id="ldc-save-template-btn"
          type="button"
          disabled={templates === null || !hasDraftMappings || name.trim().length === 0}
          onClick={saveTemplate}
          className={`${BUTTON_CLASS} text-text-primary`}
        >
          {t('ldc_template_save')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          id="ldc-load-template"
          value={hasSelection ? selected : ''}
          aria-label={t('ldc_template_select')}
          onChange={(event) => {
            setSelected(event.target.value);
          }}
          className={FIELD_CLASS}
        >
          <option value="">{t('ldc_template_select')}</option>
          {names.map((templateName) => (
            <option key={templateName} value={templateName}>
              {templateName}
            </option>
          ))}
        </select>
        <button
          id="ldc-load-template-btn"
          type="button"
          disabled={!hasSelection}
          onClick={loadTemplate}
          className={`${BUTTON_CLASS} text-text-primary`}
        >
          {t('ldc_template_load')}
        </button>
        <button
          id="ldc-delete-template-btn"
          type="button"
          disabled={!hasSelection}
          onClick={deleteTemplate}
          className={`${BUTTON_CLASS} text-negative`}
        >
          {t('ldc_template_delete')}
        </button>
      </div>
      <output
        className={`mt-2 block min-h-4 text-xs ${status?.isError ? 'text-negative' : 'text-text-muted'}`}
      >
        {status ? t(status.key, 'ui', { name: status.name ?? '' }) : ''}
      </output>
    </section>
  );
}
