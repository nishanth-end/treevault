"""Iterative preorder TVF-1 serializer for binary trees."""

from __future__ import annotations

from typing import List, Optional

from .tree import MAX_NODES, TreeNode, TreeValidationError, validate_label


def serialize_tree(root: Optional[TreeNode]) -> str:
    """Serialize a binary tree into the TVF-1 text archive format.

    Uses an explicit stack for iterative preorder traversal, emitting
    'N:<label>' for nodes and 'X' for null child positions.
    """
    tokens: List[str] = []
    node_count = 0
    stack: List[Optional[TreeNode]] = [root]

    while stack:
        curr = stack.pop()
        if curr is None:
            tokens.append("X")
        else:
            validate_label(curr.label)
            node_count += 1
            if node_count > MAX_NODES:
                raise TreeValidationError(
                    f"Tree exceeds maximum allowed {MAX_NODES} nodes."
                )
            tokens.append(f"N:{curr.label}")
            stack.append(curr.right)
            stack.append(curr.left)

    data_line = ",".join(tokens)
    return f"TVF-1\nCOUNT:{node_count}\nDATA:{data_line}"
