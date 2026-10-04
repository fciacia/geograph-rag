"""
示例数据导入脚本 (Seed Neo4j with SAMPLE data for local demos)

所有数据均为虚构示例，不代表真实地质勘查成果。
All records are fictional and labelled "示例" so they are never mistaken for real survey data.

用法 (Usage), from the backend/ folder:
    .venv/bin/python -m app.seed
"""
from app.database import Neo4jConnection

# (fault, deposit, metal_type, stratum, intrusive_rock, report_title, page)
SAMPLE_RECORDS = [
    ("F3断裂带", "F3-1 金矿化点", "Au (Gold)", "寒武系地层", "花岗斑岩", "示例勘查报告A", 12),
    ("F3断裂带", "F3-2 稀土矿化区", "REE (Rare Earth)", "二叠系地层", "花岗闪长岩", "示例勘查报告A", 27),
    ("F3断裂带", "ZK-01 镓矿化靶区", "Ga (Gallium)", "二叠系地层", "花岗闪长岩", "示例勘查报告B", 8),
    ("F5断裂带", "F5-1 铜钼矿化点", "Cu-Mo (Copper-Molybdenum)", "泥盆系地层", "石英闪长斑岩", "示例勘查报告B", 33),
    ("F7断裂带", "F7-1 铅锌矿化点", "Pb-Zn (Lead-Zinc)", "石炭系灰岩", None, "示例勘查报告C", 5),
]

SEED_QUERY = """
MERGE (f:Fault {name: $fault})
MERGE (d:Deposit {name: $deposit})
  SET d.metal_type = $metal, d.is_sample = true
MERGE (s:Stratum {name: $stratum})
MERGE (r:ReportSource {title: $report, page_number: $page})
MERGE (d)-[:CONTROLLED_BY]->(f)
MERGE (d)-[:HOSTED_IN]->(s)
MERGE (d)-[:CITED_FROM]->(r)
WITH d
WHERE $intrusive IS NOT NULL
MERGE (i:IntrusiveRock {name: $intrusive})
MERGE (d)-[:ASSOCIATED_WITH]->(i)
"""


def seed():
    conn = Neo4jConnection()
    for fault, deposit, metal, stratum, intrusive, report, page in SAMPLE_RECORDS:
        conn.query(SEED_QUERY, {
            "fault": fault, "deposit": deposit, "metal": metal, "stratum": stratum,
            "intrusive": intrusive, "report": report, "page": page,
        })
    count = conn.query("MATCH (d:Deposit {is_sample: true}) RETURN count(d) AS n")[0]["n"]
    print(f"Seeded {count} sample deposits.")
    conn.close()


if __name__ == "__main__":
    seed()
