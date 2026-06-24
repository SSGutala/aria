const STYLES: Record<
  string,
  { name: string; primary: string; bg: string; accent: string }
> = {
  corporate: {
    name: "Corporate",
    primary: "#1e40af",
    bg: "#f8fafc",
    accent: "#3b82f6",
  },
  minimal: {
    name: "Minimal",
    primary: "#18181b",
    bg: "#ffffff",
    accent: "#71717a",
  },
  bold: {
    name: "Bold",
    primary: "#7c3aed",
    bg: "#0f172a",
    accent: "#a78bfa",
  },
};

export function generateStylePreviewHtml(
  styleKey: string,
  appTitle: string
): string {
  const s = STYLES[styleKey] || STYLES.corporate;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { width: 1280px; height: 800px; background: ${s.bg}; color: ${s.primary}; }
  .topbar { height: 56px; background: ${s.primary}; color: #fff; display: flex; align-items: center; padding: 0 24px; font-weight: 600; }
  .sidebar { position: absolute; left: 0; top: 56px; width: 220px; bottom: 0; background: ${s.bg}; border-right: 1px solid #e2e8f0; padding: 16px; }
  .nav-item { padding: 10px 12px; border-radius: 8px; margin-bottom: 6px; background: ${s.accent}22; font-size: 14px; }
  .main { position: absolute; left: 220px; top: 56px; right: 0; bottom: 0; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px #0001; }
  .card h2 { font-size: 18px; margin-bottom: 8px; color: ${s.primary}; }
  .btn { display: inline-block; background: ${s.accent}; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 14px; margin-top: 12px; }
  .stat-row { display: flex; gap: 16px; }
  .stat { flex: 1; padding: 16px; background: ${s.accent}15; border-radius: 10px; text-align: center; }
  .stat strong { display: block; font-size: 24px; color: ${s.accent}; }
</style></head><body>
  <div class="topbar">${appTitle} — ${s.name} style</div>
  <div class="sidebar">
    <div class="nav-item">Dashboard</div>
    <div class="nav-item">Requests</div>
    <div class="nav-item">Approvals</div>
    <div class="nav-item">Reports</div>
  </div>
  <div class="main">
    <div class="stat-row">
      <div class="stat"><strong>12</strong>Pending</div>
      <div class="stat"><strong>48</strong>Approved</div>
      <div class="stat"><strong>3</strong>Overdue</div>
    </div>
    <div class="card"><h2>Submit request</h2><p>Static mockup preview — not a runnable app.</p><span class="btn">New request</span></div>
    <div class="card"><h2>Recent activity</h2><p>Expense report #1042 awaiting manager approval.</p></div>
  </div>
</body></html>`;
}

export const STYLE_KEYS = Object.keys(STYLES);
