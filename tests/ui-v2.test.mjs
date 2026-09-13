import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../apps/web/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../apps/web/index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../apps/web/sw.js', import.meta.url), 'utf8');
const uiModulePath = new URL('../apps/web/ui-v2.js', import.meta.url);

function has(pattern, source, message) {
  assert.match(source, pattern, message);
}

test('UI v2 keeps the hidden visibility regression guard', () => {
  has(/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/i, css, 'hidden elements must always remain hidden');
});

test('UI v2 exposes the approved design tokens', () => {
  has(/--color-sidebar\s*:\s*#0f172a/i, css, 'sidebar token missing');
  has(/--color-primary\s*:\s*#2563eb/i, css, 'primary token missing');
  has(/--color-surface\s*:\s*#ffffff/i, css, 'surface token missing');
  has(/--color-border\s*:\s*#e2e8f0/i, css, 'border token missing');
  has(/--color-success\s*:\s*#16a34a/i, css, 'success token missing');
  has(/--color-warning\s*:\s*#d97706/i, css, 'warning token missing');
  has(/--color-danger\s*:\s*#dc2626/i, css, 'danger token missing');
});

test('navigation and dashboard use UI v2 semantic components', () => {
  has(/class="nav-icon"/, html, 'sidebar icons missing');
  has(/class="card metric-card metric-products"/, html, 'dashboard metric card semantics missing');
  has(/class="card metric-card metric-low"/, html, 'low stock semantic metric missing');
});

test('movement labels are Portuguese while API values remain stable', () => {
  has(/<option value="ENTRY">Entrada<\/option>/, html, 'ENTRY must render as Entrada');
  has(/<option value="EXIT">Saída<\/option>/, html, 'EXIT must render as Saída');
  has(/<option value="ADJUSTMENT">Ajuste<\/option>/, html, 'ADJUSTMENT must render as Ajuste');
  has(/<option value="TRANSFER">Transferência<\/option>/, html, 'TRANSFER must render as Transferência');
  has(/class="operation-tabs"/, html, 'movement operation shortcuts missing');
});

test('settings and operational screens expose v2 grouping hooks', () => {
  has(/class="settings-tabs"/, html, 'settings grouping missing');
  has(/data-settings-target="backup"/, html, 'backup settings tab missing');
  has(/class="empty-state"/, html, 'improved empty state missing');
  has(/class="panel panel-accent"/, html, 'accent panel hook missing');
});

test('presentation behavior is isolated and cached for local-first use', () => {
  assert.equal(fs.existsSync(uiModulePath), true, 'ui-v2.js presentation module missing');
  const ui = fs.readFileSync(uiModulePath, 'utf8');
  has(/data-movement-type/, ui, 'movement shortcut behavior missing');
  has(/data-settings-target/, ui, 'settings tab behavior missing');
  has(/MutationObserver/, ui, 'dynamic table decoration missing');
  has(/<script type="module" src="\/ui-v2\.js"><\/script>/, html, 'ui-v2.js is not loaded');
  has(/['"]\/ui-v2\.js['"]/, sw, 'ui-v2.js is not in the offline shell');
});

test('responsive and accessibility rules are present', () => {
  has(/:focus-visible/, css, 'focus-visible treatment missing');
  has(/@media\s*\(max-width\s*:\s*760px\)/i, css, 'mobile breakpoint missing');
  has(/min-height\s*:\s*44px/i, css, 'touch target minimum missing');
  has(/prefers-reduced-motion/, css, 'reduced-motion support missing');
});
