import { Line } from './Line';
import { Point } from './Point';

export type QuickhullPhase =
    | { type: 'baseline'; line: Line; points: Point[]; hullSoFar: Point[] }
    | { type: 'capture'; line: Line; outerPoints: Point[]; innerPoints: Point[]; hullSoFar: Point[] }
    | { type: 'partition'; line: Line; outerPoints: Point[]; max: Point; hullSoFar: Point[] }
    | { type: 'hull-point'; point: Point; hullSoFar: Point[] }
    | { type: 'hull-points'; points: Point[]; hullSoFar: Point[] }
    | { type: 'complete'; hull: Point[] };

/**
 * Merges consecutive hull-point phases into a single hull-points phase.
 * Lone hull-point entries also become hull-points (single-element array).
 */
export function collapsePhases(phases: QuickhullPhase[]): QuickhullPhase[] {
    const result: QuickhullPhase[] = [];
    let i = 0;

    while (i < phases.length) {
        const phase = phases[i];
        if (phase.type === 'hull-point') {
            const points: Point[] = [phase.point];
            let lastHull = phase.hullSoFar;
            let j = i + 1;
            while (j < phases.length && phases[j].type === 'hull-point') {
                const next = phases[j] as { type: 'hull-point'; point: Point; hullSoFar: Point[] };
                points.push(next.point);
                lastHull = next.hullSoFar;
                j++;
            }
            result.push({ type: 'hull-points', points, hullSoFar: lastHull });
            i = j;
        } else {
            result.push(phase);
            i++;
        }
    }

    return result;
}

/**
 * Runs the quickhull algorithm and records each step as a phase.
 * Same logic as Quickhull.ts, but instrumented for visualisation.
 */
export function quickhullWithPhases(points: Point[]): QuickhullPhase[] {
    const phases: QuickhullPhase[] = [];
    const hull: Point[] = [];

    if (points.length < 3) {
        phases.push({ type: 'complete', hull: [...points] });
        return phases;
    }

    const baseline = getMinMaxPoints(points);

    phases.push({
        type: 'baseline',
        line: baseline,
        points: [...points],
        hullSoFar: [],
    });

    addSegments(baseline, points, hull, phases);
    addSegments(new Line(baseline.p2, baseline.p1), points, hull, phases);

    hull.push(hull[0]);
    phases.push({ type: 'complete', hull: [...hull] });

    return phases;
}

function getMinMaxPoints(points: Point[]): Line {
    let min = points[0];
    let max = points[0];

    for (let i = 1; i < points.length; i++) {
        if (points[i].x < min.x) min = points[i];
        if (points[i].x > max.x) max = points[i];
    }

    return new Line(min, max);
}

function perpDistance(point: Point, line: Line): number {
    const vY = line.p2.y - line.p1.y;
    const vX = line.p1.x - line.p2.x;
    return vX * (point.y - line.p1.y) + vY * (point.x - line.p1.x);
}

function distalPoints(line: Line, points: Point[]): { outer: Point[]; inner: Point[]; max: Point | null } {
    let max: Point | null = null;
    let maxDistance = 0;
    const outer: Point[] = [];
    const inner: Point[] = [];

    for (const point of points) {
        // Skip the line's own endpoints
        if (point === line.p1 || point === line.p2) continue;

        const distance = perpDistance(point, line);
        if (distance <= 0) {
            inner.push(point);
            continue;
        }

        outer.push(point);

        if (distance > maxDistance) {
            max = point;
            maxDistance = distance;
        }
    }

    return { outer, inner, max };
}

function addSegments(line: Line, points: Point[], hull: Point[], phases: QuickhullPhase[]): void {
    const { outer, inner, max } = distalPoints(line, points);

    if (!max) {
        hull.push(line.p1);
        phases.push({
            type: 'hull-point',
            point: line.p1,
            hullSoFar: [...hull],
        });
        return;
    }

    // Step 1: show which points are outside vs inside the edge
    phases.push({
        type: 'capture',
        line,
        outerPoints: outer,
        innerPoints: inner,
        hullSoFar: [...hull],
    });

    // Step 2: of the outer points, highlight the furthest
    phases.push({
        type: 'partition',
        line,
        outerPoints: outer,
        max,
        hullSoFar: [...hull],
    });

    addSegments(new Line(line.p1, max), outer, hull, phases);
    addSegments(new Line(max, line.p2), outer, hull, phases);
}
