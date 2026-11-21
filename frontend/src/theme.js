/**
 * Light-mode design tokens — dùng chung cho tất cả components.
 * Text thường: Inter  |  Số/code: JetBrains Mono
 */

export const C = {
  // Surfaces
  bg:        '#F8FAFC',   // trang chủ
  surface:   '#FFFFFF',   // card, panel
  surfaceAlt:'#F1F5F9',   // sub-panel, table header
  hover:     '#F8FAFC',   // row hover

  // Borders
  border:    '#E2E8F0',
  borderMd:  '#CBD5E1',

  // Text
  textPrimary:  '#0F172A',
  textSecond:   '#475569',
  textMuted:    '#94A3B8',
  textDisabled: '#CBD5E1',

  // Accents
  accent:    '#2563EB',   // active tab, primary button
  accentHov: '#1D4ED8',
  success:   '#10B981',
  warning:   '#F59E0B',
  danger:    '#EF4444',
  purple:    '#6366F1',
};

export const F = {
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

/** Reusable style objects */
export const panelStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: 16,
};

export const labelStyle = {
  fontFamily: F.sans,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: C.textMuted,
  margin: 0,
};

export const monoStyle = {
  fontFamily: F.mono,
};

export const inputStyle = {
  width: '100%',
  background: C.surfaceAlt,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: '6px 10px',
  color: C.textPrimary,
  fontSize: 12,
  fontFamily: F.mono,
  outline: 'none',
};

export const inputLabelStyle = {
  fontFamily: F.sans,
  fontSize: 11,
  fontWeight: 500,
  color: C.textSecond,
  marginBottom: 4,
  display: 'block',
};

export const thStyle = {
  padding: '7px 10px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: C.textMuted,
  fontFamily: F.sans,
  textAlign: 'left',
  background: C.surfaceAlt,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};

export const tdStyle = {
  padding: '6px 10px',
  fontSize: 11,
  fontFamily: F.mono,
  color: C.textSecond,
  borderBottom: `1px solid ${C.border}`,
};

export const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: F.sans,
  background: C.accent,
  color: '#fff',
  transition: 'background 0.15s',
};

export const btnSecondary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: F.sans,
  background: C.surface,
  color: C.textSecond,
  transition: 'background 0.15s',
};
