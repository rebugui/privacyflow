import type { DataFlow, DiagramTab, FlowNode, Port } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from './nodeTypes';

export interface Point { x: number; y: number }
export interface FlowRoute {
  points: Point[];
  label: Point;
  routeWarning?: 'overlapping-endpoints';
}
interface Rect { x: number; y: number; right: number; bottom: number }
const directions: Record<Port, Point> = {
  top: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const portOrder: Port[] = ['top', 'right', 'bottom', 'left'];
const rect = (node: FlowNode): Rect => ({
  x: node.x, y: node.y, right: node.x + NODE_WIDTH, bottom: node.y + NODE_HEIGHT,
});
const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const inside = (p: Point, r: Rect) => p.x > r.x && p.x < r.right && p.y > r.y && p.y < r.bottom;
function portPoint(node: FlowNode, port: Port): Point {
  const d = directions[port];
  return { x: node.x + NODE_WIDTH / 2 + d.x * NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT / 2 + d.y * NODE_HEIGHT / 2 };
}
function stub(point: Point, port: Port, obstacle?: Rect): Point {
  const d = directions[port];
  let distance = Infinity;
  if (obstacle) {
    if (d.x && point.y >= obstacle.y && point.y <= obstacle.bottom) {
      const edge = d.x > 0 ? obstacle.x : obstacle.right;
      const gap = (edge - point.x) * d.x;
      if (gap >= 0) distance = gap;
    } else if (d.y && point.x >= obstacle.x && point.x <= obstacle.right) {
      const edge = d.y > 0 ? obstacle.y : obstacle.bottom;
      const gap = (edge - point.y) * d.y;
      if (gap >= 0) distance = gap;
    }
  }
  const length = Math.min(20, distance / 2);
  return { x: point.x + d.x * length, y: point.y + d.y * length };
}
function clearSegment(a: Point, b: Point, boxes: Rect[]): boolean {
  return boxes.every(r => a.x === b.x
    ? !(a.x > r.x && a.x < r.right && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.bottom)
    : !(a.y > r.y && a.y < r.bottom && Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.right));
}
function direction(a: Point, b: Point): number {
  return a.y > b.y ? 0 : a.x < b.x ? 1 : a.y < b.y ? 2 : 3;
}
interface Graph { points: Point[]; neighbors: number[][] }
function visibilityGraph(required: Point[], boxes: Rect[]): Graph {
  const xs = [...new Set([...required.map(p => p.x), ...boxes.flatMap(r => [r.x - 12, r.right + 12])])].sort((a,b) => a-b);
  const ys = [...new Set([...required.map(p => p.y), ...boxes.flatMap(r => [r.y - 12, r.bottom + 12])])].sort((a,b) => a-b);
  const points: Point[] = [], rows = new Map<number, number[]>(), cols = new Map<number, number[]>();
  for (const x of xs) for (const y of ys) {
    const p = { x,y };
    if (boxes.some(r => inside(p,r))) continue;
    const id = points.length;
    points.push(p);
    const row = rows.get(y) ?? []; row.push(id); rows.set(y,row);
    const col = cols.get(x) ?? []; col.push(id); cols.set(x,col);
  }
  const neighbors = points.map(() => [] as number[]);
  for (const ids of [...rows.values(), ...cols.values()]) {
    for (let i=1;i<ids.length;i++) {
      const a=ids[i-1], b=ids[i];
      if (clearSegment(points[a], points[b], boxes)) { neighbors[a].push(b); neighbors[b].push(a); }
    }
  }
  return { points, neighbors };
}
// Grid indices are ordered by x/y, and direction indices by top/right/bottom/left.
// Picking the lowest state index on ties makes symmetric routes deterministic.
function shortest(graph: Graph, from: Point, to: Point, initialDirection: number): { points: Point[]; direction: number } | null {
  if (equal(from,to)) return { points: [from], direction: initialDirection };
  const start = graph.points.findIndex(p => equal(p,from)), end = graph.points.findIndex(p => equal(p,to));
  if (start < 0 || end < 0) return null;
  const count = graph.points.length * 4;
  const costs = new Float64Array(count).fill(Infinity), previous = new Int32Array(count).fill(-1), visited = new Uint8Array(count);
  const startState = start * 4 + initialDirection;
  costs[startState] = 0;
  let final = -1;
  for (;;) {
    let state = -1, cost = Infinity;
    for (let i=0;i<count;i++) if (!visited[i] && costs[i] < cost) { state=i; cost=costs[i]; }
    if (state < 0) break;
    const at = Math.floor(state / 4), heading = state % 4;
    if (at === end) { final = state; break; }
    visited[state] = 1;
    for (const next of graph.neighbors[at]) {
      const a=graph.points[at], b=graph.points[next], dir=direction(a,b), target=next*4+dir;
      const nextCost=cost+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+(dir === heading ? 0 : 20);
      if (nextCost < costs[target]) { costs[target]=nextCost; previous[target]=state; }
    }
  }
  if (final < 0) return null;
  const path: Point[]=[];
  for (let state=final;state>=0;state=previous[state]) path.push(graph.points[Math.floor(state/4)]);
  return { points: path.reverse(), direction: final % 4 };
}
function simplify(points: Point[]): Point[] {
  const out: Point[]=[];
  for (const p of points) {
    if (out.length && equal(out[out.length-1],p)) continue;
    while (out.length>=2) {
      const a=out[out.length-2],b=out[out.length-1];
      if ((b.x-a.x)*(p.y-b.y)!==(b.y-a.y)*(p.x-b.x) || (b.x-a.x)*(p.x-b.x)+(b.y-a.y)*(p.y-b.y)<=0) break;
      out.pop();
    }
    out.push(p);
  }
  return out;
}
export function flowPath(tab: DiagramTab, flow: DataFlow): FlowRoute {
  const source=tab.nodes.find(n => n.id===flow.from), target=tab.nodes.find(n => n.id===flow.to);
  if (!source || !target) throw new Error('흐름의 끝점이 올바르지 않습니다');
  const sourcePort=flow.sourceHandle ?? 'right', targetPort=flow.targetHandle ?? 'left';
  const first=portPoint(source,sourcePort), last=portPoint(target,targetPort);
  const a=rect(source),b=rect(target), self=source.id===target.id;
  const fallback=():FlowRoute => ({ points:[first,last],label:{x:(first.x+last.x)/2,y:(first.y+last.y)/2},routeWarning:'overlapping-endpoints' });
  if (!self && a.x<b.right && a.right>b.x && a.y<b.bottom && a.bottom>b.y) return fallback();
  const start=stub(first,sourcePort,self?undefined:b), end=stub(last,targetPort,self?undefined:a);
  const peers=tab.flows.filter(f => (f.from===flow.from && f.to===flow.to) || (!self && f.from===flow.to && f.to===flow.from));
  const lane=self || peers.length>1;
  const index=Math.max(0,peers.findIndex(f => f.id===flow.id));
  const laneY=Math.min(a.y,b.y)-72*(index+1), left=Math.min(a.x,b.x)-32, right=Math.max(a.right,b.right)+32;
  const required=lane ? [start,{x:left,y:laneY},{x:right,y:laneY},end] : [start,end];
  const graph=visibilityGraph(required,self?[a]:[a,b]);
  const result:Point[]=[first];
  let heading=portOrder.indexOf(sourcePort);
  for (let i=1;i<required.length;i++) {
    const part=shortest(graph,required[i-1],required[i],heading);
    if (!part) return fallback();
    result.push(...part.points); heading=part.direction;
  }
  result.push(last);
  const points=simplify(result);
  let label:Point={x:(left+right)/2,y:laneY};
  if (!lane) {
    let longest=-1;
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],length=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
      if (length>longest) {longest=length;label={x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
    }
  }
  return {points,label};
}
