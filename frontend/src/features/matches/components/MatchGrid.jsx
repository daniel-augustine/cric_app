import MatchCard from "./match-card/MatchCard";

export default function MatchGrid({
  activeTab,
  layout = "list",
  matches,
  onMatchClick,
}) {
  const gridClass =
    layout === "cards"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : "space-y-3";

  return (
    <div className={gridClass} aria-label={`${layout} match layout`}>
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          activeTab={activeTab}
          layout={layout}
          match={match}
          onClick={onMatchClick}
        />
      ))}
    </div>
  );
}
