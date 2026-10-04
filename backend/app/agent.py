import operator
from typing import TypedDict, Annotated
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from app.database import execute_cypher_retrieval
import os
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# 1. 定义状态图数据结构 (State Definition)
# ==========================================
class AgentState(TypedDict):
    query: str                      # 用户的原始自然语言查询 (User Query)
    entities: list[str]             # 提取的地质实体 (Extracted Geological Entities)
    graph_context: list[dict]       # 检索到的图谱上下文 (Retrieved Graph Context)
    final_response: str             # 最终生成的专业回答 (Final Generation)

# 初始化 LLM (使用 Gemini)
llm = ChatGoogleGenerativeAI(
    model="gemini-3.8-flash", 
    temperature=0, 
    google_api_key=os.getenv("GEMINI_API_KEY", "dummy-key")
)

# ==========================================
# 2. 定义节点功能 (Node Functions)
# ==========================================

def content_text(content) -> str:
    """Gemini 可能返回字符串或分块列表 (Gemini content may be a str or a list of parts)"""
    if isinstance(content, list):
        return "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
    return content

def extract_entities(state: AgentState) -> AgentState:
    """
    节点 1: 意图解析 (Intent Parsing & Entity Extraction)
    利用 LLM 从自然语言中提取关键的地质断裂、地层、矿种等实体。
    """
    prompt = f"""
    你是一个资深地质信息提取专家。请从以下用户的地质勘探查询中，提取出关键的地质实体（如断裂带名称、地层、金属/矿物类型）。
    只返回实体列表，用逗号分隔，不要有多余的解释。
    
    用户查询: {state['query']}
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    # 简单的后处理切分
    content_str = content_text(response.content)
    entities = [e.strip() for e in content_str.split(",") if e.strip()]
    
    return {"entities": entities}

def graph_retrieval(state: AgentState) -> AgentState:
    """
    节点 2: 知识图谱多跳检索 (Knowledge Graph Multi-hop Retrieval)
    根据提取的实体向 Neo4j 发送 Cypher 查询，获取拓扑事实。
    """
    entities = state.get("entities", [])
    context = execute_cypher_retrieval(entities)

    return {"graph_context": context}

def generate_response(state: AgentState) -> AgentState:
    """
    节点 3: 响应生成 (Response Generation with Citations)
    融合检索到的图谱结构化知识，进行严谨的推理生成，杜绝幻觉。
    """
    response = llm.invoke([HumanMessage(content=build_generation_prompt(state))])
    return {"final_response": content_text(response.content)}

def build_generation_prompt(state: AgentState) -> str:
    # score 是检索内部打分，不交给模型 (score is internal retrieval ranking, not a geological fact)
    facts = [{k: v for k, v in item.items() if k != "score"} for item in state.get("graph_context", [])]
    context_str = "\n".join(str(item) for item in facts) or "（无匹配记录 / No matching records）"

    return f"""
    你是一名国家级资深地质勘探专家。请依据以下【经过知识图谱严格验证的客观事实】来回答用户问题，严禁编造（Zero Hallucination）。
    
    [图谱拓扑事实]:
    {context_str}
    
    [用户问题]: {state['query']}
    
    【生成要求】:
    1. 必须逐条清晰列出推理逻辑（例如：地层赋存 -> 断裂控制 -> 热液侵入）。
    2. 若图谱事实中包含靶区或钻孔信息则明确指出；图谱中没有的靶区、钻孔编号一律不得编造。
    3. 在结论或事实的段落末尾，必须严格注明引用来源，格式为 [文献名称，页码]。
    4. 语气专业、严谨，符合工业级报告标准。
    5. 如果图谱事实为“无匹配记录”，请直接说明知识图谱中没有相关数据，不得给出推理、靶区或任何引用来源。
    """


# ==========================================
# 3. 编排并编译工作流 (Graph Orchestration)
# ==========================================
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("extract_entities", extract_entities)
workflow.add_node("graph_retrieval", graph_retrieval)
workflow.add_node("generate_response", generate_response)

# 定义边（执行流向）
workflow.set_entry_point("extract_entities")
workflow.add_edge("extract_entities", "graph_retrieval")
workflow.add_edge("graph_retrieval", "generate_response")
workflow.add_edge("generate_response", END)

# 编译图为可执行应用
geograph_agent = workflow.compile()
