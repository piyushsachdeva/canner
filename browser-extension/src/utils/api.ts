// API utility for communicating with backend and Chrome storage

const API_URL = "http://localhost:5000";

export interface Response {
  id?: string;
  title: string;
  content: string;
  tags?: string[] | string;
  profile_id?: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  profile_name: string;
  topic: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
  avatar_url?: string;
  created_at?: string;
}

// Try backend first, fall back to Chrome storage
export async function getResponses(): Promise<Response[]> {
  try {
    // Try backend
    const response = await fetch(`${API_URL}/api/responses`, {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      // Cache in Chrome storage
      chrome.storage.local.set({ responses: data });
      return data;
    }
  } catch (error) {
    console.log("Backend not available, using local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = (result.responses || []).map((r: any) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : (r.tags ? [r.tags] : [])
      }));
      resolve(responses);
    });
  });
}

export async function updateResponse(id: string, data: Partial<Response>): Promise<Response> {
  try {
    // Try backend with PATCH first, fall back to PUT if needed
    const result = await fetch(`${API_URL}/api/responses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (result.ok) {
      const updated = await result.json();
      // Sync Chrome storage cache
      const current = await getResponses();
      const next = current.map((r) => (r.id === id ? { ...r, ...updated } : r));
      chrome.storage.local.set({ responses: next });
      return updated;
    }
  } catch (error) {
    console.log("Backend not available, updating local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses: Response[] = (result.responses || []).map((r: any) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : [],
      }));
      const next = responses.map((r) => (r.id === id ? { ...r, ...data } as Response : r));
      chrome.storage.local.set({ responses: next }, () => {
        const updated = next.find((r) => r.id === id)!;
        resolve(updated);
      });
    });
  });
}

export async function saveResponse(response: Response): Promise<Response> {
  try {
    // Try backend
    const result = await fetch(`${API_URL}/api/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
      credentials: 'include'
    });

    if (result.ok) {
      const saved = await result.json();
      // Update Chrome storage
      const responses = await getResponses();
      responses.push(saved);
      chrome.storage.local.set({ responses });
      return saved;
    }
  } catch (error) {
    console.log("Backend not available, saving to local storage");
  }

  // Fallback to Chrome storage
  const id = `lh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const savedResponse = {
    ...response,
    id,
    created_at: new Date().toISOString(),
    tags: Array.isArray(response.tags) ? response.tags : (response.tags ? [response.tags] : [])
  };

  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      responses.push(savedResponse);
      chrome.storage.local.set({ responses }, () => {
        resolve(savedResponse);
      });
    });
  });
}

export async function deleteResponse(id: string): Promise<void> {
  try {
    // Try backend
    const result = await fetch(`${API_URL}/api/responses/${id}`, {
      method: "DELETE",
      credentials: 'include'
    });

    if (result.ok) {
      // Update Chrome storage
      const responses = await getResponses();
      const filtered = responses.filter((r) => r.id !== id);
      chrome.storage.local.set({ responses: filtered });
      return;
    }
  } catch (error) {
    console.log("Backend not available, deleting from local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const filtered = responses.filter((r: Response) => r.id !== id);
      chrome.storage.local.set({ responses: filtered }, () => {
        resolve();
      });
    });
  });
}

// Profile management functions
export async function getProfiles(): Promise<Profile[]> {
  try {
    const response = await fetch(`${API_URL}/api/profiles`, {
      credentials: 'include'
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Backend not available for profiles");
  }
  
  return [];
}

export async function getActiveProfile(): Promise<Profile | null> {
  try {
    const response = await fetch(`${API_URL}/api/profiles/active`, {
      credentials: 'include'
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Backend not available for active profile");
  }
  
  return null;
}

export async function createProfile(profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
  try {
    const response = await fetch(`${API_URL}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
      credentials: 'include'
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Backend not available for profile creation");
  }
  
  // Return a mock profile for fallback
  return {
    id: `profile-${Date.now()}`,
    user_id: 'user-1',
    profile_name: profile.profile_name,
    topic: profile.topic,
    is_active: false,
    created_at: new Date().toISOString()
  } as Profile;
}

export async function activateProfile(profileId: string): Promise<Profile> {
  try {
    const response = await fetch(`${API_URL}/api/profiles/${profileId}/activate`, {
      method: "POST",
      credentials: 'include'
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Backend not available for profile activation");
  }
  
  // Return a mock profile for fallback
  return {
    id: profileId,
    user_id: 'user-1',
    profile_name: 'Default Profile',
    topic: 'General',
    is_active: true,
    updated_at: new Date().toISOString()
  } as Profile;
}

export async function deleteProfile(profileId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/profiles/${profileId}`, {
      method: "DELETE",
      credentials: 'include'
    });
    
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.log("Backend not available for profile deletion");
  }
}

// Authentication functions
export async function getCurrentUser(): Promise<User | null> {
  try {
    console.log('getCurrentUser: Making request to', `${API_URL}/api/auth/user`);
    const response = await fetch(`${API_URL}/api/auth/user`, {
      credentials: 'include'
    });
    console.log('getCurrentUser: Response status:', response.status);
    console.log('getCurrentUser: Response headers:', response.headers);
    
    if (response.ok) {
      const user = await response.json();
      console.log('getCurrentUser: Success, user:', user);
      return user;
    } else {
      const errorText = await response.text();
      console.log('getCurrentUser: Error response:', errorText);
    }
  } catch (error) {
    console.log("getCurrentUser: Backend not available for user info", error);
  }
  
  return null;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "GET",
      credentials: 'include'
    });
  } catch (error) {
    console.log("Backend not available for logout");
  }
}
