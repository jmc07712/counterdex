"""The values a sync's records can take."""

from enum import StrEnum


class SyncStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ChangeKind(StrEnum):
    UPDATED = "updated"
    REMOVED = "removed"
    RESTORED = "restored"
