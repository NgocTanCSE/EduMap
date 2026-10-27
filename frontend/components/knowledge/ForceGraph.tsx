"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { KnowledgeNode, KnowledgeEdge } from "@/src/services/knowledge.service";

/**
 * Node type → color (Desert Dusk palette from tailwind.config.ts).
 * Each node type gets a distinct hue so the graph is readable at a glance.
 */
const NODE_COLORS: Record<string, string> = {
  university: "#4f46e5",     // indigo
  school: "#6366f1",         // indigo-light
  scholarship: "#eab308",    // amber
  sponsor: "#2563eb",        // blue
  opportunity: "#16a34a",    // green
  career_path: "#dc2626",    // red
  learning_material: "#7c3aed", // violet
  internship: "#0d9488",     // teal
  international_program: "#be123c", // rose
  skill: "#f59e0b",          // amber-dark
  region: "#6b7280",         // gray
  lab: "#8b5cf6",            // purple
  library: "#84cc16",        // lime
  bookstore: "#ec4899",      // pink
  unknown: "#9ca3af",        // gray-light
};

export interface ForceGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

/**
 * D3 force-directed graph for the AI Knowledge Graph (Idea #8, T4).
 *
 * Uses d3-force simulation with:
 *   - charge (repulsion) for separation
 *   - link distance scaled by edge type
 *   - drag support
 *   - zoom/pan via d3-zoom
 *   - click → onNodeClick (triggers 1-degree query on the page)
 */
export default function ForceGraph({ nodes, edges, onNodeClick, width, height }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<any>(null);

  const w = width || 800;
  const h = height || 600;

  // Color helper
  const colorForType = useCallback((nodeType: string) => NODE_COLORS[nodeType] || NODE_COLORS.unknown, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);

    // Clean up previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }
    svg.selectAll("*").remove();

    // Zoom layer
    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const zoom = d3
      .zoom<any, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    // Marker definitions for directed edges
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("height", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,10")
      .attr("fill", "#9ca3af");

    const g = zoomLayer;

    // Build node map (d3 uses index-based refs for links)
    const nodeMap = new Map<string, KnowledgeNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    // Filter edges to only those connecting known nodes
    const validEdges = edges.filter(
      (e) => nodeMap.has(e.source) && nodeMap.has(e.target),
    );

    // D3 force simulation
    const simulation = d3
      .forceSimulation(nodes as any[])
      .force(
        "link",
        d3
          .forceLink(validEdges as any[])
          .id((d: any) => d.id)
          .distance((d: any) => 60 + (100 - (d as any).weight * 20))
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide().radius(30))
      .alphaDecay(0.05)
      .velocityDecay(0.6);

    simulationRef.current = simulation;

    // Draw links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(validEdges)
      .enter()
      .append("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)")
      .attr("opacity", 0.6)
      .append("title")
      .text((d: any) => d.type)
      .selection()
      .selection()
      .append("title");

    link.append("title").text((d: any) => d.type).remove();

    // Re-select to set title properly
    g.select(".links").selectAll("line").remove();
    const links = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(validEdges)
      .enter()
      .append("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)")
      .attr("opacity", 0.6);

    // Edge type labels
    links.append("title").text((d: any) => `${d.source?.id || d.source} → ${d.target?.id || d.target} (${d.type})`);

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(drag(simulation) as any);

    node
      .append("circle")
      .attr("r", 8)
      .attr("fill", (d: any) => colorForType((d as KnowledgeNode).type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("mouseover", function () {
        d3.select(this).attr("r", 14);
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 8);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d as KnowledgeNode);
      });

    // Node labels
    node
      .append("text")
      .attr("dy", -14)
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#374151")
      .text((d: any) => (d as KnowledgeNode).name?.slice(0, 16) || "");

    // Legend
    const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(10,10)`);
    const legendTypes = Array.from(new Set(nodes.map((n) => n.type)));
    legendTypes.forEach((t, i) => {
      const item = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
      item.append("circle").attr("r", 6).attr("fill", colorForType(t));
      item.append("text").attr("x", 12).attr("y", 4).attr("font-size", 11).attr("fill", "#4b5563").text(t);
    });

    // Simulation tick
    simulation.on("tick", () => {
      links
        .attr("x1", (d: any) => (d as any).source.x)
        .attr("y1", (d: any) => (d as any).source.y)
        .attr("x2", (d: any) => (d as any).target.x)
        .attr("y2", (d: any) => (d as any).target.y);
      node.attr("transform", (d: any) => `translate(${(d as any).x}, ${(d as any).y})`);
    });

    // Cleanup on unmount
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, onNodeClick, w, h, colorForType]);

  function drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      (event.subject as any).fx = (event.subject as any).x;
      (event.subject as any).fy = (event.subject as any).y;
    }
    function dragged(event: any) {
      (event.subject as any).fx = event.x;
      (event.subject as any).fy = event.y;
    }
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      (event.subject as any).fx = null;
      (event.subject as any).fy = null;
    }
    return d3.drag<any, any>().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className="w-full h-full bg-background/40 rounded-lg"
      />
    </div>
  );
}
