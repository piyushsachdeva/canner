import React, { useEffect, useState } from "react";
import {
  deleteResponse,
  getResponses,
  Response,
  saveResponse,
  updateResponse,
} from "../utils/api";

const App: React.FC = () => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [debugInfo, setDebugInfo] = useState<string>("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  useEffect(() => {
    load();
    loadTheme();
    loadEditId();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    chrome.storage.sync.set({ theme: isDarkMode ? "dark" : "light" });
  }, [isDarkMode]);

  async function loadTheme() {
    const result = await chrome.storage.sync.get(["theme"]);
    const theme = result.theme || "light";
    setIsDarkMode(theme === "dark");
  }

  async function loadEditId() {
    const result = await chrome.storage.session.get(["editId"]);
    if (result.editId) {
      // Find the response to edit
      try {
        const responses = await getResponses();
        const response = responses.find((r) => r.id === result.editId);
        if (response) {
          openEditModal(response);
        }
      } catch (error) {
        console.error("Failed to load response for editing:", error);
      }
      // Clear the edit ID
      chrome.storage.session.remove(["editId"]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getResponses();
      setResponses(data || []);
    } catch (e) {
      console.error("❌ Error loading responses:", e);
      setDebugInfo(`❌ Error: ${e}`);
    } finally {
      setLoading(false);
      console.log("✅ Loading complete");
    }
  }

  function openCreateModal() {
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setTags("");
    setShowModal(true);
  }

  function openEditModal(r: Response) {
    setIsEditing(true);
    setEditingId(r.id || null);
    setTitle(r.title || "");
    setContent(r.content || "");
    const t = Array.isArray(r.tags) ? r.tags.join(", ") : r.tags || "";
    setTags(t);
    setShowModal(true);
  }

  const filtered = responses.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      (Array.isArray(r.tags)
        ? r.tags.join(" ").toLowerCase()
        : String(r.tags || "")
      ).includes(q)
    );
  });

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setNotification("⚠️ Title and content are required");
      return;
    }
    const baseData: Partial<Response> = {
      title: title.trim(),
      content: content.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (isEditing && editingId) {
      // Optimistic update for edit
      const prev = responses;
      const optimistic = responses.map((r) =>
        r.id === editingId ? ({ ...r, ...baseData } as Response) : r
      );
      setResponses(optimistic);
      setSaving(true);
      setNotification("⌛ Saving...");
      try {
        const updated = await updateResponse(editingId, baseData);
        // Ensure state reflects server result
        setResponses((cur) =>
          cur.map((r) => (r.id === editingId ? { ...r, ...updated } : r))
        );
        setShowModal(false);
        setSaving(false);
        setNotification("✓ Updated successfully");
      } catch (e) {
        console.error(e);
        // Rollback
        setResponses(prev);
        setSaving(false);
        setNotification("⚠️ Failed to update");
      }
    } else {
      // Create flow (existing)
      try {
        setSaving(true);
        setNotification("⌛ Saving...");
        await saveResponse(baseData as Response);
        setShowModal(false);
        setTitle("");
        setContent("");
        setTags("");
        await load();
        setNotification("✓ Response saved successfully");
      } catch (e) {
        console.error(e);
        setNotification("⚠️ Failed to save response");
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    if (!confirm("Delete this response permanently?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));

    setTimeout(async () => {
      try {
        await deleteResponse(id);
        await load();
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setNotification("✓ Response deleted");
      } catch (e) {
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setNotification("⚠️ Failed to delete");
      }
    }, 300); // Match animation duration
  }

  async function handleInsert(text: string) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) {
        setNotification("No Active Tab");
        return;
      }

      // Ensure content script is loaded
      try {
        await ensureContentScriptLoaded(tab.id);
      } catch (err) {
        console.error("Failed to inject content script:", err);
        setNotification("⚠️ Failed to load on this page");
        return;
      }

      // Send message and wait for response
      const response = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          chrome.tabs.sendMessage(
            tab.id!,
            { action: "insertResponse", content: text },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
              } else if (!res) {
                resolve({ success: false, error: "No response from page" });
              } else {
                resolve(res);
              }
            }
          );
        }
      );

      if (response.success) {
        setNotification("✓ Inserted successfully");
        setTimeout(() => window.close(), 500);
      } else {
        setNotification(`⚠️ ${response.error || "No input field detected"}`);
      }
    } catch (e) {
      console.error(e);
      setNotification("⚠️ Failed to insert");
    }
  }

  // Add this helper function to ensure content script is loaded
  async function ensureContentScriptLoaded(tabId: number): Promise<void> {
    try {
      // Try to ping the content script first
      const pingResponse = await new Promise<boolean>((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(response?.pong === true);
          }
        });
      });

      if (pingResponse) {
        console.log("Content script already loaded");
        return;
      }

      // Content script not loaded, inject it
      console.log("Injecting content script...");

      // Inject CSS first
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"],
      });

      // Then inject the script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });

      // Wait a bit for script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Content script injected successfully");
    } catch (error) {
      console.error("Error injecting content script:", error);
      throw error;
    }
  }

  // Removed copy functionality
  // async function handleCopy(text: string) {
  //   navigator.clipboard.writeText(text).then(() => {
  //     setNotification("✓ Copied to clipboard");
  //   });
  // }

  return (
    <div className="popup-container">
      {notification && <div className="notification">{notification}</div>}

      <header className="popup-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Canner</h1>
              <p className="brand-subtitle">{responses.length} {responses.length === 1 ? 'response' : 'responses'}</p>
              {debugInfo && <p style={{fontSize: '10px', color: 'orange'}}>{debugInfo}</p>}
              <p className="brand-subtitle">
                {responses.length}{" "}
                {responses.length === 1 ? "response" : "responses"}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              className="btn-new"
              onClick={openCreateModal}
              aria-label="Create new response"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New
            </button>
          </div>
        </div>
      </header>

      <div className="popup-body">
        <div className="search-container">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by title, content, or tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search responses"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="responses-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line short"></div>
                <div className="skeleton-actions">
                  <div className="skeleton-btn"></div>
                  <div className="skeleton-btn"></div>
                  <div className="skeleton-btn"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {query ? (
              <>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <h3>No matches found</h3>
                <p>Try adjusting your search terms</p>
              </>
            ) : (
              <>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <h3>No saved responses</h3>
                <p>Create your first response to get started</p>
                <button className="btn-primary" onClick={openCreateModal}>
                  Create Response
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="responses-list">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`response-card ${
                  deletingIds.has(r.id!) ? "sliding-out" : ""
                }`}
              >
                <div className="card-header">
                  <h3 className="card-title">{r.title}</h3>
                  {Array.isArray(r.tags) && r.tags.length > 0 && (
                    <div className="card-tags">
                      {r.tags.slice(0, 2).map((t: string, i: number) => (
                        <span key={i} className="tag">
                          {t}
                        </span>
                      ))}
                      {r.tags.length > 2 && (
                        <span className="tag-more">+{r.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="card-content">{r.content}</p>
                <div className="card-actions">
                  <button
                    className="btn-action btn-insert"
                    onClick={() => handleInsert(r.content)}
                    aria-label="Insert response"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Insert
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => openEditModal(r)}
                    aria-label="Edit response"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                      <path d="M14.06 4.94l3.75 3.75" />
                    </svg>
                    Edit
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => handleDelete(r.id)}
                    aria-label="Delete response"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="popup-footer">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Press <kbd>Ctrl+Shift+L</kbd> on LinkedIn pages
      </footer>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <h2 id="modal-title">
                {isEditing ? "Edit Response" : "Create Response"}
              </h2>
              <button
                className="btn-close"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="title-input" className="form-label">
                  Title
                </label>
                <input
                  id="title-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g., Introduction message"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="content-input" className="form-label">
                  Content
                </label>
                <textarea
                  id="content-input"
                  className="form-textarea"
                  placeholder="Enter your response message..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tags-input" className="form-label">
                  Tags
                </label>
                <input
                  id="tags-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g., greeting, professional (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                disabled={saving}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving
                  ? isEditing
                    ? "Saving changes..."
                    : "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : "Save Response"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
