export const $ = (id) => document.getElementById(id);
export const $$ = (selector, root = document) => root.querySelectorAll(selector);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className, text, label) {
  const node = el('button', className, text);
  node.type = 'button';
  if (label) {
    node.setAttribute('aria-label', label);
    node.title = label;
  }
  return node;
}

const TEXT_FIELDS = 'input:not([type=checkbox], [type=radio], [type=range], [type=button]), textarea, select';

export const isTyping = (target) =>
  target instanceof Element && (target.matches(TEXT_FIELDS) || target.isContentEditable);

let toastTimeout;

function hideToast() {
  $('toast').classList.remove('show');
}

/**
 * Shows a short message. With an action, the toast offers a button such as "Annulla".
 * While the settings dialog is modal the rest of the page is inert, so the toast moves inside it.
 */
export function announce(message, action) {
  const toast = $('toast');
  const dialog = $('settings');
  const host = dialog.open ? dialog : document.body;
  if (toast.parentElement !== host) host.append(toast);

  const nodes = [el('span', 'toast-text', message)];
  if (action) {
    const actionButton = button('toast-action', action.label);
    actionButton.addEventListener(
      'click',
      () => {
        hideToast();
        action.run();
      },
      { once: true },
    );
    nodes.push(actionButton);
  }
  toast.replaceChildren(...nodes);
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(hideToast, action ? 6000 : 2700);
}
