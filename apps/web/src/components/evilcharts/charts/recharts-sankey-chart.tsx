"use client";

import {
  Sankey as RechartsSankey,
  Layer,
  type SankeyProps,
  type SankeyNodeProps,
  type SankeyLinkProps,
  type SankeyData,
  type SankeyNode as RechartsSankeyNode,
} from "recharts";
import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FC,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ChartTooltip,
  ChartTooltipContent,
  type TooltipRoundness,
  type TooltipVariant,
} from "@/components/evilcharts/ui/recharts-tooltip";
import {
  type ChartConfig,
  ChartContainer,
  getColorsCount,
  LoadingIndicator,
} from "@/components/evilcharts/ui/recharts-chart";
import { ChartBackground, type BackgroundVariant } from "@/components/evilcharts/ui/recharts-background";
import { animate, cubicBezier, motion, useReducedMotion } from "motion/react";

// Constants
const LOADING_ANIMATION_DURATION = 2000; // full loading cycle duration in milliseconds
const DEFAULT_NODE_WIDTH = 10;
const DEFAULT_NODE_PADDING = 10;
const DEFAULT_LINK_CURVATURE = 0.5;
const DEFAULT_ITERATIONS = 32;

// Nodes and bands glide to a new layout instead of snapping.
const SETTLE_DURATION = 0.45; // seconds
const SETTLE_EASE = [0.22, 1, 0.36, 1] as const; // ease-out

// The routed item: a bright head with a fading tail, travelling the lane's
// centre curve. Lengths are fractions of the lane (the path is normalised to 1).
const SWEEP_DURATION = 1.2; // seconds
const SWEEP_EASE = [0.3, 0, 0.2, 1] as const; // quick start, soft landing
const SWEEP_HEAD = 0.05;
// Overlapping tails of falling length: their opacities stack into a smooth fade.
const SWEEP_TAILS = [0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.07].map((length) => ({ length, opacity: 0.09 }));
const SWEEP_TRAVEL = 1 + Math.max(...SWEEP_TAILS.map((tail) => tail.length)); // head end runs past the lane until the tail is in
// Seconds until the head reaches the outcome node, when the layout and
// counts settle so the new number lands with the item.
const SWEEP_ARRIVAL = (() => {
  const ease = cubicBezier(...SWEEP_EASE);
  let t = 0;
  while (t < 1 && ease(t) * SWEEP_TRAVEL < 1) t += 0.01;
  return t * SWEEP_DURATION;
})();

type LinkVariant = "gradient" | "solid" | "source" | "target";
type NodeLabelPosition = "inside" | "outside";

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared state for every part of the chart. Lifted into <EvilSankeyChart /> so
 * that <Node />, <Link />, and <Tooltip /> can read it without prop drilling.
 * A sankey chart's data is rigid — the root passes `nodes`/`links` straight to
 * Recharts — so the parts here configure how those nodes and links render.
 */
type SankeyChartContextValue = {
  data: SankeyData; // the nodes + links rendered by the chart
  config: ChartConfig; // colors + labels keyed by node name
  chartId: string; // colon-free id scoping this chart's SVG defs
  isLoading: boolean; // whether the chart shows its loading skeleton
  selectedNode: string | null; // currently selected node name, or null when none
  selectNode: (nodeName: string | null) => void; // sets the selected node
  settleMemory: SettleMemory; // last drawn geometry per node and band, for tweening across remounts
};

const SankeyChartContext = createContext<SankeyChartContextValue | null>(null);

// Reads the chart context, throwing a helpful error when used outside <EvilSankeyChart />
function useSankeyChart() {
  const context = use(SankeyChartContext);

  if (!context) {
    throw new Error(
      "Sankey chart parts (<Node />, <Link />, <Tooltip />, …) must be used within <EvilSankeyChart />",
    );
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root container
// ─────────────────────────────────────────────────────────────────────────────

type EvilSankeyChartBaseProps = {
  data: SankeyData; // nodes + links rendered by the chart
  config: ChartConfig; // node colors + labels keyed by node name
  children: ReactNode; // composed parts — <Node />, <Link />, <Tooltip />, …
  className?: string; // extra classes for the chart container
  sankeyProps?: Omit<SankeyProps, "data">; // escape hatch for the raw Recharts Sankey
  nodeWidth?: number; // width of each node in pixels
  nodePadding?: number; // vertical gap between nodes in pixels
  linkCurvature?: number; // link curve amount, 0 (straight) to 1 (maximum)
  iterations?: number; // layout iterations — higher is more accurate
  sort?: boolean; // sorts nodes automatically for an optimal layout
  align?: "left" | "justify"; // horizontal node alignment strategy
  verticalAlign?: "justify" | "top"; // vertical node alignment strategy
  backgroundVariant?: BackgroundVariant; // background pattern behind the chart
  defaultSelectedNode?: string | null; // node selected on first render
  onSelectionChange?: (selection: { dataKey: string; value: number } | null) => void; // fires when the selected node changes
  isLoading?: boolean; // shows the animated loading skeleton
};

type EvilSankeyChartProps = EvilSankeyChartBaseProps;

/**
 * Root of the composible sankey chart. Owns the flow data, the shared context,
 * the layout configuration, and the loading skeleton. The visual parts — the
 * nodes, links, and tooltip — are composed as children, so a consumer renders
 * exactly the parts they need with the styling they want.
 */
export function EvilSankeyChart({
  data,
  config,
  children,
  className,
  sankeyProps,
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodePadding = DEFAULT_NODE_PADDING,
  linkCurvature = DEFAULT_LINK_CURVATURE,
  iterations = DEFAULT_ITERATIONS,
  sort = true,
  align = "justify",
  verticalAlign = "justify",
  backgroundVariant,
  defaultSelectedNode = null,
  onSelectionChange,
  isLoading = false,
}: EvilSankeyChartProps) {
  const chartId = useId().replace(/:/g, ""); // colon-free id keeps CSS/SVG selectors valid
  const [selectedNode, setSelectedNode] = useState<string | null>(defaultSelectedNode);
  const [settleMemory] = useState<SettleMemory>(() => new Map());

  // Updates selection state and notifies the parent with the node's flow value
  const selectNode = useCallback(
    (nodeName: string | null) => {
      setSelectedNode(nodeName);

      if (!onSelectionChange) return;

      if (nodeName === null) {
        onSelectionChange(null);
        return;
      }

      onSelectionChange({ dataKey: nodeName, value: getNodeValue(data, nodeName) });
    },
    [onSelectionChange, data],
  );

  const contextValue = useMemo<SankeyChartContextValue>(
    () => ({ data, config, chartId, isLoading, selectedNode, selectNode, settleMemory }),
    [data, config, chartId, isLoading, selectedNode, selectNode, settleMemory],
  );

  return (
    <SankeyChartContext value={contextValue}>
      <ChartContainer className={className} config={config}>
        <LoadingIndicator isLoading={isLoading} />
        {backgroundVariant && <ChartBackground variant={backgroundVariant} />}
        {!isLoading && (
          <RechartsSankey
            id={chartId}
            data={data}
            nodeWidth={nodeWidth}
            nodePadding={nodePadding}
            linkCurvature={linkCurvature}
            iterations={iterations}
            sort={sort}
            align={align}
            verticalAlign={verticalAlign}
            {...resolveSankeyRenderers(children)}
            {...sankeyProps}
          >
            {children}
            <defs>
              <NodeColorGradients config={config} chartId={chartId} />
            </defs>
          </RechartsSankey>
        )}
        {isLoading && (
          <svg
            viewBox="0 0 500 250"
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height="100%"
            className="absolute inset-0"
          >
            <LoadingSankey />
          </svg>
        )}
      </ChartContainer>
    </SankeyChartContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composible parts
// ─────────────────────────────────────────────────────────────────────────────

type NodeProps = {
  radius?: number; // corner radius of node rectangles in pixels
  minNodeHeight?: number; // minimum rendered node height, independent of flow geometry
  minLabelHeight?: number; // minimum vertical space reserved for an inside label
  labelBackground?: string; // optional explicit label surface for a themed chart
  labelBackgroundByNode?: Record<string, string>; // node-specific label surfaces, keyed by node name
  compactZeroValues?: boolean; // renders a zero value inline with its label
  stroke?: boolean; // outlines the node and inside-label surface with its series colour
  strokeColorByNode?: Record<string, string>; // optional node-specific outlines, keyed by node name
  strokeWidth?: number; // outline thickness in pixels
  labelColor?: string; // optional explicit label fill for a themed chart
  valueColor?: string; // optional explicit value fill for a themed chart
  isClickable?: boolean; // lets nodes be selected by clicking them
  children?: ReactNode; // optional <NodeLabel /> composition
};

/**
 * Configures how the sankey nodes render. It is a configuration slot — the root
 * reads its props and wires them into the Recharts Sankey `node` renderer, so it
 * renders nothing itself. Compose a <NodeLabel /> inside it to show labels.
 */
const Node: FC<NodeProps> = () => null;

type NodeLabelProps = {
  position?: NodeLabelPosition; // places labels inside or beside the nodes
  showValues?: boolean; // appends each node's total flow value
  valueFormatter?: (value: number) => string; // formats node values when shown
};

/**
 * Declares labels for the <Node /> it is composed inside. Like <Node />, it is a
 * configuration slot and renders nothing on its own.
 */
const NodeLabel: FC<NodeLabelProps> = () => null;

type LinkProps = {
  variant?: LinkVariant; // coloring strategy for the link bands
  verticalPadding?: number; // shrinks link width where it meets a node
  pulseTarget?: string | null; // destination node for the newest routed item
  pulseKey?: string | number | null; // changes to restart the path sweep
  emptyTargetOpacity?: number; // fill opacity for a band whose target shows a zero value
};

/**
 * Configures how the sankey links render. Like <Node />, it is a configuration
 * slot read by the root and renders nothing itself. The `variant` controls how
 * each link band is colored.
 */
const Link: FC<LinkProps> = () => null;

type TooltipProps = {
  variant?: TooltipVariant; // visual style of the tooltip surface
  roundness?: TooltipRoundness; // border-radius of the tooltip
  defaultIndex?: number; // data index shown by default with no hover
};

/**
 * The hover tooltip. Reads the chart's loading state from context and is hidden
 * automatically while the chart shows its skeleton.
 */
function Tooltip({ variant, roundness, defaultIndex }: TooltipProps) {
  const { isLoading } = useSankeyChart();

  if (isLoading) return null;

  return (
    <ChartTooltip
      defaultIndex={defaultIndex}
      content={
        <ChartTooltipContent nameKey="name" hideLabel roundness={roundness} variant={variant} />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Children resolution — turns composed <Node />/<Link /> into Sankey renderers
// ─────────────────────────────────────────────────────────────────────────────

// Sums a node's outgoing flow, falling back to incoming flow for leaf nodes
const getNodeValue = (data: SankeyData, nodeName: string): number => {
  const nodeIndex = data.nodes.findIndex((node) => node.name === nodeName);
  if (nodeIndex === -1) return 0;

  const outgoing = data.links
    .filter((link) => link.source === nodeIndex)
    .reduce((sum, link) => sum + link.value, 0);
  const incoming = data.links
    .filter((link) => link.target === nodeIndex)
    .reduce((sum, link) => sum + link.value, 0);

  return outgoing > 0 ? outgoing : incoming;
};

// Reads composed <Node /> and <Link /> children into the Sankey `node`/`link` render props
const resolveSankeyRenderers = (children: ReactNode): Pick<SankeyProps, "node" | "link"> => {
  let nodeProps: NodeProps | null = null;
  let linkProps: LinkProps | null = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    // Vite Fast Refresh can preserve a parent element created with a prior
    // module instance. Recognise the chart slots by their stable function name
    // as well as identity, so a live chart does not lose its node configuration
    // (labels, sizing, or pulse) mid-session.
    if (child.type === Node || (typeof child.type === "function" && child.type.name === "Node")) {
      nodeProps = (child as ReactElement<NodeProps>).props;
    }

    if (child.type === Link || (typeof child.type === "function" && child.type.name === "Link")) {
      linkProps = (child as ReactElement<LinkProps>).props;
    }
  });

  return {
    node: (props: SankeyNodeProps) => (
      <SankeyNode {...props} nodeConfig={nodeProps} pulseKey={(linkProps as LinkProps | null)?.pulseKey ?? null} />
    ),
    link: (props: SankeyLinkProps) => <SankeyLink {...props} linkConfig={linkProps} />,
  };
};

// Reads the <NodeLabel /> composed inside a <Node />, if any
const resolveNodeLabel = (children: ReactNode): NodeLabelProps | null => {
  let label: NodeLabelProps | null = null;

  Children.forEach(children, (child) => {
    if (
      isValidElement(child)
      && (child.type === NodeLabel || (typeof child.type === "function" && child.type.name === "NodeLabel"))
    ) {
      label = (child as ReactElement<NodeLabelProps>).props;
    }
  });

  return label;
};

// ─────────────────────────────────────────────────────────────────────────────
// Settling — tweens nodes and bands between layouts
// ─────────────────────────────────────────────────────────────────────────────

type PulseKey = string | number | null;
type Geometry = Record<string, number>;
type SettleMemory = Map<string, { geometry: Geometry; pulseKey: PulseKey }>;

const mixGeometry = <T extends Geometry>(from: T, to: T, progress: number): T =>
  Object.fromEntries(
    Object.keys(to).map((key) => [key, (from[key] ?? to[key]) + (to[key] - (from[key] ?? to[key])) * progress]),
  ) as T;

const sameGeometry = (a: Geometry, b: Geometry): boolean =>
  Object.keys(b).every((key) => Math.abs((a[key] ?? Number.NaN) - b[key]) < 0.01);

/**
 * Recharts keys each node by its position and each band by its value, so a
 * new count remounts them. The chart root remembers the last drawn geometry
 * per stable id, and this tweens from it, so the layout glides instead of
 * snapping. When a new item is routed (the pulse key changes), the change
 * waits until the item reaches its node. Reduced motion settles at once.
 */
function useSettledGeometry<T extends Geometry>(id: string, target: T, pulseKey: PulseKey): T {
  const { settleMemory } = useSankeyChart();
  const reduceMotion = useReducedMotion() ?? false;
  const [shown, setShown] = useState<T>(() => (settleMemory.get(id)?.geometry as T | undefined) ?? target);
  // The effect reruns when the target's values change, not its identity.
  const signature = Object.values(target).join(" ");

  useEffect(() => {
    const previous = settleMemory.get(id);
    const from = (previous?.geometry as T | undefined) ?? target;
    const remember = (geometry: T) => settleMemory.set(id, { geometry, pulseKey });

    if (reduceMotion || previous === undefined || sameGeometry(from, target)) {
      remember(target);
      setShown(target);
      return;
    }

    // Memory takes the new pulse key only once the tween moves, so a restart
    // (a newer item, or StrictMode's second run) still waits for arrival.
    const arriving = pulseKey !== null && previous.pulseKey !== pulseKey;
    const controls = animate(0, 1, {
      duration: SETTLE_DURATION,
      ease: SETTLE_EASE,
      delay: arriving ? SWEEP_ARRIVAL : 0,
      onUpdate: (progress) => {
        const geometry = mixGeometry(from, target, progress);
        remember(geometry);
        setShown(geometry);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on `signature`
  }, [id, signature, pulseKey, reduceMotion, settleMemory]);

  return shown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node renderer — draws a single sankey node from the resolved <Node /> config
// ─────────────────────────────────────────────────────────────────────────────

type SankeyNodeRendererProps = SankeyNodeProps & {
  nodeConfig: NodeProps | null; // resolved props from the composed <Node />
  pulseKey: PulseKey; // the composed <Link />'s pulse key, so a count lands with its item
};

/**
 * Renders a single sankey node rectangle, plus its optional label and value.
 * The root passes one of these per node, configured from the composed <Node />.
 * Its position, size and count settle smoothly from the previous layout.
 */
const SankeyNode = ({ x: layoutX, y: layoutY, width: layoutWidth, height: layoutHeight, payload, nodeConfig, pulseKey }: SankeyNodeRendererProps) => {
  const { config, chartId, data, selectedNode, selectNode } = useSankeyChart();
  const reduceMotion = useReducedMotion() ?? false;

  const radius = nodeConfig?.radius ?? 0;
  const isClickable = nodeConfig?.isClickable ?? false;
  const label = resolveNodeLabel(nodeConfig?.children);

  const nodeName = payload.name;
  // A node may carry `displayValue` when its drawn size differs from its
  // real value (a size floor keeps empty nodes visible); the label shows it.
  const layoutValue = (payload as RechartsSankeyNode & { displayValue?: number }).displayValue ?? payload.value;
  const settled = useSettledGeometry(
    `node-${payload.name}`,
    { x: layoutX, y: layoutY, width: layoutWidth, height: layoutHeight, value: layoutValue },
    pulseKey,
  );
  const { x, y, width, height } = settled;
  const renderedNodeHeight = Math.max(height, nodeConfig?.minNodeHeight ?? 0);
  const renderedNodeY = y + (height - renderedNodeHeight) / 2;
  const nodeValue = Math.round(settled.value);
  // The count slides in when it changes, never on the node's first draw.
  const [firstValue] = useState(nodeValue);
  const countEnters = !reduceMotion && nodeValue !== firstValue;
  const nodeIcon = (payload as RechartsSankeyNode & { icon?: ReactNode }).icon;

  const isHighlighted = isNodeConnected(data, selectedNode, nodeName);
  const hasConfigColor = nodeName in config;
  const configLabel = config[nodeName]?.label ?? nodeName;
  const nodeStroke = nodeConfig?.strokeColorByNode?.[nodeName]
    ?? (nodeConfig?.stroke && hasConfigColor ? `var(--color-${nodeName}-0)` : undefined);
  const labelBackground = nodeConfig?.labelBackgroundByNode?.[nodeName] ?? nodeConfig?.labelBackground;
  const strokeWidth = nodeStroke ? (nodeConfig?.strokeWidth ?? 1.5) : undefined;
  const dimmed = isClickable && !isHighlighted;

  const valueFormatter = label?.valueFormatter ?? ((value: number) => value.toLocaleString());
  const showValues = label?.showValues ?? false;
  const compactZeroValue = nodeConfig?.compactZeroValues && nodeValue === 0;

  const labelX = x + width / 2;
  // A zero-value Sankey band can be too shallow for a two-line inside label.
  // Give that label a compact, centred surface so its text retains real
  // breathing room without changing the data-derived link geometry.
  const labelHeight = label?.position === "inside" ? Math.max(renderedNodeHeight - 2, nodeConfig?.minLabelHeight ?? 0) : renderedNodeHeight;
  const labelBoxY = renderedNodeY + (renderedNodeHeight - labelHeight) / 2;
  const labelCenterY = labelBoxY + labelHeight / 2;
  const labelY = showValues && !compactZeroValue ? labelCenterY - 8 : labelCenterY;
  const valueY = labelCenterY + 8;
  const outsideLabelX = x + width + 8;
  const outsideLabelY = renderedNodeY + renderedNodeHeight / 2;

  return (
    <Layer>
      <rect
        x={x}
        y={renderedNodeY}
        width={width}
        height={renderedNodeHeight}
        rx={radius}
        ry={radius}
        fill={hasConfigColor ? `url(#${chartId}-sankey-colors-${nodeName})` : "currentColor"}
        fillOpacity={dimmed ? 0.15 : 0.9}
        stroke={nodeStroke}
        strokeWidth={strokeWidth}
        className="transition-opacity duration-200"
        style={isClickable ? { cursor: "pointer" } : undefined}
        onClick={() => {
          if (!isClickable) return;
          selectNode(selectedNode === nodeName ? null : nodeName);
        }}
      />
      {label?.position === "inside" && (
        <>
          <rect
            x={x + 1}
            y={labelBoxY}
            width={width - 2}
            height={labelHeight}
            rx={Math.max(0, radius - 1)}
            ry={Math.max(0, radius - 1)}
            fill={labelBackground}
            stroke={nodeStroke ?? (labelBackground ? "#454545" : undefined)}
            strokeWidth={strokeWidth}
            opacity={dimmed ? 0.3 : 1}
            className="fill-white/50 transition-opacity duration-200 dark:fill-black/60"
            style={{ fill: labelBackground, pointerEvents: "none" }}
          />
          {nodeIcon && (
            <foreignObject
              x={labelX - 8}
              y={labelY - 30}
              width={16}
              height={16}
              opacity={dimmed ? 0.3 : 1}
              className="transition-opacity duration-200"
              style={{ pointerEvents: "none" }}
            >
              <div className="text-foreground/80 flex items-center justify-center dark:text-white/80">
                {nodeIcon}
              </div>
            </foreignObject>
          )}
          <text
            x={labelX}
            y={nodeIcon ? labelY - 4 : labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={nodeConfig?.labelColor}
            className="fill-foreground text-[10px] font-medium transition-opacity duration-200 dark:fill-white"
            opacity={dimmed ? 0.3 : 1}
            style={{ pointerEvents: "none" }}
          >
            {compactZeroValue ? `${configLabel} · ${valueFormatter(nodeValue)}` : configLabel}
          </text>
          {showValues && !compactZeroValue && (
            <motion.g
              key={nodeValue}
              initial={countEnters ? { opacity: 0, y: 5 } : false}
              animate={{ opacity: dimmed ? 0.3 : 0.6, y: 0 }}
              transition={{ duration: 0.25, ease: SETTLE_EASE }}
              style={{ pointerEvents: "none" }}
            >
              <text
                x={labelX}
                y={valueY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={nodeConfig?.valueColor ?? nodeConfig?.labelColor}
                className="fill-foreground/60 font-mono text-xs font-medium tabular-nums dark:fill-white"
              >
                {valueFormatter(nodeValue)}
              </text>
            </motion.g>
          )}
        </>
      )}
      {label?.position === "outside" && (
        <>
          <text
            x={outsideLabelX}
            y={outsideLabelY - (showValues ? 8 : 0)}
            textAnchor="start"
            dominantBaseline="middle"
            className="fill-foreground text-xs"
            style={{ pointerEvents: "none" }}
          >
            {configLabel}
          </text>
          {showValues && (
            <text
              x={outsideLabelX}
              y={outsideLabelY + 8}
              textAnchor="start"
              dominantBaseline="middle"
              opacity={0.5}
              className="fill-foreground font-mono text-xs tabular-nums dark:fill-white"
              style={{ pointerEvents: "none" }}
            >
              {valueFormatter(nodeValue)}
            </text>
          )}
        </>
      )}
    </Layer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Link renderer — draws a single sankey link from the resolved <Link /> config
// ─────────────────────────────────────────────────────────────────────────────

type SankeyLinkRendererProps = SankeyLinkProps & {
  linkConfig: LinkProps | null; // resolved props from the composed <Link />
};

/**
 * Renders a single sankey link band, colored by the composed <Link /> variant.
 * Highlights the bands connected to the selected node and dims the rest. The
 * band settles smoothly from the previous layout, and the newest routed item
 * travels its centre curve as a bright head with a fading tail.
 */
const SankeyLink = ({
  sourceX: layoutSourceX,
  targetX: layoutTargetX,
  sourceY: layoutSourceY,
  targetY: layoutTargetY,
  sourceControlX: layoutSourceControlX,
  targetControlX: layoutTargetControlX,
  linkWidth: layoutLinkWidth,
  index,
  payload,
  linkConfig,
}: SankeyLinkRendererProps) => {
  const { config, chartId, selectedNode } = useSankeyChart();
  const reduceMotion = useReducedMotion() ?? false;

  const variant = linkConfig?.variant ?? "gradient";
  const verticalPadding = linkConfig?.verticalPadding ?? 0;
  const pulseKey = linkConfig?.pulseKey ?? null;

  const sourceName = payload.source.name;
  const targetName = payload.target.name;
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth } = useSettledGeometry(
    `link-${sourceName}-${targetName}`,
    {
      sourceX: layoutSourceX,
      targetX: layoutTargetX,
      sourceY: layoutSourceY,
      targetY: layoutTargetY,
      sourceControlX: layoutSourceControlX,
      targetControlX: layoutTargetControlX,
      linkWidth: layoutLinkWidth,
    },
    pulseKey,
  );
  // The routing board has one source node. Only its newest outcome band
  // carries the item, so it reads as one decision crossing the whole path.
  const isPulsing = sourceName === "FEED" && targetName === linkConfig?.pulseTarget && pulseKey !== null;

  const isConnected =
    selectedNode === null || selectedNode === sourceName || selectedNode === targetName;

  // A floored band for an empty outcome is drawn fainter, so its minimum
  // width does not read as real flow.
  const targetValue = (payload.target as RechartsSankeyNode & { displayValue?: number }).displayValue ?? payload.target.value;
  const isEmptyTarget = linkConfig?.emptyTargetOpacity !== undefined && targetValue === 0;

  const paddedLinkWidth = Math.max(1, linkWidth - verticalPadding);
  const halfWidth = paddedLinkWidth / 2;

  const sweepColor = targetName in config ? `var(--color-${targetName}-0)` : "currentColor";
  // The item is a round-capped pill on the lane's centre line, sized to the
  // lane so it stays inside a thin band and does not swamp a wide one.
  const sweepWidth = Math.min(10, Math.max(3, paddedLinkWidth * 0.6));
  const centrePath = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;

  const linkAreaPath = `M${sourceX},${sourceY - halfWidth}
    C${sourceControlX},${sourceY - halfWidth} ${targetControlX},${targetY - halfWidth} ${targetX},${targetY - halfWidth}
    L${targetX},${targetY + halfWidth}
    C${targetControlX},${targetY + halfWidth} ${sourceControlX},${sourceY + halfWidth} ${sourceX},${sourceY + halfWidth}
    Z`;

  // Every dash ends at the same moving point (the head's front), which runs
  // from the lane start until the longest tail has entered the node. The
  // spacing exceeds the path, so each dash is drawn once.
  const sweepDash = (length: number) => ({
    initial: { pathLength: length, pathSpacing: 2, pathOffset: -length },
    animate: { pathOffset: SWEEP_TRAVEL - length, opacity: [0, 1, 1, 0] },
    transition: {
      pathOffset: { duration: SWEEP_DURATION, ease: SWEEP_EASE },
      opacity: { duration: SWEEP_DURATION, times: [0, 0.06, 0.78, 1] },
    },
  });

  return (
    <Layer>
      <defs>
        {variant === "gradient" && (
          <LinkGradient
            chartId={chartId}
            index={index}
            config={config}
            sourceName={sourceName}
            targetName={targetName}
          />
        )}
        <LinkStrokeGradient chartId={chartId} index={index} />
        {isPulsing && (
          <>
            <clipPath id={`${chartId}-link-sweep-clip-${index}`}>
              <path d={linkAreaPath} />
            </clipPath>
            <filter id={`${chartId}-link-pulse-${index}`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </>
        )}
      </defs>
      <path
        d={linkAreaPath}
        fill={getLinkFill(variant, chartId, index, config, sourceName, targetName)}
        fillOpacity={!isConnected ? 0.1 : isEmptyTarget ? linkConfig?.emptyTargetOpacity : 0.4}
        stroke={
          selectedNode !== null && isConnected ? `url(#${chartId}-link-stroke-${index})` : "none"
        }
        strokeWidth={1}
        strokeOpacity={1}
        className="transition-opacity duration-200"
      />
      {isPulsing && (
        <g clipPath={`url(#${chartId}-link-sweep-clip-${index})`} pointerEvents="none" data-sweep={targetName}>
          {reduceMotion ? (
            // Reduced motion: the lane tints in place, with no travel.
            <motion.path
              key={`link-sweep-still-${index}-${pulseKey}`}
              d={linkAreaPath}
              fill={sweepColor}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.35, 0] }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          ) : (
            <g key={`link-sweep-${index}-${pulseKey}`} fill="none" strokeLinecap="round">
              {SWEEP_TAILS.map((tail) => (
                <motion.path
                  key={tail.length}
                  d={centrePath}
                  stroke={sweepColor}
                  strokeWidth={sweepWidth}
                  strokeOpacity={tail.opacity}
                  {...sweepDash(tail.length)}
                />
              ))}
              <motion.path
                d={centrePath}
                stroke={sweepColor}
                strokeWidth={sweepWidth + 3}
                strokeOpacity={0.55}
                filter={`url(#${chartId}-link-pulse-${index})`}
                {...sweepDash(SWEEP_HEAD)}
              />
              <motion.path d={centrePath} stroke={sweepColor} strokeWidth={sweepWidth} {...sweepDash(SWEEP_HEAD)} />
              <motion.path
                d={centrePath}
                stroke="white"
                strokeWidth={Math.max(1.5, sweepWidth * 0.4)}
                strokeOpacity={0.7}
                {...sweepDash(SWEEP_HEAD)}
              />
            </g>
          )}
        </g>
      )}
    </Layer>
  );
};

// Checks whether a node is the selected one or directly linked to it
const isNodeConnected = (
  data: SankeyData,
  selectedNode: string | null,
  nodeName: string,
): boolean => {
  if (selectedNode === null || selectedNode === nodeName) return true;

  const selectedIdx = data.nodes.findIndex((node) => node.name === selectedNode);
  const nodeIdx = data.nodes.findIndex((node) => node.name === nodeName);

  return data.links.some(
    (link) =>
      (link.source === selectedIdx && link.target === nodeIdx) ||
      (link.source === nodeIdx && link.target === selectedIdx),
  );
};

// Resolves the SVG paint reference for a link band based on its variant
const getLinkFill = (
  variant: LinkVariant,
  chartId: string,
  index: number,
  config: ChartConfig,
  sourceName: string,
  targetName: string,
): string => {
  switch (variant) {
    case "gradient":
      return `url(#${chartId}-link-gradient-${index})`;
    case "source":
      return sourceName in config ? `url(#${chartId}-sankey-colors-${sourceName})` : "currentColor";
    case "target":
      return targetName in config ? `url(#${chartId}-sankey-colors-${targetName})` : "currentColor";
    case "solid":
    default:
      return "currentColor";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — SVG defs scoped to the chart's unique id
// ─────────────────────────────────────────────────────────────────────────────

/** Vertical color gradient for every configured node, painted by name. */
const NodeColorGradients = ({ config, chartId }: { config: ChartConfig; chartId: string }) => {
  return (
    <>
      {Object.entries(config).map(([dataKey, nodeConfig]) => {
        const colorsCount = getColorsCount(nodeConfig);

        return (
          <linearGradient
            key={`${chartId}-sankey-colors-${dataKey}`}
            id={`${chartId}-sankey-colors-${dataKey}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            {colorsCount === 1 ? (
              <>
                <stop offset="0%" stopColor={`var(--color-${dataKey}-0)`} />
                <stop offset="100%" stopColor={`var(--color-${dataKey}-0)`} />
              </>
            ) : (
              Array.from({ length: colorsCount }, (_, index) => {
                const offset = `${(index / (colorsCount - 1)) * 100}%`;
                return (
                  <stop
                    key={offset}
                    offset={offset}
                    stopColor={`var(--color-${dataKey}-${index}, var(--color-${dataKey}-0))`}
                  />
                );
              })
            )}
          </linearGradient>
        );
      })}
    </>
  );
};

/** Source-to-target fade gradient that fills a single gradient-variant link. */
const LinkGradient = ({
  chartId,
  index,
  config,
  sourceName,
  targetName,
}: {
  chartId: string;
  index: number;
  config: ChartConfig;
  sourceName: string;
  targetName: string;
}) => {
  const sourceColor = sourceName in config ? `var(--color-${sourceName}-0)` : "currentColor";
  const targetColor = targetName in config ? `var(--color-${targetName}-0)` : "currentColor";

  return (
    <linearGradient id={`${chartId}-link-gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor={sourceColor} stopOpacity={0.2} />
      <stop offset="50%" stopColor={sourceColor} stopOpacity={0.5} />
      <stop offset="100%" stopColor={targetColor} stopOpacity={0.2} />
    </linearGradient>
  );
};

/** Primary-colored stroke gradient highlighting a link connected to the selection. */
const LinkStrokeGradient = ({ chartId, index }: { chartId: string; index: number }) => {
  return (
    <linearGradient id={`${chartId}-link-stroke-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0} />
      <stop offset="15%" stopColor="var(--primary)" stopOpacity={0.8} />
      <stop offset="50%" stopColor="var(--primary)" stopOpacity={1} />
      <stop offset="85%" stopColor="var(--primary)" stopOpacity={0.8} />
      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
    </linearGradient>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The skeleton sankey shown while the chart is loading. Rendered by the root in
 * place of the real diagram — a fixed grid of pulsing nodes and links.
 */
const LoadingSankey = () => {
  const nodes = [
    { x: 30, y: 25, width: 12, height: 65, delay: 0 },
    { x: 30, y: 110, width: 12, height: 50, delay: 0.3 },
    { x: 30, y: 180, width: 12, height: 45, delay: 0.15 },
    { x: 244, y: 20, width: 12, height: 55, delay: 0.45 },
    { x: 244, y: 95, width: 12, height: 75, delay: 0.6 },
    { x: 244, y: 190, width: 12, height: 40, delay: 0.25 },
    { x: 458, y: 35, width: 12, height: 80, delay: 0.5 },
    { x: 458, y: 135, width: 12, height: 90, delay: 0.1 },
  ];

  const links = [
    { from: 0, to: 3, width: 26, delay: 0.2 },
    { from: 0, to: 4, width: 18, delay: 0.7 },
    { from: 1, to: 4, width: 24, delay: 0.4 },
    { from: 1, to: 5, width: 12, delay: 0.9 },
    { from: 2, to: 4, width: 16, delay: 0.1 },
    { from: 2, to: 5, width: 14, delay: 0.55 },
    { from: 3, to: 6, width: 22, delay: 0.35 },
    { from: 3, to: 7, width: 18, delay: 0.8 },
    { from: 4, to: 6, width: 28, delay: 0.05 },
    { from: 4, to: 7, width: 32, delay: 0.65 },
    { from: 5, to: 7, width: 16, delay: 0.45 },
  ];

  // Builds a bezier path connecting the right edge of one node to the left of another
  const getLinkPath = (fromIdx: number, toIdx: number) => {
    const from = nodes[fromIdx];
    const to = nodes[toIdx];
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const controlX1 = startX + (endX - startX) * 0.4;
    const controlX2 = startX + (endX - startX) * 0.6;
    return `M${startX},${startY} C${controlX1},${startY} ${controlX2},${endY} ${endX},${endY}`;
  };

  const baseDuration = LOADING_ANIMATION_DURATION / 1000;

  return (
    <>
      {links.map((link, i) => (
        <motion.path
          key={`loading-link-${link.from}-${link.to}`}
          d={getLinkPath(link.from, link.to)}
          fill="none"
          stroke="currentColor"
          strokeWidth={link.width}
          initial={{ opacity: 0.04 }}
          animate={{ opacity: [0.04, 0.14, 0.04] }}
          transition={{
            duration: baseDuration * (0.8 + (i % 3) * 0.2),
            delay: link.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {nodes.map((node, i) => (
        <motion.rect
          key={`loading-node-${node.x}-${node.y}`}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={2}
          fill="currentColor"
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.4, 0.15] }}
          transition={{
            duration: baseDuration * (0.9 + (i % 4) * 0.1),
            delay: node.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
};

// Compound API: every part hangs off the root as a static member, so a consumer
// writes <EvilSankeyChart.Node/>, <EvilSankeyChart.Tooltip/>, … from a single
// import — no colliding named marker exports when several charts share one file.
EvilSankeyChart.Node = Node;
EvilSankeyChart.NodeLabel = NodeLabel;
EvilSankeyChart.Link = Link;
EvilSankeyChart.Tooltip = Tooltip;
