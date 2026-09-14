import './wms.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function installLoteATheme() {
  if (document.querySelector('link[data-artisys-theme="lote-a"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/theme-lote-a.css';
  link.dataset.artisysTheme = 'lote-a';
  document.head.append(link);
}

const movementLabels = {
  ENTRY: { label: 'Entrada', className: 'badge-success' },
  PURCHASE_RECEIPT: { label: 'Recebimento', className: 'badge-success' },
  EXIT: { label: 'Saída', className: 'badge-danger' },
  ADJUSTMENT: { label: 'Ajuste', className: 'badge-warning' },
  CYCLE_ADJUSTMENT: { label: 'Ajuste cíclico', className: 'badge-warning' },
  TRANSFER: { label: 'Transferência', className: 'badge-info' },
  TRANSIT_OUT: { label: 'Saída em trânsito', className: 'badge-info' },
  TRANSIT_IN: { label: 'Entrada em trânsito', className: 'badge-info' },
  LOCATION_MOVE_OUT: { label: 'Mov. endereço - saída', className: 'badge-info' },
  LOCATION_MOVE_IN: { label: 'Mov. endereço - entrada', className: 'badge-info' },
  LOSS: { label: 'Perda', className: 'badge-danger' },
  DAMAGE: { label: 'Avaria', className: 'badge-warning' },
  RETURN: { label: 'Devolução', className: 'badge-success' }
};

const statusLabels = {
  OPEN: { label: 'Aberto', className: 'badge-info' },
  CLOSED: { label: 'Fechado', className: 'badge-neutral' },
  ACTIVE: { label: 'Ativo', className: 'badge-success' },
  RELEASED: { label: 'Liberado', className: 'badge-neutral' },
  CONSUMED: { label: 'Consumido', className: 'badge-neutral' },
  IN_TRANSIT: { label: 'Em trânsito', className: 'badge-info' },
  ORDERED: { label: 'Pedido', className: 'badge-info' },
  PARTIALLY_RECEIVED: { label: 'Recebido parcialmente', className: 'badge-warning' },
  RECEIVED: { label: 'Recebido', className: 'badge-success' },
  APPROVED: { label: 'Aprovado', className: 'badge-success' },
  PENDING: { label: 'Pendente', className: 'badge-neutral' },
  NEEDS_RECOUNT: { label: 'Recontagem', className: 'badge-warning' },
  COUNTED: { label: 'Contado', className: 'badge-success' },
  DRAFT: { label: 'Rascunho', className: 'badge-neutral' },
  LOST: { label: 'Perdido', className: 'badge-danger' },
  DAMAGED: { label: 'Avariado', className: 'badge-warning' }
};

function badgeHtml(entry) {
  return `<span class="badge ${entry.className}">${entry.label}</span>`;
}

function decorateDynamicContent(root = document) {
  $$('.empty', root).forEach((element) => element.classList.add('empty-state'));
  $$('td', root).forEach((cell) => {
    if (cell.dataset.uiV2Decorated === '1' || cell.children.length) return;
    const value = cell.textContent.trim();
    const entry = movementLabels[value] || statusLabels[value];
    if (!entry) return;
    cell.innerHTML = badgeHtml(entry);
    cell.dataset.uiV2Decorated = '1';
  });
}

function setupMovementShortcuts() {
  const form = $('#movement-form');
  const typeSelect = form?.querySelector('select[name="type"]');
  if (!form || !typeSelect) return;

  const tabs = $$('[data-movement-type]');
  const quantity = form.elements.quantity;
  const newQuantity = form.elements.newQuantity;
  const targetWarehouse = form.elements.targetWarehouseId;

  const setFieldState = (field, enabled) => {
    if (!field) return;
    field.disabled = !enabled;
    const wrapper = field.closest('.field');
    wrapper?.classList.toggle('field-context-muted', !enabled);
  };

  const sync = () => {
    const type = typeSelect.value;
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.movementType === type));
    setFieldState(quantity, type !== 'ADJUSTMENT');
    setFieldState(newQuantity, type === 'ADJUSTMENT');
    setFieldState(targetWarehouse, type === 'TRANSFER');
    if (quantity) quantity.required = type !== 'ADJUSTMENT';
    if (newQuantity) newQuantity.required = type === 'ADJUSTMENT';
    if (targetWarehouse) targetWarehouse.required = type === 'TRANSFER';
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    typeSelect.value = tab.dataset.movementType;
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    typeSelect.focus({ preventScroll: true });
  }));
  typeSelect.addEventListener('change', sync);
  sync();
}

function setupSettingsTabs() {
  const root = $('#view-configuracoes');
  if (!root) return;
  const tabs = $$('[data-settings-target]', root);
  const panels = $$('[data-settings-panel]', root);
  if (!tabs.length || !panels.length) return;

  const activate = (name, moveFocus = false) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.settingsTarget === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && moveFocus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== name;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.settingsTarget));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      activate(next.dataset.settingsTarget, true);
    });
  });
  activate(tabs.find((tab) => tab.classList.contains('active'))?.dataset.settingsTarget || tabs[0].dataset.settingsTarget);
}

function observeRenders() {
  const main = $('.main');
  if (!main) return;
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorateDynamicContent(main);
    });
  });
  observer.observe(main, { childList: true, subtree: true });
  decorateDynamicContent(main);
}

installLoteATheme();
setupMovementShortcuts();
setupSettingsTabs();
observeRenders();
