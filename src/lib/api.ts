export interface GraphRecord {
  fault?: string;
  deposit?: string;
  metal?: string;
  stratum?: string;
  intrusive_rock?: string;
  source_doc?: string;
  page?: number;
}

export interface ChatResponse {
  reasoning_chain: string[];
  prediction: string;
  graph_records: GraphRecord[];
  geo_coordinates: {
    type: string;
    coordinates: number[][][];
  };
  confidence: number;
}

const API_BASE = "http://localhost:8000/api/v1";

export async function sendChatQuery(query: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  return response.json();
}
