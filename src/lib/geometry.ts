import type { DiagramTab } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from './nodeTypes';
import { flowPath } from './flowGeometry';
export interface Bounds { x: number; y: number; width: number; height: number }
const title: Bounds = { x: 0, y: 0, width: 460, height: 110 };
function union(boxes: Bounds[]): Bounds {
  const x=Math.min(...boxes.map(b => b.x)),y=Math.min(...boxes.map(b => b.y));
  return {x,y,width:Math.max(...boxes.map(b => b.x+b.width))-x,height:Math.max(...boxes.map(b => b.y+b.height))-y};
}
export function contentBounds(tab: DiagramTab): Bounds {
  const boxes:Bounds[]=tab.nodes.map(n=>({x:n.x,y:n.y,width:NODE_WIDTH,height:NODE_HEIGHT}));
  for (const flow of tab.flows) {
    const route=flowPath(tab,flow);
    for (const p of route.points) boxes.push({x:p.x-12,y:p.y-12,width:24,height:24});
    boxes.push({x:route.label.x-90,y:route.label.y-28,width:180,height:56});
  }
  return boxes.length ? union(boxes) : {...title};
}
export function legendBox(tab: DiagramTab): Bounds {
  const content=contentBounds(tab);
  return {x:content.x+content.width+20,y:content.y+content.height+20,width:360,height:190};
}
export function diagramBounds(tab: DiagramTab): Bounds {
  return union([title,contentBounds(tab),legendBox(tab)]);
}
