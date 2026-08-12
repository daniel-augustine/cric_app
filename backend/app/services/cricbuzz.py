import json
from logging import info
import re
from datetime import datetime, timezone
from html import unescape
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from app.models import Match, TeamScore, BattingScore, BowlingScore, FallOfWicket, Innings, Scorecard


HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

LIVE_URL = "https://www.cricbuzz.com/cricket-match/live-scores"
SCHEDULE_URL = "https://www.cricbuzz.com/cricket-schedule/upcoming-series/all"
RECENT_URL = "https://www.cricbuzz.com/cricket-scorecard-archives"


def _parse_overs(overs_str: str) -> float:
    cleaned = overs_str.replace("Balls", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _guess_match_type(match_info: str) -> str:
    info_lower = match_info.lower()
    if "test" in info_lower:
        return "Test"
    if "odi" in info_lower or "one-day" in info_lower:
        return "ODI"
    return "T20"


def _extract_venue(match_info: str) -> str:
    if "•" in match_info:
        return match_info.split("•", 1)[1].strip()
    return match_info


def _determine_status(status_text: str) -> str:
    lower = status_text.lower()
    if "won" in lower or "won by" in lower:
        return "completed"
    if "preview" in lower:
        return "upcoming"
    return "live"


def _normalize_match_format(match_format: str, match_desc: str = "", series: str = "") -> str:
    text = " ".join([match_format, match_desc, series]).lower()
    if "test" in text:
        return "Test"
    if "odi" in text:
        return "ODI"
    return "T20"


def _extract_json_object(text: str, start: int) -> Optional[str]:
    depth = 0
    in_string = False
    escaped = False

    for i in range(start, len(text)):
        char = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return None


def _extract_embedded_matches(page_html: str) -> list[dict]:
    page_text = unescape(page_html).replace('\\"', '"')
    matches: list[dict] = []
    markers = ('"match":{', '{"matchInfo":')

    for marker in markers:
        pos = 0

        while True:
            marker_pos = page_text.find(marker, pos)
            if marker_pos == -1:
                break

            if marker == '"match":{':
                object_start = page_text.find("{", marker_pos + len('"match":'))
            else:
                object_start = marker_pos
            if object_start == -1:
                break

            object_text = _extract_json_object(page_text, object_start)
            if object_text is None:
                pos = marker_pos + len(marker)
                continue

            try:
                match_obj = json.loads(object_text)
            except json.JSONDecodeError:
                pos = object_start + 1
                continue

            if isinstance(match_obj, dict) and isinstance(match_obj.get("matchInfo"), dict):
                matches.append(match_obj)

            pos = object_start + len(object_text)

    return matches


def _build_team_score(team: str, score_data: Optional[dict]) -> TeamScore:
    if not isinstance(score_data, dict):
        return TeamScore(team=team)

    innings = [
        innings_data
        for key, innings_data in score_data.items()
        if key.startswith("inngs") and isinstance(innings_data, dict)
    ]
    innings.sort(key=lambda item: item.get("inningsId", 0))

    if not innings:
        return TeamScore(team=team)

    runs = sum(int(item.get("runs") or 0) for item in innings)
    wickets = sum(int(item.get("wickets") or 0) for item in innings)
    overs = sum(float(item.get("overs") or 0.0) for item in innings)

    return TeamScore(team=team, runs=runs, wickets=wickets, overs=overs)


async def fetch_live_matches() -> list[Match]:
    """Scrape live matches from Cricbuzz."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(LIVE_URL, headers=HEADERS, timeout=15.0)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    matches: list[Match] = []
    seen_ids: set[str] = set()

    for a in soup.find_all("a", href=True):
        if "/live-cricket-scores/" not in a["href"]:
            continue
        text = a.get_text(separator="|", strip=True)
        if not re.search(r"\d+-\d+\s*\(", text):
            continue

        match_id = a["href"].split("/")[2]
        if match_id in seen_ids:
            continue
        seen_ids.add(match_id)

        series = ""
        parent = a.parent
        for _ in range(5):
            if parent:
                series_link = parent.find("a", href=True)
                if series_link and "/cricket-series/" in series_link.get("href", ""):
                    series = series_link.get_text(strip=True)
                    break
                parent = parent.parent

        parts = [p.strip() for p in text.split("|") if p.strip()]
        match_info = parts[0] if parts else ""
        venue = _extract_venue(match_info)
        match_type = _guess_match_type(match_info)

        scores: list[TeamScore] = []
        status_text = ""
        i = 1
        score_first_innings_index= 0 
        while i < len(parts):
            part = parts[i]
            score_match = re.match(r"^(\d+)(?:-(\d+))?\s*\((.+?)\)", part)
            if score_match and i >= 2:
                runs = int(score_match.group(1))
                wickets = int(score_match.group(2)) if score_match.group(2) is not None else 0
                overs = _parse_overs(score_match.group(3))
                team_name = parts[i - 2]
                score_first_innings_index = i
                scores.append(
                    TeamScore(
                        team=team_name,
                        runs=runs,
                        wickets=wickets,
                        overs=overs,
                    )
                )
            elif any(
                kw in part.lower()
                for kw in ["won", "need", "innings", "preview", "stumped", "tied", "drawn"]
            ):
                status_text = part
            i += 1

        if(len(scores) == 1):
            if (score_first_innings_index >= 1):
                scores.append(
                    TeamScore(
                    team=parts[score_first_innings_index + 1],
                    runs=0,
                    wickets=0,
                    overs=0.0,
                    )
                )

        if not scores:
            continue

        status = _determine_status(status_text)

        if not status=="completed":
            matches.append(
                Match(
                    id=f"cb-{match_id}",
                    teams=[s.team for s in scores],
                    scores=scores,
                    status=status,
                    status_text=status_text or match_info,
                    result=status_text if status == "completed" else None,
                    venue=venue,
                    series=series,
                    match_type=match_type,
                    summary=status_text,
                )
            )

    return matches

def extract_match_times(page_html: str) -> dict[str, int]:
    match_times: dict[str, int] = {}
    html = page_html.replace('\\"', '"')

    match_id_pattern = re.compile(
        r'"matchId"\s*:\s*(\d+)'
    )

    for match in match_id_pattern.finditer(html):
        match_id = match.group(1)

        if match_id in match_times:
            continue

        start = max(0, match.start() - 500)
        end = min(len(html), match.end() + 5000)

        section = html[start:end]

        start_date_match = re.search(
            r'"startDate"\s*:\s*"?(\d+)"?',
            section,
        )

        if not start_date_match:
            continue

        match_times[match_id] = int(start_date_match.group(1))

    return match_times

async def fetch_upcoming_matches() -> list[Match]:
    """Scrape upcoming match schedule from Cricbuzz."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(SCHEDULE_URL, headers=HEADERS, timeout=15.0)
        resp.raise_for_status()
    
    match_time_map = extract_match_times(resp.text)

    soup = BeautifulSoup(resp.text, "lxml")
    matches: list[Match] = []
    seen_ids: set[str] = set()

    for a in soup.find_all("a", href=True):
        if "/live-cricket-scores/" not in a["href"]:
            continue

        text = a.get_text(separator="|", strip=True)
        parts = [p.strip() for p in text.split("|") if p.strip()]

        # Only parse schedule entries with venue info:
        # ['Team A', 'vs', 'Team B', ',', 'Match Desc', 'Venue', ',', 'City']
        if len(parts) < 5 or parts[1] != "vs" or parts[3] != ",":
            continue

        match_id = a["href"].split("/")[2]
        base_id = match_id.rsplit("-", 1)[0] if "-" in match_id else match_id

        # Use the base match ID from href (strip day suffix for tests)
        href_parts = a["href"].split("/")
        if len(href_parts) >= 3:
            raw_id = href_parts[2]
            time_upcoming = match_time_map.get(raw_id)            
        else:
            continue

        if raw_id in seen_ids:
            continue

        # Skip if match is currently live
        if "LIVE" in parts:
            continue

        team_a = parts[0]
        team_b = parts[2]
        teams = [team_a, team_b]

        # Everything after the comma is match desc + venue
        after_comma = parts[4:]
        match_desc = after_comma[0] if after_comma else ""
        venue_parts = [p for p in after_comma[1:] if p != ","]
        venue = ", ".join(venue_parts) if venue_parts else ""

        seen_ids.add(raw_id)

        # Find series name from parent
        series = ""
        parent = a.parent
        for _ in range(5):
            if parent:
                series_link = parent.find("a", href=True)
                if series_link and "/cricket-series/" in series_link.get("href", ""):
                    series = series_link.get_text(strip=True)
                    break
                parent = parent.parent

        # Find date heading before this link
        date_str = ""
        prev_date = a.find_previous(string=re.compile(r"(SUN|MON|TUE|WED|THU|FRI|SAT),", re.I))
        if prev_date:
            date_str = prev_date.strip()

        match_type = _guess_match_type(match_desc)    
        
        matches.append(
            Match(
                id=f"cb-{raw_id}",
                teams=teams,
                scores=[],
                status="upcoming",
                status_text=f"Upcoming - {date_str}" if date_str else "Upcoming",
                venue=venue,
                #date=datetime.now(timezone.utc),
                date=time_upcoming,
                series=series,
                match_type=match_type,
                summary=match_desc,
            )
        )

    return matches

async def fetch_recent_matches() -> list[Match]:
    """Scrape recent match results from Cricbuzz."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(RECENT_URL, headers=HEADERS, timeout=15.0)
        resp.raise_for_status()

    embedded_matches = _extract_embedded_matches(resp.text)
    if embedded_matches:
        matches: list[Match] = []
        seen_ids: set[str] = set()

        for match_obj in embedded_matches:
            info = match_obj["matchInfo"]
            state = str(info.get("state") or "")
            if state.lower() not in {"complete", "completed"}:
                continue

            match_id = str(info.get("matchId") or "")
            if not match_id or match_id in seen_ids:
                continue
            seen_ids.add(match_id)

            team_a = info.get("team1", {}).get("teamName", "")
            team_b = info.get("team2", {}).get("teamName", "")
            teams = [team for team in [team_a, team_b] if team]
            if len(teams) < 2:
                continue

            score = match_obj.get("matchScore") or {}
            venue_info = info.get("venueInfo") or {}
            venue = ", ".join(
                part for part in [venue_info.get("ground"), venue_info.get("city")] if part
            )
            result = str(info.get("status") or "")
            match_desc = str(info.get("matchDesc") or "")
            series = str(info.get("seriesName") or "")

            matches.append(
                Match(
                    id=f"cb-{match_id}",
                    teams=teams,
                    scores=[
                        _build_team_score(team_a, score.get("team1Score")),
                        _build_team_score(team_b, score.get("team2Score")),
                    ],
                    status="completed",
                    status_text=result,
                    result=result,
                    venue=venue,
                    date=int(info["startDate"]) if info.get("startDate") else None,
                    series=series,
                    match_type=_normalize_match_format(
                        str(info.get("matchFormat") or ""), match_desc, series
                    ),
                    summary=match_desc,
                )
            )

        return matches

    soup = BeautifulSoup(resp.text, "lxml")
    matches: list[Match] = []
    seen_ids: set[str] = set()

    for a in soup.find_all("a", href=True):
        if "/cricket-scorecard-archives/" not in a["href"]:
            continue

        text = a.get_text(separator="|", strip=True)
        parts = [p.strip() for p in text.split("|") if p.strip()]

        # Only parse entries with at least 5 parts (team1, vs, team2, , result)
        if len(parts) < 5 or parts[1] != "vs" or parts[3] != ",":
            continue

        match_id = a["href"].split("/")[2]
        if match_id in seen_ids:
            continue
        seen_ids.add(match_id)

        team_a = parts[0]
        team_b = parts[2]
        teams = [team_a, team_b]

        result = parts[4] if len(parts) > 4 else ""
        match_desc = parts[5] if len(parts) > 5 else ""
        venue_parts = [p for p in parts[6:] if p != ","]
        venue = ", ".join(venue_parts) if venue_parts else ""

        match_type = _normalize_match_format("", match_desc)

        matches.append(
            Match(
                id=f"cb-{match_id}",
                teams=teams,
                scores=[],
                status="completed",
                status_text=result,
                result=result,
                venue=venue,
                series="",
                match_type=match_type,
                summary=match_desc,
            )
        )

    return matches

SCORECARD_BASE = "https://www.cricbuzz.com/live-cricket-scorecard"


def _parse_score_int(val) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def _parse_score_float(val) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def _extract_scorecard_json(text: str) -> dict | None:
    """Extract scorecardApiData JSON from the page's Next.js script data."""
    idx = text.find("scorecardApiData")
    if idx < 0:
        return None

    sc_idx = text.find("scoreCard", idx)
    if sc_idx < 0:
        return None

    obj_start = text.rfind("{", 0, sc_idx)
    if obj_start < 0:
        return None

    chunk = text[obj_start : obj_start + 100000]
    unescaped = chunk.replace('\\"', '"').replace("\\\\", "\\").replace("\\n", "\n")

    depth = 0
    i = 0
    while i < len(unescaped):
        if unescaped[i] == "{":
            depth += 1
        elif unescaped[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1

    if depth != 0:
        return None

    try:
        return json.loads(unescaped[: i + 1])
    except json.JSONDecodeError:
        return None


def _build_innings_from_json(inn_data: dict, innings_idx: int) -> Innings:
    """Build an Innings model from the Cricbuzz JSON scorecard data."""
    bat = inn_data.get("batTeamDetails", {})
    bowl = inn_data.get("bowlTeamDetails", {})
    score = inn_data.get("scoreDetails", {})
    extras = inn_data.get("extrasData", {})
    wkts = inn_data.get("wicketsData", {})

    batting_team = bat.get("batTeamName", "")
    bowling_team = bowl.get("bowlTeamName", "")
    runs = score.get("runs", 0)
    wickets = score.get("wickets", 0)
    overs = score.get("overs", 0)

    batting_list: list[BattingScore] = []
    batsmen = bat.get("batsmenData", {})
    for key in sorted(batsmen.keys()):
        b = batsmen[key]
        # print(b)
        out_desc = b.get("outDesc", "")
        # print(f"out_desc: {out_desc}")
        is_batting = "batting" in out_desc.lower()
        # print(f"is_batting: {is_batting}")
        is_out = bool(out_desc) and "not out" not in out_desc.lower() and not is_batting

        batting_list.append(
            BattingScore(
                batter=b.get("batName", ""),
                dismissal=out_desc,
                runs=b.get("runs", 0),
                balls=b.get("balls", 0),
                fours=b.get("fours", 0),
                sixes=b.get("sixers", 0),
                strike_rate=b.get("strikeRate", 0),
                is_out=is_out,
                is_batting=is_batting,
            )
        )

    bowling_list: list[BowlingScore] = []
    bowlers = bowl.get("bowlersData", {})
    for key in sorted(bowlers.keys()):
        b = bowlers[key]
        bowling_list.append(
            BowlingScore(
                bowler=b.get("bowlName", ""),
                balls=b.get("balls", 0),
                maidens=b.get("maidens", 0),
                runs=b.get("runs", 0),
                wickets=b.get("wickets", 0),
                noballs=b.get("no_balls", 0),
                wides=b.get("wides", 0),
                economy=b.get("economy", 0),
            )
        )

    fow_list: list[FallOfWicket] = []
    for key in sorted(wkts.keys()):
        w = wkts[key]
        fow_list.append(
            FallOfWicket(
                batter=w.get("batName", ""),
                score=f"{w.get('wktRuns', 0)}-{w.get('wktNbr', 0)}",
                wicket_ball=str(w.get("wktOver", "")),
            )
        )

    extras_str = ""
    if extras:
        extras_str = (
            f"{extras.get('total', 0)} "
            f"(b {extras.get('byes', 0)}, lb {extras.get('legByes', 0)}, "
            f"w {extras.get('wides', 0)}, nb {extras.get('noBalls', 0)}, "
            f"p {extras.get('penalty', 0)})"
        )

    return Innings(
        innings_label=f"{bat.get('batTeamShortName', '')} Inn",
        batting_team=batting_team,
        bowling_team=bowling_team,
        runs=runs,
        wickets=wickets,
        overs=overs,
        batting=batting_list,
        bowling=bowling_list,
        fall_of_wickets=fow_list,
        extras=extras_str,
    )


async def fetch_scorecard(match_id: str) -> Scorecard:
    """Scrape the full scorecard for a match from Cricbuzz."""
    cb_id = match_id.replace("cb-", "")
    scorecard_url = f"{SCORECARD_BASE}/{cb_id}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(scorecard_url, headers=HEADERS, timeout=15.0)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    scorecard_data: dict | None = None
    for script in soup.find_all("script"):
        text = script.get_text()
        if "scoreCard" not in text:
            continue
        scorecard_data = _extract_scorecard_json(text)
        if scorecard_data:
            break

    if not scorecard_data:
        return Scorecard()

    innings_list: list[Innings] = []
    for idx, inn_data in enumerate(scorecard_data.get("scoreCard", [])):
        innings_list.append(_build_innings_from_json(inn_data, idx))

    header = scorecard_data.get("matchHeader", {})
    toss = ""
    toss_results = header.get("tossResults", {})
    if toss_results:
        toss = f"{toss_results.get('tossWinnerName', '')} won the toss and opt to {toss_results.get('decision', '')}"

    result = scorecard_data.get("status", "")

    return Scorecard(
        innings=innings_list,
        toss=toss,
        result=result,
    )
