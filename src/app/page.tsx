"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  Map as MapIcon, 
  Database, 
  Crosshair, 
  Settings, 
  User, 
  Send,
  FileText,
  Network,
  Compass,
  ClipboardList,
  Loader2,
  BookOpen,
  Layers,
  Zap,
  ChevronRight
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';
import { sendChatQuery, ChatResponse, GraphRecord } from '@/lib/api';
import type { MapDeposit } from '@/components/GeoMap';
import ReasoningChains from '@/components/ReasoningChains';
import dynamic from 'next/dynamic';

// Dynamically import the map to avoid SSR issues (Leaflet requires browser APIs)
const GeoMapDynamic = dynamic(() => import('@/components/GeoMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-stone-50 rounded-[2rem]">
      <div className="flex flex-col items-center gap-3 text-stone-400">
        <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        <span className="text-xs font-medium tracking-wide">Loading Map...</span>
      </div>
    </div>
  )
});

const confidenceData = [
  { name: 'Jan', value: 80 },
  { name: 'Feb', value: 82 },
  { name: 'Mar', value: 81 },
  { name: 'Apr', value: 85 },
  { name: 'May', value: 87 },
  { name: 'Jun', value: 89.4 }
];

interface ChatMessage {
  role: 'user' | 'system';
  content: string;
  reasoning?: string[];
  graph_records?: GraphRecord[];
  confidence?: number;
}

export default function GeoGraphDashboard() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [targetConfidence, setTargetConfidence] = useState<number>(89.4);
  const [graphNodes, setGraphNodes] = useState<string[]>(['F3 断裂', '大瑶山地层']);
  const [graphRecords, setGraphRecords] = useState<GraphRecord[] | null>(null);
  const [mapDeposits, setMapDeposits] = useState<MapDeposit[]>([]);
  const [polygonPoints, setPolygonPoints] = useState<string>("460,270 560,240 630,320 530,370 440,330");

  // Label and legend follow the plotted deposits; before the first query they describe the static demo overlay
  const mapFaults = [...new Set(mapDeposits.map(d => d.fault).filter((f): f is string => !!f))];
  const regionLabel = mapDeposits.length === 0
    ? '广西大瑶山区域'
    : mapFaults.length > 2 ? `${mapFaults.slice(0, 2).join(' · ')} 等 ${mapFaults.length} 条断裂` : mapFaults.join(' · ') || '查询结果';

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage = query;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setQuery("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendChatQuery(userMessage);
      
      // Update state with backend response
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: response.prediction,
        reasoning: response.reasoning_chain,
        graph_records: response.graph_records,
        confidence: response.confidence,
      }]);

      if (response.confidence) {
        setTargetConfidence(response.confidence * 100);
      }

      if (response.reasoning_chain && response.reasoning_chain.length > 0) {
        setGraphNodes(response.reasoning_chain);
      }

      setGraphRecords(response.graph_records);

      // One map marker per deposit (a deposit can appear in several records, one per cited report)
      const located = new Map<string, MapDeposit>();
      for (const rec of response.graph_records) {
        if (rec.deposit && rec.lat != null && rec.lon != null && !located.has(rec.deposit)) {
          located.set(rec.deposit, { name: rec.deposit, lat: rec.lat, lon: rec.lon, metal: rec.metal, fault: rec.fault });
        }
      }
      if (located.size > 0) setMapDeposits([...located.values()]);

      // Very rough mapping of geo_coordinates to SVG polygon for the demo
      if (response.geo_coordinates && response.geo_coordinates.coordinates[0]) {
        // Just slightly shifting the default polygon to show it updated
        setPolygonPoints("480,290 580,260 650,340 550,390 460,350");
      }

    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: "Error: Could not process request. Please check the backend connection."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:min-h-[960px] bg-stone-50 text-stone-900 font-sans selection:bg-amber-200/50 flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="h-20 bg-transparent flex items-center justify-between shrink-0 z-10 px-2 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-stone-100">
            <Compass className="w-6 h-6 text-amber-700" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-amber-950">
            DeepOre-Explorer <span className="text-sm font-normal text-stone-500 ml-3">智探大盘</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white rounded-full shadow-sm border border-stone-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-stone-600 tracking-wide uppercase">GeoAI Engine: Active</span>
          </div>
          
          <div className="flex items-center gap-5">
            <button className="text-stone-400 hover:text-amber-700 transition-colors duration-300">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-stone-100 flex items-center justify-center cursor-pointer hover:shadow-md transition-all duration-300">
              <User className="w-5 h-5 text-stone-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-[minmax(0,1fr)] gap-6 min-h-0">
        
        {/* Left Column: KPI Sidebar */}
        <aside className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-stone-100 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl">
                <FileText className="w-5 h-5 text-amber-700" />
              </div>
              <p className="text-stone-500 text-sm font-medium tracking-wide">历史报告解析</p>
            </div>
            <div>
              <h3 className="text-5xl font-light text-stone-900 tracking-tight">
                12,450 <span className="text-lg text-stone-400 font-normal ml-1">页</span>
              </h3>
            </div>
            <div className="h-12 w-full flex items-end gap-1.5 mt-8 opacity-80">
              {[30, 40, 35, 50, 45, 60, 75, 80, 70, 90, 85, 100].map((val, i) => (
                <div key={i} className="flex-1 bg-amber-100 rounded-t-sm transition-all duration-500 hover:bg-amber-200" style={{ height: `${val}%` }} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-stone-100 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 rounded-xl">
                <Database className="w-5 h-5 text-orange-700" />
              </div>
              <p className="text-stone-500 text-sm font-medium tracking-wide">图谱实体网络</p>
            </div>
            <div>
              <h3 className="text-5xl font-light text-stone-900 tracking-tight">
                {842 + graphNodes.length}k <span className="text-lg text-stone-400 font-normal ml-1">节点</span>
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-stone-100 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-shadow duration-300 flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-stone-100 rounded-xl">
                <Crosshair className="w-5 h-5 text-stone-700" />
              </div>
              <p className="text-stone-500 text-sm font-medium tracking-wide">成矿靶区置信度</p>
            </div>
            <div className="flex items-baseline gap-3 mb-6">
              <h3 className="text-5xl font-light text-stone-900 tracking-tight">{(targetConfidence).toFixed(1)}<span className="text-3xl">%</span></h3>
              <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">↑ Active</span>
            </div>
            <div className="flex-1 w-full min-h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={confidenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#d97706" 
                    strokeWidth={3} 
                    dot={{ fill: '#fff', stroke: '#d97706', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#d97706', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>

        {/* Center: Main GIS Map Stage */}
        <section className="lg:col-span-2 relative rounded-[2rem] overflow-hidden flex flex-col border border-stone-200 shadow-sm" style={{minHeight: '500px'}}>
          {/* Map overlay controls */}
          <div className="absolute top-4 left-4 z-[1000] flex gap-2">
            <div className="bg-white/95 backdrop-blur-sm shadow-sm rounded-full px-4 py-2 flex items-center gap-2 text-xs font-semibold text-stone-600 border border-stone-100">
              <MapIcon className="w-3.5 h-3.5 text-amber-600" />
              GIS · LIVE MAP
            </div>
            <div className="bg-white/95 backdrop-blur-sm shadow-sm rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-medium text-stone-500 border border-stone-100">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {regionLabel}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 border border-stone-100 shadow-sm flex flex-col gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">图例 Legend</p>
            {mapDeposits.length === 0 ? (
              <>
                <div className="flex items-center gap-2 text-[11px] text-stone-600">
                  <div className="w-6 border-t-2 border-dashed border-amber-600" />
                  F3 构造断裂带
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-600">
                  <div className="w-4 h-3 rounded-sm border-2 border-dashed border-amber-500 bg-amber-100/60" />
                  成矿靶区
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-600">
                  <div className="w-3 h-3 rounded-full bg-amber-800 border-2 border-white shadow-sm" />
                  钻孔 ZK-01
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-stone-600">
                <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                匹配矿床 Deposit × {mapDeposits.length}
              </div>
            )}
          </div>

          {/* Real Map */}
          <div className="flex-1 w-full h-full" style={{minHeight: '500px'}}>
            <GeoMapDynamic confidence={targetConfidence} deposits={mapDeposits} />
          </div>
        </section>

        {/* Right Column: Information & Copilot Panel */}
        <aside className="lg:col-span-1 flex flex-col gap-6 h-full min-h-0">
          {/* Top Half: Relational Graph */}
          <div className="flex-[0.9] min-h-0 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-3xl p-6 flex flex-col relative overflow-hidden border border-stone-100">
            <h3 className="text-stone-900 text-sm font-semibold mb-4 flex items-center gap-2">
              <Network className="w-4 h-4 text-stone-400" />
              知识图谱推演
            </h3>
            
            <div className="flex-1 relative bg-stone-50 rounded-2xl overflow-hidden border border-stone-100/60 p-4 overflow-y-auto">
              <ReasoningChains records={graphRecords} />
            </div>
          </div>

          {/* Bottom Half: System Copilot / Assistant */}
          <div className="flex-[1.1] min-h-0 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-3xl flex flex-col overflow-hidden border border-stone-100">
            <div className="px-6 py-4 border-b border-stone-50 bg-white">
              <h3 className="text-stone-900 text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-stone-400" />
                AI 决策助手
              </h3>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 text-sm bg-stone-50/30">
              
              {messages.length === 0 && (
                <div className="text-center text-stone-400 mt-10 text-xs uppercase tracking-widest font-semibold">
                  Awaiting Input
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'flex-col'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-white border border-stone-200 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[90%] text-[13px] text-stone-700 shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {/* Entity Pills */}
                      {msg.reasoning && msg.reasoning.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                            <Zap className="w-3 h-3" /> Extracted Entities
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.reasoning.map((entity, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {entity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Graph Evidence Card */}
                      {msg.graph_records && msg.graph_records.length > 0 && (
                        <div className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-stone-200 bg-white flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Graph Evidence</span>
                          </div>
                          {msg.graph_records.map((rec, i) => (
                            <div key={i} className="px-4 py-3 flex flex-col gap-1.5">
                              {rec.fault && (
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-stone-400 font-medium">断裂带 Fault</span>
                                  <span className="text-stone-800 font-semibold">{rec.fault}</span>
                                </div>
                              )}
                              {rec.deposit && (
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-stone-400 font-medium">矿体 Deposit</span>
                                  <span className="text-stone-800 font-semibold">{rec.deposit}</span>
                                </div>
                              )}
                              {rec.metal && (
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-stone-400 font-medium">矿种 Metal</span>
                                  <span className="text-amber-700 font-bold">{rec.metal}</span>
                                </div>
                              )}
                              {rec.stratum && (
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className="text-stone-400 font-medium">地层 Stratum</span>
                                  <span className="text-stone-800 font-semibold">{rec.stratum}</span>
                                </div>
                              )}
                              {rec.source_doc && (
                                <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-stone-200 text-[11px] text-stone-500">
                                  <BookOpen className="w-3 h-3 text-stone-400 shrink-0" />
                                  <span>{rec.source_doc}{rec.page ? ` · p.${rec.page}` : ''}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* AI Analysis */}
                      <div className="bg-amber-50/60 border border-amber-100 rounded-2xl rounded-tl-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                              <Activity className="w-3.5 h-3.5 text-amber-700" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">GeoAI Analysis</span>
                          </div>
                          {msg.confidence && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              {(msg.confidence * 100).toFixed(1)}% confidence
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] leading-relaxed text-stone-700 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4 items-center text-amber-700 text-xs font-semibold uppercase tracking-wider">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Geo-Data...
                </div>
              )}

              {error && (
                <div className="text-red-500 text-xs font-semibold bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-white border-t border-stone-50">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="relative bg-white rounded-2xl border border-stone-200 flex items-center overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all shadow-sm"
              >
                <input 
                  type="text" 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ask GeoAI to analyze regions..." 
                  className="flex-1 bg-transparent border-none outline-none text-[13px] text-stone-800 px-5 py-4 placeholder:text-stone-400"
                  disabled={isLoading}
                />
                <button 
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="mr-2 p-2.5 bg-amber-700 text-white rounded-xl hover:bg-amber-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}
