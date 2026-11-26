# TREEVAULT — Teammate Study Guide & Judge Defense Prep

Use this guide to prepare for demos, viva questions, and code walkthroughs with judges or professors.

---

## 1. 60-Second Elevator Pitch

> "Standard binary tree traversals like Preorder alone can't reconstruct a tree unambiguously, and Preorder + Inorder fails if labels repeat. **TREEVAULT** solves this with **TVF-1**, a lossless text archive format that records explicit `X` null markers in iterative preorder. Our stateless FastAPI backend serializes, validates, and reconstructs up to 2,000-node trees without recursion—so even deep skewed trees never overflow the call stack. In the UI, you can export a tree, wipe it from memory, restore a brand-new tree purely from the `TVF-1` text, and run an iterative node-by-node structural verification against the original snapshot."

---

## 2. Suggested Team Role Split (For Presentations)

| Teammate | Owns & Explains | Key Files to Open |
|---|---|---|
| **Person 1: Tree Core & Traversals** | `TreeNode`, JSON $\leftrightarrow$ `TreeNode`, iterative Preorder/Inorder/Count, Random Generator | [`backend/tree.py`](backend/tree.py) |
| **Person 2: TVF-1 Codec & Validation** | `TVF-1` spec, explicit-stack Serializer, Validator, pending-slot Deserializer | [`backend/serializer.py`](backend/serializer.py), [`backend/validator.py`](backend/validator.py), [`backend/deserializer.py`](backend/deserializer.py) |
| **Person 3: Verifier, API & Tests** | Iterative structural comparison, stateless FastAPI routes, Pydantic schemas, 11-test suite | [`backend/verifier.py`](backend/verifier.py), [`backend/main.py`](backend/main.py), [`backend/tests.py`](backend/tests.py) |
| **Person 4: Frontend & SVG Layout** | Overlap-free inorder-rank SVG layout, 8-step recovery demo, corruption controls | [`frontend/app.js`](frontend/app.js), [`frontend/index.html`](frontend/index.html) |

---

## 3. Step-by-Step Dry Run (Keep This Handy!)

Suppose a judge asks: *"Trace how your illustrative example tree becomes `TVF-1` and comes back."*

Tree: `A` (left: `B` $\rightarrow$ right: `D`, right: `C`)

1. **Serialization** ([`serializer.py` L10-L36](backend/serializer.py#L10-L36)):
   - Stack starts `[A]`
   - Pop `A` $\rightarrow$ emit `N:A`, push `C`, push `B`
   - Pop `B` $\rightarrow$ emit `N:B`, push `D`, push `None`
   - Pop `None` $\rightarrow$ emit `X`
   - Pop `D` $\rightarrow$ emit `N:D`, push `None`, push `None`
   - Pop `None`, `None` $\rightarrow$ emit `X, X`
   - Pop `C` $\rightarrow$ emit `N:C`, push `None`, push `None`
   - Pop `None`, `None` $\rightarrow$ emit `X, X`
   - Output: `TVF-1\nCOUNT:4\nDATA:N:A,N:B,X,N:D,X,X,N:C,X,X`

2. **Deserialization** ([`deserializer.py` L11-L70](backend/deserializer.py#L11-L70)):
   - `pending_slots` starts `[(None, "root")]`
   - `N:A` $\rightarrow$ root = `A`; push `(A, right)`, `(A, left)`
   - `N:B` $\rightarrow$ `A.left = B`; push `(B, right)`, `(B, left)`
   - `X` $\rightarrow$ pops `(B, left)` $\rightarrow$ stays `None`!
   - `N:D` $\rightarrow$ pops `(B, right)` $\rightarrow$ `B.right = D`; push `(D, right)`, `(D, left)`
   - `X, X` $\rightarrow$ `D.left = None`, `D.right = None`
   - `N:C` $\rightarrow$ pops `(A, right)` $\rightarrow$ `A.right = C`; push `(C, right)`, `(C, left)`
   - `X, X` $\rightarrow$ `C.left = None`, `C.right = None`
   - Stack is now empty and `actual_count (4) == declared_count (4)` $\rightarrow$ **Valid!**

---

## 4. Top 10 Questions Judges Might Ask (With Answers)

1. **Why not just save Preorder + Inorder instead of `TVF-1`?**  
   *Answer:* Preorder + Inorder fails when two nodes have the **same label** (e.g., two `A`s), and requires $O(N \log N)$ or $O(N^2)$ to find split points. `TVF-1` with explicit `X` markers works with duplicate labels and reconstructs in $O(N)$ time.

2. **Why did you use iterative stacks instead of recursion everywhere?**  
   *Answer:* Python's default recursion limit is ~1,000 frames. A skewed 2,000-node tree would crash with `RecursionError`. Explicit stacks in `tree.py`, `serializer.py`, `deserializer.py`, and `verifier.py` handle 2,000+ nodes safely.

3. **Is this a Binary Search Tree (BST)?**  
   *Answer:* No, it's an **ordinary binary tree**. Users explicitly choose "Add Left Child" or "Add Right Child" regardless of label value, and `generate_random_tree` picks random open child slots.

4. **How do you prove recovery isn't faked?**  
   *Answer:* Look at `POST /api/archive/restore` in [`main.py` L102-L114](backend/main.py#L102-L114) and `RestoreRequest` in [`schemas.py` L40-L41](backend/schemas.py#L40-L41): the restore endpoint **only** accepts `{"archive": "..."}`. It never receives the tree JSON or the verification snapshot.

5. **Why not verify by comparing preorder strings?**  
   *Answer:* Two different trees could theoretically collide on a single traversal string. In [`verifier.py` L17-L41](backend/verifier.py#L17-L41), `trees_structurally_equal` walks both trees simultaneously with an explicit stack of `(node_a, node_b)` pairs, checking labels and both child positions.

6. **What happens if someone corrupts the archive text?**  
   *Answer:* `validate_archive_text` ([`validator.py`](backend/validator.py)) and `deserialize_tree` ([`deserializer.py`](backend/deserializer.py)) catch bad headers, non-numeric or mismatched `COUNT`, bad characters in labels, missing `X` markers (incomplete stream), and extra tokens (trailing tokens), returning HTTP `422` with the exact reason.

7. **How does the SVG avoid overlapping nodes on weird or large trees?**  
   *Answer:* In [`app.js` L116-L240](frontend/app.js#L116-L240), `renderTreeSVG()` assigns each node's X coordinate from its **inorder traversal index** (`0, 1, 2, ...`) and Y coordinate from its **depth**. Since every node has a unique inorder index, no two nodes can overlap horizontally.

8. **Why is the backend stateless?**  
   *Answer:* No database or server-side memory is needed. Every request carries the tree JSON or `TVF-1` text, making the API simple, reproducible, and easy to test.

9. **What is the time and space complexity of serialization and deserialization?**  
   *Answer:* Both are **$O(N)$ time** (visiting each of the $N$ nodes and $N+1$ null slots once) and **$O(H)$ auxiliary stack space** ($O(N)$ worst-case for a skewed tree, $O(\log N)$ for a balanced tree).

10. **How do you test the 2,000-node limit?**  
    *Answer:* Test #11 (`_test_max_node_tree` in [`tests.py` L125-L131](backend/tests.py#L125-L131)) generates a 2,000-node tree, serializes it, deserializes it, checks `count_nodes == 2000`, and verifies `trees_structurally_equal(root, restored)`.

---

## 5. Live Demo Checklist (2 Minutes)

1. Click **Load Example** $\rightarrow$ show `A, B, D, C` in SVG (point out `D` is the **right** child of `B`).
2. Click **Run Full Recovery Demo** $\rightarrow$ point out how it exports `TVF-1`, captures snapshot (`4 nodes`), clears the canvas, restores solely from `TVF-1`, and shows **`STRUCTURAL MATCH`**.
3. Click **Alter Count** (or **Remove Token** / **Inject Invalid Token**) $\rightarrow$ click **Restore from Archive** $\rightarrow$ show the HTTP `422` error box (`REJECTED`).
4. Click **Run All Tests** in the Test Lab $\rightarrow$ show **`11/11 passed`**.
