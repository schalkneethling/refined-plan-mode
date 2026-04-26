import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle, foldGutter } from "@codemirror/language";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
  ViewPlugin,
  type PluginValue,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import "./style.css";

type ReviewStatus = "approved" | "approved_with_comments" | "changes_requested";
type AnchorType = "line" | "range" | "selection";

type PlanVersion = {
  version: string;
  fileName: string;
  path: string;
  mtime: string;
};

type PlanResponse = {
  content: string;
  version: string | null;
  planFile: string | null;
  versions: PlanVersion[];
  error?: string;
};

type ReviewComment = {
  id: string;
  anchorType: AnchorType;
  startLine: number;
  endLine: number;
  originalText: string;
  selectedText?: string;
  body: string;
};

type FeedbackPayload = {
  planFile: string | null;
  version: string | null;
  timestamp: string;
  status: ReviewStatus;
  comments: ReviewComment[];
};

type CommentDecorationEntry = {
  from: number;
  decoration: Decoration;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root was not found.");
}

app.innerHTML = `
  <main class="review-shell">
    <header class="review-header">
      <div>
        <p class="review-header__eyebrow">Refined Plan Mode</p>
        <h1 class="review-header__title">Plan Review</h1>
      </div>
      <div class="review-header__controls">
        <label class="field">
          <span class="field__label">Version</span>
          <select class="select" id="version-select" aria-label="Plan version"></select>
        </label>
        <button class="button button--ghost" id="reload-button" type="button">Reload</button>
      </div>
    </header>

    <section class="status-bar" id="status-bar" role="status" aria-live="polite"></section>

    <section class="review-layout">
      <div class="source-pane" aria-label="Plan source">
        <div class="source-pane__toolbar">
          <span id="plan-path">No plan loaded</span>
          <button class="button button--small" id="selection-button" type="button" disabled>Add Comment</button>
        </div>
        <div class="editor-host" id="editor"></div>
      </div>

      <aside class="comment-panel" aria-label="Pending comments">
        <div class="comment-panel__header">
          <h2>Comments</h2>
          <span class="comment-count" id="comment-count">0</span>
        </div>
        <div id="comment-list" class="comment-list"></div>
      </aside>
    </section>

    <footer class="review-actions">
      <button class="button button--secondary" id="submit-review" type="button" disabled>Submit Review</button>
      <button class="button button--primary" id="approve-review" type="button">Approve</button>
    </footer>
  </main>

  <dialog class="comment-dialog" id="comment-dialog">
    <form method="dialog" class="comment-form">
      <h2 id="comment-title">Add comment</h2>
      <p class="comment-form__anchor" id="comment-anchor"></p>
      <label class="field">
        <span class="field__label">Comment</span>
        <textarea class="textarea" id="comment-body" rows="6" required></textarea>
      </label>
      <div class="comment-form__actions">
        <button class="button button--ghost" id="cancel-comment" value="cancel" type="button">Cancel</button>
        <button class="button button--primary" id="save-comment" value="default" type="submit">Save</button>
      </div>
    </form>
  </dialog>
`;

const statusBar = document.querySelector<HTMLDivElement>("#status-bar")!;
const editorHost = document.querySelector<HTMLDivElement>("#editor")!;
const versionSelect = document.querySelector<HTMLSelectElement>("#version-select")!;
const reloadButton = document.querySelector<HTMLButtonElement>("#reload-button")!;
const selectionButton = document.querySelector<HTMLButtonElement>("#selection-button")!;
const submitButton = document.querySelector<HTMLButtonElement>("#submit-review")!;
const approveButton = document.querySelector<HTMLButtonElement>("#approve-review")!;
const planPath = document.querySelector<HTMLSpanElement>("#plan-path")!;
const commentList = document.querySelector<HTMLDivElement>("#comment-list")!;
const commentCount = document.querySelector<HTMLSpanElement>("#comment-count")!;
const commentDialog = document.querySelector<HTMLDialogElement>("#comment-dialog")!;
const commentTitle = document.querySelector<HTMLHeadingElement>("#comment-title")!;
const commentAnchor = document.querySelector<HTMLParagraphElement>("#comment-anchor")!;
const commentBody = document.querySelector<HTMLTextAreaElement>("#comment-body")!;
const cancelComment = document.querySelector<HTMLButtonElement>("#cancel-comment")!;
const saveComment = document.querySelector<HTMLButtonElement>("#save-comment")!;
const commentLineDecoration = Decoration.line({
  class: "cm-comment-line",
});

let currentPlan: PlanResponse = { content: "", version: null, planFile: null, versions: [] };
let comments: ReviewComment[] = [];
let editingCommentId: string | null = null;
let draftAnchor: Omit<ReviewComment, "id" | "body"> | null = null;
let gutterRangeStartLine: number | null = null;
let lastGutterClickLine: number | null = null;
let suppressNextGutterClick = false;

const commentDecorations = ViewPlugin.fromClass(
  class implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCommentDecorations(view);
    }

    update(update: ViewUpdate) {
      this.decorations = buildCommentDecorations(update.view);
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading, class: "cm-md-heading" },
  { tag: tags.strong, class: "cm-md-strong" },
  { tag: tags.emphasis, class: "cm-md-emphasis" },
  { tag: tags.link, class: "cm-md-link" },
  { tag: tags.monospace, class: "cm-md-code" },
  { tag: tags.list, class: "cm-md-list" },
]);

const editorExtensions: Extension[] = [
  lineNumbers({
    domEventHandlers: {
      mousedown(view, block, event) {
        const mouseEvent = event as MouseEvent;
        if (mouseEvent.button !== 0) {
          return false;
        }

        gutterRangeStartLine = view.state.doc.lineAt(block.from).number;
        return false;
      },
      mouseup(view, block) {
        if (gutterRangeStartLine === null) {
          return false;
        }

        const line = view.state.doc.lineAt(block.from);
        if (line.number !== gutterRangeStartLine) {
          openLineRangeComment(gutterRangeStartLine, line.number);
          suppressNextGutterClick = true;
        }

        gutterRangeStartLine = null;
        return false;
      },
      click(view, block, event) {
        const mouseEvent = event as MouseEvent;
        if (suppressNextGutterClick) {
          suppressNextGutterClick = false;
          return true;
        }

        const line = view.state.doc.lineAt(block.from);
        if (mouseEvent.shiftKey && lastGutterClickLine !== null) {
          openLineRangeComment(lastGutterClickLine, line.number);
          lastGutterClickLine = line.number;
          return true;
        }

        lastGutterClickLine = line.number;
        openCommentDialog({
          anchorType: "line",
          startLine: line.number,
          endLine: line.number,
          originalText: line.text,
        });
        return true;
      },
    },
    formatNumber: (lineNo) => String(lineNo),
  }),
  foldGutter(),
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  EditorView.lineWrapping,
  markdown(),
  syntaxHighlighting(highlightStyle),
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  commentDecorations,
  EditorView.theme({
    "&": { height: "100%" },
    ".cm-scroller": { fontFamily: "var(--mono)" },
    ".cm-content": { padding: "18px 0" },
    ".cm-line": { padding: "0 18px" },
  }),
];

const editor = new EditorView({
  state: EditorState.create({ doc: "", extensions: editorExtensions }),
  parent: editorHost,
});

selectionButton.addEventListener("click", () => {
  const selection = editor.state.selection.main;
  if (selection.empty) {
    return;
  }

  const startLine = editor.state.doc.lineAt(selection.from);
  const selectionEnd = getSelectionEndPosition(selection.from, selection.to);
  const endLine = editor.state.doc.lineAt(selectionEnd);
  const selectedText = editor.state.sliceDoc(selection.from, selection.to);

  openCommentDialog({
    anchorType: "selection",
    startLine: startLine.number,
    endLine: endLine.number,
    originalText: getTextForLines(startLine.number, endLine.number),
    selectedText,
  });
});

reloadButton.addEventListener("click", () => {
  resetReviewActionState();
  void loadPlan(versionSelect.value || undefined);
});

versionSelect.addEventListener("change", () => {
  resetReviewActionState();
  void loadPlan(versionSelect.value);
});

submitButton.addEventListener("click", () => {
  void submitFeedback("changes_requested");
});

approveButton.addEventListener("click", () => {
  const status: ReviewStatus = comments.length > 0 ? "approved_with_comments" : "approved";
  void submitFeedback(status);
});

cancelComment.addEventListener("click", () => {
  closeCommentDialog();
});

commentDialog.addEventListener("close", () => {
  if (commentDialog.returnValue === "cancel") {
    editingCommentId = null;
    draftAnchor = null;
    commentBody.value = "";
  }
});

saveComment.addEventListener("click", (event) => {
  event.preventDefault();
  const body = commentBody.value.trim();

  if (!draftAnchor || body.length === 0) {
    commentBody.focus();
    return;
  }

  if (editingCommentId) {
    comments = comments.map((comment) =>
      comment.id === editingCommentId ? { ...comment, ...draftAnchor, body } : comment,
    );
  } else {
    comments = [...comments, { ...draftAnchor, id: crypto.randomUUID(), body }];
  }

  comments.sort(
    (first, second) => first.startLine - second.startLine || first.endLine - second.endLine,
  );
  saveDraftComments();
  renderComments();
  refreshCommentDecorations();
  closeCommentDialog();
});

editor.dom.addEventListener("mouseup", updateSelectionButton);
editor.dom.addEventListener("keyup", updateSelectionButton);

function setStatus(message: string, tone: "info" | "success" | "error" = "info") {
  statusBar.textContent = message;
  statusBar.dataset.tone = tone;
}

async function loadPlan(version?: string) {
  setStatus("Loading plan...");
  resetReviewActionState();
  comments = [];
  renderComments();

  const endpoint = version ? `/api/plan/${encodeURIComponent(version)}` : "/api/plan";
  const response = await fetch(endpoint);
  currentPlan = (await response.json()) as PlanResponse;

  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: currentPlan.content },
  });

  renderVersions();
  planPath.textContent = currentPlan.planFile ?? ".plan-review/plans";

  if (!response.ok || currentPlan.error) {
    setStatus(currentPlan.error ?? "Unable to load the plan.", "error");
    return;
  }

  if (!currentPlan.version) {
    setStatus("No plan versions found. Write a plan to .plan-review/plans/plan-v1.md to begin.");
    return;
  }

  if (currentPlan.content.trim().length === 0) {
    setStatus(`${currentPlan.version} exists, but the file is empty.`, "error");
    return;
  }

  comments = loadDraftComments();
  renderComments();
  refreshCommentDecorations();

  setStatus(
    `Loaded ${currentPlan.version}. Click a line number, drag across line numbers, or select text to add feedback.`,
  );
}

function renderVersions() {
  versionSelect.replaceChildren(
    ...currentPlan.versions.map((version) => {
      const option = document.createElement("option");
      option.value = version.version;
      option.textContent = version.version;
      option.selected = version.version === currentPlan.version;
      return option;
    }),
  );
  versionSelect.disabled = currentPlan.versions.length === 0;
}

function renderComments() {
  commentCount.textContent = String(comments.length);
  submitButton.disabled = comments.length === 0;

  if (comments.length === 0) {
    commentList.innerHTML = `<p class="empty-state">No comments yet.</p>`;
    return;
  }

  commentList.replaceChildren(
    ...comments.map((comment) => {
      const item = document.createElement("article");
      item.className = "comment-card";
      item.innerHTML = `
        <button class="comment-card__anchor" type="button">
          ${formatLineRange(comment)}
        </button>
        <blockquote>${escapeHtml(formatCommentPreview(comment))}</blockquote>
        <p>${escapeHtml(comment.body)}</p>
        <div class="comment-card__actions">
          <button class="button button--small" type="button" data-action="edit">Edit</button>
          <button class="button button--small button--danger" type="button" data-action="delete">Delete</button>
        </div>
      `;

      item.querySelector(".comment-card__anchor")?.addEventListener("click", () => {
        scrollToLine(comment.startLine);
      });

      item.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
        editingCommentId = comment.id;
        openCommentDialog(comment, comment.body);
      });

      item.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        comments = comments.filter((existing) => existing.id !== comment.id);
        saveDraftComments();
        renderComments();
        refreshCommentDecorations();
      });

      return item;
    }),
  );
}

function openCommentDialog(anchor: Omit<ReviewComment, "id" | "body">, body = "") {
  draftAnchor = anchor;
  commentTitle.textContent = editingCommentId ? "Edit comment" : "Add comment";
  commentAnchor.textContent = `${formatLineRange(anchor)} - ${anchor.anchorType}`;
  commentBody.value = body;
  commentDialog.showModal();
  commentBody.focus();
}

function openLineRangeComment(fromLine: number, toLine: number) {
  const startLine = Math.min(fromLine, toLine);
  const endLine = Math.max(fromLine, toLine);

  openCommentDialog({
    anchorType: startLine === endLine ? "line" : "range",
    startLine,
    endLine,
    originalText: getTextForLines(startLine, endLine),
  });
}

function closeCommentDialog() {
  if (commentDialog.open) {
    commentDialog.close("cancel");
  }

  editingCommentId = null;
  draftAnchor = null;
  commentBody.value = "";
}

async function submitFeedback(status: ReviewStatus) {
  setReviewActionState(status, "pending");

  const payload: FeedbackPayload = {
    planFile: currentPlan.planFile,
    version: currentPlan.version,
    timestamp: new Date().toISOString(),
    status,
    comments,
  };

  const response = await fetch(
    `/api/feedback/${encodeURIComponent(currentPlan.version ?? "unknown")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    resetReviewActionState();
    setStatus("Feedback could not be written. Your comments are still on screen.", "error");
    return;
  }

  comments = [];
  clearDraftComments();
  renderComments();
  refreshCommentDecorations();
  setStatus(status === "changes_requested" ? "Review submitted." : "Plan approved.", "success");
  setReviewActionState(status, "success");
}

function setReviewActionState(status: ReviewStatus, state: "pending" | "success") {
  const isApproval = status === "approved" || status === "approved_with_comments";
  const activeButton = isApproval ? approveButton : submitButton;
  const inactiveButton = isApproval ? submitButton : approveButton;

  activeButton.disabled = true;
  inactiveButton.disabled = true;
  activeButton.dataset.state = state;

  if (state === "pending") {
    activeButton.textContent = isApproval ? "Approving..." : "Submitting...";
    return;
  }

  activeButton.textContent = isApproval ? "Plan Approved" : "Review Submitted";
}

function resetReviewActionState() {
  delete approveButton.dataset.state;
  delete submitButton.dataset.state;
  approveButton.textContent = "Approve";
  submitButton.textContent = "Submit Review";
  approveButton.disabled = false;
  submitButton.disabled = comments.length === 0;
}

function updateSelectionButton() {
  selectionButton.disabled = editor.state.selection.main.empty;
}

function refreshCommentDecorations() {
  editor.dispatch({ effects: [] });
}

function buildCommentDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  const decorationEntries: CommentDecorationEntry[] = [];

  for (const comment of comments) {
    for (let lineNumber = comment.startLine; lineNumber <= comment.endLine; lineNumber += 1) {
      decorationEntries.push({
        from: view.state.doc.line(lineNumber).from,
        decoration: commentLineDecoration,
      });
    }
  }

  decorationEntries.sort((first, second) => first.from - second.from);

  for (const entry of decorationEntries) {
    builder.add(entry.from, entry.from, entry.decoration);
  }

  return builder.finish();
}

function scrollToLine(lineNumber: number) {
  const line = editor.state.doc.line(lineNumber);
  editor.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  editor.focus();
}

function getTextForLines(startLine: number, endLine: number) {
  const lines: string[] = [];
  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    lines.push(editor.state.doc.line(lineNo).text);
  }
  return lines.join("\n");
}

function getSelectionEndPosition(selectionFrom: number, selectionTo: number) {
  if (selectionTo > selectionFrom && editor.state.sliceDoc(selectionTo - 1, selectionTo) === "\n") {
    return selectionTo - 1;
  }

  return selectionTo;
}

function formatCommentPreview(comment: ReviewComment) {
  const text = comment.selectedText || comment.originalText;
  const lines = text.split("\n");
  const visibleLines = lines.slice(0, 8);
  const preview = visibleLines.join("\n");
  const truncatedByLine = lines.length > visibleLines.length;
  const truncatedByLength = preview.length > 800;

  if (truncatedByLength) {
    return `${preview.slice(0, 800)}\n...`;
  }

  if (truncatedByLine) {
    return `${preview}\n...`;
  }

  return preview;
}

function getDraftStorageKey() {
  return `refined-plan-mode:draft-comments:${currentPlan.planFile ?? "unknown"}:${currentPlan.version ?? "unknown"}`;
}

function loadDraftComments() {
  try {
    const storedComments = localStorage.getItem(getDraftStorageKey());
    if (!storedComments) {
      return [];
    }

    return JSON.parse(storedComments) as ReviewComment[];
  } catch {
    return [];
  }
}

function saveDraftComments() {
  if (!currentPlan.version) {
    return;
  }

  localStorage.setItem(getDraftStorageKey(), JSON.stringify(comments));
}

function clearDraftComments() {
  localStorage.removeItem(getDraftStorageKey());
}

function formatLineRange(anchor: Pick<ReviewComment, "startLine" | "endLine">) {
  return anchor.startLine === anchor.endLine
    ? `Line ${anchor.startLine}`
    : `Lines ${anchor.startLine}-${anchor.endLine}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

void loadPlan();
