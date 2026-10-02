import { describe, expect, it } from 'vitest';
import type { DiagramTab, Port, FlowNode, DataFlow } from '../types';
import { defaultNode, defaultFlow } from './defaults';
import { makeProject } from './templates';
import { flowPath } from './flowGeometry';
import { NODE_WIDTH as W, NODE_HEIGHT as H } from './nodeTypes';
const ports:Port[]=['top','right','bottom','left'];
const node=(id:string,x:number,y:number):FlowNode=>({...defaultNode('subject', 'collect'),id,x,y});
const flow=(id:string,from:string,to:string,sourceHandle:Port,targetHandle:Port):DataFlow=>({...defaultFlow(from,to),id,sourceHandle,targetHandle});
function endpoint(n:FlowNode,p:Port) { return {x:n.x+(p==='left'?0:p==='right'?W:W/2),y:n.y+(p==='top'?0:p==='bottom'?H:H/2)}; }
function assertSafe(tab:DiagramTab,f:DataFlow) {
  const route=flowPath(tab,f),a=tab.nodes.find(n=>n.id===f.from)!,b=tab.nodes.find(n=>n.id===f.to)!;
  expect(route.routeWarning).toBeUndefined();
  expect(route.points[0]).toEqual(endpoint(a,f.sourceHandle??'right'));
  expect(route.points.at(-1)).toEqual(endpoint(b,f.targetHandle??'left'));
  for(let i=1;i<route.points.length;i++) {
    const p=route.points[i-1],q=route.points[i];
    expect(p.x===q.x||p.y===q.y).toBe(true);
    expect(p).not.toEqual(q);
    for(const n of tab.nodes) {
      const crosses=p.x===q.x
        ? p.x>n.x&&p.x<n.x+W&&Math.max(p.y,q.y)>n.y&&Math.min(p.y,q.y)<n.y+H
        : p.y>n.y&&p.y<n.y+H&&Math.max(p.x,q.x)>n.x&&Math.min(p.x,q.x)<n.x+W;
      expect(crosses,`${f.sourceHandle}→${f.targetHandle}: ${JSON.stringify(p)}→${JSON.stringify(q)}`).toBe(false);
    }
  }
  return route;
}
describe('port-preserving orthogonal routing',()=>{
  for(const sourceHandle of ports) for(const targetHandle of ports) {
    it(`${sourceHandle}→${targetHandle} routes around endpoint interiors`,()=>{
      for(const [x,y] of [[500,220],[80,500],[-250,100],[300,220]]) {
        const f=flow('f','a','b',sourceHandle,targetHandle);
        const tab:DiagramTab={id:'tab',name:'',nodes:[node('a',80,220),node('b',x,y)],flows:[f]};
        assertSafe(tab,f);
        expect(flowPath(tab,f)).toEqual(flowPath(tab,f));
      }
    });
    it(`${sourceHandle}→${targetHandle} self-loop retains both ports and has a nonzero lane`,()=>{
      const f=flow('self','a','a',sourceHandle,targetHandle);
      const tab:DiagramTab={id:'tab',name:'',nodes:[node('a',80,220)],flows:[f]};
      const route=assertSafe(tab,f);
      expect(Math.min(...route.points.map(p=>p.x))).toBeLessThan(80);
      expect(Math.max(...route.points.map(p=>p.x))).toBeGreaterThan(80+W);
      expect(route.label).toEqual({x:180,y:148});
    });
  }
  it('parallel and reverse flow labels occupy separate lanes without changing IDs or ports',()=>{
    const flows=[flow('f1','a','b','bottom','top'),flow('f2','a','b','left','right'),flow('f3','b','a','top','bottom')];
    const tab:DiagramTab={id:'tab',name:'',nodes:[node('a',80,220),node('b',500,220)],flows};
    const original=structuredClone(tab),routes=flows.map(f=>assertSafe(tab,f));
    expect(routes.map(r=>r.label.y)).toEqual([148,76,4]);
    expect(tab).toEqual(original);
  });
  it('overlap preserves connection and returns a warning rather than deleting or repairing it',()=>{
    const f=flow('f','a','b','top','left'),tab:DiagramTab={id:'tab',name:'',nodes:[node('a',80,220),node('b',100,230)],flows:[f]};
    const original=structuredClone(tab),route=flowPath(tab,f);
    expect(route.routeWarning).toBe('overlapping-endpoints');
    expect(route.points).toEqual([endpoint(tab.nodes[0],'top'),endpoint(tab.nodes[1],'left')]);
    expect(tab).toEqual(original);
  });
});
describe('nonendpoint obstacles and immutable route cache',()=>{
  it('keeps all six synthetic flows clear of every unrelated node',()=>{
    const tab=makeProject(true).tabs[0];
    for(const f of tab.flows) assertSafe(tab,f);
  });
  it('reroutes a direct line around an intermediate node without changing ports or project data',()=>{
    const f=flow('f','a','b','right','left');
    const tab:DiagramTab={id:'tab',name:'',nodes:[node('a',0,0),node('c',340,0),node('b',760,0)],flows:[f]};
    const original=structuredClone(tab);
    const route=assertSafe(tab,f);
    expect(route.points.some(p=>p.y<0||p.y>H)).toBe(true);
    expect(tab).toEqual(original);
    expect(flowPath(tab,f)).toBe(route);
    expect(flowPath({...tab,nodes:tab.nodes.map(n=>n.id==='c'?{...n,y:240}:n)},f)).not.toBe(route);
    expect(flowPath(tab,{...f,name:'revised'})).not.toBe(route);
  });
  it('marks a blocked port as obstructed instead of returning a false healthy line',()=>{
    const f=flow('f','a','b','right','left');
    const tab:DiagramTab={id:'tab',name:'',nodes:[node('a',0,0),node('c',200,0),node('b',680,0)],flows:[f]};
    const route=flowPath(tab,f);
    expect(route.routeWarning).toBe('obstructed-route');
    expect(route.points).toEqual([endpoint(tab.nodes[0],'right'),endpoint(tab.nodes[2],'left')]);
    expect(tab.flows).toEqual([f]);
  });
});
