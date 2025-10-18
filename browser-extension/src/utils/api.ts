// API utility for communicating with backend and Chrome storage

const API_URL = "http://localhost:5000";

export interface Response {
  id?: string;
  title: string;
  content: string;
  tags?: string[] | string;
  usage_count?: number;
  custom_order?: number;
  created_at?: string;
}

// Try backend first, fall back to Chrome storage
export async function getResponses(): Promise<Response[]> {
  try {
    // Try backend
    const response = await fetch(`${API_URL}/api/responses`);
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

export async function trackUsage(id: string): Promise<void> {
  try {
    const result = await fetch(`${API_URL}/api/responses/${id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (result.ok) {
      const responses = await getResponses();
      const updatedResponses = responses.map(r => 
        r.id === id ? { ...r, usage_count: (r.usage_count || 0) + 1 } : r
      );
      chrome.storage.local.set({ responses: updatedResponses });
      return;
    }
  } catch (error) {
    console.log("Backend not available, updating local storage");
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const updatedResponses = responses.map((r: Response) => 
        r.id === id ? { ...r, usage_count: (r.usage_count || 0) + 1 } : r
      );
      chrome.storage.local.set({ responses: updatedResponses }, () => {
        resolve();
      });
    });
  });
}
