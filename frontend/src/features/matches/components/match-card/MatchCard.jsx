import { Fragment } from "react";
import {
  formatDate,
  formatDateWithoutTime,
  formatMatchType,
  formatScore,
} from "../../../../utils";
import { normalizeMatchStatus } from "../../utils/matchStatus";

function statusLabel(status) {
  const normalizedStatus = normalizeMatchStatus(status);
  if (normalizedStatus === "live") return "LIVE";
  if (normalizedStatus === "completed") return "COMPLETED";
  return "UPCOMING";
}

function statusClasses(status) {
  const normalizedStatus = normalizeMatchStatus(status);
  if (normalizedStatus === "live") return "bg-cblive text-cbonlive";
  if (normalizedStatus === "completed")
    return "bg-cbcompleted/20 text-cbcompleted";
  return "bg-cbupcoming/15 text-cbupcoming";
}

function TeamRows({ compact = false, match }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
      {match.teams.map((team, index) => (
        <Fragment key={`${team}-${index}`}>
          <h3 className="min-w-0 text-lg font-bold leading-tight text-cbtext sm:text-xl">
            {team}
          </h3>
          {match.scores?.[index] ? (
            <p
              className={`whitespace-nowrap text-right font-bold ${
                index === 0
                  ? `${compact ? "text-xl" : "text-2xl"} text-cblive`
                  : `${compact ? "text-lg" : "text-xl"} text-cbcompleted`
              }`}
            >
              {formatScore(
                match.scores[index].runs,
                match.scores[index].wickets,
                match.scores[index].overs,
              )}
            </p>
          ) : (
            <span aria-hidden="true" />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export default function MatchCard({ activeTab, layout = "list", match, onClick }) {
  const firstScore = match.scores?.[0];
  const compact = layout === "cards";
  const matchStatus = normalizeMatchStatus(match.status);
  const summaryText =
    activeTab === "recent" ? match.result : match.status_text || match.result;
  const dateLabel =
    matchStatus === "completed"
      ? formatDateWithoutTime(match.date)
      : formatDate(match.date);

  return (
    <button
      onClick={() => onClick(match)}
      className={`group w-full rounded-xl border bg-cbcard p-4 text-left shadow-lg shadow-black/10 transition-all hover:border-cbaccent/40 hover:bg-cbsurface ${
        matchStatus === "live"
          ? "border-l-4 border-l-cblive border-cbborder"
          : "border-cbborder"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-1 text-xs font-bold ${statusClasses(
                match.status,
              )}`}
            >
              {statusLabel(match.status)}
            </span>
            {matchStatus === "live" && firstScore?.overs > 0 && (
              <span className="rounded bg-cblive/10 px-2 py-1 text-xs font-semibold text-cblive">
                {firstScore.overs} ov
              </span>
            )}
          </div>
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-cbmuted">
            {match.series}
          </p>
        </div>

        <span className="rounded bg-cbupcoming/10 px-2.5 py-1 text-xs font-semibold text-cbupcoming">
          {formatMatchType(match.match_type)}
        </span>
      </div>

      <div>
        <div className="min-w-0">
          <TeamRows compact={compact} match={match} />
          {summaryText && (
            <p className="mt-4 text-sm text-cbmuted">{summaryText}</p>
          )}
          {matchStatus !== "live" && dateLabel && (
            <p className="mt-2 text-sm text-cbmuted">{dateLabel}</p>
          )}
          {match.venue && (
            <p className="mt-2 text-sm text-cbmuted">{match.venue}</p>
          )}
        </div>
      </div>
    </button>
  );
}
