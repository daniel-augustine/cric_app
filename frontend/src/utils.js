export function formatScore(runs, wickets, overs) {
  if (overs === 0 && runs === 0) return 'Yet to bat';
  return `${runs}-${wickets} (${overs})`;
}

export function formatMatchType(type) {
  const map = { T20: 'T20', ODI: 'ODI', Test: 'TEST' };
  return map[type] || type;
}

export function getStatusColor(status) {
  if (status === 'live') return 'bg-cblive';
  if (status === 'upcoming') return 'bg-cbupcoming';
  return 'bg-cbcompleted';
}

function parseDateValue(value) {
  if (!value) return null;
  const dateValue =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(dateStr) {
  const d = parseDateValue(dateStr);
  if (!d) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateWithoutTime(dateStr) {
  const d = parseDateValue(dateStr);
  if (!d) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
