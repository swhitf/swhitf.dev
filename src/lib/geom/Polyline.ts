import { Line } from './Line';
import { Matrix } from './Matrix';
import { Path } from './Path';
import { PathCommand } from './PathCommand';
import { type HasPoints, Point } from './Point';
import quickhull from './Quickhull';
import { Rect } from './Rect';

export class Polyline implements Iterable<Point> {

    public static fromHull = quickhull;

    public static from(points: HasPoints, close?: boolean): Polyline {
        const mpts = Point.manyFrom(points);
        if (close && mpts.length > 1 && !mpts[0].equals(mpts[mpts.length - 1])) {
            mpts.push(mpts[0]);
        }
        return new Polyline(mpts);
    }

    public readonly points: readonly Point[];

    constructor(points: readonly Point[]) {
        if (points.length < 1) throw new Error('Path must have more than one point.');
        Object.defineProperty(this, 'points', {
            configurable: false,
            enumerable: true,
            writable: false,
            value: Object.freeze(points.slice(0)),
        });
    }

    public get bounds(): Rect { return Rect.fromPoints(this.points); }
    public get center(): Point {
        if (this.points.length === 0) return Point.zero;
        return this.points.reduce((t, x) => t.add(x)).divide(this.points.length);
    }

    public get closed(): boolean {
        return this.points[0].equals(this.points[this.points.length - 1]);
    }

    public get lines(): readonly Line[] {
        const lines = [] as Line[];
        for (let i = 1; i < this.points.length; i++) {
            const a = this.points[i - 1];
            const b = this.points[i];
            if (a.equals(b)) continue;
            lines.push(new Line(a, b));
        }
        return lines;
    }

    public get length(): number {
        return this.lines.map(x => x.length).reduce((t, x) => t + x, 0);
    }

    public distanceTo(pt: Point): number {
        const dists = this.lines.map(x => x.distanceTo(pt));
        return Math.min(...dists);
    }

    public nearestPointTo(pt: Point): Point {
        return this.lines.map(x => x.nearestPointTo(pt))
            .reduce((a, b) => a.distanceTo(pt) < b.distanceTo(pt) ? a : b);
    }

    public inflate(amount: number) {
        return new Polyline(this.points.map(p => {
            const v = p.subtract(this.center).normalize();
            return p.add(v.multiply(amount));
        }));
    }

    public transform(mt: Matrix): Polyline {
        return new Polyline(mt.apply(this.points));
    }

    public round() {
        return new Polyline(this.points.map(x => x.round()));
    }

    public contains(input: Point | HasPoints): boolean {
        const points = Point.manyFrom(input);
        for (const pt of points) {
            if (!this.bounds.contains(pt)) return false;
            const ray = new Line(new Point(Point.max.x, pt.y), pt);
            let count = 0;
            for (const ln of this.lines) {
                if (ln.distanceTo(pt) < 0.00001) { count = 1; break; }
                // Simple line-line intersection check
                const d1 = ray.p2.subtract(ray.p1);
                const d2 = ln.p2.subtract(ln.p1);
                const cross = d1.x * d2.y - d1.y * d2.x;
                if (Math.abs(cross) < 1e-10) continue;
                const t = ((ln.p1.x - ray.p1.x) * d2.y - (ln.p1.y - ray.p1.y) * d2.x) / cross;
                const u = ((ln.p1.x - ray.p1.x) * d1.y - (ln.p1.y - ray.p1.y) * d1.x) / cross;
                if (t >= 0 && t <= 1 && u >= 0 && u <= 1) count++;
            }
            if (count % 2 === 0) return false;
        }
        return true;
    }

    public toClosed() {
        if (this.closed) return this;
        return new Polyline([...this.points, this.points[0]]);
    }

    public toPath(close = true) {
        const cmds = this.points.map((pt, i) => i === 0 ? ['M', pt] : ['L', pt]) as PathCommand[];
        if (close) cmds.push(['Z']);
        return new Path(cmds);
    }

    public toRoundedPath(method: 'quadratic' | 'cubic', factor: number | number[], close = true) {
        if (Array.isArray(factor) && !factor.length) return this.toPath(close);
        if (!factor || Number(factor) < 0) return this.toPath(close);

        const fx = Array.isArray(factor)
            ? (i: number) => factor[i] ?? 0
            : (_i: number) => factor as number;

        const kappa = 0.5522847498307933984022516322796;
        const cmds = [] as PathCommand[];
        const lines = this.lines.filter(x => x.length !== 0);

        for (let i = 0; i < lines.length; i++) {
            const a = lines[i % lines.length];
            const b = lines[(i + 1) % lines.length];
            const l = Math.min(a.length / 2, b.length / 2, fx(i));
            const p1 = a.p1;
            const p2 = a.p2;
            const p3 = b.p2;
            const sp = p2.add(Point.vector(p2, p1).normalize().multiply(l));
            const ep = p2.add(Point.vector(p2, p3).normalize().multiply(l));

            cmds.push([i === 0 ? 'M' : 'L', sp]);

            if (method === 'quadratic') {
                cmds.push(['Q', p2, ep]);
            }
            else {
                const cp1 = sp.add(Point.vector(sp, p2).normalize().multiply(l * kappa));
                const cp2 = ep.add(Point.vector(ep, p2).normalize().multiply(l * kappa));
                cmds.push(['C', cp1, cp2, ep]);
            }
        }

        if (close) cmds.push(['Z']);
        return new Path(cmds);
    }

    public toArray(): Point[] { return this.points.slice(0); }

    public [Symbol.iterator](): Iterator<Point> {
        return this.points[Symbol.iterator]();
    }
}
