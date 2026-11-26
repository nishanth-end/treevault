"""Stateless FastAPI backend for TREEVAULT binary tree archiving and recovery."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .deserializer import deserialize_tree
from .schemas import (
    ExportResponse,
    RandomTreeRequest,
    RestoreRequest,
    TestRunResponse,
    TraversalsResponse,
    TreePayload,
    TreeResponse,
    VerifyRequest,
    VerifyResponse,
)
from .serializer import serialize_tree
from .tests import run_all_tests
from .tree import (
    TreeValidationError,
    build_example_tree,
    count_nodes,
    generate_random_tree,
    inorder_traversal,
    preorder_traversal,
    tree_from_json,
    tree_to_json,
)
from .validator import ArchiveValidationError
from .verifier import create_verification_snapshot, verify_restored_tree

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(
    title="TREEVAULT",
    description="Stateless Binary Tree Archiving and Recovery System (TVF-1)",
    version="1.0.0",
)


@app.get("/api/tree/example", response_model=TreeResponse)
def get_example_tree() -> TreeResponse:
    root = build_example_tree()
    return TreeResponse(
        tree=tree_to_json(root),
        node_count=count_nodes(root),
        preorder=preorder_traversal(root),
        inorder=inorder_traversal(root),
    )


@app.post("/api/tree/random", response_model=TreeResponse)
def post_random_tree(req: RandomTreeRequest) -> TreeResponse:
    try:
        root = generate_random_tree(target_nodes=req.node_count, seed=req.seed)
    except TreeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TreeResponse(
        tree=tree_to_json(root),
        node_count=count_nodes(root),
        preorder=preorder_traversal(root),
        inorder=inorder_traversal(root),
    )


@app.post("/api/tree/traversals", response_model=TraversalsResponse)
def post_traversals(req: TreePayload) -> TraversalsResponse:
    try:
        root = tree_from_json(req.tree)
    except TreeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TraversalsResponse(
        node_count=count_nodes(root),
        preorder=preorder_traversal(root),
        inorder=inorder_traversal(root),
    )


@app.post("/api/archive/export", response_model=ExportResponse)
def post_archive_export(req: TreePayload) -> ExportResponse:
    try:
        root = tree_from_json(req.tree)
        archive = serialize_tree(root)
    except TreeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ExportResponse(
        archive=archive,
        node_count=count_nodes(root),
        preorder=preorder_traversal(root),
        inorder=inorder_traversal(root),
        snapshot=create_verification_snapshot(root),
    )


@app.post("/api/archive/restore", response_model=TreeResponse)
def post_archive_restore(req: RestoreRequest) -> TreeResponse:
    try:
        restored_root = deserialize_tree(req.archive)
    except ArchiveValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return TreeResponse(
        tree=tree_to_json(restored_root),
        node_count=count_nodes(restored_root),
        preorder=preorder_traversal(restored_root),
        inorder=inorder_traversal(restored_root),
    )


@app.post("/api/tree/verify", response_model=VerifyResponse)
def post_tree_verify(req: VerifyRequest) -> VerifyResponse:
    try:
        restored_root = tree_from_json(req.restored_tree)
        report = verify_restored_tree(req.original_snapshot, restored_root)
    except TreeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return VerifyResponse(**report)


@app.post("/api/tests/run", response_model=TestRunResponse)
def post_tests_run() -> TestRunResponse:
    report = run_all_tests()
    return TestRunResponse(**report)


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(str(FRONTEND_DIR / "index.html"))
