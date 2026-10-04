"""
示例数据导入脚本 (Seed Neo4j with SIMULATED data for demos)

矿床名称与大致位置取自公开资料中的广西知名矿床；坐标为近似值，演示前请用 Mindat 核对。
断裂、地层归属为简化示意；所有勘查报告均为模拟（标题含“模拟版”），不代表真实勘查成果。

Deposit names/locations are well-known public Guangxi deposits with APPROXIMATE coordinates.
Report sources are simulated and labelled "模拟版" so they are never mistaken for real survey data.

用法 (Usage), from the backend/ folder:
    .venv/bin/python -m app.seed
"""
from app.database import Neo4jConnection

DEPOSITS = [
    {
        "name": "南丹大厂锡多金属矿田", "metal": "Sn-Zn-Pb-Sb-In (锡·锌·铅·锑·伴生铟)",
        "lat": 24.85, "lon": 107.58,
        "keywords": ["南丹", "大厂", "锡", "铟", "锑", "锌", "铅", "多金属", "丹池"],
        "fault": "丹池断裂带", "stratum": "泥盆系地层", "intrusive": "笼箱盖黑云母花岗岩",
        "reports": [("《南丹大厂锡多金属矿田勘查报告（模拟版，1986）》", 42),
                    ("《大厂矿田伴生铟资源评价（模拟版，2009）》", 17)],
    },
    {
        "name": "南丹芒场锡锑矿", "metal": "Sn-Sb (锡·锑)",
        "lat": 25.00, "lon": 107.50,
        "keywords": ["南丹", "芒场", "锡", "锑", "丹池"],
        "fault": "丹池断裂带", "stratum": "泥盆系地层", "intrusive": None,
        "reports": [("《南丹芒场锡锑矿普查报告（模拟版，1992）》", 23)],
    },
    {
        "name": "平果铝土矿", "metal": "Al (铝土矿) · 伴生 Ga (镓)",
        "lat": 23.45, "lon": 107.55,
        "keywords": ["平果", "铝", "铝土矿", "镓", "右江"],
        "fault": "右江断裂带", "stratum": "二叠系合山组", "intrusive": None,
        "reports": [("《平果铝土矿成矿规律研究报告（模拟版，1998）》", 56)],
    },
    {
        "name": "凤山金牙金矿", "metal": "Au (金, 卡林型)",
        "lat": 24.55, "lon": 106.95,
        "keywords": ["凤山", "金牙", "金矿", "黄金", "卡林", "隐伏", "右江"],
        "fault": "右江断裂带", "stratum": "三叠系浊积岩", "intrusive": None,
        "reports": [("《凤山金牙金矿详查报告（模拟版，2003）》", 31)],
    },
    {
        "name": "田林高龙金矿", "metal": "Au (金, 卡林型)",
        "lat": 24.27, "lon": 106.24,
        "keywords": ["田林", "高龙", "金矿", "黄金", "卡林", "隐伏", "右江"],
        "fault": "右江断裂带", "stratum": "三叠系地层", "intrusive": None,
        "reports": [("《田林高龙金矿深部找矿报告（模拟版，2011）》", 64)],
    },
    {
        "name": "岑溪佛子冲铅锌矿", "metal": "Pb-Zn (铅·锌)",
        "lat": 23.00, "lon": 111.10,
        "keywords": ["岑溪", "佛子冲", "铅", "锌", "博白"],
        "fault": "博白—岑溪断裂带", "stratum": "奥陶—志留系地层", "intrusive": "燕山期花岗岩",
        "reports": [("《岑溪佛子冲铅锌矿勘探报告（模拟版，1989）》", 19)],
    },
    {
        "name": "上林大明山钨矿", "metal": "W (钨)",
        "lat": 23.50, "lon": 108.45,
        "keywords": ["上林", "武鸣", "大明山", "钨"],
        "fault": "大明山断裂（模拟）", "stratum": "寒武系地层", "intrusive": "大明山花岗岩",
        "reports": [("《大明山钨矿外围普查报告（模拟版，2006）》", 12)],
    },
    {
        "name": "恭城栗木锡钽铌矿", "metal": "Sn-Ta-Nb (锡·钽·铌)",
        "lat": 24.97, "lon": 110.83,
        "keywords": ["恭城", "栗木", "锡", "钽", "铌"],
        "fault": "栗木断裂（模拟）", "stratum": "泥盆系地层", "intrusive": "栗木花岗岩",
        "reports": [("《恭城栗木锡钽铌矿勘查报告（模拟版，1984）》", 38)],
    },
    {
        "name": "大新下雷锰矿", "metal": "Mn (锰)",
        "lat": 22.85, "lon": 106.75,
        "keywords": ["大新", "下雷", "锰"],
        "fault": "下雷断裂（模拟）", "stratum": "泥盆系五指山组", "intrusive": None,
        "reports": [("《大新下雷锰矿资源储量报告（模拟版，2001）》", 27)],
    },
    {
        "name": "贺州姑婆山稀土矿", "metal": "REE (离子吸附型稀土)",
        "lat": 24.62, "lon": 111.53,
        "keywords": ["贺州", "姑婆山", "稀土", "离子吸附"],
        "fault": "姑婆山断裂（模拟）", "stratum": "花岗岩风化壳", "intrusive": "姑婆山花岗岩",
        "reports": [("《贺州姑婆山稀土矿调查报告（模拟版，2014）》", 9)],
    },
]

# 清除旧的示例数据 (Remove earlier seed data, including the first F3/F5/F7 fictional set)
CLEAR_QUERIES = [
    """
    MATCH (n)
    WHERE n.seed = true OR n.is_sample = true
       OR (n:Fault AND n.name IN ['F3断裂带', 'F5断裂带', 'F7断裂带'])
       OR (n:ReportSource AND n.title STARTS WITH '示例勘查报告')
    DETACH DELETE n
    """,
    "MATCH (n) WHERE (n:Stratum OR n:IntrusiveRock) AND NOT (n)--() DELETE n",
]

DEPOSIT_QUERY = """
MERGE (d:Deposit {name: $name})
  SET d.metal_type = $metal, d.lat = $lat, d.lon = $lon, d.keywords = $keywords, d.seed = true
MERGE (f:Fault {name: $fault}) SET f.seed = true
MERGE (s:Stratum {name: $stratum}) SET s.seed = true
MERGE (d)-[:CONTROLLED_BY]->(f)
MERGE (d)-[:HOSTED_IN]->(s)
WITH d
WHERE $intrusive IS NOT NULL
MERGE (i:IntrusiveRock {name: $intrusive}) SET i.seed = true
MERGE (d)-[:ASSOCIATED_WITH]->(i)
"""

REPORT_QUERY = """
MATCH (d:Deposit {name: $name})
MERGE (r:ReportSource {title: $title, page_number: $page}) SET r.seed = true
MERGE (d)-[:CITED_FROM]->(r)
"""


def seed():
    conn = Neo4jConnection()
    for q in CLEAR_QUERIES:
        conn.query(q)
    for dep in DEPOSITS:
        conn.query(DEPOSIT_QUERY, {k: dep[k] for k in
                                   ("name", "metal", "lat", "lon", "keywords", "fault", "stratum", "intrusive")})
        for title, page in dep["reports"]:
            conn.query(REPORT_QUERY, {"name": dep["name"], "title": title, "page": page})
    count = conn.query("MATCH (d:Deposit {seed: true}) RETURN count(d) AS n")[0]["n"]
    print(f"Seeded {count} deposits (simulated reports, approximate coordinates).")
    conn.close()


if __name__ == "__main__":
    seed()
