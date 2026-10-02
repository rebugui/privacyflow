import { expect, it } from 'vitest';
import type { DiagramTab } from '../types';
import { defaultNode, defaultFlow } from './defaults';
import { contentBounds, diagramBounds, legendBox } from './geometry';
import { flowPath } from './flowGeometry';
it('includes negative self lanes, full labels and arrow margins in export bounds',()=>{
  const tab:DiagramTab={id:'t',name:'',nodes:[{...defaultNode('subject', 'collect'),id:'n',x:0,y:0}],flows:[1,2,3].map(i=>({...defaultFlow('n','n'),id:`f${i}`,sourceHandle:'top',targetHandle:'top'}))};
  const b=diagramBounds(tab);
  const contains=(x:number,y:number)=>{expect(x).toBeGreaterThanOrEqual(b.x);expect(y).toBeGreaterThanOrEqual(b.y);expect(x).toBeLessThanOrEqual(b.x+b.width);expect(y).toBeLessThanOrEqual(b.y+b.height);};
  for(const f of tab.flows) {
    const r=flowPath(tab,f);
    for(const p of r.points) {contains(p.x-12,p.y-12);contains(p.x+12,p.y+12);}
    contains(r.label.x-90,r.label.y-28);contains(r.label.x+90,r.label.y+28);
  }
  const legend=legendBox(tab);contains(legend.x,legend.y);contains(legend.x+legend.width,legend.y+legend.height);
  contains(0,0);contains(460,110);
});
it('empty diagrams retain finite title and legend bounds',()=>{
  const tab:DiagramTab={id:'t',name:'',nodes:[],flows:[]};
  expect(contentBounds(tab)).toEqual({x:0,y:0,width:460,height:110});
  const b=diagramBounds(tab);
  expect(Object.values(b).every(Number.isFinite)).toBe(true);
  expect(b.width).toBeGreaterThan(460);expect(b.height).toBeGreaterThan(110);
});
