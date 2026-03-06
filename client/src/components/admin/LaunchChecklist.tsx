import { useState } from 'react';

const defaultItems = [
  'Staging deploy updated before production release',
  'DB backup completed and verified',
  'Webhook replay test passed',
  'Buyer end-to-end test passed',
  'Seller end-to-end test passed',
  'Retirement certificate flow tested',
  'Admin approve/reject flow tested',
  'Rollback plan reviewed',
  'Incident contact published',
  'Status page updated',
];

export function LaunchChecklist() {
  const [items, setItems] = useState(defaultItems.map(label => ({ label, done: false })));
  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid #1e3050', background: '#0d1a2e' }}>
      <h3 style={{ marginTop: 0, color: '#d4a843' }}>Launch Checklist</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item, idx) => (
          <label key={item.label} style={{ display: 'flex', gap: 10, color: '#e2e8f0' }}>
            <input type="checkbox" checked={item.done} onChange={() => setItems(prev => prev.map((it, i) => i === idx ? { ...it, done: !it.done } : it))} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
