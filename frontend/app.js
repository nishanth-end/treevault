(() => {
  "use strict";

  const LABEL_RE = /^[A-Za-z0-9_-]{1,16}$/;

  const state = {
    tree: null, // { label: string, left: node|null, right: node|null } | null
    selectedPath: null, // string like "" (root), "L", "LR", etc. or null
    snapshot: null, // compact original verification snapshot captured on Export
  };

  // DOM elements
  const statusBanner = document.getElementById("status-banner");
  const treeMeta = document.getElementById("tree-meta");
  const selectedNodeInfo = document.getElementById("selected-node-info");
  const nodeLabelInput = document.getElementById("node-label-input");
  const randomCountInput = document.getElementById("random-count");

  const svgEl = document.getElementById("tree-svg");
  const svgEdges = document.getElementById("svg-edges");
  const svgNodes = document.getElementById("svg-nodes");
  const emptyCanvasMsg = document.getElementById("empty-canvas-msg");

  const archiveTextarea = document.getElementById("archive-textarea");
  const archiveError = document.getElementById("archive-error");
  const snapshotBadge = document.getElementById("snapshot-badge");

  const matchBadge = document.getElementById("match-badge");
  const recoveryStatus = document.getElementById("recovery-status");
  const activeCountEl = document.getElementById("active-count");
  const snapshotCountEl = document.getElementById("snapshot-count");
  const activePreorderEl = document.getElementById("active-preorder");
  const activeInorderEl = document.getElementById("active-inorder");
  const snapshotPreorderRow = document.getElementById("snapshot-preorder-row");
  const snapshotInorderRow = document.getElementById("snapshot-inorder-row");
  const snapshotPreorderEl = document.getElementById("snapshot-preorder");
  const snapshotInorderEl = document.getElementById("snapshot-inorder");

  const testSummary = document.getElementById("test-summary");
  const testResultsGrid = document.getElementById("test-results-grid");

  // Buttons
  const btnLoadExample = document.getElementById("btn-load-example");
  const btnRandomTree = document.getElementById("btn-random-tree");
  const btnClearTree = document.getElementById("btn-clear-tree");
  const btnAddRoot = document.getElementById("btn-add-root");
  const btnAddLeft = document.getElementById("btn-add-left");
  const btnAddRight = document.getElementById("btn-add-right");
  const btnDeleteSubtree = document.getElementById("btn-delete-subtree");

  const btnExport = document.getElementById("btn-export");
  const btnCopy = document.getElementById("btn-copy");
  const fileImport = document.getElementById("file-import");
  const btnRestore = document.getElementById("btn-restore");
  const btnRunDemo = document.getElementById("btn-run-demo");

  const btnCorruptRemove = document.getElementById("btn-corrupt-remove");
  const btnCorruptCount = document.getElementById("btn-corrupt-count");
  const btnCorruptToken = document.getElementById("btn-corrupt-token");
  const btnRunTests = document.getElementById("btn-run-tests");

  function setStatus(msg) {
    statusBanner.textContent = msg;
  }

  function showArchiveError(msg) {
    if (!msg) {
      archiveError.hidden = true;
      archiveError.textContent = "";
      return;
    }
    archiveError.hidden = false;
    archiveError.textContent = msg;
  }

  async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail || `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return data;
  }

  function getNodeAtPath(root, path) {
    if (!root || path === null) return null;
    let curr = root;
    for (const ch of path) {
      if (!curr) return null;
      curr = ch === "L" ? curr.left : curr.right;
    }
    return curr;
  }

  function validateInputLabel() {
    const raw = nodeLabelInput.value.trim();
    if (!LABEL_RE.test(raw)) {
      setStatus("Invalid label: use 1-16 chars of letters, digits, '_' or '-'.");
      nodeLabelInput.focus();
      return null;
    }
    return raw;
  }

  function formatListPreview(arr) {
    if (!arr || arr.length === 0) return "[]";
    if (arr.length <= 40) return `[${arr.join(", ")}]`;
    return `[${arr.slice(0, 30).join(", ")}, ... (${arr.length} total)]`;
  }

  // Iterative inorder layout to avoid overlap on arbitrary binary trees
  function renderTreeSVG() {
    svgEdges.innerHTML = "";
    svgNodes.innerHTML = "";

    if (!state.tree) {
      emptyCanvasMsg.style.display = "flex";
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      updateSelectionUI();
      return;
    }
    emptyCanvasMsg.style.display = "none";

    // Assign inorder X index and depth Y iteratively
    const positions = new Map(); // path -> { node, xIdx, depth, parentPath, side }
    const stack = [];
    let curr = { node: state.tree, path: "", depth: 0, parentPath: null, side: null };
    let xCounter = 0;
    let maxDepth = 0;

    while (curr !== null || stack.length > 0) {
      while (curr !== null) {
        stack.push(curr);
        curr = curr.node.left
          ? {
              node: curr.node.left,
              path: curr.path + "L",
              depth: curr.depth + 1,
              parentPath: curr.path,
              side: "L",
            }
          : null;
      }
      const item = stack.pop();
      positions.set(item.path, {
        node: item.node,
        xIdx: xCounter++,
        depth: item.depth,
        parentPath: item.parentPath,
        side: item.side,
      });
      if (item.depth > maxDepth) maxDepth = item.depth;

      curr = item.node.right
        ? {
            node: item.node.right,
            path: item.path + "R",
            depth: item.depth + 1,
            parentPath: item.path,
            side: "R",
          }
        : null;
    }

    const hStep = xCounter > 40 ? 44 : 56;
    const vStep = 72;
    const padX = 48;
    const padY = 44;
    const radius = xCounter > 80 ? 15 : 19;

    const width = Math.max(600, xCounter * hStep + padX * 2);
    const height = Math.max(420, (maxDepth + 1) * vStep + padY * 2);
    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));

    const coords = new Map();
    for (const [path, info] of positions.entries()) {
      coords.set(path, {
        x: padX + info.xIdx * hStep,
        y: padY + info.depth * vStep,
        info,
      });
    }

    // Draw edges first
    for (const [path, { x, y, info }] of coords.entries()) {
      if (info.parentPath !== null) {
        const p = coords.get(info.parentPath);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(p.x));
        line.setAttribute("y1", String(p.y));
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(y));
        line.setAttribute("class", "tree-edge");
        svgEdges.appendChild(line);
      }
    }

    // Draw nodes
    for (const [path, { x, y, info }] of coords.entries()) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const isSelected = state.selectedPath === path;
      g.setAttribute("class", isSelected ? "tree-node-group selected" : "tree-node-group");
      g.dataset.path = path;

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", String(radius));
      circle.setAttribute("class", "tree-node-circle");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y));
      text.setAttribute("class", "tree-node-label");
      const label = info.node.label;
      text.textContent = label.length > 5 ? label.slice(0, 4) + "…" : label;

      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${label} (path: ${path || "ROOT"})`;

      g.appendChild(circle);
      g.appendChild(text);
      g.appendChild(title);

      g.addEventListener("click", () => {
        state.selectedPath = path;
        renderTreeSVG();
      });

      svgNodes.appendChild(g);
    }

    updateSelectionUI();
  }

  function updateSelectionUI() {
    const selectedNode = getNodeAtPath(state.tree, state.selectedPath);
    if (!selectedNode) {
      state.selectedPath = null;
      selectedNodeInfo.textContent = "None (click a node in the SVG)";
    } else {
      const pathLabel = state.selectedPath === "" ? "ROOT" : state.selectedPath;
      selectedNodeInfo.textContent = `${selectedNode.label} [${pathLabel}]`;
    }

    btnAddRoot.disabled = state.tree !== null;
    btnAddLeft.disabled = !selectedNode || selectedNode.left !== null;
    btnAddRight.disabled = !selectedNode || selectedNode.right !== null;
    btnDeleteSubtree.disabled = !selectedNode;
  }

  async function refreshTraversals() {
    try {
      const data = await apiRequest("/api/tree/traversals", {
        method: "POST",
        body: JSON.stringify({ tree: state.tree }),
      });
      treeMeta.textContent = `${data.node_count} node${data.node_count === 1 ? "" : "s"}`;
      activeCountEl.textContent = String(data.node_count);
      activePreorderEl.textContent = formatListPreview(data.preorder);
      activeInorderEl.textContent = formatListPreview(data.inorder);
    } catch (err) {
      setStatus(`Traversal error: ${err.message}`);
    }
  }

  function updateSnapshotUI() {
    if (!state.snapshot) {
      snapshotBadge.textContent = "Snapshot: None";
      snapshotCountEl.textContent = "—";
      snapshotPreorderRow.hidden = true;
      snapshotInorderRow.hidden = true;
      return;
    }
    snapshotBadge.textContent = `Snapshot: ${state.snapshot.node_count} nodes`;
    snapshotCountEl.textContent = String(state.snapshot.node_count);
    snapshotPreorderRow.hidden = false;
    snapshotInorderRow.hidden = false;
    snapshotPreorderEl.textContent = formatListPreview(state.snapshot.preorder);
    snapshotInorderEl.textContent = formatListPreview(state.snapshot.inorder);
  }

  function resetVerificationBadge() {
    matchBadge.textContent = "Pending";
    matchBadge.className = "meta-pill";
  }

  async function verifyAgainstSnapshotIfPresent() {
    if (!state.snapshot) {
      resetVerificationBadge();
      recoveryStatus.textContent = "Restored tree from archive. (No original snapshot captured to verify against.)";
      return null;
    }
    const report = await apiRequest("/api/tree/verify", {
      method: "POST",
      body: JSON.stringify({
        original_snapshot: state.snapshot,
        restored_tree: state.tree,
      }),
    });
    if (report.structural_match) {
      matchBadge.textContent = "STRUCTURAL MATCH";
      matchBadge.className = "meta-pill pass";
      recoveryStatus.textContent =
        `Verified: Restored tree (${report.restored_node_count} nodes) structurally matches the original snapshot (${report.original_node_count} nodes).`;
    } else {
      matchBadge.textContent = "MISMATCH";
      matchBadge.className = "meta-pill fail";
      recoveryStatus.textContent =
        `Mismatch: Restored (${report.restored_node_count} nodes) does not match original snapshot (${report.original_node_count} nodes).`;
    }
    return report;
  }

  // Tree Builder handlers
  btnLoadExample.addEventListener("click", async () => {
    try {
      const data = await apiRequest("/api/tree/example");
      state.tree = data.tree;
      state.selectedPath = "";
      renderTreeSVG();
      await refreshTraversals();
      setStatus("Loaded illustrative example tree (A, B, D, C).");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  });

  btnRandomTree.addEventListener("click", async () => {
    const rawCount = randomCountInput.value.trim();
    const payload = rawCount ? { node_count: Number(rawCount) } : {};
    try {
      const data = await apiRequest("/api/tree/random", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.tree = data.tree;
      state.selectedPath = data.tree ? "" : null;
      renderTreeSVG();
      await refreshTraversals();
      setStatus(`Generated random binary tree with ${data.node_count} nodes.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  });

  btnClearTree.addEventListener("click", async () => {
    state.tree = null;
    state.selectedPath = null;
    renderTreeSVG();
    await refreshTraversals();
    setStatus("Cleared active tree from canvas.");
  });

  btnAddRoot.addEventListener("click", async () => {
    if (state.tree !== null) return;
    const label = validateInputLabel();
    if (!label) return;
    state.tree = { label, left: null, right: null };
    state.selectedPath = "";
    nodeLabelInput.value = "";
    renderTreeSVG();
    await refreshTraversals();
    setStatus(`Added root node '${label}'.`);
  });

  async function addChild(side) {
    const parent = getNodeAtPath(state.tree, state.selectedPath);
    if (!parent) return;
    const prop = side === "L" ? "left" : "right";
    if (parent[prop] !== null) {
      setStatus(`Selected node already has a ${prop} child.`);
      return;
    }
    const label = validateInputLabel();
    if (!label) return;
    parent[prop] = { label, left: null, right: null };
    state.selectedPath = state.selectedPath + side;
    nodeLabelInput.value = "";
    renderTreeSVG();
    await refreshTraversals();
    setStatus(`Added ${prop} child '${label}'.`);
  }

  btnAddLeft.addEventListener("click", () => addChild("L"));
  btnAddRight.addEventListener("click", () => addChild("R"));

  btnDeleteSubtree.addEventListener("click", async () => {
    if (state.selectedPath === null) return;
    if (state.selectedPath === "") {
      state.tree = null;
      state.selectedPath = null;
    } else {
      const parentPath = state.selectedPath.slice(0, -1);
      const side = state.selectedPath.slice(-1);
      const parent = getNodeAtPath(state.tree, parentPath);
      if (parent) {
        if (side === "L") parent.left = null;
        else parent.right = null;
      }
      state.selectedPath = parentPath;
    }
    renderTreeSVG();
    await refreshTraversals();
    setStatus("Deleted selected subtree.");
  });

  // Archive & Recovery handlers
  async function exportCurrentTree() {
    showArchiveError("");
    const data = await apiRequest("/api/archive/export", {
      method: "POST",
      body: JSON.stringify({ tree: state.tree }),
    });
    archiveTextarea.value = data.archive;
    state.snapshot = data.snapshot;
    updateSnapshotUI();
    resetVerificationBadge();
    recoveryStatus.textContent = "Snapshot captured. You can now clear the active tree and restore from the TVF-1 archive.";
    setStatus(`Exported TVF-1 archive (${data.node_count} nodes) and captured snapshot.`);
    return data;
  }

  btnExport.addEventListener("click", async () => {
    try {
      await exportCurrentTree();
    } catch (err) {
      showArchiveError(err.message);
      setStatus(`Export failed: ${err.message}`);
    }
  });

  btnCopy.addEventListener("click", async () => {
    const text = archiveTextarea.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied TVF-1 archive to clipboard.");
    } catch {
      archiveTextarea.select();
      setStatus("Selected archive text (clipboard permission unavailable).");
    }
  });

  fileImport.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      archiveTextarea.value = String(reader.result || "");
      showArchiveError("");
      setStatus(`Loaded archive from '${file.name}'. Click Restore from Archive.`);
    };
    reader.readAsText(file);
    fileImport.value = "";
  });

  async function restoreFromArchive() {
    showArchiveError("");
    const archiveText = archiveTextarea.value;
    const data = await apiRequest("/api/archive/restore", {
      method: "POST",
      body: JSON.stringify({ archive: archiveText }),
    });
    state.tree = data.tree;
    state.selectedPath = data.tree ? "" : null;
    renderTreeSVG();
    await refreshTraversals();
    await verifyAgainstSnapshotIfPresent();
    setStatus(`Restored tree from TVF-1 archive (${data.node_count} nodes).`);
    return data;
  }

  btnRestore.addEventListener("click", async () => {
    try {
      await restoreFromArchive();
    } catch (err) {
      showArchiveError(err.message);
      matchBadge.textContent = "REJECTED";
      matchBadge.className = "meta-pill fail";
      recoveryStatus.textContent = `Recovery rejected: ${err.message}`;
      setStatus(`Restore failed: ${err.message}`);
    }
  });

  // Full 8-step recovery demonstration
  btnRunDemo.addEventListener("click", async () => {
    try {
      if (!state.tree) {
        const ex = await apiRequest("/api/tree/example");
        state.tree = ex.tree;
      }
      // 1-3: Export & capture snapshot
      await exportCurrentTree();
      // 4: Clear original active tree from frontend
      state.tree = null;
      state.selectedPath = null;
      renderTreeSVG();
      await refreshTraversals();
      // 5-8: Restore using only archive text & verify against snapshot
      await restoreFromArchive();
      setStatus("Full recovery demo completed: Export -> Clear -> Restore -> Verify.");
    } catch (err) {
      showArchiveError(err.message);
      setStatus(`Demo failed: ${err.message}`);
    }
  });

  // Corruption controls
  btnCorruptRemove.addEventListener("click", () => {
    const lines = archiveTextarea.value.split("\n");
    if (lines.length < 3 || !lines[2].startsWith("DATA:")) return;
    const tokens = lines[2].slice(5).split(",");
    if (tokens.length > 0) {
      tokens.pop();
      lines[2] = "DATA:" + tokens.join(",");
      archiveTextarea.value = lines.join("\n");
      setStatus("Corrupted archive: removed last token from DATA.");
    }
  });

  btnCorruptCount.addEventListener("click", () => {
    const lines = archiveTextarea.value.split("\n");
    if (lines.length < 2 || !lines[1].startsWith("COUNT:")) return;
    const curr = parseInt(lines[1].slice(6), 10);
    const altered = Number.isNaN(curr) ? 999 : curr + 5;
    lines[1] = `COUNT:${altered}`;
    archiveTextarea.value = lines.join("\n");
    setStatus(`Corrupted archive: altered COUNT to ${altered}.`);
  });

  btnCorruptToken.addEventListener("click", () => {
    const lines = archiveTextarea.value.split("\n");
    if (lines.length < 3 || !lines[2].startsWith("DATA:")) return;
    const payload = lines[2].slice(5);
    const tokens = payload ? payload.split(",") : [];
    const insertAt = Math.min(1, tokens.length);
    tokens.splice(insertAt, 0, "INVALID_TOKEN");
    lines[2] = "DATA:" + tokens.join(",");
    archiveTextarea.value = lines.join("\n");
    setStatus("Corrupted archive: injected 'INVALID_TOKEN' into DATA.");
  });

  // Test Lab
  btnRunTests.addEventListener("click", async () => {
    try {
      const report = await apiRequest("/api/tests/run", { method: "POST" });
      testSummary.textContent = `${report.passed}/${report.total} passed`;
      testSummary.className = report.failed === 0 ? "meta-pill pass" : "meta-pill fail";

      testResultsGrid.innerHTML = "";
      for (const item of report.results) {
        const card = document.createElement("div");
        card.className = "test-card";

        const header = document.createElement("div");
        header.className = "test-card-header";

        const title = document.createElement("span");
        title.textContent = item.name;

        const badge = document.createElement("span");
        badge.className = item.passed ? "meta-pill pass" : "meta-pill fail";
        badge.textContent = item.passed ? "PASS" : "FAIL";

        header.appendChild(title);
        header.appendChild(badge);

        const details = document.createElement("div");
        details.className = "test-card-details";
        details.textContent = item.details;

        card.appendChild(header);
        card.appendChild(details);
        testResultsGrid.appendChild(card);
      }
      setStatus(`Test Lab finished: ${report.passed}/${report.total} tests passed.`);
    } catch (err) {
      setStatus(`Test run failed: ${err.message}`);
    }
  });

  // Initial render
  renderTreeSVG();
  refreshTraversals();
  updateSnapshotUI();
})();
