"""Automated test suite for TREEVAULT serialization, validation, and verification."""

from __future__ import annotations

from typing import Callable, Dict, List, TypedDict

from .deserializer import deserialize_tree
from .serializer import serialize_tree
from .tree import (
    MAX_NODES,
    TreeNode,
    build_example_tree,
    count_nodes,
    generate_random_tree,
    inorder_traversal,
    preorder_traversal,
)
from .validator import ArchiveValidationError
from .verifier import trees_structurally_equal


class TestResult(TypedDict):
    name: str
    passed: bool
    details: str


def _test_empty_tree() -> str:
    archive = serialize_tree(None)
    assert archive == "TVF-1\nCOUNT:0\nDATA:X", f"Unexpected archive: {archive!r}"
    restored = deserialize_tree(archive)
    assert restored is None
    assert trees_structurally_equal(None, restored)
    return "Serialized to COUNT:0, DATA:X and restored to None."


def _test_single_node() -> str:
    root = TreeNode("ROOT")
    archive = serialize_tree(root)
    assert archive == "TVF-1\nCOUNT:1\nDATA:N:ROOT,X,X"
    restored = deserialize_tree(archive)
    assert restored is not root
    assert trees_structurally_equal(root, restored)
    return "Single node round-trip preserved label and null children."


def _test_left_only_child() -> str:
    root = TreeNode("A", left=TreeNode("B", left=TreeNode("C")))
    archive = serialize_tree(root)
    restored = deserialize_tree(archive)
    assert trees_structurally_equal(root, restored)
    assert restored is not None and restored.right is None
    assert restored.left is not None and restored.left.right is None
    return "Left-only chain preserved exact left child positions."


def _test_right_only_child() -> str:
    root = TreeNode("A", right=TreeNode("B", right=TreeNode("C")))
    archive = serialize_tree(root)
    restored = deserialize_tree(archive)
    assert trees_structurally_equal(root, restored)
    assert restored is not None and restored.left is None
    assert restored.right is not None and restored.right.left is None
    return "Right-only chain preserved exact right child positions."


def _test_illustrative_tree() -> str:
    root = build_example_tree()
    archive = serialize_tree(root)
    expected = "TVF-1\nCOUNT:4\nDATA:N:A,N:B,X,N:D,X,X,N:C,X,X"
    assert archive == expected, f"Expected {expected!r}, got {archive!r}"
    restored = deserialize_tree(archive)
    assert restored is not root
    assert trees_structurally_equal(root, restored)
    assert preorder_traversal(restored) == ["A", "B", "D", "C"]
    assert inorder_traversal(restored) == ["B", "D", "A", "C"]
    return "Illustrative tree matched exact TVF-1 spec and traversals."


def _test_incomplete_archive() -> str:
    bad = "TVF-1\nCOUNT:2\nDATA:N:A,N:B,X"
    try:
        deserialize_tree(bad)
    except ArchiveValidationError as exc:
        return f"Rejected incomplete stream: {exc}"
    raise AssertionError("Incomplete archive was not rejected.")


def _test_invalid_token() -> str:
    bad = "TVF-1\nCOUNT:1\nDATA:N:A,Z,X"
    try:
        deserialize_tree(bad)
    except ArchiveValidationError as exc:
        return f"Rejected invalid token: {exc}"
    raise AssertionError("Invalid token was not rejected.")


def _test_invalid_label() -> str:
    bad = "TVF-1\nCOUNT:1\nDATA:N:BAD$LABEL,X,X"
    try:
        deserialize_tree(bad)
    except ArchiveValidationError as exc:
        return f"Rejected invalid label: {exc}"
    raise AssertionError("Invalid label was not rejected.")


def _test_wrong_node_count() -> str:
    bad = "TVF-1\nCOUNT:99\nDATA:N:A,X,X"
    try:
        deserialize_tree(bad)
    except ArchiveValidationError as exc:
        return f"Rejected count mismatch: {exc}"
    raise AssertionError("Wrong node count was not rejected.")


def _test_trailing_tokens() -> str:
    bad = "TVF-1\nCOUNT:1\nDATA:N:A,X,X,X"
    try:
        deserialize_tree(bad)
    except ArchiveValidationError as exc:
        return f"Rejected trailing tokens: {exc}"
    raise AssertionError("Trailing tokens were not rejected.")


def _test_max_node_tree() -> str:
    root = generate_random_tree(target_nodes=MAX_NODES, seed=2026)
    archive = serialize_tree(root)
    restored = deserialize_tree(archive)
    assert count_nodes(restored) == MAX_NODES
    assert trees_structurally_equal(root, restored)
    return f"Round-tripped {MAX_NODES}-node tree iteratively without recursion overflow."


TEST_CASES: List[tuple[str, Callable[[], str]]] = [
    ("Empty tree", _test_empty_tree),
    ("Single node", _test_single_node),
    ("Left-only child", _test_left_only_child),
    ("Right-only child", _test_right_only_child),
    ("Illustrative tree", _test_illustrative_tree),
    ("Incomplete archive", _test_incomplete_archive),
    ("Invalid token", _test_invalid_token),
    ("Invalid label", _test_invalid_label),
    ("Wrong node count", _test_wrong_node_count),
    ("Trailing tokens", _test_trailing_tokens),
    ("Maximum-node tree", _test_max_node_tree),
]


def run_all_tests() -> Dict[str, object]:
    """Execute all built-in TREEVAULT tests and return a structured report."""
    results: List[TestResult] = []
    passed_count = 0

    for name, fn in TEST_CASES:
        try:
            details = fn()
            results.append({"name": name, "passed": True, "details": details})
            passed_count += 1
        except Exception as exc:  # noqa: BLE001
            results.append({"name": name, "passed": False, "details": str(exc)})

    return {
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "results": results,
    }


if __name__ == "__main__":
    report = run_all_tests()
    for item in report["results"]:  # type: ignore[index]
        status = "PASS" if item["passed"] else "FAIL"
        print(f"[{status}] {item['name']}: {item['details']}")
    print(f"\nSummary: {report['passed']}/{report['total']} passed")
    if report["failed"]:
        raise SystemExit(1)
