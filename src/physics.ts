import RAPIER from '@dimforge/rapier2d-compat';
import {Engine} from './engine';

export class Physics {
    static world: RAPIER.World;

    static async init() {
        await RAPIER.init();
        Physics.world = new RAPIER.World({x: 0, y: 0});
        Engine.engine.onUpdate(() => Physics.world.step());
    }
}