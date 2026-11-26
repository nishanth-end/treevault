# TREEVAULT — Technical Project Report

> **Project:** TREEVAULT — Binary Tree Archiving & Structural Recovery System  
> **Stack:** Python 3, FastAPI, Pydantic, HTML5, CSS3, Vanilla JavaScript, SVG  
> **Scope:** Ordinary binary trees up to 2,000 nodes, custom `TVF-1` lossless text archive format

---

## 1. Problem Statement & Motivation

In standard computer science problems, reconstructing a binary tree from a single traversal (such as Preorder alone or Inorder alone) is **ambiguous**: multiple distinct tree shapes can produce the exact same traversal string. Even combining Preorder + Inorder fails when a tree contains **duplicate node labels** (for example, two nodes both labeled `A`), and fails to distinguish a left-only child from a right-only child when only one traversal is stored.

**TREEVAULT** solves this by implementing a **lossless, human-readable, position-preserving archive format (`TVF-1`)** and a **stateless web application** that lets users:
1. Build or generate an ordinary binary tree (not a BST—left and right child positions are explicit and arbitrary).
2. Serialize it into `TVF-1` text while capturing a compact verification snapshot.
3. Completely clear the active tree from the frontend.
4. Reconstruct a brand-new `TreeNode` graph **solely from the `TVF-1` text**.
5. Structurally verify the restored tree against the original snapshot.

---

## 2. System Architecture

TREEVAULT is strictly divided into three decoupled layers:

1. **Core Algorithms (`treevault/backend/`)**: Pure Python data structures and iterative stack-based algorithms (`tree.py`, `serializer.py`, `validator.py`, `deserializer.py`, `verifier.py`, `tests.py`). They have **zero dependency** on FastAPI or HTTP.
2. **Stateless API Layer (`treevault/backend/main.py`, `schemas.py`)**: FastAPI routes that validate JSON payloads with Pydantic, convert JSON into `TreeNode` graphs when needed, invoke core algorithms, and return structured JSON or HTTP `400`/`422` errors. No database, no server-side session state, no authentication.
3. **Single-Page Frontend (`treevault/frontend/`)**: Plain HTML/CSS/Vanilla JS (`index.html`, `style.css`, `app.js`) that maintains the editable tree as JSON in browser memory, renders it in an overlap-free SVG canvas, and drives the Recovery Demo and Corruption Test Lab.

---

## 3. Data Structures & Formats

### 3.1 `TreeNode` & JSON Representation
- **Implementation**: `TreeNode` in [`tree.py`](backend/tree.py#L17-L30) uses `__slots__ = ("label", "left", "right")` for lightweight memory usage.
- **Label Rules**: 1–16 characters matching `^[A-Za-z0-9_-]{1,16}$` (no commas, spaces, or newlines).
- **JSON Schema**:
```json
{
  "label": "A",
  "left": {
    "label": "B",
    "left": null,
    "right": { "label": "D", "left": null, "right": null }
  },
  "right": { "label": "C", "left": null, "right": null }
}
```

### 3.2 Custom Archive Format: `TVF-1`
Every archive consists of exactly 3 lines:
```text
TVF-1
COUNT:<number>
DATA:<comma-separated tokens>
```
- `N:<label>` represents an actual node.
- `X` represents an explicit null (`None`) child position.
- **Empty tree**: `TVF-1\nCOUNT:0\nDATA:X`
- **Example tree (`A` with left `B -> right D` and right `C`)**:
  ```text
  TVF-1
  COUNT:4
  DATA:N:A,N:B,X,N:D,X,X,N:C,X,X
  ```

> **Key Property:** A binary tree with $N$ nodes always produces exactly $N$ node tokens (`N:...`) and $N + 1$ null markers (`X`), for a total of $2N + 1$ tokens.

---

## 4. Algorithms, Pseudocode & Code Locations

All tree algorithms are **iterative** (using explicit Python lists as stacks) rather than recursive, ensuring deep skewed trees up to **2,000 nodes** never hit Python's default recursion limit (~1,000 frames).

---

### Algorithm 1: Iterative JSON $\leftrightarrow$ `TreeNode` Conversion
- **Where in code:**
  - `tree_from_json`: [`treevault/backend/tree.py` (lines 42–89)](backend/tree.py#L42-L89)
  - `tree_to_json`: [`treevault/backend/tree.py` (lines 92–119)](backend/tree.py#L92-L119)
- **Complexity:** $O(N)$ time, $O(H)$ stack space (worst-case $O(N)$).

**Pseudocode (`tree_from_json`):**
```text
FUNCTION tree_from_json(data, max_nodes=2000):
    IF data IS NULL: RETURN NULL
    VALIDATE data is a dict and data.label matches LABEL_PATTERN
    root <- NEW TreeNode(data.label)
    count <- 1
    stack <- [(data, root)]

    WHILE stack IS NOT EMPTY:
        (curr_dict, curr_node) <- stack.POP()
        FOR side IN ["right", "left"]:
            child_val <- curr_dict[side]
            IF child_val IS NULL: CONTINUE
            VALIDATE child_val is a dict and child_val.label is valid
            count <- count + 1
            IF count > max_nodes: RAISE TreeValidationError
            child_node <- NEW TreeNode(child_val.label)
            ATTACH child_node TO curr_node[side]
            stack.PUSH((child_val, child_node))
    RETURN root
```

---

### Algorithm 2: Iterative Traversals (Preorder, Inorder, Node Count)
- **Where in code:**
  - `preorder_traversal`: [`treevault/backend/tree.py` (lines 122–135)](backend/tree.py#L122-L135)
  - `inorder_traversal`: [`treevault/backend/tree.py` (lines 138–150)](backend/tree.py#L138-L150)
  - `count_nodes`: [`treevault/backend/tree.py` (lines 153–166)](backend/tree.py#L153-L166)
- **Complexity:** $O(N)$ time, $O(H)$ space.

**Pseudocode (`preorder_traversal`):**
```text
FUNCTION preorder_traversal(root):
    IF root IS NULL: RETURN []
    result <- []
    stack <- [root]
    WHILE stack IS NOT EMPTY:
        node <- stack.POP()
        result.APPEND(node.label)
        IF node.right IS NOT NULL: stack.PUSH(node.right)
        IF node.left IS NOT NULL:  stack.PUSH(node.left)
    RETURN result
```

**Pseudocode (`inorder_traversal`):**
```text
FUNCTION inorder_traversal(root):
    result <- []
    stack <- []
    curr <- root
    WHILE curr IS NOT NULL OR stack IS NOT EMPTY:
        WHILE curr IS NOT NULL:
            stack.PUSH(curr)
            curr <- curr.left
        curr <- stack.POP()
        result.APPEND(curr.label)
        curr <- curr.right
    RETURN result
```

---

### Algorithm 3: Iterative `TVF-1` Serialization
- **Where in code:** `serialize_tree` in [`treevault/backend/serializer.py` (lines 10–36)](backend/serializer.py#L10-L36)
- **Idea:** Unlike standard preorder traversal (which skips `None`), we push `None` children onto the stack too! Whenever `None` is popped, we emit `X`. Pushing `right` before `left` ensures `left` is popped first.
- **Complexity:** $O(N)$ time, $O(H)$ stack space, $O(N)$ output tokens ($2N + 1$ tokens).

**Pseudocode:**
```text
FUNCTION serialize_tree(root):
    tokens <- []
    node_count <- 0
    stack <- [root]

    WHILE stack IS NOT EMPTY:
        curr <- stack.POP()
        IF curr IS NULL:
            tokens.APPEND("X")
        ELSE:
            VALIDATE curr.label
            node_count <- node_count + 1
            IF node_count > 2000: RAISE TreeValidationError
            tokens.APPEND("N:" + curr.label)
            stack.PUSH(curr.right)
            stack.PUSH(curr.left)

    RETURN "TVF-1\nCOUNT:" + node_count + "\nDATA:" + JOIN(tokens, ",")
```

---

### Algorithm 4: `TVF-1` Validation
- **Where in code:** `validate_archive_text` in [`treevault/backend/validator.py` (lines 23–89)](backend/validator.py#L23-L89)
- **What it checks before deserialization:**
  1. Non-empty string, exactly 3 lines after stripping trailing blank lines.
  2. Line 1 equals `"TVF-1"`.
  3. Line 2 starts with `"COUNT:"` followed by a non-negative integer $\le 2000$.
  4. Line 3 starts with `"DATA:"` with a non-empty comma-separated payload.
  5. Every token is either `"X"` or `"N:<label>"` where `<label>` matches `^[A-Za-z0-9_-]{1,16}$`.

---

### Algorithm 5: Iterative `TVF-1` Deserialization (Pending Child Slots)
- **Where in code:** `deserialize_tree` in [`treevault/backend/deserializer.py` (lines 11–70)](backend/deserializer.py#L11-L70)
- **Idea:** Maintain a stack of **pending child slots** `(parent_node, side)` where `side` is `"root"`, `"left"`, or `"right"`. Start with `[(None, "root")]`. For each token:
  - If `pending_slots` is empty $\rightarrow$ **trailing token error**.
  - Pop `(parent, side)`.
  - If token is `"X"` $\rightarrow$ leave slot as `None`.
  - If token is `"N:<label>"` $\rightarrow$ create `new_node`, attach to `parent[side]`, and push `(new_node, "right")` then `(new_node, "left")` so left is filled next.
  - After all tokens: if `pending_slots` is non-empty $\rightarrow$ **incomplete stream error**.
  - If `actual_count != declared_count` $\rightarrow$ **count mismatch error**.
- **Complexity:** $O(N)$ time, $O(H)$ stack space.

**Pseudocode:**
```text
FUNCTION deserialize_tree(archive_text):
    (declared_count, tokens) <- validate_archive_text(archive_text)
    root <- NULL
    actual_count <- 0
    pending_slots <- [(NULL, "root")]

    FOR EACH token IN tokens:
        IF pending_slots IS EMPTY:
            RAISE ArchiveValidationError("Trailing token")
        (parent, side) <- pending_slots.POP()

        IF token == "X":
            CONTINUE

        label <- token[2:]
        actual_count <- actual_count + 1
        IF actual_count > 2000:
            RAISE ArchiveValidationError("Exceeds max nodes")

        new_node <- NEW TreeNode(label)
        IF side == "root": root <- new_node
        ELSE IF side == "left":  parent.left <- new_node
        ELSE IF side == "right": parent.right <- new_node

        pending_slots.PUSH((new_node, "right"))
        pending_slots.PUSH((new_node, "left"))

    IF pending_slots IS NOT EMPTY:
        RAISE ArchiveValidationError("Incomplete archive stream")
    IF actual_count != declared_count:
        RAISE ArchiveValidationError("Node count mismatch")

    RETURN root
```

---

### Algorithm 6: Iterative Structural Verification
- **Where in code:**
  - `trees_structurally_equal`: [`treevault/backend/verifier.py` (lines 17–41)](backend/verifier.py#L17-L41)
  - `create_verification_snapshot`: [`treevault/backend/verifier.py` (lines 44–51)](backend/verifier.py#L44-L51)
  - `verify_restored_tree`: [`treevault/backend/verifier.py` (lines 54–77)](backend/verifier.py#L54-L77)
- **Idea:** Instead of trusting traversal strings alone, compare both trees node-by-node and child-by-child using an explicit stack of `(node_a, node_b)` pairs.
- **Complexity:** $O(N)$ time, $O(H)$ space.

**Pseudocode:**
```text
FUNCTION trees_structurally_equal(tree_a, tree_b):
    stack <- [(tree_a, tree_b)]
    WHILE stack IS NOT EMPTY:
        (a, b) <- stack.POP()
        IF a IS NULL AND b IS NULL: CONTINUE
        IF a IS NULL OR b IS NULL:  RETURN FALSE
        IF a.label != b.label:      RETURN FALSE
        stack.PUSH((a.right, b.right))
        stack.PUSH((a.left, b.left))
    RETURN TRUE
```

---

### Algorithm 7: Overlap-Free SVG Tree Layout
- **Where in code:** `renderTreeSVG` in [`treevault/frontend/app.js` (lines 116–240)](frontend/app.js#L116-L240)
- **Idea:** Every node gets a unique horizontal grid column `xIdx` equal to its **inorder traversal rank** (`0, 1, 2, ...`) and a vertical row `depth` equal to its distance from the root. Because every node in a binary tree has a distinct inorder rank, **no two nodes can ever share the same X coordinate**, guaranteeing zero horizontal overlap for any tree shape up to 2,000 nodes.

---

### Algorithm 8: Random Ordinary Binary Tree Generator
- **Where in code:** `generate_random_tree` in [`treevault/backend/tree.py` (lines 184–221)](backend/tree.py#L184-L221)
- **Idea:** Maintain a list of open child slots `[(parent, "left"), (parent, "right")]`. For each new node, pick a random open slot, attach the node there, and add its two new child slots. This creates arbitrary shapes without BST ordering rules.

---

## 5. API Endpoints (`main.py` & `schemas.py`)

| Method & Path | Handler (`main.py`) | Request Schema | Response / Error |
|---|---|---|---|
| `GET /` | `serve_index` (L138) | — | Serves `frontend/index.html` |
| `GET /api/tree/example` | `get_example_tree` (L48) | — | `TreeResponse` (`200`) |
| `POST /api/tree/random` | `post_random_tree` (L59) | `RandomTreeRequest` | `TreeResponse` (`200` / `400`) |
| `POST /api/tree/traversals` | `post_traversals` (L73) | `TreePayload` | `TraversalsResponse` (`200` / `400`) |
| `POST /api/archive/export` | `post_archive_export` (L86) | `TreePayload` | `ExportResponse` (`200` / `400`) |
| `POST /api/archive/restore` | `post_archive_restore` (L103) | `RestoreRequest` | `TreeResponse` (`200` / `422`) |
| `POST /api/tree/verify` | `post_tree_verify` (L118) | `VerifyRequest` | `VerifyResponse` (`200` / `400`) |
| `POST /api/tests/run` | `post_tests_run` (L128) | — | `TestRunResponse` (`200`) |

---

## 6. Automated Test Suite (`tests.py`)

All 11 test cases in [`treevault/backend/tests.py`](backend/tests.py#L28-L145) execute the real `serialize_tree`, `validate_archive_text`, `deserialize_tree`, and `trees_structurally_equal` functions:

1. **Empty tree** (`COUNT:0`, `DATA:X` $\rightarrow$ `None`)
2. **Single node** (`N:ROOT,X,X`)
3. **Left-only child** (verifies `right is None` at every level)
4. **Right-only child** (verifies `left is None` at every level)
5. **Illustrative tree** (exact match to `TVF-1\nCOUNT:4\nDATA:N:A,N:B,X,N:D,X,X,N:C,X,X`)
6. **Incomplete archive** (rejects missing `X` markers)
7. **Invalid token** (rejects `Z`)
8. **Invalid label** (rejects `BAD$LABEL`)
9. **Wrong node count** (rejects `COUNT:99` for 1-node tree)
10. **Trailing tokens** (rejects extra `X` after tree completes)
11. **Maximum-node tree** (2,000-node random tree round-trip without recursion overflow)
