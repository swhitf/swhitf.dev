import { Line } from './Line';
import { round } from './Math';
import { Matrix } from './Matrix';
import { type HasPoints, type HasXY, Point, type PointSource } from './Point';

export interface RectLike {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface RectSides {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export type Rectuple = readonly [number, number, number, number];

export class Rect {

    public static empty: Rect = new Rect(0, 0, 0, 0);

    public static fromArray(ltwh: number[]): Rect {
        return new Rect(ltwh[0], ltwh[1], ltwh[2], ltwh[3]);
    }

    public static fromCenter(center: Point, radius: number | Point): Rect {
        radius = typeof (radius) === 'number' ? new Point(radius, radius) : radius;
        return Rect.fromPoints([center.add(radius), center.subtract(radius)]);
    }

    public static fromDims(position: Point, size: Point): Rect {
        return new Rect(position.x, position.y, size.w, size.h);
    }

    public static fromEdges(left: number, top: number, right: number, bottom: number): Rect {
        return new Rect(left, top, right - left, bottom - top);
    }

    public static fromLike(like: RectLike): Rect {
        return new Rect(like.left, like.top, like.width, like.height);
    }

    public static fromMany(rects: readonly Rect[]): Rect {
        if (!rects.length) return Rect.empty;
        const points = rects.filter(x => (x.width + x.height) !== 0).flatMap(x => x.points());
        if (points.length > 1) return Rect.fromPoints(points);
        if (rects.length === 1) return rects[0];
        return Rect.empty;
    }

    public static fromPoints(points: readonly Point[]): Rect {
        return Rect.fromEdges(
            Math.min(...points.map(p => p.x)),
            Math.min(...points.map(p => p.y)),
            Math.max(...points.map(p => p.x)),
            Math.max(...points.map(p => p.y))
        );
    }

    public static fromSize(size: PointSource, origin: 'topLeft' | 'center' = 'topLeft'): Rect {
        const pt = Point.from(size);
        return origin === 'topLeft'
            ? new Rect(0, 0, pt.w, pt.h)
            : new Rect(pt.w / -2, pt.h / -2, pt.w, pt.h);
    }

    public readonly left: number = 0;
    public readonly top: number = 0;
    public readonly width: number = 0;
    public readonly height: number = 0;

    constructor(left: number, top: number, width: number, height: number) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    public get right() { return this.left + this.width; }
    public get bottom() { return this.top + this.height; }
    public get minX() { return this.left; }
    public get maxX() { return this.right; }
    public get minY() { return this.top; }
    public get maxY() { return this.bottom; }

    public center(): Point {
        return new Point(this.left + (this.width / 2), this.top + (this.height / 2));
    }

    public topLeft(): Point { return new Point(this.left, this.top); }
    public topRight(): Point { return new Point(this.right, this.top); }
    public bottomLeft(): Point { return new Point(this.left, this.bottom); }
    public bottomRight(): Point { return new Point(this.right, this.bottom); }

    public area(): number { return this.width * this.height; }

    public points(): Point[] {
        return [
            new Point(this.left, this.top),
            new Point(this.left + this.width, this.top),
            new Point(this.left + this.width, this.top + this.height),
            new Point(this.left, this.top + this.height),
        ];
    }

    public lines(): [Line, Line, Line, Line] {
        const pts = this.points();
        return [
            new Line(pts[0], pts[1]),
            new Line(pts[1], pts[2]),
            new Line(pts[2], pts[3]),
            new Line(pts[3], pts[0]),
        ];
    }

    public size(): Point { return new Point(this.width, this.height); }

    public contains(input: HasXY | RectLike): boolean {
        if ('x' in input && 'y' in input) {
            return (
                input.x >= this.left && input.y >= this.top &&
                input.x <= this.left + this.width && input.y <= this.top + this.height
            );
        }
        else {
            return (
                input.left >= this.left && input.top >= this.top &&
                input.left + input.width <= this.left + this.width &&
                input.top + input.height <= this.top + this.height
            );
        }
    }

    public distanceTo(geom: HasPoints | HasXY): number {
        if ('x' in geom && 'y' in geom) {
            const dx = Math.max(0, geom.x - this.right, this.left - geom.x);
            const dy = Math.max(0, geom.y - this.bottom, this.top - geom.y);
            return Math.sqrt(dx * dx + dy * dy);
        }
        else {
            const other = Rect.fromPoints(Point.manyFrom(geom));
            const dx = Math.max(0, other.left - this.right, this.left - other.right);
            const dy = Math.max(0, other.top - this.bottom, this.top - other.bottom);
            return Math.sqrt(dx * dx + dy * dy);
        }
    }

    public intersects(rect: Rect): boolean {
        return !(
            rect.left > this.right || rect.right < this.left ||
            rect.top > this.bottom || rect.bottom < this.top
        );
    }

    public inflate(size: PointSource): Rect {
        const pt = Point.from(size);
        return Rect.fromEdges(this.left - pt.x, this.top - pt.y, this.right + pt.x, this.bottom + pt.y);
    }

    public offset(by: PointSource): Rect {
        const pt = Point.from(by);
        return new Rect(this.left + pt.x, this.top + pt.y, this.width, this.height);
    }

    public round(dp: number = 0): Rect {
        return Rect.fromEdges(round(this.left, dp), round(this.top, dp), round(this.right, dp), round(this.bottom, dp));
    }

    public scale(x: number, y?: number) {
        y = y ?? x;
        return Rect.fromCenter(this.center(), this.size().divide(2).multiply([x, y]));
    }

    public transform(mt: Matrix): Point[] { return mt.apply(this.points()); }

    public normalize(): Rect {
        if (this.width >= 0 && this.height >= 0) return this;
        let x = this.left, y = this.top, w = this.width, h = this.height;
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }
        return new Rect(x, y, w, h);
    }

    public equals(rect?: Rect) {
        if (!rect) return false;
        return this.left === rect.left && this.top === rect.top && this.width === rect.width && this.height === rect.height;
    }

    public toArray() { return [this.left, this.top, this.width, this.height]; }

    public toObject(): RectLike {
        return { left: this.left, top: this.top, width: this.width, height: this.height };
    }

    public toString(sep?: string): string {
        return sep ? this.toArray().join(sep) : `[${this.left}, ${this.top}, ${this.width}, ${this.height}]`;
    }
}
