import { Engine } from '../engine';
import { Vec2 } from '../physics';
import { Segment } from '../segment';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function spawns(engine: Engine, position: Vec2, shape: any): Segment {
  const seg = new Segment(engine, {
    x: position.x,
    y: position.y,
    shape,
    color: Math.floor(Math.random() * 0xffffff),
  });
  engine.add(seg);
  return seg;
}

export function spawnRectangle(e: Engine, p: Vec2): Segment {
  return spawns(e, p, { type: 'rect', width: rand(0.1, 0.5), height: rand(0.3, 2) });
}

export function spawnRock(e: Engine, p: Vec2): Segment {
  let shape: any = {
    type: 'polygon',
    vertices: softTurbulence(catmulClark(randomRemove(startingShape(1), 0.3), 0.6)),
  };
  return spawns(e, p, shape);
}

export function spawnWeird(e: Engine, p: Vec2): Segment {
  let a = startingShape(1);
  for(let i = 0; i < rand(3,8); i++){
    let r = Math.floor(rand(0,5));
    switch(r){
      case 0:
        a = catmulClark(a, rand(0.,0.5));
        break;
      case 1:
        a = softTurbulence(a, rand(0.1,0.3));
        break;
      case 2:
        a = randomRemove(a, 0.3, 5);
        break;
      case 3:
        a = scale(a, 0.8, 1.3);
        break;
      case 4:
        a = scale(a, rand(0.2,2), rand(0.2, 2));
        break;
    }
  }
  let shape: any = {
    type: 'polygon',
    vertices: a
  };
  return spawns(e, p, shape);
}

export function spawnElipse(e: Engine, p: Vec2) {
  //scale(catmulClark(randomRemove(catmulClark(startingShape(1),rand(0.2,0.6)),0.5),rand(0.2,0.6)),1., rand(0.2, 0.7));
  const s = pipe(
    startingShape(1),
    (p) => catmulClark(p, rand(0.2, 0.6)),
    (p) => randomRemove(p, 0.5),
    (p) => catmulClark(p, rand(0.2, 0.6)),
    (p) => scale(p, rand(0.7, 1.3), rand(0.2, 0.8)),
  );
  let shape: any = {
    type: 'polygon',
    vertices: s,
  };

  return spawns(e, p, shape);
}

//Pipelines
const pipe = <T>(v: T, ...fns: ((v: T) => T)[]) => fns.reduce((a, f) => f(a), v);

function startingShape(s: number = 1): [number, number][] {
  return [
    [-0.5 * s, -0.5 * s],
    [0.5 * s, -0.5 * s],
    [0.5 * s, 0.5 * s],
    [-0.5 * s, 0.5 * s],
  ];
}

function catmulClark(
  pts: [number, number][],
  hardness: number,
  iterations: number = 3,
): [number, number][] {
  const h = Math.min(1, Math.max(0, hardness));
  let current = pts;

  for (let it = 0; it < iterations; it++) {
    const n = current.length;
    const next: [number, number][] = [];

    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const cur = current[i];
      const nxt = current[(i + 1) % n];

      const sx = (prev[0] + 6 * cur[0] + nxt[0]) / 8;
      const sy = (prev[1] + 6 * cur[1] + nxt[1]) / 8;

      next.push([sx + (cur[0] - sx) * h, sy + (cur[1] - sy) * h]);
      next.push([(cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2]);
    }

    current = next;
  }

  return current;
}

function randomRemove(
  pts: [number, number][],
  odds: number,
  minPts: number = 4,
): [number, number][] {
  const order = pts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const removed = new Set<number>();
  for (const idx of order) {
    if (pts.length - removed.size <= minPts) break;
    if (Math.random() < odds) removed.add(idx);
  }

  return pts.filter((_, i) => !removed.has(i));
}

function softTurbulence(pts: [number, number][], amplitude: number = 0.15): [number, number][] {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;

  const octaves = [2, 3, 5].map((k) => ({
    k,
    phase: Math.random() * Math.PI * 2,
    amp: amplitude / (k - 1),
  }));

  return pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const angle = Math.atan2(dy, dx);

    let noise = 0;
    for (const o of octaves) noise += Math.sin(o.k * angle + o.phase) * o.amp;

    const scale = 1 + noise;
    return [cx + dx * scale, cy + dy * scale] as [number, number];
  });
}

function scale(pts: [number, number][], sx: number, sy: number): [number, number][] {
  return pts.map(([x, y]) => {
    return [x * sx, y * sy];
  });
}
