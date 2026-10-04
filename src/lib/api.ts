export interface GraphRecord {
  fault?: string;
  deposit?: string;
  metal?: string;
  stratum?: string;
  intrusive_rock?: string;
  source_doc?: string;
  page?: number;
  lat?: number;
  lon?: number;
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

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

export async function sendChatQuery(query: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  return response.json();
}

export interface ChatContext {
  reasoning_chain: string[];
  graph_records: GraphRecord[];
  geo_coordinates: ChatResponse["geo_coordinates"];
  confidence: number;
}

/** Streams NDJSON from the backend: one "context" event (retrieval results), then "token" events, then "done". */
export async function streamChatQuery(
  query: string,
  handlers: { onContext: (ctx: ChatContext) => void; onToken: (text: string) => void },
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok || !response.body) throw new Error(`Server error: ${response.status}`);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "context") handlers.onContext(event);
      else if (event.type === "token") handlers.onToken(event.text);
      else if (event.type === "done") finished = true;
    }
  }
  if (!finished) throw new Error("Answer stream ended early.");
}

export interface GraphStats {
  nodes: number;
  relationships: number;
  deposits: number;
  reports: number;
}

export async function fetchStats(): Promise<GraphStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  return response.json();
}

export async function fetchDeposits(): Promise<GraphRecord[]> {
  const response = await fetch(`${API_BASE}/deposits`);
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  return response.json();
}
