import React, { useState, useEffect } from "react";
import {
  getResponses,
  saveResponse,
  deleteResponse,
  Response,
} from "../utils/api";
import { FaSpinner } from "react-icons/fa";

function App() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [filteredResponses, setFilteredResponses] = useState<Response[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // New response form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    loadResponses();
  }, []);

  useEffect(() => {
    filterResponses();
  }, [searchQuery, responses]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const data = await getResponses();
      setResponses(data);
      setFilteredResponses(data);
    } catch (error) {
      console.error("Error loading responses:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterResponses = () => {
    if (!searchQuery.trim()) {
      setFilteredResponses(responses);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = responses.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query) ||
        (r.tags && Array.isArray(r.tags) 
          ? r.tags.some((tag: string) => tag.toLowerCase().includes(query))
          : typeof r.tags === 'string' && r.tags.toLowerCase().includes(query))
    );
    setFilteredResponses(filtered);
  };

  const handleSaveNew = async () => {
  if (!newTitle.trim() || !newContent.trim()) {
    alert("Please enter both title and content");
    return;
  }

  setSaving(true); // Start spinner

  try {
    const newResponse = {
      title: newTitle.trim(),
      content: newContent.trim(),
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
    };

    await saveResponse(newResponse);
    await loadResponses();

    // Reset form
    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setShowNewForm(false);
  } catch (error) {
    console.error("Error saving response:", error);
    alert("Failed to save response");
  } finally {
    setSaving(false); // ✅ Always stop spinner
  }
};

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this response?")) {
      try {
        await deleteResponse(id);
        await loadResponses();
      } catch (error) {
        console.error("Error deleting response:", error);
        alert("Failed to delete response");
      }
    }
  };

  const handleInsert = async (response: Response) => {
    try {
      // Send message to content script to insert the response
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "insertResponse",
            content: response.content,
          },
          (response) => {
            if (response?.success) {
              window.close(); // Close popup after successful insertion
            } else {
              alert("Please click on a LinkedIn message box first");
            }
          }
        );
      }
    } catch (error) {
      console.error("Error inserting response:", error);
      alert("Failed to insert response");
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    alert("Copied to clipboard!");
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>💼 Canner</h1>
        <p>Your saved responses library</p>
      </header>

      <div className="popup-content">
        {/* Search Bar */}
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="btn-new"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            {showNewForm ? "✕ Cancel" : "➕ New"}
          </button>
        </div>

        {/* New Response Form */}
        {showNewForm && (
          <div className="new-form">
            <input
              type="text"
              placeholder="Title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="form-input"
            />
            <textarea
              placeholder="Content *"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="form-textarea"
              rows={4}
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="form-input"
            />
           <button onClick={handleSaveNew} className="btn-save" disabled={saving}>
            {saving ? (
            <FaSpinner className="spinner-icon" />
             ) : (
              "Save Response"
                 )}
             </button>
          </div>
        )}

        {/* Responses List */}
        <div className="responses-list">
          {loading ? (
             <div className="skeleton-container">
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton-card">
          <div className="skeleton-title"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
          <div className="skeleton-tags">
            <div className="skeleton-tag"></div>
            <div className="skeleton-tag"></div>
          </div>
        </div>
      ))}
    </div>
          ) : filteredResponses.length === 0 ? (
            <div className="empty">
              <p>📭 No responses found</p>
              <p className="empty-sub">Create your first response!</p>
            </div>
          ) : (
            filteredResponses.map((response) => (
              <div key={response.id} className="response-card">
                <div className="response-title">{response.title}</div>
                <div className="response-content">{response.content}</div>
                {response.tags && (
                  <div className="response-tags">
                    {(Array.isArray(response.tags) ? response.tags : [response.tags])
                      .filter(Boolean)
                      .map((tag, idx) => (
                        <span key={idx} className="tag">
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
                <div className="response-actions">
                  <button
                    onClick={() => handleInsert(response)}
                    className="btn-action btn-insert"
                    title="Insert into LinkedIn"
                  >
                    📝 Insert
                  </button>
                  <button
                    onClick={() => handleCopy(response.content)}
                    className="btn-action btn-copy"
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => response.id && handleDelete(response.id)}
                    className="btn-action btn-delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="popup-footer">
        <small>Tip: Use Ctrl+Shift+L on LinkedIn pages</small>
      </footer>
    </div>
  );
}

export default App;
