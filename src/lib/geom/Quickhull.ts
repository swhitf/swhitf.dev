import { Line } from './Line';
import { Point } from './Point';
import { Polyline } from './Polyline';

/**
 * Implementation of the QuickHull algorithm for finding the convex hull of a set of points.
 *
 * Based on QuickHull.js by Clay Gulick, refactored to use Point and Line.
 */
export default function quickhull(points: Point[]): Polyline {

    if (points.length < 3) {
        return new Polyline([...points, points[0]]);
    }

    // If exactly 3, it's already a hull
    if (points.length === 3) {
        return new Polyline([...points, points[0]]);
    }

    const hull: Point[] = [];

    // Find the leftmost and rightmost points — these are guaranteed to be on the hull
    const baseline = getMinMaxPoints(points);

    // Build hull segments for each side of the baseline
    addSegments(baseline, points, hull);
    addSegments(new Line(baseline.p2, baseline.p1), points, hull);

    // Close the loop
    hull.push(hull[0]);

    return new Polyline(hull);
}

/**
 * Finds the leftmost and rightmost points and returns them as a Line.
 */
function getMinMaxPoints(points: Point[]): Line {
    let min = points[0];
    let max = points[0];

    for (let i = 1; i < points.length; i++) {
        if (points[i].x < min.x) min = points[i];
        if (points[i].x > max.x) max = points[i];
    }

    return new Line(min, max);
}

/**
 * Returns the perpendicular distance of a point from a line. Positive values indicate the point
 * is on the left side of the line (from p1 to p2).
 */
function perpDistance(point: Point, line: Line): number {
    const vY = line.p2.y - line.p1.y;
    const vX = line.p1.x - line.p2.x;
    return vX * (point.y - line.p1.y) + vY * (point.x - line.p1.x);
}

/**
 * Finds all points on the outer (positive) side of the line, and the one farthest from it.
 */
function distalPoints(line: Line, points: Point[]): { outer: Point[], max: Point | null } {
    let max: Point | null = null;
    let maxDistance = 0;
    const outer: Point[] = [];

    for (const point of points) {
        const distance = perpDistance(point, line);
        if (distance <= 0) continue;

        outer.push(point);

        if (distance > maxDistance) {
            max = point;
            maxDistance = distance;
        }
    }

    return { outer, max };
}

/**
 * Recursively partitions points and adds hull vertices.
 */
function addSegments(line: Line, points: Point[], hull: Point[]): void {
    const { outer, max } = distalPoints(line, points);

    if (!max) {
        hull.push(line.p1);
        return;
    }

    addSegments(new Line(line.p1, max), outer, hull);
    addSegments(new Line(max, line.p2), outer, hull);
}
