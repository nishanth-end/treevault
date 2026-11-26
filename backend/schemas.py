"""Pydantic request and response schemas for the TREEVAULT FastAPI backend."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TreePayload(BaseModel):
    tree: Optional[Dict[str, Any]] = None


class RandomTreeRequest(BaseModel):
    node_count: Optional[int] = Field(default=None, ge=1, le=2000)
    seed: Optional[int] = None


class TreeResponse(BaseModel):
    tree: Optional[Dict[str, Any]]
    node_count: int
    preorder: List[str]
    inorder: List[str]


class TraversalsResponse(BaseModel):
    node_count: int
    preorder: List[str]
    inorder: List[str]


class ExportResponse(BaseModel):
    archive: str
    node_count: int
    preorder: List[str]
    inorder: List[str]
    snapshot: Dict[str, Any]


class RestoreRequest(BaseModel):
    archive: str


class VerifyRequest(BaseModel):
    original_snapshot: Dict[str, Any]
    restored_tree: Optional[Dict[str, Any]] = None


class VerifyResponse(BaseModel):
    original_node_count: int
    restored_node_count: int
    original_preorder: List[str]
    restored_preorder: List[str]
    original_inorder: List[str]
    restored_inorder: List[str]
    structural_match: bool


class TestItem(BaseModel):
    name: str
    passed: bool
    details: str


class TestRunResponse(BaseModel):
    total: int
    passed: int
    failed: int
    results: List[TestItem]
