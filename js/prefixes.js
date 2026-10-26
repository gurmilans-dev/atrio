// Personal search prefixes ("jira 123" -> your Jira): the list and the form in settings.
// Resolution happens in js/search.js, like the built-in prefixes.
import { LIMITS } from './config.js';
import { $, announce, button, el } from './dom.js';
import { t } from './i18n.js';
import { resolvePrefixURL } from './search.js';
import { PREFIX_KEY, RESERVED_PREFIXES, normalizePrefix } from './state.js';
import { getState, subscribe, update } from './store.js';

let renderedKey = '';
let editingKey = null;

/** The prefixes in the shape resolveInput expects: { jira: { label, url } }. */
export const prefixTargets = (state) =>
  Object.fromEntries(state.prefixes.map((prefix) => [prefix.key, { label: prefix.name, url: prefix.url }]));

function render(state) {
  if (editingKey && !state.prefixes.some((prefix) => prefix.key === editingKey)) resetForm();
  const key = JSON.stringify([state.prefixes, editingKey]);
  if (key === renderedKey) return;
  renderedKey = key;
  const rows = state.prefixes.map((prefix) => {
    const row = el('div', prefix.key === editingKey ? 'settings-link editing' : 'settings-link');
    row.dataset.key = prefix.key;
    const name = el('span', 'settings-link-name', `${prefix.key} → ${prefix.name}`);
    name.append(el('small', '', prefix.url));
    const actions = el('div', 'row-actions');
    const edit = button('text-action', t('links.edit'), t('links.editOne', { name: prefix.key }));
    edit.dataset.action = 'edit';
    const remove = button(
      'text-action danger',
      t('links.remove'),
      t('links.removeOne', { name: prefix.key }),
    );
    remove.dataset.action = 'remove';
    actions.append(edit, remove);
    row.append(name, actions);
    return row;
  });
  $('settings-prefixes').replaceChildren(...rows);
}

function resetForm() {
  editingKey = null;
  $('prefix-form').reset();
  $('prefix-submit').textContent = t('prefixes.add');
  $('prefix-cancel').hidden = true;
}

function startEditing(key) {
  const prefix = getState().prefixes.find((item) => item.key === key);
  if (!prefix) return;
  editingKey = key;
  $('prefix-key').value = prefix.key;
  $('prefix-name').value = prefix.name;
  $('prefix-url').value = prefix.url;
  $('prefix-submit').textContent = t('links.save');
  $('prefix-cancel').hidden = false;
  render(getState());
  $('prefix-key').focus();
}

function reject(fieldId, message) {
  announce(message);
  $(fieldId).focus();
}

function submitForm(event) {
  event.preventDefault();
  const key = $('prefix-key').value.trim().toLowerCase().replace(/^!/, '');
  const url = resolvePrefixURL($('prefix-url').value);
  if (!PREFIX_KEY.test(key)) return reject('prefix-key', t('prefixes.invalidKey'));
  if (RESERVED_PREFIXES.has(key)) return reject('prefix-key', t('prefixes.reserved', { key }));
  if (!url) return reject('prefix-url', t('prefixes.invalidUrl'));
  const { prefixes } = getState();
  if (key !== editingKey && prefixes.some((prefix) => prefix.key === key)) {
    return reject('prefix-key', t('prefixes.taken', { key }));
  }
  if (!editingKey && prefixes.length >= LIMITS.prefixes) {
    return reject('prefix-key', t('prefixes.max', { n: LIMITS.prefixes }));
  }

  const entry = normalizePrefix({ key, name: $('prefix-name').value, url });
  const replaced = editingKey;
  update((state) => {
    const index = state.prefixes.findIndex((prefix) => prefix.key === replaced);
    if (index >= 0) state.prefixes[index] = entry;
    else state.prefixes.push(entry);
  });
  resetForm();
  render(getState());
  $('prefix-key').focus();
  announce(t(replaced ? 'prefixes.updated' : 'prefixes.added', { key }));
}

function removePrefix(key) {
  const { prefixes } = getState();
  const index = prefixes.findIndex((prefix) => prefix.key === key);
  if (index < 0) return;
  const prefix = prefixes[index];
  const next = prefixes[index + 1] ?? prefixes[index - 1];
  if (editingKey === key) resetForm();
  update((state) => {
    state.prefixes = state.prefixes.filter((item) => item.key !== key);
  });
  const nextButton =
    next && $('settings-prefixes').querySelector(`[data-key="${next.key}"] [data-action="remove"]`);
  (nextButton || $('prefix-key')).focus();
  announce(t('prefixes.removed', { key }), {
    label: t('common.undo'),
    run: () =>
      update((state) => {
        if (state.prefixes.some((item) => item.key === key) || state.prefixes.length >= LIMITS.prefixes) {
          return;
        }
        state.prefixes.splice(Math.min(index, state.prefixes.length), 0, prefix);
      }),
  });
}

export function initPrefixes() {
  $('settings-prefixes').addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;
    const { key } = target.closest('[data-key]').dataset;
    if (target.dataset.action === 'edit') startEditing(key);
    else removePrefix(key);
  });
  $('prefix-form').addEventListener('submit', submitForm);
  $('prefix-cancel').addEventListener('click', () => {
    resetForm();
    render(getState());
    $('prefix-key').focus();
  });
  resetForm();
  render(getState());
  subscribe(render);
}
