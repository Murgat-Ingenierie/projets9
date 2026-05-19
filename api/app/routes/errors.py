from fastapi import HTTPException, status

from app.invariants import InvariantError


def http_from_invariant(e: InvariantError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": e.code, "message": e.detail},
    )
