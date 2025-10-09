// API utility for communicating with backend and Chrome storage

const API_URL = "http://localhost:5000";

export interface Response {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  created_at?: string;
  usage_count?: number;
  custom_order?: number;
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
      resolve(result.responses || []);
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
      // Cache in Chrome storage
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
    usage_count: response.usage_count || 0,
    custom_order: response.custom_order || 0,
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

export async function updateResponse(id: string, updates: Partial<Response>): Promise<Response> {
  try {
    // Try backend
    const result = await fetch(`${API_URL}/api/responses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (result.ok) {
      const updated = await result.json();
      // Update Chrome storage
      const responses = await getResponses();
      const index = responses.findIndex(r => r.id === id);
      if (index !== -1) {
        responses[index] = updated;
        chrome.storage.local.set({ responses });
      }
      return updated;
    }
  } catch (error) {
    console.log("Backend not available, updating local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const index = responses.findIndex((r: Response) => r.id === id);
      if (index !== -1) {
        responses[index] = { ...responses[index], ...updates };
        chrome.storage.local.set({ responses }, () => {
          resolve(responses[index]);
        });
      } else {
        throw new Error("Response not found");
      }
    });
  });
}
