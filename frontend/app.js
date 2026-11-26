(() => {
  "use strict";

  const LABEL_RE = /^[A-Za-z0-9_-]{1,16}$/;

  const state = {
    tree: null,           // Deliverable 01 active editable tree JSON
    selectedPath: null,   // Selected node path in Deliverable 01 ("", "L", "LR", etc.)
    exportedArchive: "",  // Deliverable 02 exported TVF-1 text
    snapshot: null,       // Compact original verification snapshot captured on Export
    recoveredTree: null,  // Deliverable 03 reconstructed tree JSON (independent of state.tree)
  };

  // Header & Navigation
  const backendStatusEl = document.getElementById("backend-status");
  const backendStatusText = document.getElementById("backend-status-text");
  const globalNotice = document.getElementById("global-notice");
  const navTabs = Array.from(document.querySelectorAll(".nav-tab"));
  const deliverablePanels = Array.from(document.querySelectorAll(".deliverable-panel"));

  // Deliverable 01 Elements
  const d1NodeCount = document.getElementById("d1-node-count");
  const d1TreeHeight = document.getElementById("d1-tree-height");
  const d1SelectedNode = document.getElementById("d1-selected-node");
  const d1Preorder = document.getElementById("d1-preorder");
  const d1Inorder = document.getElementById("d1-inorder");
  const randomCountInput = document.getElementById("random-count");
  const nodeLabelInput = document.getElementById("node-label-input");
  const d1Svg = document.getElementById("tree-svg");
  const d1SvgEdges = document.getElementById("svg-edges");
  const d1SvgNodes = document.getElementById("svg-nodes");
  const d1EmptyMsg = document.getElementById("empty-canvas-msg");

  const btnLoadExample = document.getElementById("btn-load-example");
  const btnRandomTree = document.getElementById("btn-random-tree");
  const btnClearTree = document.getElementById("btn-clear-tree");
  const btnAddRoot = document.getElementById("btn-add-root");
  const btnAddLeft = document.getElementById("btn-add-left");
  const btnAddRight = document.getElementById("btn-add-right");
  const btnDeleteSubtree = document.getElementById("btn-delete-subtree");

  // Deliverable 02 Elements
  const d2NodeCount = document.getElementById("d2-node-count");
  const d2MetaCount = document.getElementById("d2-meta-count");
  const d2SnapshotStatus = document.getElementById("d2-snapshot-status");
  const exportedArchiveDisplay = document.getElementById("exported-archive-display");
  const d2Error = document.getElementById("d2-error");
  const btnExport = document.getElementById("btn-export");
  const btnCopy = document.getElementById("btn-copy");
  const btnDownloadTvf = document.getElementById("btn-download-tvf");
  const btnClearArchive = document.getElementById("btn-clear-archive");

  // Deliverable 03 Elements
  const d3NodeCount = document.getElementById("d3-node-count");
  const d3ValidationPill = document.getElementById("d3-validation-pill");
  const recoveryTextarea = document.getElementById("recovery-textarea");
  const d3ValidationBox = document.getElementById("d3-validation-box");
  const d3Preorder = document.getElementById("d3-preorder");
  const d3Inorder = document.getElementById("d3-inorder");
  const d3Svg = document.getElementById("recovery-svg");
  const d3SvgEdges = document.getElementById("recovery-svg-edges");
  const d3SvgNodes = document.getElementById("recovery-svg-nodes");
  const d3EmptyMsg = document.getElementById("recovery-empty-msg");
  const btnUseExported = document.getElementById("btn-use-exported");
  const fileImport = document.getElementById("file-import");
  const btnRestore = document.getElementById("btn-restore");
  const btnClearRecoveryInput = document.getElementById("btn-clear-recovery-input");
  const btnAdoptRecovered = document.getElementById("btn-adopt-recovered");

  // Deliverable 04 Elements
  const btnVerify = document.getElementById("btn-verify");
  const d4StatusNote = document.getElementById("d4-status-note");
  const vStructureStatus = document.getElementById("v-structure-status");
  const vStructureDetail = document.getElementById("v-structure-detail");
  const vCountStatus = document.getElementById("v-count-status");
  const vCountDetail = document.getElementById("v-count-detail");
  const vPreorderStatus = document.getElementById("v-preorder-status");
  const vPreorderDetail = document.getElementById("v-preorder-detail");
  const vInorderStatus = document.getElementById("v-inorder-status");
  const vInorderDetail = document.getElementById("v-inorder-detail");
  const vOrigPre = document.getElementById("v-orig-pre");
  const vRecPre = document.getElementById("v-rec-pre");
  const vOrigIn = document.getElementById("v-orig-in");
  const vRecIn = document.getElementById("v-rec-in");

  // Archival Utilities Elements
  const btnCorruptRemove = document.getElementById("btn-corrupt-remove");
  const btnCorruptCount = document.getElementById("btn-corrupt-count");
  const btnCorruptToken = document.getElementById("btn-corrupt-token");
  const corruptionFeedback = document.getElementById("corruption-feedback");
  const btnRunTests = document.getElementById("btn-run-tests");
  const testSummary = document.getElementById("test-summary");
  const testResultsGrid = document.getElementById("test-results-grid");

  function setNotice(msg) {
    globalNotice.textContent = msg;
  }

  function showBox(el, msg, type = "error") {
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.className = "alert-box";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.className = `alert-box ${type === "success" ? "alert-success" : "alert-error"}`;
  }

  async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    return data;
  }

  async function checkBackendConnectivity() {
    try {
      await apiRequest("/api/tree/traversals", {
        method: "POST",
        body: JSON.stringify({ tree: null }),
      });
      backendStatusEl.className = "conn-pill connected";
      backendStatusText.textContent = "Backend Connected";
    } catch {
      backendStatusEl.className = "conn-pill disconnected";
      backendStatusText.textContent = "Backend Disconnected";
    }
  }

  // Tab Navigation (preserves all application state)
  function switchTab(targetId) {
    for (const tab of navTabs) {
      const isMatch = tab.dataset.tab === targetId;
      tab.classList.toggle("active", isMatch);
      tab.setAttribute("aria-selected", isMatch ? "true" : "false");
    }
    for (const panel of deliverablePanels) {
      const isMatch = panel.id === targetId;
      panel.classList.toggle("active", isMatch);
      panel.hidden = !isMatch;
    }
  }

  for (const tab of navTabs) {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  }

  // Iterative tree height computation (0 for empty, 1 for single root)
  function computeTreeHeight(root) {
    if (!root) return 0;
    let maxH = 0;
    const stack = [{ node: root, depth: 1 }];
    while (stack.length > 0) {
      const { node, depth } = stack.pop();
      if (depth > maxH) maxH = depth;
      if (node.right) stack.push({ node: node.right, depth: depth + 1 });
      if (node.left) stack.push({ node: node.left, depth: depth + 1 });
    }
    return maxH;
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
      setNotice("Invalid label: use 1-16 characters of letters, digits, '_' or '-'.");
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

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Reusable overlap-free iterative inorder-rank SVG tree renderer
  function renderTreeToSVG(treeData, svgEl, edgesGroup, nodesGroup, emptyEl, options = {}) {
    const { interactive = false, selectedPath = null, onSelect = null, minHeight = 420 } = options;
    edgesGroup.innerHTML = "";
    nodesGroup.innerHTML = "";

    if (!treeData) {
      emptyEl.style.display = "flex";
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      return;
    }
    emptyEl.style.display = "none";

    const positions = new Map();
    const stack = [];
    let curr = { node: treeData, path: "", depth: 0, parentPath: null };
    let xCounter = 0;
    let maxDepth = 0;

    while (curr !== null || stack.length > 0) {
      while (curr !== null) {
        stack.push(curr);
        curr = curr.node.left
          ? { node: curr.node.left, path: curr.path + "L", depth: curr.depth + 1, parentPath: curr.path }
          : null;
      }
      const item = stack.pop();
      positions.set(item.path, {
        node: item.node,
        xIdx: xCounter++,
        depth: item.depth,
        parentPath: item.parentPath,
      });
      if (item.depth > maxDepth) maxDepth = item.depth;

      curr = item.node.right
        ? { node: item.node.right, path: item.path + "R", depth: item.depth + 1, parentPath: item.parentPath !== undefined ? item.path : null }
        : null;
    }

    const hStep = xCounter > 40 ? 44 : 58;
    const vStep = 72;
    const padX = 48;
    const padY = 44;
    const radius = xCounter > 80 ? 15 : 19;

    const width = Math.max(580, xCounter * hStep + padX * 2);
    const height = Math.max(minHeight, (maxDepth + 1) * vStep + padY * 2);
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

    for (const [, { x, y, info }] of coords.entries()) {
      if (info.parentPath !== null) {
        const p = coords.get(info.parentPath);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(p.x));
        line.setAttribute("y1", String(p.y));
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(y));
        line.setAttribute("class", "tree-edge");
        edgesGroup.appendChild(line);
      }
    }

    for (const [path, { x, y, info }] of coords.entries()) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const isSelected = interactive && selectedPath === path;
      g.setAttribute("class", isSelected ? "tree-node-group selected" : "tree-node-group");

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

      if (interactive && onSelect) {
        g.addEventListener("click", () => onSelect(path));
      }

      nodesGroup.appendChild(g);
    }
  }

  function renderConstructionSVG() {
    renderTreeToSVG(state.tree, d1Svg, d1SvgEdges, d1SvgNodes, d1EmptyMsg, {
      interactive: true,
      selectedPath: state.selectedPath,
      minHeight: 420,
      onSelect: (path) => {
        state.selectedPath = path;
        renderConstructionSVG();
      },
    });
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const selectedNode = getNodeAtPath(state.tree, state.selectedPath);
    if (!selectedNode) {
      state.selectedPath = null;
      d1SelectedNode.textContent = "None";
    } else {
      const pathLabel = state.selectedPath === "" ? "ROOT" : state.selectedPath;
      d1SelectedNode.textContent = `${selectedNode.label} (${pathLabel})`;
    }
    d1TreeHeight.textContent = String(computeTreeHeight(state.tree));
    btnAddRoot.disabled = state.tree !== null;
    btnAddLeft.disabled = !selectedNode || selectedNode.left !== null;
    btnAddRight.disabled = !selectedNode || selectedNode.right !== null;
    btnDeleteSubtree.disabled = !selectedNode;
  }

  async function refreshConstructionTraversals() {
    try {
      const data = await apiRequest("/api/tree/traversals", {
        method: "POST",
        body: JSON.stringify({ tree: state.tree }),
      });
      d1NodeCount.textContent = String(data.node_count);
      d1Preorder.textContent = formatListPreview(data.preorder);
      d1Inorder.textContent = formatListPreview(data.inorder);
    } catch (err) {
      setNotice(`Traversal calculation failed: ${err.message}`);
    }
  }

  // Deliverable 01 Handlers
  btnLoadExample.addEventListener("click", async () => {
    try {
      const data = await apiRequest("/api/tree/example");
      state.tree = data.tree;
      state.selectedPath = "";
      renderConstructionSVG();
      await refreshConstructionTraversals();
      setNotice("Loaded the illustrative 4-node museum family tree (A, B, D, C).");
    } catch (err) {
      setNotice(`Failed to load example: ${err.message}`);
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
      renderConstructionSVG();
      await refreshConstructionTraversals();
      setNotice(`Generated random ordinary binary tree (${data.node_count} nodes).`);
    } catch (err) {
      setNotice(`Random generation error: ${err.message}`);
    }
  });

  btnClearTree.addEventListener("click", async () => {
    state.tree = null;
    state.selectedPath = null;
    renderConstructionSVG();
    await refreshConstructionTraversals();
    setNotice("Cleared active workspace tree. Any captured snapshot remains intact for verification.");
  });

  btnAddRoot.addEventListener("click", async () => {
    if (state.tree !== null) return;
    const label = validateInputLabel();
    if (!label) return;
    state.tree = { label, left: null, right: null };
    state.selectedPath = "";
    nodeLabelInput.value = "";
    renderConstructionSVG();
    await refreshConstructionTraversals();
    setNotice(`Created root node '${label}'.`);
  });

  async function addChild(side) {
    const parent = getNodeAtPath(state.tree, state.selectedPath);
    if (!parent) return;
    const prop = side === "L" ? "left" : "right";
    if (parent[prop] !== null) {
      setNotice(`Selected node already has a ${prop} child.`);
      return;
    }
    const label = validateInputLabel();
    if (!label) return;
    parent[prop] = { label, left: null, right: null };
    state.selectedPath = state.selectedPath + side;
    nodeLabelInput.value = "";
    renderConstructionSVG();
    await refreshConstructionTraversals();
    setNotice(`Added ${prop} child '${label}'.`);
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
    renderConstructionSVG();
    await refreshConstructionTraversals();
    setNotice("Deleted selected subtree.");
  });

  // Deliverable 02: Archive & Serialization
  btnExport.addEventListener("click", async () => {
    showBox(d2Error, "");
    try {
      const data = await apiRequest("/api/archive/export", {
        method: "POST",
        body: JSON.stringify({ tree: state.tree }),
      });
      state.exportedArchive = data.archive;
      state.snapshot = data.snapshot;
      exportedArchiveDisplay.textContent = data.archive;
      d2NodeCount.textContent = String(data.node_count);
      d2MetaCount.textContent = String(data.node_count);
      d2SnapshotStatus.textContent = `SNAPSHOT: CAPTURED (${data.node_count} NODES)`;
      setNotice(`Exported TVF-1 archival record (${data.node_count} nodes) and captured reference snapshot.`);
    } catch (err) {
      showBox(d2Error, err.message, "error");
      setNotice(`Export failed: ${err.message}`);
    }
  });

  btnCopy.addEventListener("click", async () => {
    if (!state.exportedArchive) {
      setNotice("No exported archive to copy. Click Export Archive first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(state.exportedArchive);
      setNotice("Copied TVF-1 archival record to clipboard.");
    } catch {
      setNotice("Clipboard permission unavailable; select text directly from the record sheet.");
    }
  });

  btnDownloadTvf.addEventListener("click", () => {
    if (!state.exportedArchive) {
      setNotice("No exported archive to download. Click Export Archive first.");
      return;
    }
    const blob = new Blob([state.exportedArchive + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "treevault-record.tvf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice("Downloaded preservation record as treevault-record.tvf.");
  });

  btnClearArchive.addEventListener("click", () => {
    state.exportedArchive = "";
    exportedArchiveDisplay.textContent = 'No preservation record generated yet. Click "Export Archive" to serialize the active tree.';
    d2NodeCount.textContent = "—";
    d2MetaCount.textContent = "—";
    showBox(d2Error, "");
    setNotice("Cleared displayed preservation record.");
  });

  // Deliverable 03: Independent Archive Recovery
  btnUseExported.addEventListener("click", () => {
    if (!state.exportedArchive) {
      setNotice("No record has been exported in Deliverable 02 yet.");
      return;
    }
    recoveryTextarea.value = state.exportedArchive;
    showBox(d3ValidationBox, "");
    setNotice("Loaded exported TVF-1 record into Deliverable 03 recovery input.");
  });

  fileImport.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      recoveryTextarea.value = String(reader.result || "");
      showBox(d3ValidationBox, "");
      setNotice(`Imported '${file.name}' into recovery input. Click Restore Tree to reconstruct.`);
    };
    reader.readAsText(file);
    fileImport.value = "";
  });

  btnClearRecoveryInput.addEventListener("click", () => {
    recoveryTextarea.value = "";
    state.recoveredTree = null;
    d3NodeCount.textContent = "—";
    d3ValidationPill.textContent = "Pending";
    d3Preorder.textContent = "[]";
    d3Inorder.textContent = "[]";
    btnAdoptRecovered.disabled = true;
    showBox(d3ValidationBox, "");
    renderTreeToSVG(null, d3Svg, d3SvgEdges, d3SvgNodes, d3EmptyMsg, { minHeight: 330 });
    setNotice("Cleared recovery input and reconstructed preview.");
  });

  btnRestore.addEventListener("click", async () => {
    showBox(d3ValidationBox, "");
    const archiveText = recoveryTextarea.value;
    try {
      const data = await apiRequest("/api/archive/restore", {
        method: "POST",
        body: JSON.stringify({ archive: archiveText }),
      });
      state.recoveredTree = data.tree;
      d3NodeCount.textContent = String(data.node_count);
      d3ValidationPill.textContent = "Valid TVF-1";
      d3Preorder.textContent = formatListPreview(data.preorder);
      d3Inorder.textContent = formatListPreview(data.inorder);
      btnAdoptRecovered.disabled = false;
      showBox(
        d3ValidationBox,
        `Valid TVF-1 stream: reconstructed ${data.node_count} node(s) from archive text alone.`,
        "success"
      );
      renderTreeToSVG(state.recoveredTree, d3Svg, d3SvgEdges, d3SvgNodes, d3EmptyMsg, {
        interactive: false,
        minHeight: 330,
      });
      setNotice(`Restored ${data.node_count} node(s) from TVF-1 archive.`);
    } catch (err) {
      state.recoveredTree = null;
      d3NodeCount.textContent = "—";
      d3ValidationPill.textContent = "Rejected";
      d3Preorder.textContent = "[]";
      d3Inorder.textContent = "[]";
      btnAdoptRecovered.disabled = true;
      showBox(d3ValidationBox, `Archive Rejected: ${err.message}`, "error");
      renderTreeToSVG(null, d3Svg, d3SvgEdges, d3SvgNodes, d3EmptyMsg, { minHeight: 330 });
      setNotice(`Recovery failed: ${err.message}`);
    }
  });

  btnAdoptRecovered.addEventListener("click", async () => {
    state.tree = state.recoveredTree ? JSON.parse(JSON.stringify(state.recoveredTree)) : null;
    state.selectedPath = state.tree ? "" : null;
    renderConstructionSVG();
    await refreshConstructionTraversals();
    switchTab("tab-construct");
    setNotice("Loaded reconstructed tree into Deliverable 01 construction workspace.");
  });

  // Deliverable 04: Integrity Verification
  function setStatusTag(el, matched, labelMatch = "MATCH", labelMismatch = "MISMATCH") {
    el.textContent = matched ? labelMatch : labelMismatch;
    el.className = `status-tag ${matched ? "tag-match" : "tag-mismatch"}`;
  }

  btnVerify.addEventListener("click", async () => {
    if (!state.snapshot) {
      d4StatusNote.textContent = "No original reference snapshot found. Export a tree in Deliverable 02 first.";
      setNotice("Verification requires an original snapshot from Deliverable 02.");
      return;
    }
    if (d3ValidationPill.textContent !== "Valid TVF-1") {
      d4StatusNote.textContent = "No valid reconstructed tree found. Restore an archive in Deliverable 03 first.";
      setNotice("Verification requires a restored tree from Deliverable 03.");
      return;
    }

    try {
      const report = await apiRequest("/api/tree/verify", {
        method: "POST",
        body: JSON.stringify({
          original_snapshot: state.snapshot,
          restored_tree: state.recoveredTree,
        }),
      });

      const countMatch = report.original_node_count === report.restored_node_count;
      const preorderMatch = arraysEqual(report.original_preorder, report.restored_preorder);
      const inorderMatch = arraysEqual(report.original_inorder, report.restored_inorder);

      setStatusTag(vStructureStatus, report.structural_match);
      vStructureDetail.textContent = report.structural_match
        ? "Explicit-stack comparison confirmed identical labels and child positions."
        : "Structural divergence detected between original snapshot and restored tree.";

      setStatusTag(vCountStatus, countMatch);
      vCountDetail.textContent = `Original: ${report.original_node_count} | Recovered: ${report.restored_node_count}`;

      setStatusTag(vPreorderStatus, preorderMatch);
      vPreorderDetail.textContent = preorderMatch ? "Preorder sequences are identical." : "Preorder sequences differ.";

      setStatusTag(vInorderStatus, inorderMatch);
      vInorderDetail.textContent = inorderMatch ? "Inorder sequences are identical." : "Inorder sequences differ.";

      vOrigPre.textContent = formatListPreview(report.original_preorder);
      vRecPre.textContent = formatListPreview(report.restored_preorder);
      vOrigIn.textContent = formatListPreview(report.original_inorder);
      vRecIn.textContent = formatListPreview(report.restored_inorder);

      d4StatusNote.textContent = report.structural_match
        ? "Verification complete: the recovered tree is structurally identical to the original snapshot."
        : "Verification complete: structural mismatch detected.";
      setNotice(
        report.structural_match
          ? "Integrity verified: STRUCTURE — MATCH."
          : "Integrity check detected a structural mismatch."
      );
    } catch (err) {
      d4StatusNote.textContent = `Verification error: ${err.message}`;
      setNotice(`Verification failed: ${err.message}`);
    }
  });

  // Archival Utilities: Corruption Tools & Test Suite
  function ensureRecoveryArchiveSeed() {
    if (!recoveryTextarea.value.trim() && state.exportedArchive) {
      recoveryTextarea.value = state.exportedArchive;
    }
  }

  btnCorruptRemove.addEventListener("click", () => {
    ensureRecoveryArchiveSeed();
    const lines = recoveryTextarea.value.split("\n");
    if (lines.length < 3 || !lines[2].startsWith("DATA:")) {
      corruptionFeedback.textContent = "Load or paste a valid TVF-1 archive in Deliverable 03 first.";
      return;
    }
    const tokens = lines[2].slice(5).split(",");
    if (tokens.length > 0) {
      tokens.pop();
      lines[2] = "DATA:" + tokens.join(",");
      recoveryTextarea.value = lines.join("\n");
      corruptionFeedback.textContent = "Fault injected: removed the last token from DATA. Switch to Deliverable 03 and click Restore Tree.";
      setNotice("Injected fault: removed last token in Deliverable 03 input.");
    }
  });

  btnCorruptCount.addEventListener("click", () => {
    ensureRecoveryArchiveSeed();
    const lines = recoveryTextarea.value.split("\n");
    if (lines.length < 2 || !lines[1].startsWith("COUNT:")) {
      corruptionFeedback.textContent = "Load or paste a valid TVF-1 archive in Deliverable 03 first.";
      return;
    }
    const curr = parseInt(lines[1].slice(6), 10);
    const altered = Number.isNaN(curr) ? 999 : curr + 5;
    lines[1] = `COUNT:${altered}`;
    recoveryTextarea.value = lines.join("\n");
    corruptionFeedback.textContent = `Fault injected: altered COUNT to ${altered}. Switch to Deliverable 03 and click Restore Tree.`;
    setNotice(`Injected fault: altered COUNT to ${altered} in Deliverable 03 input.`);
  });

  btnCorruptToken.addEventListener("click", () => {
    ensureRecoveryArchiveSeed();
    const lines = recoveryTextarea.value.split("\n");
    if (lines.length < 3 || !lines[2].startsWith("DATA:")) {
      corruptionFeedback.textContent = "Load or paste a valid TVF-1 archive in Deliverable 03 first.";
      return;
    }
    const payload = lines[2].slice(5);
    const tokens = payload ? payload.split(",") : [];
    const insertAt = Math.min(1, tokens.length);
    tokens.splice(insertAt, 0, "INVALID_TOKEN");
    lines[2] = "DATA:" + tokens.join(",");
    recoveryTextarea.value = lines.join("\n");
    corruptionFeedback.textContent = "Fault injected: inserted 'INVALID_TOKEN' into DATA. Switch to Deliverable 03 and click Restore Tree.";
    setNotice("Injected fault: inserted INVALID_TOKEN in Deliverable 03 input.");
  });

  btnRunTests.addEventListener("click", async () => {
    try {
      const report = await apiRequest("/api/tests/run", { method: "POST" });
      testSummary.textContent = `${report.passed}/${report.total} PASSED`;
      testSummary.className = `status-tag ${report.failed === 0 ? "tag-match" : "tag-mismatch"}`;

      testResultsGrid.innerHTML = "";
      for (const item of report.results) {
        const card = document.createElement("div");
        card.className = "test-item";

        const head = document.createElement("div");
        head.className = "test-item-head";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = item.name;

        const badge = document.createElement("span");
        badge.className = `status-tag ${item.passed ? "tag-match" : "tag-mismatch"}`;
        badge.textContent = item.passed ? "PASS" : "FAIL";

        head.appendChild(nameSpan);
        head.appendChild(badge);

        const detail = document.createElement("div");
        detail.className = "test-item-detail";
        detail.textContent = item.details;

        card.appendChild(head);
        card.appendChild(detail);
        testResultsGrid.appendChild(card);
      }
      setNotice(`Test suite finished: ${report.passed}/${report.total} passed.`);
    } catch (err) {
      setNotice(`Test suite error: ${err.message}`);
    }
  });

  // Initial Boot
  checkBackendConnectivity();
  renderConstructionSVG();
  refreshConstructionTraversals();
})();
