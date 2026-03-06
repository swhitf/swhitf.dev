import { Point } from './Point';

export enum AngleUnits {
    Radians = 1,
    Degrees = 2,
}

export type MatrixTransformable<T> = { transform(mt: Matrix): T };

export interface DecomposedMatrix {
    scale: Point;
    rotate: number;
    translate: Point;
}

export class Matrix {

    public static identity: Matrix = new Matrix();

    public static scale(pt: Point): Matrix;
    public static scale(tx: number, ty: number): Matrix;
    public static scale(f: number): Matrix;
    public static scale(...args: any[]): Matrix {
        return Matrix.prototype.scale.apply(Matrix.identity, args);
    }

    public static translate(pt: Point): Matrix;
    public static translate(tx: number, ty: number): Matrix;
    public static translate(...args: any[]): Matrix {
        return Matrix.prototype.translate.apply(Matrix.identity, args);
    }

    public static rotate(angle: number, unit: AngleUnits = AngleUnits.Radians): Matrix {
        return Matrix.identity.rotate(angle, unit);
    }

    public static fromRotation(radians: number): Matrix {
        return this.identity.rotate(radians);
    }

    public readonly m11: number;
    public readonly m12: number;
    public readonly m21: number;
    public readonly m22: number;
    public readonly m31: number;
    public readonly m32: number;

    constructor(a: number = 1, b: number = 0, c: number = 0, d: number = 1, e: number = 0, f: number = 0) {
        this.m11 = a;
        this.m12 = b;
        this.m21 = c;
        this.m22 = d;
        this.m31 = e;
        this.m32 = f;
    }

    public get a() { return this.m11; }
    public get b() { return this.m12; }
    public get c() { return this.m21; }
    public get d() { return this.m22; }
    public get e() { return this.m31; }
    public get f() { return this.m32; }

    public isIdentity(): boolean { return this.equals(Matrix.identity); }

    public isInvertible(): boolean { return !this.q(this.determinant(), 0); }

    public determinant(): number { return this.m11 * this.m22 - this.m12 * this.m21; }

    public equals(m: Matrix): boolean {
        const q = this.q;
        return (
            q(this.m11, m.m11) && q(this.m12, m.m12) &&
            q(this.m21, m.m21) && q(this.m22, m.m22) &&
            q(this.m31, m.m31) && q(this.m32, m.m32)
        );
    }

    public apply(pt: Point): Point;
    public apply(input: readonly Point[]): Point[];
    public apply<T>(input: MatrixTransformable<T>): T;
    public apply(x: number, y: number): [number, number];
    public apply(...args: any[]) {
        if (args.length === 2) {
            const [x, y] = args;
            return [
                x * this.m11 + y * this.m21 + this.m31,
                x * this.m12 + y * this.m22 + this.m32
            ];
        }
        const [arg] = args;
        if ('transform' in arg) {
            return arg.transform(this);
        }
        if (Array.isArray(arg)) {
            return arg.map(x => this.apply(x));
        }
        if (arg instanceof Point) {
            return new Point(
                arg.x * this.m11 + arg.y * this.m21 + this.m31,
                arg.x * this.m12 + arg.y * this.m22 + this.m32
            );
        }
    }

    public concat(cm: Matrix): Matrix { return this.clone().multiply(cm); }
    public clone(): Matrix { return new Matrix().multiply(this); }

    public decompose(): [Point, number, Point] {
        const rotation = Math.atan2(this.m12, this.m11);
        const shear = Math.atan2(this.m22, this.m21) - Math.PI / 2 - rotation;
        const scaleX = Math.sqrt(this.m11 * this.m11 + this.m12 * this.m12);
        const scaleY = Math.sqrt(this.m21 * this.m21 + this.m22 * this.m22) * Math.cos(shear);
        return [
            new Point(scaleX, scaleY),
            rotation,
            new Point(this.m31, this.m32),
        ];
    }

    public decompose2(): DecomposedMatrix {
        const rotation = Math.atan2(this.m12, this.m11);
        const shear = Math.atan2(this.m22, this.m21) - Math.PI / 2 - rotation;
        const scaleX = Math.sqrt(this.m11 * this.m11 + this.m12 * this.m12);
        const scaleY = Math.sqrt(this.m21 * this.m21 + this.m22 * this.m22) * Math.cos(shear);
        return {
            scale: new Point(scaleX, scaleY),
            rotate: rotation,
            translate: new Point(this.m31, this.m32),
        };
    }

    public transform(a2: number, b2: number, c2: number, d2: number, e2: number, f2: number): Matrix {
        const a1 = this.m11, b1 = this.m12, c1 = this.m21, d1 = this.m22, e1 = this.m31, f1 = this.m32;
        return new Matrix(
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1,
            b1 * e2 + d1 * f2 + f1,
        );
    }

    public multiply(m: Matrix): Matrix {
        return this.transform(m.m11, m.m12, m.m21, m.m22, m.m31, m.m32);
    }

    public divide(m: Matrix): Matrix {
        if (!m.isInvertible()) throw new Error('Matrix not invertible');
        return this.multiply(m.inverse());
    }

    public divideScalar(dv: number): Matrix {
        return new Matrix(this.m11 / dv, this.m12 / dv, this.m21 / dv, this.m22 / dv, this.m31 / dv, this.m32 / dv);
    }

    public scale(pt: Point): Matrix;
    public scale(tx: number, ty: number): Matrix;
    public scale(f: number): Matrix;
    public scale(x: Point | number, y?: number): Matrix {
        if (x instanceof Point) return this.transform(x.x, 0, 0, x.y, 0, 0);
        y = y === undefined ? x : y;
        return this.transform(x, 0, 0, y, 0, 0);
    }

    public translate(pt: Point): Matrix;
    public translate(tx: number, ty: number): Matrix;
    public translate(...args: any[]): Matrix {
        if (args.length === 1) return this.translate(args[0].x, args[0].y);
        const [tx, ty] = args;
        return this.transform(1, 0, 0, 1, tx, ty);
    }

    public rotate(angle: number, unit: AngleUnits = AngleUnits.Radians): Matrix {
        if (unit === AngleUnits.Degrees) return this.rotate(angle * Math.PI / 180);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return this.transform(cos, sin, -sin, cos, 0, 0);
    }

    public inverse(): Matrix {
        const dt = this.determinant();
        if (this.q(dt, 0)) throw new Error('Matrix not invertible.');
        return new Matrix(
            this.m22 / dt, -this.m12 / dt, -this.m21 / dt, this.m11 / dt,
            (this.m21 * this.m32 - this.m22 * this.m31) / dt,
            -(this.m11 * this.m32 - this.m12 * this.m31) / dt,
        );
    }

    public toArray(): number[] { return [this.m11, this.m12, this.m21, this.m22, this.m31, this.m32]; }
    public toCSS(): string { return `matrix(${this.toArray()})`; }
    public toCSS3D(): string { return `matrix3d(${this.m11}, ${this.m12}, 0, 0, ${this.m21}, ${this.m22}, 0, 0, 0, 0, 1, 0, ${this.m31}, ${this.m32}, 0, 1)`; }
    public toString() { return this.toCSS(); }

    private q(f1: number, f2: number): boolean { return Math.abs(f1 - f2) < 1e-14; }
}
