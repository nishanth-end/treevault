"""Iterative structural verification and snapshot comparison for binary trees."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .tree import (
    TreeNode,
    count_nodes,
    inorder_traversal,
    preorder_traversal,
    tree_from_json,
    tree_to_json,
)


def trees_structurally_equal(
    tree_a: Optional[TreeNode], tree_b: Optional[TreeNode]
) -> bool:
    """Iteratively compare two binary trees for exact structural and label equality.

    Uses an explicit stack of node pairs (recursive-equivalent):
    - Both None -> equal at this position.
    - One None, one not None -> not equal.
    - Both exist -> labels must match, and both left and right subtrees must match.
    """
    stack: List[Tuple[Optional[TreeNode], Optional[TreeNode]]] = [(tree_a, tree_b)]

    while stack:
        node_a, node_b = stack.pop()
        if node_a is None and node_b is None:
            continue
        if node_a is None or node_b is None:
            return False
        if node_a.label != node_b.label:
            return False

        stack.append((node_a.right, node_b.right))
        stack.append((node_a.left, node_b.left))

    return True


def create_verification_snapshot(root: Optional[TreeNode]) -> Dict[str, Any]:
    """Capture a compact verification snapshot of the original tree before clearing."""
    return {
        "node_count": count_nodes(root),
        "preorder": preorder_traversal(root),
        "inorder": inorder_traversal(root),
        "tree": tree_to_json(root),
    }


def verify_restored_tree(
    original_snapshot: Dict[str, Any], restored_root: Optional[TreeNode]
) -> Dict[str, Any]:
    """Verify a restored tree against a previously captured original snapshot."""
    original_root = tree_from_json(original_snapshot.get("tree"))

    original_count = count_nodes(original_root)
    restored_count = count_nodes(restored_root)
    original_preorder = preorder_traversal(original_root)
    restored_preorder = preorder_traversal(restored_root)
    original_inorder = inorder_traversal(original_root)
    restored_inorder = inorder_traversal(restored_root)

    structural_match = trees_structurally_equal(original_root, restored_root)

    return {
        "original_node_count": original_count,
        "restored_node_count": restored_count,
        "original_preorder": original_preorder,
        "restored_preorder": restored_preorder,
        "original_inorder": original_inorder,
        "restored_inorder": restored_inorder,
        "structural_match": structural_match,
    }
