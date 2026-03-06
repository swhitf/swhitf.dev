import { Point } from "../geom/Point";
import { Rect } from "../geom/Rect";
import { type QuickhullPhase, quickhullWithPhases, collapsePhases } from "../geom/QuickhullWithPhases";

type State = {
    rects: Rect[];
    phases: QuickhullPhase[];
    aliveSets: Set<Point>[];
    boundaries: Point[][];
    corners: Point[];
    currentPhaseIndex: number;
    started: boolean;
    complete: boolean;
};

const NOTE_SIZE = 100;
const MAX_PLACEMENT_ATTEMPTS = 500;

const STICKY_COLORS = [
    '#fef08a', // yellow
    '#bbf7d0', // green
    '#bfdbfe', // blue
    '#fbcfe8', // pink
    '#fed7aa', // orange
    '#ddd6fe', // purple
    '#fecaca', // red
    '#a5f3fc', // cyan
];

/** Place up to 8 non-overlapping 100x100 rects within bounds. */
const createInitialRects = (bounds: Rect): Rect[] => {
    const placeable = bounds.inflate(-NOTE_SIZE / 2 - 10);
    const rects: Rect[] = [];
    let attempts = 0;

    while (rects.length < 8 && attempts < MAX_PLACEMENT_ATTEMPTS) {
        attempts++;
        const x = Math.random() * placeable.width + placeable.left;
        const y = Math.random() * placeable.height + placeable.top;
        const candidate = new Rect(x - NOTE_SIZE / 2, y - NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE);

        if (rects.some(r => r.intersects(candidate))) continue;
        rects.push(candidate);
    }

    return rects;
};

/** Get all 4 corners from every rect. */
const allCorners = (rects: Rect[]): Point[] =>
    rects.flatMap(r => r.points());

/** Collect every Point reference that appears in a phase. */
const pointsInPhase = (phase: QuickhullPhase): Point[] => {
    switch (phase.type) {
        case 'baseline':
            return [...phase.points, phase.line.p1, phase.line.p2];
        case 'capture':
            return [...phase.outerPoints, ...phase.innerPoints, phase.line.p1, phase.line.p2];
        case 'partition':
            return [...phase.outerPoints, phase.max, phase.line.p1, phase.line.p2];
        case 'hull-point':
            return [phase.point];
        case 'hull-points':
            return phase.points;
        case 'complete':
            return phase.hull;
    }
};

const computeAliveSets = (phases: QuickhullPhase[]): Set<Point>[] => {
    const sets: Set<Point>[] = new Array(phases.length);
    let alive = new Set<Point>();
    for (let i = phases.length - 1; i >= 0; i--) {
        for (const p of pointsInPhase(phases[i])) alive.add(p);
        sets[i] = new Set(alive);
    }
    return sets;
};

const computeBoundaries = (phases: QuickhullPhase[]): Point[][] => {
    let boundary: Point[] = [];
    return phases.map(phase => {
        if (phase.type === 'baseline') {
            boundary = [phase.line.p1, phase.line.p2, phase.line.p1];
        } else if (phase.type === 'partition') {
            const next: Point[] = [];
            for (let i = 0; i < boundary.length - 1; i++) {
                next.push(boundary[i]);
                if (boundary[i] === phase.line.p1 && boundary[i + 1] === phase.line.p2) {
                    next.push(phase.max);
                }
            }
            next.push(boundary[boundary.length - 1]);
            boundary = next;
        }
        return [...boundary];
    });
};

// ── Drawing helpers ──────────────────────────────────────────────

const drawPoints = (ctx: CanvasRenderingContext2D, points: Point[], style: string, radius: number) => {
    for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = style;
        ctx.fill();
    }
};

const drawLine = (ctx: CanvasRenderingContext2D, p1: Point, p2: Point, style: string, width: number, dash: number[] = []) => {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
};

const drawBoundary = (ctx: CanvasRenderingContext2D, boundary: Point[]) => {
    if (boundary.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(boundary[0].x, boundary[0].y);
    for (let i = 1; i < boundary.length; i++) {
        ctx.lineTo(boundary[i].x, boundary[i].y);
    }
    ctx.strokeStyle = 'rgba(162, 89, 217, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
};

const drawTriangleFill = (ctx: CanvasRenderingContext2D, p1: Point, p2: Point, p3: Point) => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(162, 89, 217, 0.1)';
    ctx.fill();
};

/** Draw a sticky note: rounded rect with a slight box shadow. */
const drawStickyNote = (ctx: CanvasRenderingContext2D, rect: Rect, color: string, dimmed: boolean) => {
    const alpha = dimmed ? 0.4 : 1;
    const x = rect.left;
    const y = rect.top;
    const w = rect.width;
    const h = rect.height;
    const r = 4;

    // Shadow
    ctx.save();
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w, h, r);
    ctx.fill();
    ctx.restore();

    // Main body
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
};

const drawStickyNotes = (ctx: CanvasRenderingContext2D, rects: Rect[], dimmed: boolean) => {
    for (let i = 0; i < rects.length; i++) {
        drawStickyNote(ctx, rects[i], STICKY_COLORS[i % STICKY_COLORS.length], dimmed);
    }
};

const labelForPhase = (phase: QuickhullPhase): string => {
    switch (phase.type) {
        case 'baseline':
            return 'Finding leftmost and rightmost points \u2014 click to step';
        case 'capture':
            return `Checking edge: ${phase.outerPoints.length} outside, ${phase.innerPoints.length} inside`;
        case 'partition':
            return `Finding furthest of ${phase.outerPoints.length} outer point${phase.outerPoints.length === 1 ? '' : 's'}`;
        case 'hull-points':
            return `Adding ${phase.points.length} point${phase.points.length === 1 ? '' : 's'} to hull`;
        case 'complete':
            return 'Hull complete \u2014 click to restart';
        default:
            return '';
    }
};

const drawPhase = (
    ctx: CanvasRenderingContext2D,
    phase: QuickhullPhase,
    rects: Rect[],
    corners: Point[],
    alive: Set<Point>,
    boundary: Point[],
    cssWidth: number,
    cssHeight: number,
) => {
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Draw sticky notes (dimmed during algorithm, solid on complete)
    const isComplete = phase.type === 'complete';
    drawStickyNotes(ctx, rects, !isComplete);

    // Draw alive corners as dark gray dots
    const aliveCorners = corners.filter(p => alive.has(p));
    drawPoints(ctx, aliveCorners, '#555', 3);

    // Draw working boundary
    drawBoundary(ctx, boundary);

    switch (phase.type) {
        case 'baseline': {
            drawLine(ctx, phase.line.p1, phase.line.p2, '#6366f1', 2, [6, 4]);
            drawPoints(ctx, [phase.line.p1, phase.line.p2], '#6366f1', 4);
            break;
        }
        case 'capture': {
            // Show the edge being tested
            drawLine(ctx, phase.line.p1, phase.line.p2, '#6366f1', 2.5);
            drawPoints(ctx, [phase.line.p1, phase.line.p2], '#6366f1', 3);
            // Outer points (outside the edge) in orange
            drawPoints(ctx, phase.outerPoints, '#f59e0b', 3);
            // Inner points (inside / on the edge) faded out
            drawPoints(ctx, phase.innerPoints, 'rgba(0,0,0,0.15)', 3);
            break;
        }
        case 'partition': {
            drawLine(ctx, phase.line.p1, phase.line.p2, '#6366f1', 2.5);
            drawTriangleFill(ctx, phase.line.p1, phase.max, phase.line.p2);
            drawPoints(ctx, phase.outerPoints, '#f59e0b', 3);
            drawPoints(ctx, [phase.max], '#ef4444', 4);
            drawPoints(ctx, [phase.line.p1, phase.line.p2], '#6366f1', 3);
            break;
        }
        case 'hull-points': {
            drawPoints(ctx, phase.points, '#22c55e', 5);
            break;
        }
        case 'complete': {
            if (boundary.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(boundary[0].x, boundary[0].y);
                for (let i = 1; i < boundary.length; i++) {
                    ctx.lineTo(boundary[i].x, boundary[i].y);
                }
                ctx.strokeStyle = '#a259d9';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            break;
        }
    }
};

// ── Init ─────────────────────────────────────────────────────────

export const initQuickHullDemo = (containerId: string) => {
    const container = document.getElementById(containerId)!;
    const canvas = container.querySelector('canvas')!;
    const label = container.querySelector('.quickhull-label') as HTMLElement;
    const ctx = canvas.getContext('2d')!;

    // Size canvas backing buffer to its CSS layout size, accounting for HiDPI
    const dpr = window.devicePixelRatio || 1;
    const canvasRect = canvas.getBoundingClientRect();
    const cssWidth = canvasRect.width;
    const cssHeight = canvasRect.height;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    const bounds = new Rect(0, 0, cssWidth, cssHeight);

    const state: State = {
        rects: [],
        phases: [],
        aliveSets: [],
        boundaries: [],
        corners: [],
        currentPhaseIndex: 0,
        started: false,
        complete: false,
    };

    const setLabel = (text: string) => {
        label.textContent = text;
    };

    const drawIdle = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        drawStickyNotes(ctx, state.rects, false);
        const corners = allCorners(state.rects);
        drawPoints(ctx, corners, '#555', 3);
        setLabel('Click to start');
    };

    const restart = () => {
        state.corners = allCorners(state.rects);
        state.phases = collapsePhases(quickhullWithPhases(state.corners));
        state.aliveSets = computeAliveSets(state.phases);
        state.boundaries = computeBoundaries(state.phases);
        state.currentPhaseIndex = 0;
        state.started = false;
        state.complete = false;
        drawIdle();
    };

    const renderCurrentPhase = () => {
        if (state.currentPhaseIndex >= state.phases.length) return;
        const phase = state.phases[state.currentPhaseIndex];
        setLabel(labelForPhase(phase));
        drawPhase(
            ctx,
            phase,
            state.rects,
            state.corners,
            state.aliveSets[state.currentPhaseIndex],
            state.boundaries[state.currentPhaseIndex],
            cssWidth,
            cssHeight,
        );
    };

    canvas.addEventListener('click', () => {
        if (state.complete) {
            state.rects = createInitialRects(bounds);
            restart();
        } else if (!state.started) {
            state.started = true;
            renderCurrentPhase();
        } else if (state.currentPhaseIndex < state.phases.length - 1) {
            state.currentPhaseIndex++;
            renderCurrentPhase();
            if (state.currentPhaseIndex === state.phases.length - 1) {
                state.complete = true;
            }
        }
    });

    state.rects = createInitialRects(bounds);
    restart();
};
