import React, { useEffect, useState } from "react";
import {
  activateProfile,
  createProfile,
  deleteProfile,
  deleteResponse,
  getActiveProfile,
  getCurrentUser,
  getProfiles,
  getResponses,
  logout,
  Profile,
  Response, saveResponse, updateResponse,
  User
} from "../utils/api";

const App: React.FC = () => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  
  // Profile form state
  const [profileName, setProfileName] = useState("");
  const [profileTopic, setProfileTopic] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      load();
      loadTheme();
    }
    setAuthChecked(true);
  }, [currentUser]);

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

  async function loadUser() {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      
      if (user) {
        // Load profiles for authenticated user
        const profilesData = await getProfiles();
        setProfiles(profilesData);
        
        const active = await getActiveProfile();
        setActiveProfile(active);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTheme() {
    const result = await chrome.storage.sync.get(["theme"]);
    const theme = result.theme || "light";
    setIsDarkMode(theme === "dark");
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getResponses();
      setResponses(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  function openCreateProfileModal() {
    setProfileName("");
    setProfileTopic("");
    setShowProfileModal(true);
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
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      profile_id: activeProfile?.id
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

  async function handleSaveProfile() {
    if (!profileName.trim() || !profileTopic.trim()) {
      setNotification("⚠️ Profile name and topic are required");
      return;
    }
    
    try {
      const newProfile = await createProfile({
        user_id: currentUser?.id || '',
        profile_name: profileName.trim(),
        topic: profileTopic.trim(),
        is_active: profiles.length === 0 // Make first profile active
      });
      
      setProfiles(prev => [...prev, newProfile]);
      
      if (profiles.length === 0) {
        setActiveProfile(newProfile);
      }
      
      setShowProfileModal(false);
      setProfileName("");
      setProfileTopic("");
      setNotification("✓ Profile created successfully");
    } catch (e) {
      console.error(e);
      setNotification("⚠️ Failed to create profile");
    }
  }

  async function handleActivateProfile(profile: Profile) {
    try {
      const updatedProfile = await activateProfile(profile.id);
      
      // Update profiles list
      setProfiles(prev => prev.map(p => 
        p.id === profile.id ? { ...p, is_active: true } : { ...p, is_active: false }
      ));
      
      setActiveProfile(updatedProfile);
      
      // Reload responses for the new active profile
      await load();
      
      setNotification("✓ Profile activated");
    } catch (e) {
      console.error(e);
      setNotification("⚠️ Failed to activate profile");
    }
  }

  async function handleDeleteProfile(profileId: string) {
    if (!confirm("Delete this profile permanently?")) return;
    
    try {
      await deleteProfile(profileId);
      
      // Update profiles list
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      
      // If we deleted the active profile, set a new active profile
      if (activeProfile?.id === profileId) {
        const remainingProfiles = profiles.filter(p => p.id !== profileId);
        if (remainingProfiles.length > 0) {
          const newActive = remainingProfiles[0];
          await handleActivateProfile(newActive);
        } else {
          setActiveProfile(null);
        }
      }
      
      setNotification("✓ Profile deleted");
    } catch (e) {
      console.error(e);
      setNotification("⚠️ Failed to delete profile");
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
      if (!tab?.id) {
        setNotification("⚠️ No active tab");
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

  async function handleLogout() {
    try {
      await logout();
      setCurrentUser(null);
      setProfiles([]);
      setActiveProfile(null);
      setNotification("✓ Logged out successfully");
    } catch (e) {
      console.error(e);
      setNotification("⚠️ Failed to logout");
    }
  }

  // Auto-refresh after OAuth login
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'oauth-success') {
        // Add a small delay to ensure session is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Aggressively poll a few times to ensure we reflect authenticated state
        let authed = null as User | null;
        for (let i = 0; i < 5; i++) {
          try {
            authed = await getCurrentUser();
            setCurrentUser(authed);
            if (authed) break;
          } catch {}
          await new Promise(r => setTimeout(r, 500));
        }
        if (authed) {
          try {
            // Open a full tab with the extension UI for a better post-login experience
            await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            window.close();
          } catch (e) {
            // If tabs API is unavailable, just keep the current popup
          }
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Also check for auth status periodically in case of popup blocking
  useEffect(() => {
    if (!currentUser) {
      const interval = setInterval(() => {
        loadUser();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Login handlers
  function handleGoogleLogin() {
    window.open('http://localhost:5000/api/auth/login/google', '_blank');
  }

  function handleGitHubLogin() {
    window.open('http://localhost:5000/api/auth/login/github', '_blank');
  }

  // Removed copy functionality
  // async function handleCopy(text: string) {
  //   navigator.clipboard.writeText(text).then(() => {
  //     setNotification("✓ Copied to clipboard");
  //   });
  // }

  if (!authChecked) {
    return (
      <div className="popup-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="popup-container">
        {notification && (
          <div className="notification">{notification}</div>
        )}
        
        <header className="popup-header">
          <div className="header-content">
            <div className="brand-section">
              <div className="brand-logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="brand-text">
                <h1 className="brand-title">Canner</h1>
                <p className="brand-subtitle">AI-powered LinkedIn & Twitter Assistant</p>
              </div>
            </div>
          </div>
        </header>
        
        <div className="popup-body">
          <div className="login-container">
            <div className="login-header">
              <h2>Welcome to Canner</h2>
              <p className="login-description">Sign in to access your personalized response templates and profiles.</p>
            </div>
            
            <div className="login-options">
              <button className="btn-login btn-google" onClick={handleGoogleLogin}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
              
              <button className="btn-login btn-github" onClick={handleGitHubLogin}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" fill="currentColor"/>
                </svg>
                Sign in with GitHub
              </button>
            </div>
            
            <div className="login-info">
              <p className="login-footer">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
              <div className="login-benefits">
                <h3>Why Sign In?</h3>
                <ul>
                  <li>Save and organize your response templates</li>
                  <li>Create topic-based profiles for different use cases</li>
                  <li>Access your templates across devices</li>
                  <li>Personalize your AI assistant experience</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <footer className="popup-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          Press <kbd>Ctrl+Shift+L</kbd> on LinkedIn pages
        </footer>
      </div>
    );
  }

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
              <p className="brand-subtitle">
                {responses.length}{" "}
                {responses.length === 1 ? "response" : "responses"}
              </p>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="user-menu-container">
              <button 
                className="user-avatar" 
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User menu"
              >
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-info">
                    <div className="user-name">{currentUser.name}</div>
                    <div className="user-email">{currentUser.email}</div>
                  </div>
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
            
            <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode">
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
            
            <button className="btn-new" onClick={openCreateModal} aria-label="Create new response">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New
            </button>
          </div>
        </div>
      </header>

      <div className="profile-section">
        <div className="profile-header">
          <h2>Profiles</h2>
          <button className="btn-secondary" style={{ marginLeft: '10px' }} onClick={openCreateProfileModal}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Profile
          </button>
        </div>
        
        <div className="profiles-list">
          {profiles.map(profile => (
            <div 
              key={profile.id} 
              className={`profile-card ${profile.is_active ? 'active' : ''}`}
            >
              <div className="profile-info">
                <h3>{profile.profile_name} {profile.is_active && <span className="profile-label">Active</span>}</h3>
                <p>{profile.topic}</p>
              </div>
              <div className="profile-actions">
                {!profile.is_active && (
                  <button 
                    className="btn-action btn-activate"
                    onClick={() => handleActivateProfile(profile)}
                  >
                    Activate
                  </button>
                )}
                <button 
                  className="btn-action btn-delete"
                  onClick={() => handleDeleteProfile(profile.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              {activeProfile && (
                <div className="form-group">
                  <label className="form-label">Profile</label>
                  <div className="profile-info-small">
                    <span className="profile-name">{activeProfile.profile_name}</span>
                    <span className="profile-topic">({activeProfile.topic})</span>
                  </div>
                </div>
              )}
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
      
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="modal-header">
              <h2 id="profile-modal-title">Create Profile</h2>
              <button className="btn-close" onClick={() => setShowProfileModal(false)} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="profile-name-input" className="form-label">Profile Name</label>
                <input
                  id="profile-name-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g., AI Assistant"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="profile-topic-input" className="form-label">Topic</label>
                <input
                  id="profile-topic-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g., Artificial Intelligence"
                  value={profileTopic}
                  onChange={(e) => setProfileTopic(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveProfile}>
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;