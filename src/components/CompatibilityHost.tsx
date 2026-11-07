import React from 'react';
import { ENGINE_OPTIONS } from '@/config/engines';
import { ALL_ROLES } from '@/config/scoreConfig';
import { LdcModalCompat } from '@/features/ldc/LdcModalCompat';
import { PossessionShell } from './PossessionShell';
import { useUiText } from '@/hooks/useUiText';
import { DiagnosticsShell } from './DiagnosticsShell';
import { SettingsShell } from './SettingsShell';

function HiddenCompatSelects() {
  return (
    <div className="hidden" aria-hidden="true">
      <select id="central-engine-select" defaultValue="Default">
        {ENGINE_OPTIONS.map((engine) => (
          <option key={engine.id} value={engine.id}>
            {engine.id}
          </option>
        ))}
      </select>
      <select id="central-position-select" defaultValue="">
        <option value="" />
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <input id="rows-per-page" defaultValue="50" />
      <input id="page-number" defaultValue="1" />
      <span id="page-total-display" />
      <button id="page-first" type="button" />
      <button id="page-prev" type="button" />
      <button id="page-next" type="button" />
      <button id="page-last" type="button" />
      <div id="pagination-controls">
        <span id="results-count" />
      </div>
      <div id="step-1-upload" />
      <div id="step-2-config" />
      <div id="central-upload-zone" />
      <div id="header-upload-controls" />
      <div id="single-type-prompt" className="px-6 pt-3">
        <div className="rounded-xl border border-border bg-surface/70 px-4 py-3">
          <p id="single-type-prompt-text" className="text-sm text-text-secondary" />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="radio" name="merge-mode" value="true" defaultChecked />
              <span>merge_mode_combine</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="radio" name="merge-mode" value="false" />
              <span>merge_mode_replace</span>
            </label>
            <button
              id="btn-process-now"
              type="button"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
            >
              continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CompatibilityHost = React.memo(function CompatibilityHost() {
  const t = useUiText();

  return (
    <>
      <HiddenCompatSelects />

      <div
        id="language-dropdown"
        className="hidden absolute right-6 top-16 z-[120] w-44 overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      />

      <div
        id="language-choice-modal"
        className="hidden fixed inset-0 z-[140] flex items-center justify-center bg-background/70 px-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
          <h2 id="language-choice-title" className="text-lg font-semibold" />
          <p id="language-choice-message" className="mt-3 text-sm text-text-secondary" />
          <p id="language-choice-question" className="mt-4 text-sm font-medium text-text-primary" />
          <label className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
            <input id="language-choice-remember" type="checkbox" />
            <span>{t('remember_language_choice')}</span>
          </label>
          <div className="mt-6 flex gap-3">
            <button
              id="language-choice-ui-btn"
              type="button"
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            />
            <button
              id="language-choice-file-btn"
              type="button"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary"
            />
          </div>
        </div>
      </div>
      <SettingsShell />
      <DiagnosticsShell />
      <LdcModalCompat />
      <PossessionShell />

      <div id="health-check-modal" className="hidden" />
      <input id="files-input" type="file" accept=".html,.htm,.csv" className="hidden" />

      <button id="reset-data-btn" type="button" className="hidden" />
    </>
  );
});
