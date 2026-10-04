import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

# 加载环境变量 (Load Environment Variables)
load_dotenv()

class Neo4jConnection:
    """
    Neo4j 数据库连接单例 (Singleton for Neo4j Database Connection)
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Neo4jConnection, cls).__new__(cls)
            uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            user = os.getenv("NEO4J_USERNAME", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "password")
            cls._instance.driver = GraphDatabase.driver(uri, auth=(user, password))
        return cls._instance

    def close(self):
        """关闭数据库连接 (Close Database Connection)"""
        if self.driver:
            self.driver.close()

    def query(self, cypher_query: str, parameters: dict = None):
        """
        执行 Cypher 查询并返回结果 (Execute Cypher query and return records)
        """
        with self.driver.session() as session:
            result = session.run(cypher_query, parameters or {})
            return [record.data() for record in result]


def execute_cypher_retrieval(query_entities: list[str]) -> list[dict]:
    """
    基于提取的地质实体进行图谱多跳检索。
    检索目标: 匹配目标断裂带(Fault)或地层(Stratum)所控制/赋存的矿体(Deposit)，及其相关的地球化学异常(GeochemAnomaly)和历史文献来源(ReportSource)。
    """
    if not query_entities:
        return []

    conn = Neo4jConnection()
    
    # 构建包含 OR 逻辑的动态查询匹配
    # 这里为了原型演示，采用基础的 CONTAINS 匹配。实际工程中可使用向量索引或全文本搜索。
    cypher_query = """
    MATCH (f:Fault)-[:CONTROLLED_BY]-(d:Deposit)-[:HOSTED_IN]-(s:Stratum)
    WHERE any(entity IN $entities WHERE f.name CONTAINS entity OR s.name CONTAINS entity OR d.name CONTAINS entity)
    OPTIONAL MATCH (d)-[:CITED_FROM]->(r:ReportSource)
    OPTIONAL MATCH (d)-[:ASSOCIATED_WITH]->(i:IntrusiveRock)
    RETURN 
        f.name AS fault, 
        d.name AS deposit, 
        d.metal_type AS metal, 
        s.name AS stratum, 
        i.name AS intrusive_rock,
        r.title AS source_doc, 
        r.page_number AS page
    LIMIT 10
    """
    
    try:
        records = conn.query(cypher_query, parameters={"entities": query_entities})
        return records
    except Exception as e:
        print(f"Neo4j query failed, returning no records. Error: {e}")
        return []
