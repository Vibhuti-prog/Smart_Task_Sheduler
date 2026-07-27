import type { Task } from '../types';

export function tasksToCSV(tasks: Task[]): string {
  const headers = [
    'Title',
    'Description',
    'Status',
    'Priority',
    'Category',
    'Tags',
    'Due Date',
    'Completed At',
    'Estimated Minutes',
    'Recurrence',
    'Created At',
  ];
  const escape = (v: string | null | undefined): string => {
    const s = v ?? '';
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = tasks.map((t) =>
    [
      t.title,
      t.description,
      t.status,
      t.priority,
      t.category,
      t.tags.join('|'),
      t.due_date ? new Date(t.due_date).toISOString() : '',
      t.completed_at ? new Date(t.completed_at).toISOString() : '',
      t.estimated_minutes ?? '',
      t.recurrence,
      t.created_at,
    ]
      .map((v) => escape(String(v)))
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTasksCSV(tasks: Task[]): void {
  const csv = tasksToCSV(tasks);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`tasks-${stamp}.csv`, csv, 'text/csv;charset=utf-8;');
}

export function exportTasksPDF(tasks: Task[]): void {
  // Lightweight printable HTML export — opens a print dialog so the user can
  // "Save as PDF". Avoids a heavy PDF dependency while still delivering export.
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = tasks
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.title)}</td>
        <td>${t.priority}</td>
        <td>${t.status}</td>
        <td>${t.due_date ? new Date(t.due_date).toLocaleString() : '—'}</td>
        <td>${t.category ?? '—'}</td>
      </tr>`,
    )
    .join('');
  win.document.write(`<!doctype html><html><head><title>Tasks</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;padding:32px;color:#0f172a}
    h1{font-size:22px;margin-bottom:4px}
    .meta{color:#64748b;font-size:13px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0}
    th{background:#f1f5f9;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
    tr:nth-child(even){background:#f8fafc}
  </style></head><body>
  <h1>Task Report</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} • ${tasks.length} tasks</div>
  <table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due</th><th>Category</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}
