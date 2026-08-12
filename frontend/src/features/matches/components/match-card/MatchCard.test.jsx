import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MatchCard from "./MatchCard";

const baseMatch = {
  id: "match-1",
  series: "India Tour",
  match_type: "T20",
  status: "live",
  status_text: "India need 12 runs",
  teams: ["India", "Australia"],
  scores: [
    { runs: 142, wickets: 4, overs: 17.2 },
    { runs: 153, wickets: 7, overs: 20 },
  ],
  venue: "Wankhede Stadium",
};

describe("MatchCard", () => {
  it("renders match summary and dispatches the selected match", async () => {
    const onClick = vi.fn();

    render(<MatchCard match={baseMatch} onClick={onClick} />);
    await userEvent.click(screen.getByText("India"));

    expect(screen.getByText("India Tour")).toBeInTheDocument();
    expect(screen.getByText("142-4 (17.2)")).toBeInTheDocument();
    expect(screen.getByText("India need 12 runs")).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledWith(baseMatch);
  });

  it("shows only the result text for recent matches", () => {
    render(
      <MatchCard
        activeTab="recent"
        match={{
          ...baseMatch,
          date: "1786543200000",
          result: "India won by 24 runs",
          status: "completed",
          status_text: "Completed",
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("India won by 24 runs")).toBeInTheDocument();
    expect(screen.getByText("Aug 12")).toBeInTheDocument();
    expect(screen.queryByText("Aug 12, 07:30 PM")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("shows date and time for upcoming matches", () => {
    render(
      <MatchCard
        activeTab="upcoming"
        match={{
          ...baseMatch,
          date: 1786543200000,
          status: "upcoming",
          status_text: "Match starts at Aug 12, 02:00 PM GMT",
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Aug 12, 07:30 PM")).toBeInTheDocument();
  });
});
