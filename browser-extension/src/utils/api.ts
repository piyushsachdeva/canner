// API utility for communicating with backend and Chrome storage

const API_URL = "http://localhost:8000";

export interface Response {
  id?: string;
  title: string;
  content: string;
  tags?: string[] | string;
  created_at?: string;
}

// Try backend first, fall back to Chrome storage
export async function getResponses(): Promise<Response[]> {
  try {
    console.log("🔍 Attempting to fetch from backend:", `${API_URL}/responses/`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_URL}/responses/`, {
      signal: controller.signal,
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    console.log("📡 Backend response status:", response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Backend data received:", data.length, "responses");
      // Cache in Chrome storage for offline access
      chrome.storage.local.set({ responses: data, lastSync: new Date().toISOString() });
      return data;
    } else {
      console.log("❌ Backend response not ok:", response.status);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log("❌ Backend fetch error:", error || error);
    console.log("🔄 Falling back to local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses", "lastSync"], (result) => {
      let responses = (result.responses || []).map((r: any) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : (r.tags ? [r.tags] : [])
      }));
      
      // If no cached data, provide some default responses
      if (responses.length === 0) {
        console.log("💾 No local storage data found, providing default responses");
        responses = [
          {
            id: "default-1",
            title: "Connection Request",
            content: "Hi {{name}}, I'd love to connect and learn more about your work in {{industry}}.",
            tags: ["linkedin", "networking", "connection"],
            created_at: new Date().toISOString()
          },
          {
            id: "default-2", 
            title: "Thank You Message",
            content: "Thank you for connecting! I appreciate the opportunity to expand my network.",
            tags: ["networking", "gratitude", "professional"],
            created_at: new Date().toISOString()
          }
        ];
        // Save defaults to storage
        chrome.storage.local.set({ responses });
      }
      
      console.log("💾 Local storage responses:", responses.length);
      if (result.lastSync) {
        console.log("🕐 Last sync:", result.lastSync);
      }
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
    const result = await fetch(`${API_URL}/responses/`, {
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

export async function updateResponse(id: string, response: Partial<Response>): Promise<Response | null> {
  try {
    // Try backend
    const result = await fetch(`${API_URL}/responses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });

    if (result.ok) {
      const updated = await result.json();
      // Update Chrome storage
      const responses = await getResponses();
      const index = responses.findIndex((r) => r.id === id);
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
        const updated = {
          ...responses[index],
          ...response,
          updated_at: new Date().toISOString(),
        };
        responses[index] = updated;
        chrome.storage.local.set({ responses }, () => {
          resolve(updated);
        });
      } else {
        resolve(null);
      }
    });
  });
}

export async function deleteResponse(id: string): Promise<void> {
  try {
    // Try backend
    const result = await fetch(`${API_URL}/responses/${id}`, {
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
