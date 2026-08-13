const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
// const BASE_URL = "http://127.0.0.1:8000";

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getLiveMatches() {
  return fetchJSON("/matches/live");
}

export function getUpcomingMatches() {
  return fetchJSON("/matches/upcoming");
}

export function getRecentMatches() {
  return fetchJSON("/matches/recent");
}

export function getMatchById(id) {
  return fetchJSON(`/matches/${id}`);
}
