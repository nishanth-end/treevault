"""Iterative TVF-1 deserializer using an explicit pending child slot stack."""

from __future__ import annotations

from typing import List, Optional, Tuple

from .tree import MAX_NODES, TreeNode
from .validator import ArchiveValidationError, validate_archive_text


def deserialize_tree(archive_text: str) -> Optional[TreeNode]:
    """Reconstruct a new TreeNode graph from a validated TVF-1 archive string.

    Uses an explicit stack of pending child slots: (parent_node_or_none, side).
    Rejects incomplete streams, trailing tokens, count mismatches, and >2000 nodes.
    """
    parsed = validate_archive_text(archive_text)
    tokens = parsed.tokens
    declared_count = parsed.declared_count

    root: Optional[TreeNode] = None
    actual_count = 0

    # Stack of pending slots: (parent_node, 'left' | 'right' | 'root')
    # 'root' is a sentinel for the very first slot.
    pending_slots: List[Tuple[Optional[TreeNode], str]] = [(None, "root")]

    for idx, token in enumerate(tokens):
        if not pending_slots:
            raise ArchiveValidationError(
                f"Trailing token {token!r} at index {idx}: tree is already complete."
            )

        parent, side = pending_slots.pop()

        if token == "X":
            # Null child; nothing to attach or push.
            continue

        # Token is guaranteed to be 'N:<label>' by validate_archive_text.
        label = token[2:]
        actual_count += 1
        if actual_count > MAX_NODES:
            raise ArchiveValidationError(
                f"Decoded node count exceeds maximum of {MAX_NODES}."
            )

        new_node = TreeNode(label=label)
        if side == "root":
            root = new_node
        elif side == "left" and parent is not None:
            parent.left = new_node
        elif side == "right" and parent is not None:
            parent.right = new_node

        # Push right slot first so left slot is popped next (preorder).
        pending_slots.append((new_node, "right"))
        pending_slots.append((new_node, "left"))

    if pending_slots:
        raise ArchiveValidationError(
            f"Incomplete archive stream: {len(pending_slots)} unresolved child slot(s) remaining."
        )

    if actual_count != declared_count:
        raise ArchiveValidationError(
            f"Node count mismatch: declared COUNT:{declared_count}, but decoded {actual_count} node(s)."
        )

    return root
