import json
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent import geograph_agent, extract_entities, graph_retrieval, build_generation_prompt, content_text, llm
from app.database import fetch_graph_stats, fetch_all_deposits
from langchain_core.messages import HumanMessage

# ==========================================
# 1. API 实例初始化配置 (FastAPI Initialization)
# ==========================================
app = FastAPI(
    title="GeoGraph-RAG Backend API",
    description="后端核心推理引擎：结合知识图谱 (Neo4j) 与大语言模型的多模态空间预测系统",
    version="1.0.0"
)

# 配置 CORS 允许前端跨域调用 (Allowing Next.js frontend to call this API)
app.add_middleware(
    CORSMiddleware,
    # 逗号分隔的允许来源 (Comma-separated allowed origins, e.g. the deployed frontend URL)
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. 数据验证模型 (Pydantic Models)
# ==========================================
class ChatRequest(BaseModel):
    query: str

class GraphRecord(BaseModel):
    fault: str | None = None
    deposit: str | None = None
    metal: str | None = None
    stratum: str | None = None
    intrusive_rock: str | None = None
    source_doc: str | None = None
    page: int | None = None
    lat: float | None = None
    lon: float | None = None

class ChatResponse(BaseModel):
    reasoning_chain: list[str]
    prediction: str
    graph_records: list[GraphRecord]
    geo_coordinates: dict
    confidence: float

# ==========================================
# 3. 路由与端点 (API Routes)
# ==========================================
@app.get("/api/v1/health")
def health_check():
    """系统健康检查 (Health Check Endpoint)"""
    return {"status": "healthy", "engine": "GeoGraph-RAG Active"}

def target_polygon(records: list[GraphRecord], pad: float = 0.1) -> dict:
    """匹配矿床外包矩形作为预测靶区 (Padded bounding box around matched deposits, GeoJSON [lon, lat])"""
    points = [(r.lon, r.lat) for r in records if r.lat is not None and r.lon is not None]
    if not points:
        return {"type": "Polygon", "coordinates": []}
    lons, lats = zip(*points)
    w, e, s, n = min(lons) - pad, max(lons) + pad, min(lats) - pad, max(lats) + pad
    return {"type": "Polygon", "coordinates": [[[w, n], [e, n], [e, s], [w, s], [w, n]]]}

def match_confidence(entities: list[str], graph_context: list[dict]) -> float:
    """命中实体占比：最佳匹配矿床命中的查询实体数 / 实体总数 (Share of query entities matched by the best deposit)"""
    if not entities or not graph_context:
        return 0.0
    return round(min(max(rec.get("score", 0) for rec in graph_context) / len(entities), 1.0), 3)

def to_graph_records(graph_context: list[dict]) -> list[GraphRecord]:
    return [GraphRecord(**{k: v for k, v in rec.items() if k in GraphRecord.model_fields}) for rec in graph_context]

@app.get("/api/v1/stats")
def stats():
    """知识库实时规模 (Live knowledge-graph counts)"""
    return fetch_graph_stats()

@app.get("/api/v1/deposits", response_model=list[GraphRecord])
def deposits():
    """全部带坐标矿床 (All deposits with coordinates, for the map's opening view)"""
    return to_graph_records(fetch_all_deposits())

@app.post("/api/v1/chat/stream")
def chat_stream(request: ChatRequest):
    """
    流式接口 (NDJSON): 先返回检索结果 {"type": "context", ...}，再逐段返回回答 {"type": "token", "text"}，最后 {"type": "done"}。
    """
    def events():
        state = {"query": request.query}
        state.update(extract_entities(state))
        state.update(graph_retrieval(state))
        records = to_graph_records(state["graph_context"])
        yield json.dumps({
            "type": "context",
            "reasoning_chain": state["entities"],
            "graph_records": [r.model_dump() for r in records],
            "geo_coordinates": target_polygon(records),
            "confidence": match_confidence(state["entities"], state["graph_context"]),
        }, ensure_ascii=False) + "\n"
        for chunk in llm.stream([HumanMessage(content=build_generation_prompt(state))]):
            text = content_text(chunk.content)
            if text:
                yield json.dumps({"type": "token", "text": text}, ensure_ascii=False) + "\n"
        yield json.dumps({"type": "done"}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")

@app.post("/api/v1/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    核心业务接口：接收地质查询，通过 LangGraph 编排进行实体提取、图谱多跳检索及推理生成。
    """
    initial_state = {"query": request.query}
    result_state = geograph_agent.invoke(initial_state)

    entities = result_state.get("entities", [])
    graph_context = result_state.get("graph_context", [])

    graph_records = to_graph_records(graph_context)

    return ChatResponse(
        reasoning_chain=entities,
        prediction=result_state.get("final_response", ""),
        graph_records=graph_records,
        geo_coordinates=target_polygon(graph_records),
        confidence=match_confidence(entities, graph_context),
    )

if __name__ == "__main__":
    import uvicorn
    # 本地启动测试服务器
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
