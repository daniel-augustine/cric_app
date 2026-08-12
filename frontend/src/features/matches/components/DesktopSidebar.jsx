import { MATCH_TABS } from "../constants";

export default function DesktopSidebar({
  activeTab,
  activeCount,
  leagueTotalCount,
  leagues,
  onSeriesChange,
  onTabChange,
  selectedSeries,
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-cbborder bg-cbcard px-5 py-6 md:block">
      <nav className="space-y-2">
        {MATCH_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              onSeriesChange(null);
              onTabChange(tab.key);
            }}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-cbaccent/10 text-cbaccent"
                : "text-cbmuted hover:bg-cbsurface hover:text-cbtext"
            }`}
          >
            <span>{tab.label}</span>
            {activeTab === tab.key && (
              <span className="rounded-full bg-cbaccent/20 px-2 py-0.5 text-xs text-cbaccent">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-8 border-t border-cbborder pt-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-cbmuted">
          Popular Leagues
        </p>
        {leagues.length > 0 ? (
          <div className="space-y-1">
            <button
              onClick={() => onSeriesChange(null)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedSeries
                  ? "text-cbmuted hover:bg-cbsurface hover:text-cbtext"
                  : "bg-cbaccent/10 text-cbaccent"
              }`}
            >
              <span>All leagues</span>
              <span className="text-xs">{leagueTotalCount}</span>
            </button>
            {leagues.map((league) => (
              <button
                key={league.series}
                aria-label={`Filter league ${league.series}`}
                onClick={() => onSeriesChange(league.series)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedSeries === league.series
                    ? "bg-cbaccent/10 text-cbaccent"
                    : "text-cbmuted hover:bg-cbsurface hover:text-cbtext"
                }`}
              >
                <span className="truncate">{league.series}</span>
                <span className="shrink-0 text-xs">{league.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cbmuted">No leagues available</p>
        )}
      </div>
    </aside>
  );
}
