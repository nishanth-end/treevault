# TREEVAULT — Binary Tree Archiving & Recovery System

TREEVAULT is a local, stateless web application for **lossless serialization, validation, and structural recovery** of ordinary binary trees using the custom `TVF-1` archive format.

## Documentation for Teammates
- **[PROJECT_REPORT.md](PROJECT_REPORT.md)**: Full technical report with problem statement, architecture, pseudocode, complexity analysis, and exact file/line references.
- **[STUDY_GUIDE.md](STUDY_GUIDE.md)**: Viva / hackathon judge Q&A, 60-second pitch, teammate role split, and live demo script.

---

## Key Features

- **Ordinary Binary Tree Builder**: Create a root, explicitly add left or right children, select nodes in SVG, delete subtrees, clear the tree, load the illustrative example, or generate random trees (1–2,000 nodes).
- **Custom `TVF-1` Format**: Iterative preorder serialization (`N:<label>` for nodes, `X` for null children) that preserves exact left/right child positions without recursion limits.
- **Strict Validation**: Rejects malformed headers, invalid `COUNT`/`DATA` fields, illegal labels, incomplete streams, trailing tokens, count mismatches, and trees exceeding 2,000 nodes with HTTP `422` / `400` errors.
- **8-Step Recovery & Structural Verification**: Captures a compact verification snapshot on export, clears the active tree, reconstructs a new `TreeNode` graph solely from the `TVF-1` text, and verifies structural equality node-for-node.
- **Overlap-Free SVG Visualization & Test Lab**: Inorder-rank SVG layout, 11-case automated test runner, and interactive archive corruption controls.

---

## Project Structure

```text
treevault/
├── backend/
│   ├── main.py          # Stateless FastAPI app & static file serving
│   ├── schemas.py       # Pydantic request/response models
│   ├── tree.py          # TreeNode, JSON conversion, iterative traversals, generators
│   ├── serializer.py    # Iterative TVF-1 serializer (explicit stack)
│   ├── validator.py     # TVF-1 header, count, data, and token/label validator
│   ├── deserializer.py  # Iterative TVF-1 deserializer (pending child slots stack)
│   ├── verifier.py      # Iterative structural equality & snapshot verification
│   └── tests.py         # 11 automated unit & integration tests
├── frontend/
│   ├── index.html       # Single-page UI (Tree Builder, Archive, Verification, Test Lab)
│   ├── style.css        # Clean, restrained engineering-tool styling
│   └── app.js           # Client state, API calls, SVG layout, corruption controls
├── requirements.txt
├── README.md
├── PROJECT_REPORT.md
└── STUDY_GUIDE.md
```

---

## Setup & Run Instructions

```bash
cd treevault
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Open **http://127.0.0.1:8000** in your browser.

### Run Backend Tests Directly

```bash
cd treevault
python3 -m backend.tests
```

Expected output: `11/11 passed`.
