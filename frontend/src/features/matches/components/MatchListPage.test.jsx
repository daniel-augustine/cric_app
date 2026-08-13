import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../../theme/ThemeContext";
import MatchListPage from "./MatchListPage";

const match = {
  id: "match-1",
  series: "Asia Cup",
  match_type: "T20",
  status: "upcoming",
  teams: ["India", "Sri Lanka"],
  scores: [],
  date: "2099-08-05T14:00:00Z",
};

const odiMatch = {
  ...match,
  id: "match-2",
  match_type: "ODI",
  series: "Champions Trophy",
  teams: ["Pakistan", "South Africa"],
};

const liveMatch = {
  ...match,
  id: "match-live",
  status: "live",
  teams: ["India", "Australia"],
};

const liveOdiMatch = {
  ...odiMatch,
  status: "live",
};

const completedMatch = {
  ...match,
  id: "match-completed",
  status: "completed",
  teams: ["England", "New Zealand"],
};

function renderPage(props) {
  return render(
    <ThemeProvider>
      <MatchListPage {...props} />
    </ThemeProvider>,
  );
}

describe("MatchListPage", () => {
  it("renders the loading state", () => {
    renderPage({
      activeTab: "live",
      loading: true,
      matches: [],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    expect(
      screen.getByRole("status", { name: "Loading matches" }),
    ).toBeInTheDocument();
  });

  it("renders errors and retries", async () => {
    const onRefresh = vi.fn();

    renderPage({
      activeTab: "live",
      error: "Network failed",
      loading: false,
      matches: [],
      onMatchClick: vi.fn(),
      onRefresh,
      onTabChange: vi.fn(),
    });

    expect(screen.getByText("Network failed")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Try again"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders empty, tab, and match-grid interactions", async () => {
    const onMatchClick = vi.fn();
    const onTabChange = vi.fn();

    const { rerender } = renderPage({
      activeTab: "recent",
      loading: false,
      matches: [],
      onMatchClick,
      onRefresh: vi.fn(),
      onTabChange,
    });

    expect(
      screen.getByText("No recent matches at the moment."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getAllByText("Upcoming")[0]);
    expect(onTabChange).toHaveBeenCalledWith("upcoming");

    rerender(
      <ThemeProvider>
        <MatchListPage
          activeTab="upcoming"
          lastUpdated={new Date("2026-08-04T10:11:12Z")}
          loading={false}
          matches={[match]}
          onMatchClick={onMatchClick}
          onRefresh={vi.fn()}
          onTabChange={onTabChange}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("India")).toBeInTheDocument();
    await userEvent.click(screen.getByText("India"));
    expect(onMatchClick).toHaveBeenCalledWith(match);
  });

  it("filters matches by match type", async () => {
    renderPage({
      activeTab: "live",
      loading: false,
      matches: [liveMatch, liveOdiMatch],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("Pakistan")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "ODI" }));

    expect(screen.queryByText("India")).not.toBeInTheDocument();
    expect(screen.getByText("Pakistan")).toBeInTheDocument();
  });

  it("does not render completed matches in the live tab", () => {
    renderPage({
      activeTab: "live",
      loading: false,
      matches: [liveMatch, completedMatch],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.queryByText("England")).not.toBeInTheDocument();
  });

  it("filters matches by selected league from the desktop sidebar", async () => {
    renderPage({
      activeTab: "live",
      loading: false,
      matches: [liveMatch, liveOdiMatch],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("Pakistan")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Filter league Champions Trophy" }),
    );

    expect(screen.getByText("Filtered by Champions Trophy")).toBeInTheDocument();
    expect(screen.queryByText("India")).not.toBeInTheDocument();
    expect(screen.getByText("Pakistan")).toBeInTheDocument();
    expect(screen.getByText("All leagues").nextSibling).toHaveTextContent("2");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("Pakistan")).toBeInTheDocument();
  });

  it("combines selected league and match-type filters", async () => {
    renderPage({
      activeTab: "live",
      loading: false,
      matches: [liveMatch, liveOdiMatch],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Filter league Asia Cup" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "ODI" }));

    expect(screen.queryByText("India")).not.toBeInTheDocument();
    expect(screen.queryByText("Pakistan")).not.toBeInTheDocument();
    expect(
      screen.getByText("No Asia Cup matches at the moment."),
    ).toBeInTheDocument();
  });

  it("switches between list and card layouts", async () => {
    renderPage({
      activeTab: "live",
      loading: false,
      matches: [liveMatch, liveOdiMatch],
      onMatchClick: vi.fn(),
      onRefresh: vi.fn(),
      onTabChange: vi.fn(),
    });

    expect(screen.getByLabelText("list match layout")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByLabelText("cards match layout")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByLabelText("list match layout")).toBeInTheDocument();
  });
});
