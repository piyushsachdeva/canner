import React, { useState, useEffect } from "react";
import {
  getResponses,
  saveResponse,
  deleteResponse,
  updateResponse,
  Response,
} from "../utils/api";

type SortOption = "date" | "alphabetical" | "most-used" | "custom";

function App() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [filteredResponses, setFilteredResponses] = useState<Response[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem('canner-sort-by') as SortOption) || 'date';
  });

  // New response form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    loadResponses();
  }, []);

  useEffect(() => {
    filterAndSortResponses();
  }, [searchQuery, responses, sortBy]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const data = await getResponses();
      setResponses(data);
    } catch (error) {
      console.error("Error loading responses:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortResponses = () => {
    let filtered = responses;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = responses.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.content.toLowerCase().includes(query) ||
          r.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date":
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;

        case "alphabetical":
          return a.title.localeCompare(b.title);

        case "most-used":
          const usageA = a.usage_count || 0;
          const usageB = b.usage_count || 0;
          if (usageA !== usageB) {
            return usageB - usageA;
          }
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

        case "custom":
          const orderA = a.custom_order || 0;
          const orderB = b.custom_order || 0;
          return orderA - orderB;

        default:
          return 0;
      }
    });

    setFilteredResponses(sorted);
  };

  const handleSaveNew = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      alert("Please enter both title and content");
      return;
    }

    try {
      const newResponse: Response = {
        title: newTitle.trim(),
        content: newContent.trim(),
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
      };

      await saveResponse(newResponse);
      await loadResponses();

      setNewTitle("");
      setNewContent("");
      setNewTags("");
      setShowNewForm(false);
    } catch (error) {
      console.error("Error saving response:", error);
      alert("Failed to save response");
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
      if (response.id) {
        const newUsageCount = (response.usage_count || 0) + 1;
        await updateResponse(response.id, { usage_count: newUsageCount });

        setResponses(prev => prev.map(r => 
          r.id === response.id ? { ...r, usage_count: newUsageCount } : r
        ));
      }

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
              window.close();
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
        <div className="sort-section">
          <label className="sort-label">Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="sort-select"
          >
            <option value="date">📅 Date Created</option>
            <option value="alphabetical">🔤 Alphabetical</option>
            <option value="most-used">📈 Most Used</option>
            <option value="custom">🎯 Custom Order</option>
          </select>
        </div>

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
            <button onClick={handleSaveNew} className="btn-save">
              Save Response
            </button>
          </div>
        )}

        {/* Responses List */}
        <div className="responses-list">
          {loading ? (
            <div className="loading">Loading...</div>
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
                {response.tags && response.tags.length > 0 && (
                  <div className="response-tags">
                    {response.tags.map((tag, idx) => (
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
