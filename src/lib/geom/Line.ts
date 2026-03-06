import { Matrix } from './Matrix';
import { Point } from './Point';

export type LineSource = readonly Point[] | readonly number[];

export class Line {

    public readonly p1: Point;
    public readonly p2: Point;

    public static ray(origin: Point, vector: Point): Line {
        const mag = Number.MAX_SAFE_INTEGER;
        return new Line(origin, origin.add(vector.normalize().multiply(mag)));
    }

    public static from(ls: LineSource): Line {
        if (ls !== null && ls !== undefined) {
            if (Array.isArray(ls)) {
                if (ls[0] instanceof Point) return new Line(ls[0], ls[1]);
                if (typeof ls[0] === 'number') return new Line(new Point(ls[0], ls[1]), new Point(ls[2], ls[3]));
            }
        }
        throw new Error(`Line: ${ls} is not a valid source.`);
    }

    constructor(p1: Point, p2: Point) {
        this.p1 = p1;
        this.p2 = p2;
    }

    public get direction(): Point { return this.toVector().normalize(); }
    public get length(): number { return this.toVector().length(); }
    public get mid(): Point { return new Point((this.p1.x + this.p2.x) / 2, (this.p1.y + this.p2.y) / 2); }
    public get normal(): Point { return this.toVector().perp().normalize(); }

    public reverse(): Line { return new Line(this.p2, this.p1); }

    public split(): [Line, Line] {
        return [new Line(this.p1, this.mid), new Line(this.mid, this.p2)];
    }

    public transform(mt: Matrix): Line {
        return new Line(mt.apply(this.p1), mt.apply(this.p2));
    }

    public translate(by: Point): Line;
    public translate(x: number, y: number): Line;
    public translate(...args: any[]): Line {
        if (args.length === 1) return this.translate(args[0].x, args[0].y);
        return this.transform(Matrix.identity.translate(args[0], args[1]));
    }

    public rotate(origin: Point, by: number) {
        return this.transform(
            Matrix.identity.translate(origin).rotate(by).translate(origin.multiply(-1))
        );
    }

    public scale(f: number) { return this.transform(Matrix.scale(f)); }

    public extend(amount: number): Line {
        const v = this.p2.subtract(this.p1).normalize();
        return new Line(this.p1.add(v.multiply(-amount)), this.p2.add(v.multiply(amount)));
    }

    public extrude(lhs: number, rhs: number = 0) {
        const normal = this.toVector().perp().normalize();
        return [
            this.p1.add(normal.multiply(lhs)),
            this.p2.add(normal.multiply(lhs)),
            this.p2.add(normal.multiply(rhs * -1)),
            this.p1.add(normal.multiply(rhs * -1)),
        ];
    }

    public pointAt(distance: number) {
        return this.p1.add(this.toVector().normalize().multiply(distance));
    }

    public lerp(t: number): Point {
        return this.p1.add(this.toVector().multiply(t));
    }

    public distanceTo(pt: Point): number {
        const px = this.p2.subtract(this.p1);
        const s = px.x * px.x + px.y * px.y;
        let u = ((pt.x - this.p1.x) * px.x + (pt.y - this.p1.y) * px.y) / s;
        if (u > 1) u = 1;
        else if (u < 0) u = 0;
        const x = this.p1.x + u * px.x;
        const y = this.p1.y + u * px.y;
        const dx = x - pt.x;
        const dy = y - pt.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    public perpDistanceTo(pt: Point): number {
        const A = this.p1;
        const B = this.p2;
        const len2 = (B.x - A.x) * (B.x - A.x) + (B.y - A.y) * (B.y - A.y);
        const s = ((A.y - pt.y) * (B.x - A.x) - (A.x - pt.x) * (B.y - A.y)) / len2;
        return s * Math.sqrt(len2);
    }

    public nearestPointTo(p: Point) {
        const a = this.p1;
        const b = this.p2;
        const v = new Point(b.x - a.x, b.y - a.y);
        const u = new Point(a.x - p.x, a.y - p.y);
        const vu = v.x * u.x + v.y * u.y;
        const vv = v.x ** 2 + v.y ** 2;
        const t = -vu / vv;
        if (t < 0) return a;
        if (t > 1) return b;
        return new Point((1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y);
    }

    public coincidentWith(another: Line): boolean {
        return this.equals(another) || this.equals(another.reverse());
    }

    public connectsWith(another: Line): boolean {
        if (this.p1.equals(another.p1) || this.p1.equals(another.p2)) return true;
        if (this.p2.equals(another.p1) || this.p1.equals(another.p2)) return true;
        return false;
    }

    public equals(another: Line, directionSensitive = true): boolean {
        if (this.p1.equals(another.p1) && this.p2.equals(another.p2)) return true;
        if (!directionSensitive && this.p2.equals(another.p1) && this.p1.equals(another.p2)) return true;
        return false;
    }

    public toArray(): Point[] { return [this.p1, this.p2]; }
    public toVector(): Point { return this.p2.subtract(this.p1); }
    public toTuple(): [Point, Point] { return [this.p1, this.p2]; }
    public toString() { return this.toArray().toString(); }

    public project(p: Point, bounded = true) {
        const { p1: a, p2: b } = this;
        const atob = { x: b.x - a.x, y: b.y - a.y };
        const atop = { x: p.x - a.x, y: p.y - a.y };
        const len = atob.x * atob.x + atob.y * atob.y;
        const dot = atop.x * atob.x + atop.y * atob.y;
        const ut = dot / len;
        const t = bounded ? Math.min(1, Math.max(0, ut)) : ut;
        return new Point(a.x + atob.x * t, a.y + atob.y * t);
    }
}
