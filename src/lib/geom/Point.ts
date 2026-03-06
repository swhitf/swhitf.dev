import { round } from './Math';

export interface HasXY { x: number, y: number }
export interface HasWH { w: number, h: number }
export interface HasLeftTop { left: number, top: number }
export interface HasWidthHeight { width: number, height: number }
export type HasPoints =
    readonly Point[] |
    { points(): readonly Point[] } |
    { readonly points: readonly Point[] } |
    { toPoints(): readonly Point[] };

export type PointSource = number | [number, number] | number[] | string | Point | readonly [Point] | HasXY | HasLeftTop | HasWidthHeight;
export type PointMutator = (v: number) => number;

/**
 * Represents an immutable 2d cartesian coordinate or vector.
 */
export class Point {

    public static readonly zero: Point = new Point(0, 0);
    public static readonly origin = new Point(0, 0);
    public static readonly max = new Point(2147483647, 2147483647);
    public static readonly min = new Point(-2147483647, -2147483647);
    public static readonly up = new Point(0, -1);
    public static readonly down = new Point(0, 1);
    public static readonly left = new Point(-1, 0);
    public static readonly right = new Point(1, 0);
    public static readonly x = new Point(1, 0);
    public static readonly y = new Point(0, 1);

    public static average(points: PointSource[]): Point {
        if (!points.length) {
            return Point.zero;
        }
        let x = 0;
        let y = 0;
        for (const ps of points) {
            const p = Point.from(ps);
            x += p.x;
            y += p.y;
        }
        return new Point(x / points.length, y / points.length);
    }

    public static unique(points: PointSource[]): Point[] {
        const index = new Map<string, Point>();
        for (const p of points) {
            const key = Point.from(p).toString();
            if (index.has(key)) continue;
            index.set(key, Point.from(p));
        }
        return Array.from(index.values());
    }

    public static flatten(points: PointSource[]): number[] {
        return points.map(x => Point.from(x)).flatMap(x => x.toArray());
    }

    public static parse(val: string): Point {
        if (val === null || typeof (val) !== 'string') {
            throw new Error(`Point.parse: ${val} is not a valid input.`);
        }
        const [x, y] = (val.match(/\d*\.?\d*/g) || [])
            .filter(v => !!v)
            .map(parseFloat);
        if (x === undefined || y === undefined) {
            throw new Error(`Point.parse: ${val} is not a valid input.`);
        }
        return new Point(x, y);
    }

    public static from(pts: PointSource): Point;
    public static from(pts: any, prefix: string): Point;
    public static from(pts: any, prefix?: string): Point {
        if (pts !== null && pts !== undefined) {
            if (!!prefix && typeof (pts) === 'object') {
                const x = prefix + 'X';
                const y = prefix + 'Y';
                if (!(x in pts && y in pts)) throw new Error('Point.from: prefixed fields not present in object.');
                return Point.from([pts[x], pts[y]]);
            }
            if (pts instanceof Point) {
                return pts;
            }
            if (typeof (pts) === 'number') {
                return new Point(pts, pts);
            }
            if (typeof (pts) === 'string') {
                return Point.parse(pts);
            }
            if (Array.isArray(pts)) {
                if (pts.length === 1) {
                    if (typeof (pts[0]) === 'number') {
                        return new Point(pts[0], pts[1]);
                    }
                    else {
                        return Point.from(pts[0]);
                    }
                }
                if (pts.length === 2) {
                    return new Point(pts[0], pts[1]);
                }
            }
            if ('x' in pts && 'y' in pts) {
                return new Point(pts.x, pts.y);
            }
            if ('left' in pts && 'top' in pts) {
                return new Point(pts.left, pts.top);
            }
            if ('width' in pts && 'height' in pts) {
                return new Point(pts.width, pts.height);
            }
        }
        throw new Error(`Point.from: ${pts} is not a valid input.`);
    }

    public static fromBuffer(buffer: number[], index: number = 0): Point {
        if (buffer.length < (index + 2)) {
            throw new Error('fromBuffer failure: buffer not long enough.');
        }
        return new Point(buffer[index], buffer[index + 1]);
    }

    public static fromKeyCode(keyCode: number) {
        switch (keyCode) {
            case 37: return Point.left;
            case 38: return Point.up;
            case 39: return Point.right;
            case 40: return Point.down;
        }
        return Point.zero;
    }

    public static manyFrom(hp: Point | HasPoints): Point[] {
        if (hp instanceof Point) {
            return [hp];
        }
        if ('points' in hp) {
            return this.manyFrom(typeof (hp.points) === 'function' ? hp.points() : hp.points);
        }
        if ('toPoints' in hp && typeof (hp.toPoints) === 'function') {
            return this.manyFrom(hp.toPoints());
        }
        if (Array.isArray(hp)) {
            if (Point.isPointLike(hp[0])) {
                return hp;
            }
        }
        throw new Error(`Point: ${hp} is not a valid HasPoints`);
    }

    public static coalesce(points: Point[]): Point | null {
        return points.find(x => !!x && x.length() > 0) || null;
    }

    public static vector(origin: PointSource, dest: PointSource): Point {
        return Point.from(dest).subtract(Point.from(origin));
    }

    public static isPointLike(input: any): boolean {
        return (
            ('x' in input && typeof input.x === 'number') &&
            ('y' in input && typeof input.y === 'number')
        );
    }

    public readonly x: number;
    public readonly y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        Object.freeze(this);
    }

    public get w() { return this.x; }
    public get h() { return this.y; }

    public xish() {
        return Math.abs(this.normalize().dot(Point.x)) >= 0.5;
    }

    public yish() {
        return Math.abs(this.normalize().dot(Point.x)) < 0.5;
    }

    public round(precision?: number): Point {
        return this.apply(c => round(c, precision));
    }

    public clamp(min: Point, max: Point): Point {
        return new Point(
            Math.min(Math.max(this.x, min.x), max.x),
            Math.min(Math.max(this.y, min.y), max.y),
        );
    }

    public ceil(): Point { return this.apply(Math.ceil); }
    public floor(): Point { return this.apply(Math.floor); }
    public inverse() { return this.apply(v => v * -1); }
    public length(): number { return this.magnitude(); }

    public area(): number {
        return this.x * this.y;
    }

    public magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(): Point {
        const len = this.magnitude();
        if (len === 1) return this;
        if (len > 0.00001) return this.multiply(1 / len);
        return Point.zero;
    }

    public perp(): Point { return new Point(this.y, -this.x); }
    public perpcw(): Point { return new Point(-this.y, this.x); }

    public quadrant(): 0 | 1 | 2 | 3 {
        const a = this.angle();
        if (a > 0) return a < 1.5708 ? 0 : 1;
        else return a < -1.5708 ? 2 : 3;
    }

    public angle(relativeTo?: PointSource): number {
        const to = Point.from(relativeTo || Point.right);
        return Math.atan2(this.cross(to), this.dot(to));
    }

    public rotate(radians: number): Point {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return Point.from([
            (this.x * cos) + (this.y * -sin),
            (this.x * sin) + (this.y * cos),
        ]);
    }

    public distanceTo(to: Point): number {
        return this.subtract(to).magnitude();
    }

    public nearestOf(pts: readonly Point[]): Point {
        let sd = -1;
        let sp = null as Point | null;
        for (const np of pts) {
            const nd = this.distanceTo(np);
            if (sd < 0 || nd < sd) { sd = nd; sp = np; }
        }
        return sp ?? this;
    }

    public farthestOf(pts: readonly Point[]): Point {
        let sd = -1;
        let sp = null as Point | null;
        for (const np of pts) {
            const nd = this.distanceTo(np);
            if (sd < 0 || nd > sd) { sd = nd; sp = np; }
        }
        return sp ?? this;
    }

    public dot(pts: PointSource): number {
        const pt = Point.from(pts);
        return this.x * pt.x + this.y * pt.y;
    }

    public cross(pts: PointSource): number {
        const pt = Point.from(pts);
        return (this.x * pt.y - this.y * pt.x) * -1;
    }

    public colinear() { return this.x === 0 || this.y === 0; }

    public apply(mutator: PointMutator): Point {
        return new Point(mutator(this.x), mutator(this.y));
    }

    public add(pts: PointSource): Point {
        const pt = Point.from(pts);
        return new Point(this.x + pt.x, this.y + pt.y);
    }

    public subtract(pts: PointSource): Point {
        const pt = Point.from(pts);
        return new Point(this.x - pt.x, this.y - pt.y);
    }

    public multiply(pts: PointSource): Point {
        const pt = Point.from(pts);
        return new Point(this.x * pt.x, this.y * pt.y);
    }

    public divide(pts: PointSource): Point {
        const pt = Point.from(pts);
        return new Point(this.x / pt.x, this.y / pt.y);
    }

    public project(axis: Point) {
        const na = axis.normalize();
        const nv = this.normalize();
        const adnv = na.dot(nv);
        return na.multiply(this.length() * adnv);
    }

    public lerp(to: Point, t: number): Point {
        const omt = 1.0 - t;
        return new Point(this.x * omt + to.x * t, this.y * omt + to.y * t);
    }

    public equals(another: Point): boolean {
        if (!another) throw new Error('Point.equals: specified point was falsey.');
        return this.x === another.x && this.y === another.y;
    }

    public fixNaN(replacement: number = 1): Point {
        return this
            .apply(x => isNaN(x) || Number.isNaN(x) ? replacement : x)
            .apply(x => !Number.isFinite(x) ? replacement : x);
    }

    public format(fmt?: 'object' | 'array' | 'x' | 'svg' | 'px') {
        if (fmt === 'object') return `{x:${this.x}, y:${this.y}}`;
        if (fmt === 'array') return `[${this.x}, ${this.y}]`;
        if (fmt === 'x') return `${this.x}x${this.y}`;
        if (fmt === 'svg') return `${this.x} ${this.y}`;
        if (fmt === 'px') return `${this.x}px, ${this.y}px`;
        return this.toString();
    }

    public toArray(): [number, number] { return [this.x, this.y]; }

    public toCSS() {
        return { left: `${this.x}px`, top: `${this.y}px` };
    }

    public toObject(): HasXY { return { x: this.x, y: this.y }; }

    public toString(): string { return `[${this.x},${this.y}]`; }
}
