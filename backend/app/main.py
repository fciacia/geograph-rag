from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent import geograph_agent

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
    allow_origins=["*"], # 在生产环境中请指定明确的来源，如 "http://localhost:3000"
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

@app.post("/api/v1/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    核心业务接口：接收地质查询，通过 LangGraph 编排进行实体提取、图谱多跳检索及推理生成。
    """
    initial_state = {"query": request.query}
    result_state = geograph_agent.invoke(initial_state)

    entities = result_state.get("entities", [])
    graph_context = result_state.get("graph_context", [])

    # Dynamic confidence: more entities matched = higher confidence (capped at 0.97)
    base_confidence = 0.82
    confidence = min(base_confidence + len(entities) * 0.02, 0.97)

    graph_records = [GraphRecord(**{k: v for k, v in rec.items() if k in GraphRecord.model_fields}) for rec in graph_context]

    return ChatResponse(
        reasoning_chain=entities,
        prediction=result_state.get("final_response", ""),
        graph_records=graph_records,
        geo_coordinates={
            "type": "Polygon",
            "coordinates": [
                [[109.213, 23.456], [109.220, 23.450], [109.218, 23.440], [109.210, 23.445], [109.213, 23.456]]
            ]
        },
        confidence=round(confidence, 3),
    )

if __name__ == "__main__":
    import uvicorn
    # 本地启动测试服务器
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
