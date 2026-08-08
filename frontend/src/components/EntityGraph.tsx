import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { Link } from "react-router-dom";
import { Phone, Mail, Landmark, Globe, IndianRupee, CircleHelp, FolderKanban } from "lucide-react";
import type { CrossCaseLink } from "../api";

const ENTITY_ICON: Record<string, typeof Phone> = {
  phone: Phone,
  email: Mail,
  account: Landmark,
  ip: Globe,
  upi: IndianRupee,
};

interface GNode {
  id: string;
  kind: "case" | "entity";
  label: string;
  entityType?: string;
  caseId?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GEdge {
  source: string | GNode;
  target: string | GNode;
}

export default function EntityGraph({
  links,
  currentCaseId,
  currentCaseNumber,
}: {
  links: CrossCaseLink[];
  currentCaseId: number;
  currentCaseNumber: string;
}) {
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [simError, setSimError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 700, height: 420 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setSize({ width: w, height: Math.max(320, Math.min(560, w * 0.55)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodeList, edgeList, omitted } = useMemo(() => {
    const nodeMap = new Map<string, GNode>();
    const edgeKey = new Set<string>();
    const edgeList: GEdge[] = [];
    // seed positions in a fixed reference frame, not the live viewport size —
    // this only needs to scatter nodes before the simulation settles, and
    // depending on `size` here would mean every resize invalidates and
    // rebuilds the whole graph instead of just the render dimensions
    const SEED = 400;

    const caseNode = (id: number, number?: string | null) => {
      const key = `case:${id}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          kind: "case",
          label: number || `Case #${id}`,
          caseId: id,
          x: SEED / 2 + (Math.random() - 0.5) * 40,
          y: SEED / 2 + (Math.random() - 0.5) * 40,
        });
      }
      return key;
    };

    caseNode(currentCaseId, currentCaseNumber);

    // Cap to the N entities with the most connections — a case that's
    // accumulated links across dozens of prior cases would otherwise render
    // (and force-simulate) an unbounded graph. Prioritizing the
    // best-connected entities keeps the graph meaningful and fast.
    const MAX_ENTITIES = 40;
    const entityFreq = new Map<string, number>();
    for (const l of links) {
      const k = `${l.entity_type}:${l.entity_value}`;
      entityFreq.set(k, (entityFreq.get(k) ?? 0) + 1);
    }
    const allowedEntities =
      entityFreq.size <= MAX_ENTITIES
        ? null
        : new Set(
            Array.from(entityFreq.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, MAX_ENTITIES)
              .map(([k]) => k)
          );

    let omitted = 0;
    for (const l of links) {
      const entSlug = `${l.entity_type}:${l.entity_value}`;
      if (allowedEntities && !allowedEntities.has(entSlug)) {
        omitted++;
        continue;
      }
      const entKey = `entity:${entSlug}`;
      if (!nodeMap.has(entKey)) {
        nodeMap.set(entKey, {
          id: entKey,
          kind: "entity",
          label: l.entity_value,
          entityType: l.entity_type,
          x: SEED / 2 + (Math.random() - 0.5) * 200,
          y: SEED / 2 + (Math.random() - 0.5) * 200,
        });
      }
      const aKey = caseNode(l.case_a, l.case_a_number);
      const bKey = caseNode(l.case_b, l.case_b_number);
      for (const ck of [aKey, bKey]) {
        const ek = `${entKey}|${ck}`;
        if (!edgeKey.has(ek)) {
          edgeKey.add(ek);
          edgeList.push({ source: entKey, target: ck });
        }
      }
    }
    return { nodeList: Array.from(nodeMap.values()), edgeList, omitted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, currentCaseId, currentCaseNumber]);

  useEffect(() => {
    if (nodeList.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    try {
      const simNodes = nodeList.map((n) => ({ ...n }));
      const simEdges = edgeList.map((e) => ({ ...e }));
      const sim = forceSimulation(simNodes as unknown as { x: number; y: number }[])
        .force(
          "link",
          forceLink(simEdges as unknown as { source: string; target: string }[])
            .id((d: unknown) => (d as GNode).id)
            .distance(90)
            .strength(0.7)
        )
        .force("charge", forceManyBody().strength(-220))
        .force("center", forceCenter(size.width / 2, size.height / 2))
        .force(
          "collide",
          forceCollide((d: unknown) => ((d as GNode).kind === "case" ? 34 : 22))
        )
        .stop();
      for (let i = 0; i < 300; i++) sim.tick();
      setNodes(simNodes as unknown as GNode[]);
      setEdges(simEdges as unknown as GEdge[]);
      setSimError(false);
    } catch {
      // Layout is a nice-to-have; a bad edge case here should never break
      // the rest of the page (or the table underneath) — fall back visibly
      // instead of throwing during render.
      setSimError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeList, edgeList, size.width, size.height]);

  if (simError) {
    return (
      <div className="py-6 text-center text-sm text-muted">
        Couldn't render the relationship graph for this link set — see the table below instead.
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted">
        No entities from this case appear in other cases.
      </div>
    );
  }

  const neighborIds = (id: string) => {
    const set = new Set<string>([id]);
    for (const e of edges) {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      if (s === id) set.add(t);
      if (t === id) set.add(s);
    }
    return set;
  };
  const highlighted = hovered ? neighborIds(hovered) : null;

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="mx-auto"
      >
        <g>
          {edges.map((e, i) => {
            const s = typeof e.source === "string" ? nodes.find((n) => n.id === e.source) : e.source;
            const t = typeof e.target === "string" ? nodes.find((n) => n.id === e.target) : e.target;
            if (!s || !t) return null;
            const dim = highlighted && !(highlighted.has(s.id) && highlighted.has(t.id));
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="var(--color-line)"
                strokeWidth={dim ? 1 : 1.5}
                opacity={dim ? 0.25 : 0.8}
              />
            );
          })}
        </g>
        <g>
          {nodes.map((n) => {
            const dim = highlighted && !highlighted.has(n.id);
            const isCurrent = n.kind === "case" && n.caseId === currentCaseId;
            const Icon = n.kind === "entity" ? ENTITY_ICON[n.entityType ?? ""] ?? CircleHelp : FolderKanban;
            const r = n.kind === "case" ? (isCurrent ? 24 : 20) : 15;
            const label = n.label.length > 16 ? n.label.slice(0, 14) + "…" : n.label;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.3 : 1}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle
                  r={r}
                  fill={n.kind === "case" ? "var(--color-panel-2)" : "var(--color-panel)"}
                  stroke={n.kind === "case" ? "var(--color-phosphor)" : "var(--color-muted)"}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                />
                <foreignObject x={-9} y={-9} width={18} height={18} className="pointer-events-none">
                  <Icon
                    size={18}
                    strokeWidth={2}
                    color={n.kind === "case" ? "var(--color-phosphor)" : "var(--color-muted)"}
                  />
                </foreignObject>
                <text
                  y={r + 13}
                  textAnchor="middle"
                  className="mono select-none"
                  fontSize={10.5}
                  fill={isCurrent ? "var(--color-phosphor)" : "var(--color-muted)"}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {omitted > 0 && (
        <div className="mt-1.5 text-center text-xs text-muted">
          Showing the most-connected entities — {omitted} additional link(s) omitted from the
          graph for readability. See the full table below.
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <FolderKanban size={13} color="var(--color-phosphor)" /> Case
        </span>
        {Object.entries(ENTITY_ICON).map(([type, Icon]) => (
          <span key={type} className="flex items-center gap-1.5">
            <Icon size={13} color="var(--color-muted)" /> {type}
          </span>
        ))}
        {nodes.filter((n) => n.kind === "case").length > 0 && (
          <span className="ml-auto">
            Hover a node to trace its connections ·{" "}
            {nodes
              .filter((n) => n.kind === "case")
              .map((n, i) => (
                <span key={n.id}>
                  {i > 0 && ", "}
                  <Link to={`/cases/${n.caseId}`} className="text-phosphor hover:underline">
                    {n.label}
                  </Link>
                </span>
              ))}
          </span>
        )}
      </div>
    </div>
  );
}
