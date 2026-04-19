"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowState } from "@/types";
import { cn } from "@/lib/utils";

const STATE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  case_created: {
    bg: "bg-slate-50 dark:bg-slate-900",
    border: "border-slate-300 dark:border-slate-600",
    text: "text-slate-700 dark:text-slate-200",
  },
  awaiting_evidence: {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-200",
  },
  under_review: {
    bg: "bg-indigo-50 dark:bg-indigo-950",
    border: "border-indigo-300 dark:border-indigo-700",
    text: "text-indigo-800 dark:text-indigo-200",
  },
  pending_decision: {
    bg: "bg-sky-50 dark:bg-sky-950",
    border: "border-sky-300 dark:border-sky-700",
    text: "text-sky-800 dark:text-sky-200",
  },
  escalated: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-300 dark:border-red-700",
    text: "text-red-800 dark:text-red-200",
  },
  closed: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-800 dark:text-emerald-200",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-gray-50 dark:bg-gray-900",
  border: "border-gray-300 dark:border-gray-600",
  text: "text-gray-700 dark:text-gray-200",
};

function StateNode({ data }: { data: { label: string; state: string; description: string; actions: string[]; thresholds?: { reminder_days?: number; escalation_days?: number } } }) {
  const colors = STATE_COLORS[data.state] ?? DEFAULT_COLOR;
  return (
    <div
      className={cn(
        "rounded-lg border-2 px-4 py-3 shadow-sm",
        colors.bg,
        colors.border,
        "min-w-[200px] max-w-[260px]",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-govuk-dark-grey !h-2 !w-2" />
      <div className={cn("text-sm font-bold", colors.text)}>{data.label}</div>
      <div className="mt-1 text-[11px] leading-snug text-govuk-dark-grey dark:text-govuk-mid-grey">
        {data.description}
      </div>
      {data.actions.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-dashed border-current/10 pt-2">
          {data.actions.map((a) => (
            <li key={a} className="text-[10px] leading-tight text-govuk-dark-grey dark:text-govuk-mid-grey">
              · {a}
            </li>
          ))}
        </ul>
      )}
      {data.thresholds && (
        <div className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          {data.thresholds.reminder_days != null && `Reminder: ${data.thresholds.reminder_days}d`}
          {data.thresholds.reminder_days != null && data.thresholds.escalation_days != null && " · "}
          {data.thresholds.escalation_days != null && `Escalate: ${data.thresholds.escalation_days}d`}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-govuk-dark-grey !h-2 !w-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  stateNode: StateNode,
};

function layoutNodes(states: WorkflowState[]): { nodes: Node[]; edges: Edge[] } {
  // Build a row-based layout: start → middle rows → end
  // "case_created" always top, "closed" always bottom, "escalated" to the right
  const stateMap = new Map(states.map((s) => [s.state, s]));

  // Classify states into rows
  const start = states.filter((s) => s.state === "case_created");
  const end = states.filter((s) => s.state === "closed");
  const escalated = states.filter((s) => s.state === "escalated");
  const middle = states.filter(
    (s) =>
      s.state !== "case_created" &&
      s.state !== "closed" &&
      s.state !== "escalated",
  );

  // Order middle states by typical flow
  const middleOrder = ["awaiting_evidence", "under_review", "pending_decision"];
  middle.sort((a, b) => {
    const ai = middleOrder.indexOf(a.state);
    const bi = middleOrder.indexOf(b.state);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const COL_WIDTH = 300;
  const ROW_HEIGHT = 220;

  const nodes: Node[] = [];

  // Start node center-top
  const midX = (Math.max(middle.length, 1) * COL_WIDTH) / 2;
  start.forEach((s, i) => {
    nodes.push({
      id: s.state,
      type: "stateNode",
      position: { x: midX - 130 + i * COL_WIDTH, y: 0 },
      data: {
        label: s.label,
        state: s.state,
        description: s.description,
        actions: s.required_actions,
        thresholds: s.escalation_thresholds,
      },
    });
  });

  // Middle row
  middle.forEach((s, i) => {
    nodes.push({
      id: s.state,
      type: "stateNode",
      position: { x: i * COL_WIDTH, y: ROW_HEIGHT },
      data: {
        label: s.label,
        state: s.state,
        description: s.description,
        actions: s.required_actions,
        thresholds: s.escalation_thresholds,
      },
    });
  });

  // Escalated node to the right
  escalated.forEach((s) => {
    nodes.push({
      id: s.state,
      type: "stateNode",
      position: { x: Math.max(middle.length, 1) * COL_WIDTH + 60, y: ROW_HEIGHT },
      data: {
        label: s.label,
        state: s.state,
        description: s.description,
        actions: s.required_actions,
        thresholds: s.escalation_thresholds,
      },
    });
  });

  // Closed node center-bottom
  end.forEach((s, i) => {
    nodes.push({
      id: s.state,
      type: "stateNode",
      position: { x: midX - 130 + i * COL_WIDTH, y: ROW_HEIGHT * 2 },
      data: {
        label: s.label,
        state: s.state,
        description: s.description,
        actions: s.required_actions,
        thresholds: s.escalation_thresholds,
      },
    });
  });

  // Edges
  const edges: Edge[] = [];
  for (const s of states) {
    for (const target of s.allowed_transitions) {
      if (!stateMap.has(target)) continue;
      const isEscalation = target === "escalated" || s.state === "escalated";
      edges.push({
        id: `${s.state}->${target}`,
        source: s.state,
        target,
        animated: isEscalation,
        style: {
          stroke: isEscalation ? "#d4351c" : "#505a5f",
          strokeWidth: isEscalation ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEscalation ? "#d4351c" : "#505a5f",
          width: 16,
          height: 16,
        },
        label: isEscalation ? "escalate" : undefined,
        labelStyle: { fontSize: 10, fill: "#d4351c" },
      });
    }
  }

  return { nodes, edges };
}

interface WorkflowGraphProps {
  caseType: string;
  states: WorkflowState[];
  className?: string;
}

export function WorkflowGraph({ states, className }: WorkflowGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutNodes(states),
    [states],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  return (
    <div className={cn("h-[600px] w-full rounded-lg border border-govuk-mid-grey bg-govuk-white dark:bg-govuk-black", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const s = n.id;
            if (s === "escalated") return "#d4351c";
            if (s === "closed") return "#00703c";
            if (s === "case_created") return "#505a5f";
            return "#1d70b8";
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
