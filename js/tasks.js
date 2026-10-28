import { LIMITS } from './config.js';
import { $, announce, button, el } from './dom.js';
import { t } from './i18n.js';
import { showPanelTab } from './notes.js';
import { getState, subscribe, update } from './store.js';

let renderedKey = '';

function render(state) {
  const key = JSON.stringify(state.tasks);
  if (key === renderedKey) return;
  renderedKey = key;

  // Re-rendering replaces the nodes: remember which control had focus and restore it.
  const active = document.activeElement;
  const activeId = active?.closest?.('#task-list [data-id]')?.dataset.id;
  const activeAction = active?.dataset?.action;

  const rows = state.tasks.map((task) => {
    const row = el('li', task.done ? 'task done' : 'task');
    row.dataset.id = task.id;
    const label = el('label', 'task-main');
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.dataset.action = 'toggle';
    label.append(checkbox, el('span', 'task-label', task.text));
    const remove = button('task-delete', '×', t('tasks.delete', { text: task.text }));
    remove.dataset.action = 'delete';
    row.append(label, remove);
    return row;
  });
  $('task-list').replaceChildren(...rows);

  const done = state.tasks.filter((task) => task.done).length;
  $('task-counter').textContent = `${done} / ${state.tasks.length}`;
  $('empty-tasks').hidden = state.tasks.length > 0;
  $('clear-done').disabled = done === 0;

  if (activeId && activeAction) {
    $('task-list')
      .querySelector(`[data-id="${CSS.escape(activeId)}"] [data-action="${activeAction}"]`)
      ?.focus();
  }
}

// Removes the matching tasks and offers an undo that puts them back where they were.
function removeTasks(predicate, message) {
  const removed = [];
  getState().tasks.forEach((task, index) => {
    if (predicate(task)) removed.push({ task, index });
  });
  if (!removed.length) return;
  const ids = new Set(removed.map(({ task }) => task.id));
  update((state) => {
    state.tasks = state.tasks.filter((task) => !ids.has(task.id));
  });
  announce(message(removed.length), {
    label: t('common.undo'),
    run: () =>
      update((state) => {
        for (const { task, index } of removed) {
          if (state.tasks.length >= LIMITS.tasks || state.tasks.some((item) => item.id === task.id)) continue;
          state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
        }
      }),
  });
}

export function focusTaskInput() {
  showPanelTab('tasks');
  $('task-input').focus();
}

/** Adds a task at the top of the list; returns false when the text is empty or the list is full. */
export function addTask(raw) {
  const text = String(raw).trim().slice(0, LIMITS.taskText);
  if (!text) return false;
  if (getState().tasks.length >= LIMITS.tasks) {
    announce(t('tasks.max', { n: LIMITS.tasks }));
    return false;
  }
  // The id is made outside the change: replayed by the store, it must add the same task.
  const task = { id: crypto.randomUUID(), text, done: false };
  update((state) => {
    if (!state.tasks.some((item) => item.id === task.id)) state.tasks.unshift({ ...task });
  });
  return true;
}

export function initTasks() {
  $('task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('task-input');
    if (!addTask(input.value)) return;
    input.value = '';
    input.focus();
  });

  $('task-list').addEventListener('change', (event) => {
    if (event.target.dataset.action !== 'toggle') return;
    const { id } = event.target.closest('[data-id]').dataset;
    const done = event.target.checked;
    update((state) => {
      const task = state.tasks.find((item) => item.id === id);
      if (task) task.done = done;
    });
  });

  $('task-list').addEventListener('click', (event) => {
    const target = event.target.closest('[data-action="delete"]');
    if (!target) return;
    const row = target.closest('[data-id]');
    const sibling = row.nextElementSibling ?? row.previousElementSibling;
    const siblingId = sibling?.dataset.id;
    removeTasks(
      (task) => task.id === row.dataset.id,
      () => t('tasks.deleted'),
    );
    const next =
      siblingId && $('task-list').querySelector(`[data-id="${CSS.escape(siblingId)}"] .task-delete`);
    (next || $('task-input')).focus();
  });

  $('clear-done').addEventListener('click', () => {
    removeTasks(
      (task) => task.done,
      (count) => t('tasks.cleared', { n: count }),
    );
  });

  render(getState());
  subscribe(render);
}
