import { describe, expect, it } from 'vitest';

import {
  legacyClubActionAttrs,
  legacyCopyActionAttrs,
  legacyIdActionAttrs,
  legacyIndexActionAttrs,
  legacyOpenDetailsActionAttrs,
  legacyResultActionAttrs
} from './legacyActionAttributes';

describe('legacyActionAttributes', () => {
  it('renders index action attributes', () => {
    expect(legacyIndexActionAttrs('removeFileFromStack', 4)).toBe(
      'data-fm-action="removeFileFromStack" data-fm-index="4"'
    );
  });

  it('renders id action attributes with optional type', () => {
    expect(legacyIdActionAttrs('applyFilter', 'club', 'complex')).toBe(
      'data-fm-action="applyFilter" data-fm-id="club" data-fm-type="complex"'
    );
    expect(legacyIdActionAttrs('toggleAllVisible', 'league')).toBe(
      'data-fm-action="toggleAllVisible" data-fm-id="league"'
    );
  });

  it('renders semantic payload helpers for compat producers', () => {
    expect(legacyResultActionAttrs('editOCRResult', 'ocr-1')).toBe(
      'data-fm-action="editOCRResult" data-fm-result-id="ocr-1"'
    );
    expect(legacyClubActionAttrs('selectPossessionClub', 'Legia')).toBe(
      'data-fm-action="selectPossessionClub" data-fm-club="Legia"'
    );
    expect(legacyOpenDetailsActionAttrs('uid-7')).toBe(
      'data-fm-action="openDetails" data-fm-uid="uid-7"'
    );
    expect(legacyCopyActionAttrs('Rakow', 'copy-7')).toBe(
      'data-fm-action="copyToClipboard" data-fm-icon-id="copy-7" data-fm-text="Rakow"'
    );
  });

  it('escapes attribute values', () => {
    expect(legacyCopyActionAttrs(`a "b" <c> & 'd'`, 'copy-1')).toBe(
      'data-fm-action="copyToClipboard" data-fm-icon-id="copy-1" data-fm-text="a &quot;b&quot; &lt;c&gt; &amp; &#39;d&#39;"'
    );
  });
});
