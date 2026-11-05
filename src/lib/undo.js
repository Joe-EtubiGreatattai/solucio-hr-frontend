import toast from 'react-hot-toast';
import { createElement as h, useReducer } from 'react';
import api, { toastError } from './api';

const UNDO_MS = 6000;
const pending = new Map(); // item id -> timer

// Lists hide items that are waiting to be deleted, so a live refresh doesn't bring them back.
export const isPendingDelete = (id) => pending.has(String(id));

// Remove an item straight away, show "Undo" for a few seconds, and only then call the API.
// The timer lives outside React so leaving the page doesn't cancel the delete.
export function deleteWithUndo({ id, url, message, onRemove, onRestore }) {
  const key = String(id);
  onRemove?.();
  const toastId = toast(
    (t) => h('span', { className: 'flex items-center gap-3' },
      h('span', null, message),
      h('button', {
        type: 'button',
        className: 'rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50',
        onClick: () => {
          clearTimeout(pending.get(key));
          pending.delete(key);
          toast.dismiss(t.id);
          onRestore?.();
        },
      }, 'Undo')),
    { duration: UNDO_MS },
  );
  pending.set(key, setTimeout(async () => {
    try {
      await api.delete(url);
    } catch (e) {
      toastError(e);
      onRestore?.();
    } finally {
      pending.delete(key);
      toast.dismiss(toastId);
    }
  }, UNDO_MS));
}

// Hook for list pages: `visible(list)` hides items waiting to be deleted; `remove()` deletes with undo.
export function useUndoDelete() {
  const [, rerender] = useReducer((x) => x + 1, 0);
  return {
    visible: (list) => (list || []).filter((item) => !isPendingDelete(item._id)),
    remove: ({ id, url, message, onRestore }) =>
      deleteWithUndo({ id, url, message, onRemove: rerender, onRestore: () => { rerender(); onRestore?.(); } }),
  };
}

// Success toast with one action button, e.g. "Loan approved · Undo".
export function toastWithAction(message, actionLabel, onAction, ms = UNDO_MS) {
  toast.success(
    (t) => h('span', { className: 'flex items-center gap-3' },
      h('span', null, message),
      h('button', {
        type: 'button',
        className: 'rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50',
        onClick: () => { toast.dismiss(t.id); onAction(); },
      }, actionLabel)),
    { duration: ms },
  );
}
