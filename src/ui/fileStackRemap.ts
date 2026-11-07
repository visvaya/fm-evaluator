type ColumnMap = Record<number, string>;
type UserMappings = Record<string, null | string>;

interface HeaderMappingRow {
  autoMappedTo: null | string;
  header: string;
  index: number;
  isAmbiguous: boolean;
  isAutoMapped: boolean;
}

interface HeaderMappingModalInstance {
  show: (
    allHeadersToMap: HeaderMappingRow[],
    schemaRegistry: unknown,
    headers: string[],
    languageConfig: unknown,
    currentColumnMap: ColumnMap,
    fileName: string
  ) => Promise<null | UserMappings>;
}

type HeaderMappingModalCtor = new () => HeaderMappingModalInstance;

export function extractHeadersForRemap(html: string, normalizeHeader: (header: unknown) => string) {
  // Remap works on a local HTML snapshot, so DOMParser here is intentional.
  // eslint-disable-next-line no-restricted-globals
  const documentSnapshot = new DOMParser().parseFromString(html, 'text/html');
  const table = documentSnapshot.querySelector('table');
  if (!table) {
    throw new Error('No table found in file');
  }

  return [...table.querySelectorAll('th')].map((headerCell) =>
    normalizeHeader(headerCell.textContent)
  );
}

export function buildHeadersToMap(
  headers: string[],
  currentColumnMap: ColumnMap
): HeaderMappingRow[] {
  return headers.map((header, index) => ({
    autoMappedTo: currentColumnMap[index] ?? null,
    header,
    index,
    isAmbiguous: false,
    isAutoMapped: Boolean(currentColumnMap[index])
  }));
}

export async function requestUserMappings({
  currentColumnMap,
  fileName,
  HeaderMappingModal,
  headers,
  languageConfig,
  schemaRegistry
}: {
  currentColumnMap: ColumnMap;
  fileName: string;
  HeaderMappingModal: HeaderMappingModalCtor;
  headers: string[];
  languageConfig: unknown;
  schemaRegistry: unknown;
}) {
  const headerModal = new HeaderMappingModal();

  return headerModal.show(
    buildHeadersToMap(headers, currentColumnMap),
    schemaRegistry,
    headers,
    languageConfig,
    currentColumnMap,
    fileName
  );
}

export function buildUpdatedColumnMap(currentColumnMap: ColumnMap, userMappings: UserMappings) {
  const removedColumns = new Set(
    Object.entries(userMappings)
      .filter(([, schemaId]) => !schemaId)
      .map(([columnIndex]) => Number.parseInt(columnIndex, 10))
  );
  const addedEntries = Object.entries(userMappings)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([columnIndex, schemaId]) => [Number.parseInt(columnIndex, 10), schemaId] as const);

  return Object.fromEntries([
    ...Object.entries(currentColumnMap).filter(
      ([columnIndex]) => !removedColumns.has(Number.parseInt(columnIndex, 10))
    ),
    ...addedEntries
  ]);
}
