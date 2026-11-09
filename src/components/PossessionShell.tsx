export function PossessionShell() {
  return (
    <div
      id="possession-modal"
      className="fixed inset-0 z-[110] hidden items-center justify-center bg-background/70 px-4 flex"
    >
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-border bg-background p-6 shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between border-b border-border pb-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Konfiguracja Posiadania</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Wpływa na statystyki PAdj (Possession Adjusted)
            </p>
          </div>
          <button
            id="possession-close-x"
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto custom-scroll pr-1 space-y-3">
          {/* Club configuration section */}
          <div className="rounded-xl border border-border bg-surface/35">
            <button
              id="club-config-toggle"
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Przypisz posiadanie do klubu
              </span>
              <span className="text-xs text-text-muted">▾</span>
            </button>
            <div id="club-config-content" className="hidden border-t border-border px-3 pb-3 pt-2">
              <div className="relative mb-2">
                <input
                  type="text"
                  id="possession-club-search"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Szukaj klubu..."
                  autoComplete="off"
                />
              </div>
              <div
                id="possession-club-list"
                className="club-list-container custom-scroll empty:h-auto"
              >
                <div className="p-4 text-center text-xs text-text-muted">Brak danych klubów.</div>
              </div>
              <div
                id="possession-club-input-wrapper"
                className="hidden mt-2 rounded-xl border border-border bg-surface/35 p-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span
                      id="selected-club-label"
                      className="truncate text-xs font-semibold text-text-primary pr-2"
                    >
                      Wybrany klub
                    </span>
                    <div className="flex gap-3 text-xs">
                      <button
                        id="reset-club-selection-value"
                        type="button"
                        className="text-text-muted hover:text-negative transition"
                      >
                        Resetuj
                      </button>
                      <button
                        id="clear-club-selection"
                        type="button"
                        className="text-text-muted hover:text-text-primary transition"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="possession-club-value"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="%"
                    />
                    <span className="text-sm text-text-muted font-medium">%</span>
                    <button
                      id="save-club-possession"
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:border-positive/30 hover:text-positive"
                      title="Zapisz"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OCR / bulk import section */}
          <div className="rounded-xl border border-border bg-surface/35">
            <button
              id="ocr-toggle"
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Import masowy (Tekst / Tabela)
              </span>
              <span className="text-xs text-text-muted">▾</span>
            </button>
            <div
              id="ocr-content"
              className="hidden border-t border-border px-3 pb-3 pt-2 space-y-2"
            >
              {/* OCR settings panel */}
              <div
                id="ocr-settings-panel"
                className="hidden rounded-lg border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Ustawienia OCR
                  </span>
                  <button
                    id="toggle-ocr-settings"
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary transition"
                  >
                    Ukryj
                  </button>
                </div>
                <div id="ocr-settings-content" className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">
                      Jakość vs Szybkość
                    </label>
                    <select
                      id="ocr-quality-setting"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                      defaultValue="medium"
                    >
                      <option value="low">Niska (szybko)</option>
                      <option value="medium">Średnia (równowaga)</option>
                      <option value="high">Wysoka (dokładnie)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">
                      Próg pewności (%)
                    </label>
                    <input
                      type="number"
                      id="ocr-confidence-threshold"
                      min="0"
                      max="100"
                      defaultValue="60"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Ostrzeżenia dla wyników poniżej tego progu
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">PSM Mode</label>
                    <select
                      id="ocr-psm-mode"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                      defaultValue="6"
                    >
                      <option value="6">6 – Jednolity blok tekstu</option>
                      <option value="7">7 – Pojedyncza linia tekstu</option>
                      <option value="8">8 – Pojedyncze słowo</option>
                      <option value="11">11 – Sparse text</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">
                      Limit równoległości
                    </label>
                    <input
                      type="number"
                      id="ocr-concurrency-limit"
                      min="1"
                      max="5"
                      defaultValue="2"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Liczba obrazów przetwarzanych jednocześnie
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  id="show-ocr-settings"
                  type="button"
                  className="text-xs text-text-muted hover:text-text-primary transition"
                >
                  ⚙ Ustawienia OCR
                </button>
              </div>

              <div
                id="ocr-area-selection"
                className="hidden rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">
                    Konfiguracja obszarów OCR
                  </span>
                  <button
                    id="change-ocr-areas"
                    type="button"
                    className="hidden text-xs text-accent hover:underline"
                  >
                    Zmień obszary
                  </button>
                </div>
              </div>

              {/* Fullscreen crop modal */}
              <div id="cropModal" className="fixed inset-0 z-[100] hidden flex-col bg-gray-900/95">
                <div className="flex items-center justify-between border-b border-border bg-background p-4 shadow-sm">
                  <h3 id="crop-modal-title" className="text-base font-semibold text-text-primary">
                    Zaznacz obszar nazwy ligi w nagłówku
                  </h3>
                  <div className="flex gap-2">
                    <button
                      id="cancel-crop-btn"
                      type="button"
                      className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface transition"
                    >
                      Anuluj
                    </button>
                    <button
                      id="confirm-crop-btn"
                      type="button"
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition"
                    >
                      Zatwierdź obszar
                    </button>
                  </div>
                </div>
                <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-4">
                  <img id="imageToCrop" alt="Source" className="block max-h-full max-w-full" />
                </div>
                <div className="border-t border-border bg-background p-3 text-center text-xs text-text-secondary">
                  <span id="crop-instruction-text">
                    Użyj rolki myszy aby przybliżyć | Przeciągnij aby zmienić obszar
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-secondary">
                    Wgraj zrzuty ekranu (OCR)
                  </label>
                  <button
                    id="reset-ocr-areas"
                    type="button"
                    className="text-xs text-negative hover:underline transition"
                    title="Resetuj zapisane obszary OCR"
                  >
                    Resetuj obszary
                  </button>
                </div>
                <input
                  type="file"
                  id="possession-ocr-file"
                  accept="image/*"
                  multiple
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-xs file:font-semibold file:text-text-secondary"
                />
                <p className="mt-1 text-xs text-text-muted">Obsługiwane formaty: PNG, JPG, JPEG.</p>
              </div>

              <div id="ocr-progress-container" className="hidden">
                <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                  <span>Przetwarzanie OCR...</span>
                  <span id="ocr-progress-text" className="text-accent">
                    0%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface">
                  <div
                    id="ocr-progress-bar"
                    className="h-full rounded-full bg-accent transition-all duration-300"
                  />
                </div>
              </div>

              <div
                id="ocr-preview-container"
                className="hidden rounded-lg border border-border bg-surface/35 p-3"
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Rozpoznane dane:
                </p>
                <div
                  id="ocr-preview-text"
                  className="max-h-24 overflow-y-auto custom-scroll text-xs text-text-secondary"
                />
              </div>

              <div className="border-t border-border pt-2">
                <label className="mb-1 block text-xs font-semibold text-text-secondary">
                  Lub wklej tekst ręcznie
                </label>
                <textarea
                  id="possession-ocr-text"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  placeholder="Wklej tutaj tabelę: Nazwa Klubu - Wartość%"
                />
              </div>
              <button
                id="possession-apply-ocr"
                type="button"
                className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-text-secondary hover:bg-surface transition"
              >
                Przetwórz tekst
              </button>
            </div>
          </div>

          {/* Global default */}
          <div className="rounded-xl border border-border bg-surface/35 p-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Domyślne posiadanie (Globalne)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                id="possession-default-value"
                min="0"
                max="100"
                step="1"
                defaultValue="50"
                className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-sm text-text-muted">%</span>
              <p className="text-xs text-text-muted leading-snug">
                Używane gdy klub zawodnika nie ma przypisanej wartości.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 shrink-0">
          <div id="possession-modal-error" className="text-xs text-negative min-h-[1rem]" />
          <div className="flex gap-2">
            <button
              id="possession-reset"
              type="button"
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-negative hover:bg-negative/10 transition"
              title="Wyczyść wszystkie dane"
            >
              Reset
            </button>
            <button
              id="possession-close"
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface transition"
            >
              Zamknij
            </button>
            <button
              id="possession-save"
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition"
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
