export function normalizeMatchStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function isLiveMatch(match) {
  return normalizeMatchStatus(match?.status) === "live";
}

function parseMatchDate(date) {
  if (!date) return null;
  const dateValue =
    typeof date === "string" && /^\d+$/.test(date) ? Number(date) : date;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function isUpcomingMatchVisible(match, now = new Date()) {
  if (normalizeMatchStatus(match?.status) !== "upcoming") return false;

  const matchDate = parseMatchDate(match?.date);
  if (!matchDate) return true;

  return matchDate.getTime() >= now.getTime();
}

export function getMatchesForTab(activeTab, matches = []) {
  if (activeTab === "live") return matches.filter(isLiveMatch);
  if (activeTab === "upcoming") {
    return matches.filter((match) => isUpcomingMatchVisible(match));
  }
  return matches;
}
