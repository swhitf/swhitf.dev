import { Matrix } from './Matrix';
import { PathCommand } from './PathCommand';
import { type HasPoints, Point } from './Point';
import { Rect } from './Rect';

export class Path implements Iterable<PathCommand> {

    public static from(hp: HasPoints): Path {
        const points = Point.manyFrom(hp);
        const commands = points.map((x, i) => [i === 0 ? 'M' : 'L', x]) as PathCommand[];
        return new Path(commands.concat([['Z']]));
    }

    public static parse(pathString: string) {
        return new Path(PathCommand.from(pathString));
    }

    public static builder(): PathBuilder {
        return new PathBuilder();
    }

    public readonly commands: readonly PathCommand[];

    constructor(commands: readonly PathCommand[]) {
        if (!commands[0] || (commands[0][0] !== 'M' && commands[0][0] !== 'Z')) {
            throw new Error('Path: first command must be M or Z.');
        }
        this.commands = commands;
    }

    public get closed() {
        return this.commands.length > 0 && this.commands[this.commands.length - 1][0] === 'Z';
    }

    public bounds(strokeWidth: number = 0) {
        const points: Point[] = [];
        for (const cmd of this.commands) {
            for (let i = 1; i < cmd.length; i++) {
                if (cmd[i] instanceof Point) points.push(cmd[i] as Point);
            }
        }
        if (!points.length) return Rect.empty;
        const rect = Rect.fromPoints(points);
        if (strokeWidth) return rect.inflate([strokeWidth / 2, strokeWidth / 2]);
        return rect;
    }

    public concat(...paths: Path[]): Path {
        return new Path([this, ...paths].flatMap(x => x.commands));
    }

    public scale(sx: number, sy?: number): Path {
        return this.transform(Matrix.scale(sx, sy ?? sx));
    }

    public transform(mt: Matrix): Path {
        return new Path(this.commands.map((c: any[]) => {
            const [type, ...args] = c;
            if (type === 'A') {
                const [radii, rotation, largeArc, sweep, endPoint] = args as [Point, number, 0 | 1, 0 | 1, Point];
                const scaleX = Math.sqrt(mt.a * mt.a + mt.c * mt.c);
                const scaleY = Math.sqrt(mt.b * mt.b + mt.d * mt.d);
                const transformedRadii = new Point(radii.x * scaleX, radii.y * scaleY);
                const matrixRotation = Math.atan2(mt.c, mt.a);
                const transformedRotation = rotation + (matrixRotation * 180 / Math.PI);
                const transformedEndPoint = mt.apply(endPoint);
                return ['A', transformedRadii, transformedRotation, largeArc, sweep, transformedEndPoint] as PathCommand;
            }
            return c.map(x => x instanceof Point ? mt.apply(x) : x) as PathCommand;
        }));
    }

    public toClosed() {
        const c = this.commands;
        if (c[c.length - 1][0] === 'Z') return this;
        return new Path([...c, ['Z']]);
    }

    public toRounded(method: 'quadratic' | 'cubic', factor: number | number[]) {
        if (Array.isArray(factor) && !factor.length) return this;
        if (!factor || Number(factor) < 0) return this;
        if (this.commands.length < 3) return this;

        const fx = Array.isArray(factor)
            ? (i: number) => factor[i] ?? 0
            : (_i: number) => factor as number;

        const kappa = 0.5522847498307933984022516322796;
        const cmds = [] as PathCommand[];
        const f = ['M', 'L'];
        const open = !this.closed;
        const startPoint = this.commands[0][1] as Point;
        const numPointCommands = this.closed ? this.commands.length - 1 : this.commands.length;

        const getCmd = (idx: number): PathCommand => {
            if (this.closed) idx = ((idx % numPointCommands) + numPointCommands) % numPointCommands;
            return this.commands[idx];
        };

        const getPoint = (cmd: PathCommand): Point => {
            if (cmd[0] === 'Z') return startPoint;
            return cmd[1] as Point;
        };

        const count = open ? numPointCommands - 2 : numPointCommands;

        for (let i = 0; i < count; i++) {
            const cmdA = getCmd(i);
            const cmdB = getCmd(i + 1);
            const cmdC = getCmd(i + 2);

            const [at] = cmdA;
            const [bt] = cmdB;
            const [ct] = cmdC;

            const a = getPoint(cmdA);
            const b = getPoint(cmdB);
            const c = getPoint(cmdC);

            if (f.includes(at) && f.includes(bt) && f.includes(ct)) {
                const ab = Point.vector(a, b);
                const bc = Point.vector(b, c);
                const l = Math.min(ab.length() / 2, bc.length() / 2, fx(i));

                const sp = b.add(Point.vector(b, a).normalize().multiply(l));
                const ep = b.add(Point.vector(b, c).normalize().multiply(l));

                if (open && i === 0) {
                    cmds.push(['M', a]);
                    cmds.push(['L', sp]);
                }

                cmds.push([at, sp] as any);
                if (method === 'quadratic') {
                    cmds.push(['Q', b, ep]);
                }
                else {
                    const cp1 = sp.add(Point.vector(sp, b).normalize().multiply(l * kappa));
                    const cp2 = ep.add(Point.vector(ep, b).normalize().multiply(l * kappa));
                    cmds.push(['C', cp1, cp2, ep]);
                }

                if (open && i === count - 1) {
                    cmds.push(['L', c]);
                }
            }
            else {
                cmds.push(this.commands[i]);
            }
        }

        if (!open) cmds.push(['Z']);

        return new Path(cmds);
    }

    public toString(leaveOpen?: boolean): string {
        const path = [] as string[];
        for (const [type, ...args] of this.commands) {
            if (type === 'Z' && leaveOpen) continue;
            path.push(type);
            path.push(...args.map((a: any) => a instanceof Point ? a.format('svg') : a));
        }
        return path.join(' ');
    }

    [Symbol.iterator](): Iterator<PathCommand> {
        return this.commands[Symbol.iterator]();
    }
}

class PathBuilder {

    public readonly commands: PathCommand[] = [];

    public get empty() { return this.commands.length === 0; }

    public moveTo(p: Point): this {
        this.commands.push(['M', p]);
        return this;
    }

    public cubeTo(cp1: Point, cp2: Point, p: Point): this {
        this.commands.push(['C', cp1, cp2, p]);
        return this;
    }

    public continueCubeTo(cp2: Point, p: Point): this {
        this.commands.push(['S', cp2, p]);
        return this;
    }

    public quadTo(cp: Point, p: Point, continuation?: Point[]): this {
        this.commands.push(['Q', cp, p]);
        for (const x of continuation ?? []) {
            this.commands.push(['T', x]);
        }
        return this;
    }

    public lineTo(p: Point | Point[]): this {
        p = Array.isArray(p) ? p : [p];
        for (const x of p) {
            this.commands.push(['L', x]);
        }
        return this;
    }

    public arcTo([rx, ry, rotation, laf, sf]: [number, number, number, 0 | 1, 0 | 1], p: Point): this {
        this.commands.push(['A', new Point(rx, ry), rotation, laf, sf, p]);
        return this;
    }

    public addPath(path: Path): this {
        this.commands.push(...path.commands.filter(x => x[0] !== 'Z'));
        return this;
    }

    public build(close?: boolean): Path {
        return close ? new Path([...this.commands, ['Z']]) : new Path([...this.commands]);
    }
}
