"""Core binary tree data structure, JSON conversion, iterative traversals, and generators."""

from __future__ import annotations

import random
import re
from typing import Any, Dict, List, Optional

MAX_NODES = 2000
LABEL_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,16}$")


class TreeValidationError(ValueError):
    """Raised when a tree JSON representation or label is invalid."""


class TreeNode:
    """Binary tree node with a string label and optional left/right children."""

    __slots__ = ("label", "left", "right")

    def __init__(
        self,
        label: str,
        left: Optional[TreeNode] = None,
        right: Optional[TreeNode] = None,
    ) -> None:
        self.label = label
        self.left = left
        self.right = right


def validate_label(label: Any) -> str:
    """Validate that a node label is a 1-16 char string matching [A-Za-z0-9_-]."""
    if not isinstance(label, str) or not LABEL_PATTERN.match(label):
        raise TreeValidationError(
            f"Invalid label {label!r}: must be 1-16 chars of letters, digits, '_' or '-'."
        )
    return label


def tree_from_json(data: Optional[Dict[str, Any]], max_nodes: int = MAX_NODES) -> Optional[TreeNode]:
    """Iteratively construct a TreeNode graph from a nested dict representation.

    Validates structure, label syntax, and maximum node count.
    """
    if data is None:
        return None
    if not isinstance(data, dict):
        raise TreeValidationError("Tree JSON node must be an object or null.")

    def _extract_node(obj: Dict[str, Any]) -> TreeNode:
        if "label" not in obj:
            raise TreeValidationError("Tree JSON node is missing required 'label' field.")
        label = validate_label(obj["label"])
        return TreeNode(label=label)

    root = _extract_node(data)
    node_count = 1
    if node_count > max_nodes:
        raise TreeValidationError(f"Tree exceeds maximum allowed {max_nodes} nodes.")

    # Stack items: (json_dict, target_node)
    stack: List[tuple[Dict[str, Any], TreeNode]] = [(data, root)]

    while stack:
        curr_dict, curr_node = stack.pop()

        for side in ("right", "left"):
            child_val = curr_dict.get(side, None)
            if child_val is None:
                continue
            if not isinstance(child_val, dict):
                raise TreeValidationError(
                    f"Child '{side}' of node '{curr_node.label}' must be an object or null."
                )
            node_count += 1
            if node_count > max_nodes:
                raise TreeValidationError(
                    f"Tree exceeds maximum allowed {max_nodes} nodes."
                )
            child_node = _extract_node(child_val)
            if side == "left":
                curr_node.left = child_node
            else:
                curr_node.right = child_node
            stack.append((child_val, child_node))

    return root


def tree_to_json(root: Optional[TreeNode]) -> Optional[Dict[str, Any]]:
    """Iteratively convert a TreeNode graph into a nested dict representation."""
    if root is None:
        return None

    root_dict: Dict[str, Any] = {"label": root.label, "left": None, "right": None}
    stack: List[tuple[TreeNode, Dict[str, Any]]] = [(root, root_dict)]

    while stack:
        curr_node, curr_dict = stack.pop()
        if curr_node.right is not None:
            right_dict: Dict[str, Any] = {
                "label": curr_node.right.label,
                "left": None,
                "right": None,
            }
            curr_dict["right"] = right_dict
            stack.append((curr_node.right, right_dict))
        if curr_node.left is not None:
            left_dict: Dict[str, Any] = {
                "label": curr_node.left.label,
                "left": None,
                "right": None,
            }
            curr_dict["left"] = left_dict
            stack.append((curr_node.left, left_dict))

    return root_dict


def preorder_traversal(root: Optional[TreeNode]) -> List[str]:
    """Return iterative preorder traversal labels (Root, Left, Right)."""
    if root is None:
        return []
    result: List[str] = []
    stack: List[TreeNode] = [root]
    while stack:
        node = stack.pop()
        result.append(node.label)
        if node.right is not None:
            stack.append(node.right)
        if node.left is not None:
            stack.append(node.left)
    return result


def inorder_traversal(root: Optional[TreeNode]) -> List[str]:
    """Return iterative inorder traversal labels (Left, Root, Right)."""
    result: List[str] = []
    stack: List[TreeNode] = []
    curr = root
    while curr is not None or stack:
        while curr is not None:
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()
        result.append(curr.label)
        curr = curr.right
    return result


def count_nodes(root: Optional[TreeNode]) -> int:
    """Return total number of nodes in the tree iteratively."""
    if root is None:
        return 0
    count = 0
    stack: List[TreeNode] = [root]
    while stack:
        node = stack.pop()
        count += 1
        if node.right is not None:
            stack.append(node.right)
        if node.left is not None:
            stack.append(node.left)
    return count


def build_example_tree() -> TreeNode:
    """Build the illustrative example tree:
           A
          / \\
         B   C
          \\
           D
    """
    return TreeNode(
        "A",
        left=TreeNode("B", right=TreeNode("D")),
        right=TreeNode("C"),
    )


def generate_random_tree(
    target_nodes: Optional[int] = None,
    seed: Optional[int] = None,
) -> Optional[TreeNode]:
    """Generate a random ordinary binary tree with 1 to 2000 nodes.

    Preserves arbitrary left/right placement (not a BST).
    """
    rng = random.Random(seed)
    if target_nodes is None:
        target_nodes = rng.randint(5, 15)
    if target_nodes <= 0:
        return None
    if target_nodes > MAX_NODES:
        raise TreeValidationError(f"target_nodes cannot exceed {MAX_NODES}.")

    def _make_label(idx: int) -> str:
        # Use readable A, B, ... for small trees, N1..Nk for larger ones
        if idx < 26:
            return chr(ord("A") + idx)
        return f"N{idx + 1}"

    root = TreeNode(_make_label(0))
    # Available child slots: (parent_node, side)
    slots: List[tuple[TreeNode, str]] = [(root, "left"), (root, "right")]

    for idx in range(1, target_nodes):
        slot_idx = rng.randrange(len(slots))
        parent, side = slots.pop(slot_idx)
        new_node = TreeNode(_make_label(idx))
        if side == "left":
            parent.left = new_node
        else:
            parent.right = new_node
        slots.append((new_node, "left"))
        slots.append((new_node, "right"))

    return root
