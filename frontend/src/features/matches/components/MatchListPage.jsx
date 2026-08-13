import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../../shared/ui/EmptyState";
import ErrorState from "../../../shared/ui/ErrorState";
import { MatchCardGridSkeleton } from "../../../shared/ui/Skeleton";
import AppHeader from "./AppHeader";
import DesktopSidebar from "./DesktopSidebar";
import LayoutSelector from "./LayoutSelector";
import MatchGrid from "./MatchGrid";
import MatchTabs from "./MatchTabs";
import MatchTypeFilters from "./MatchTypeFilters";
import { getMatchesForTab } from "../utils/matchStatus";

export default function MatchListPage({
  activeTab,
  error,
  lastUpdated,
  loading,
  matches,
  onMatchClick,
  onRefresh,
  onTabChange,
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeLayout, setActiveLayout] = useState("list");
  const [selectedSeries, setSelectedSeries] = useState(null);

  useEffect(() => {
    setActiveFilter("all");
    setSelectedSeries(null);
  }, [activeTab]);

  const tabMatches = useMemo(
    () => getMatchesForTab(activeTab, matches),
    [activeTab, matches],
  );

  const leagues = useMemo(() => {
    const counts = tabMatches.reduce((acc, match) => {
      if (!match.series) return acc;
      acc.set(match.series, (acc.get(match.series) || 0) + 1);
      return acc;
    }, new Map());

    return Array.from(counts, ([series, count]) => ({ series, count })).sort(
      (a, b) => b.count - a.count || a.series.localeCompare(b.series),
    );
  }, [tabMatches]);

  const filteredMatches = useMemo(
    () =>
      tabMatches.filter((match) => {
        const matchesType =
          activeFilter === "all" || match.match_type === activeFilter;
        const matchesSeries =
          !selectedSeries || match.series === selectedSeries;

        return matchesType && matchesSeries;
      }),
    [activeFilter, selectedSeries, tabMatches],
  );

  return (
    <div className="min-h-screen bg-cbdark p-0 text-cbtext md:p-7">
      <div className="mx-auto min-h-screen max-w-6xl overflow-hidden border-cbborder bg-cbsurface shadow-2xl shadow-black/20 md:min-h-[calc(100vh-56px)] md:rounded-xl md:border">
        <AppHeader
          lastUpdated={lastUpdated}
          loading={loading}
          onRefresh={onRefresh}
        />

        <div className="md:flex">
          <DesktopSidebar
            activeCount={filteredMatches.length}
            activeTab={activeTab}
            leagueTotalCount={tabMatches.length}
            leagues={leagues}
            onSeriesChange={setSelectedSeries}
            onTabChange={onTabChange}
            selectedSeries={selectedSeries}
          />

          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7">
            <div className="space-y-4 md:hidden">
              {lastUpdated && (
                <p className="text-sm text-cbmuted">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cbgreen" />
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <MatchTabs
                activeCount={filteredMatches.length}
                activeTab={activeTab}
                onTabChange={onTabChange}
              />
            </div>

            <div className="mb-5 mt-6 flex flex-col gap-4 md:mt-0">
              <h2 className="text-2xl font-bold capitalize text-cbtext">
                {activeTab} Matches
              </h2>
              {selectedSeries && (
                <div className="flex items-center gap-2 text-sm text-cbmuted">
                  <span className="truncate">Filtered by {selectedSeries}</span>
                  <button
                    onClick={() => setSelectedSeries(null)}
                    className="rounded border border-cbborder px-2 py-1 text-xs text-cbaccent hover:border-cbaccent/40"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <MatchTypeFilters
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                />
                <LayoutSelector
                  activeLayout={activeLayout}
                  onLayoutChange={setActiveLayout}
                />
              </div>
            </div>

            {loading ? (
              <MatchCardGridSkeleton />
            ) : error ? (
              <ErrorState message={error} onRetry={onRefresh} />
            ) : filteredMatches.length === 0 ? (
              <EmptyState
                label={`No ${
                  selectedSeries ||
                  (activeFilter === "all" ? activeTab : activeFilter)
                } matches at the moment.`}
              />
            ) : (
              <MatchGrid
                activeTab={activeTab}
                layout={activeLayout}
                matches={filteredMatches}
                onMatchClick={onMatchClick}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
