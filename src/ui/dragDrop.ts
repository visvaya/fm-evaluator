export function setupFileStackDragAndDrop(
  containerId: string,
  onReorder: (fromIndex: number, toIndex: number) => void
): void {
  // Try main file stack first, then modal
  let fileStackContainer = document.getElementById(containerId);
  if (
    (!fileStackContainer || fileStackContainer.classList.contains('hidden')) && // Fallback or explicit check?
    // Logic in main.js was: let container = getById('file-stack'); if hidden -> getById('file-stack-modal')
    // Here we pass containerId explicitly, so caller should decide.
    // But for completeness let's support the fallback lookup if containerId is generic
    containerId === 'file-stack'
  ) {
    const alternative = document.querySelector('#file-stack-modal');
    if (
      fileStackContainer.classList.contains('hidden') &&
      alternative &&
      !alternative.classList.contains('hidden')
    ) {
      fileStackContainer = alternative as HTMLElement;
    }
  }
  if (!fileStackContainer) return;

  let draggedElement: HTMLElement | null = null;
  let draggedIndex: null | number = null;

  fileStackContainer.querySelectorAll('.file-card').forEach((card) => {
    const dragHandle = card.querySelector('.drag-handle');
    if (!dragHandle) return;

    // Get the parent card element
    const getCard = (element: any): HTMLElement | null => {
      return element.closest('.file-card');
    };

    dragHandle.addEventListener('dragstart', (e: Event) => {
      const dragEvent = e as DragEvent;
      const target = dragEvent.target as HTMLElement;
      const card = getCard(target);
      if (!card) return;

      draggedElement = card;
      const idxStr = card.dataset.fileIndex;
      draggedIndex = idxStr ? parseInt(idxStr) : null;

      card.classList.add('opacity-50');
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.effectAllowed = 'move';
      }
    });

    dragHandle.addEventListener('dragend', (e: Event) => {
      const target = e.target as HTMLElement;
      const card = getCard(target);
      if (card) card.classList.remove('opacity-50');
      draggedElement = null;
      draggedIndex = null;
    });

    card.addEventListener('dragover', (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      if (!draggedElement) return;

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }

      const afterElement = getDragAfterElement(fileStackContainer, dragEvent.clientY);
      if (afterElement == null) {
        fileStackContainer.append(draggedElement);
      } else {
        afterElement.before(draggedElement);
      }
    });

    card.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedElement && draggedIndex !== null && fileStackContainer) {
        const childrenArray = [...fileStackContainer.children];
        const newIndex = childrenArray.indexOf(draggedElement);

        if (newIndex !== -1 && newIndex !== draggedIndex) {
          // Trigger reorder in manager
          onReorder(draggedIndex, newIndex);
        }
      }
    });
  });
}

function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
  const draggableElements = [...container.querySelectorAll('.file-card:not(.opacity-50)')];

  return draggableElements.reduce(
    (closest: any, child: any) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      return offset < 0 && offset > closest.offset ? { element: child, offset: offset } : closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}
