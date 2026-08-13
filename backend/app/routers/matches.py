from fastapi import APIRouter, HTTPException

from app.models import Match
from app.services.cricbuzz import (
    fetch_recent_matches,
    fetch_live_matches,
    fetch_upcoming_matches,
    fetch_scorecard,
)

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/live", response_model=list[Match])
async def get_live_matches() -> list[Match]:
    try:
        return await fetch_live_matches()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch live matches: {str(e)}",
        )


@router.get("/upcoming", response_model=list[Match])
async def get_upcoming_matches() -> list[Match]:
    try:
        return await fetch_upcoming_matches()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch upcoming matches: {str(e)}",
        )


@router.get("/recent", response_model=list[Match])
async def get_recent_matches() -> list[Match]:
    try:
        recent = await fetch_recent_matches()
        return recent
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch recent matches: {str(e)}",
        )


@router.get("/{match_id}", response_model=Match)
async def get_match_by_id(match_id: str) -> Match:
    try:
        live = await fetch_live_matches()

        for match in live:
            if match.id == match_id:
                try:
                    match.scorecard = await fetch_scorecard(match_id)
                except Exception:
                    pass

                return match

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch match: {str(e)}",
        )

    raise HTTPException(
        status_code=404,
        detail="Match not found",
    )


@router.get("/", response_model=list[Match])
async def get_all_matches() -> list[Match]:
    try:
        live = await fetch_live_matches()
        upcoming = await fetch_upcoming_matches()

        return live + upcoming

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch matches: {str(e)}",
        )
