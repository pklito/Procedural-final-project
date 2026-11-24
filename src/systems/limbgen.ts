import { Engine } from '../engine';
import { Vec2 } from '../physics';
import { Segment } from '../segment';

export function spawnRandomSegment(engine: Engine, position: Vec2) {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  // Pick a random shape type
  const kind = Math.floor(Math.random() * 2);
  let shape: any;

  if (kind === 0) {
    shape = { type: 'circle', radius: rand(0.1, 0.5) };
  } else if (kind === 1) {
    shape = { type: 'rect', width: rand(0.1, 0.5), height: rand(0.3, 2.) };
  } else {
    const s = rand(0.4, 1.2);
    shape = {
      type: 'polygon',
      vertices: [
        [0, s],
        [-s * 0.9, -s * 0.5],
        [s * 0.9, -s * 0.5],
      ],
    };
  }

  const seg = new Segment(engine, {
    x: position.x,
    y: position.y,
    shape,
    color: Math.floor(Math.random() * 0xffffff),
  });
  engine.add(seg);
  return seg;
}
