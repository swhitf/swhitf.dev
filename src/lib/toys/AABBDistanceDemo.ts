import { Point } from "../geom/Point";
import { Rect } from "../geom/Rect";

const NOTE_W = 120;
const NOTE_H = 120;

const COLORS = {
    rectA: '#bfdbfe',   // blue
    rectB: '#fef08a',   // yellow
    dx: '#6366f1',      // indigo
    dy: '#22c55e',      // green
    dist: '#ef4444',    // red
    grid: 'rgba(0,0,0,0.08)',
    regionFill: 'rgba(99,102,241,0.06)',
    text: '#334155',
};

// ── Drawing helpers ──────────────────────────────────────────────

const drawStickyNote = (ctx: CanvasRenderingContext2D, rect: Rect, color: string) => {
    const x = rect.left;
    const y = rect.top;
    const w = rect.width;
    const h = rect.height;
    const fold = 12;

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2, y + 2, w, h);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w - fold, y + fold);
    ctx.lineTo(x + w, y + fold);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fill();
};

const drawDashedLine = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    color: string, lineWidth: number = 1.5,
) => {
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
};

const drawSolidLine = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    color: string, lineWidth: number = 2,
) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
};

const drawLabel = (
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    color: string, align: CanvasTextAlign = 'center',
) => {
    ctx.font = '11px monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(text);
    const px = 4, py = 2;
    const bx = align === 'center' ? x - metrics.width / 2 - px
        : align === 'left' ? x - px
            : x - metrics.width - px;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(bx, y - 7 - py, metrics.width + px * 2, 14 + py * 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
};

/** Draw the 3x3 region grid extending from rect A's edges. */
const drawRegionGrid = (
    ctx: CanvasRenderingContext2D,
    a: Rect,
    w: number, h: number,
) => {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Vertical lines at a.left and a.right
    ctx.beginPath();
    ctx.moveTo(a.left, 0);
    ctx.lineTo(a.left, h);
    ctx.moveTo(a.right, 0);
    ctx.lineTo(a.right, h);

    // Horizontal lines at a.top and a.bottom
    ctx.moveTo(0, a.top);
    ctx.lineTo(w, a.top);
    ctx.moveTo(0, a.bottom);
    ctx.lineTo(w, a.bottom);

    ctx.stroke();
    ctx.setLineDash([]);
};

/** Highlight the region that B falls into within the 3x3 grid. */
const highlightRegion = (
    ctx: CanvasRenderingContext2D,
    a: Rect, b: Rect,
    w: number, h: number,
) => {
    // Determine which column and row B's center falls in
    const bc = b.center();

    const colLeft = bc.x < a.left ? 0 : bc.x <= a.right ? 1 : 2;
    const rowTop = bc.y < a.top ? 0 : bc.y <= a.bottom ? 1 : 2;

    // Region bounds
    const xs = [0, a.left, a.right, w];
    const ys = [0, a.top, a.bottom, h];

    ctx.fillStyle = COLORS.regionFill;
    ctx.fillRect(xs[colLeft], ys[rowTop], xs[colLeft + 1] - xs[colLeft], ys[rowTop + 1] - ys[rowTop]);
};

/** Draw region labels in small text showing what dx/dy resolve to. */
const drawRegionLabels = (
    ctx: CanvasRenderingContext2D,
    a: Rect,
    w: number, h: number,
) => {
    const xs = [0, a.left, a.right, w];
    const ys = [0, a.top, a.bottom, h];

    const dxLabels = ['A.left − B.right', '0', 'B.left − A.right'];
    const dyLabels = ['A.top − B.bottom', '0', 'B.top − A.bottom'];

    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
            const cx = (xs[col] + xs[col + 1]) / 2;
            const cy = (ys[row] + ys[row + 1]) / 2;

            // Only label outer regions (skip center = overlapping)
            if (col === 1 && row === 1) continue;

            const cellW = xs[col + 1] - xs[col];
            const cellH = ys[row + 1] - ys[row];
            // Skip if cell is too small to show a label
            if (cellW < 60 || cellH < 30) continue;

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillText(`dx: ${dxLabels[col]}`, cx, cy - 6);
            ctx.fillText(`dy: ${dyLabels[row]}`, cx, cy + 6);
        }
    }
};

// ── Main ─────────────────────────────────────────────────────────

export const initAABBDistanceDemo = (containerId: string) => {
    const container = document.getElementById(containerId)!;
    const canvas = container.querySelector('canvas')!;
    const label = container.querySelector('.aabb-label') as HTMLElement;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    const containerRect = container.getBoundingClientRect();
    const cssWidth = containerRect.width;
    const cssHeight = containerRect.height;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    // Initial positions — separated diagonally so both dx and dy are visible
    let rectA = new Rect(cssWidth * 0.28 - NOTE_W / 2, cssHeight * 0.42 - NOTE_H / 2, NOTE_W, NOTE_H);
    let rectB = new Rect(cssWidth * 0.72 - NOTE_W / 2, cssHeight * 0.62 - NOTE_H / 2, NOTE_W, NOTE_H);

    let dragging: 'a' | 'b' | null = null;
    let dragOffset = new Point(0, 0);

    const hitTest = (x: number, y: number): 'a' | 'b' | null => {
        if (rectB.contains({ x, y })) return 'b';
        if (rectA.contains({ x, y })) return 'a';
        return null;
    };

    const render = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        const a = rectA;
        const b = rectB;

        // AABB distance components (same formula as Rect.distanceTo)
        const dx = Math.max(0, b.left - a.right, a.left - b.right);
        const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const overlapping = a.intersects(b);

        // 1. Draw the 3x3 region grid from A's edges
        drawRegionGrid(ctx, a, cssWidth, cssHeight);

        // 2. Highlight the region B falls into
        if (!overlapping) {
            highlightRegion(ctx, a, b, cssWidth, cssHeight);
        }

        // 3. Draw region formula labels
        drawRegionLabels(ctx, a, cssWidth, cssHeight);

        // 4. Draw distance measurement lines
        if (!overlapping && (dx > 0 || dy > 0)) {
            // Nearest edges on each axis
            const nearX1 = a.right <= b.left ? a.right : a.left;
            const nearX2 = a.right <= b.left ? b.left : b.right;
            const nearY1 = a.bottom <= b.top ? a.bottom : a.top;
            const nearY2 = a.bottom <= b.top ? b.top : b.bottom;

            // Overlapping range midpoints (for single-axis alignment)
            const overlapYmid = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
            const overlapXmid = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;

            if (dx > 0 && dy > 0) {
                // Corner region — both axes separated
                // Draw the right-angle triangle: dx, dy, hypotenuse
                const cx = nearX1;
                const cy = nearY1;

                // dx component (horizontal leg)
                drawDashedLine(ctx, cx, cy, nearX2, cy, COLORS.dx);
                drawLabel(ctx, `dx = ${Math.round(dx)}`, (cx + nearX2) / 2, cy - 14, COLORS.dx);

                // dy component (vertical leg)
                drawDashedLine(ctx, nearX2, cy, nearX2, nearY2, COLORS.dy);
                drawLabel(ctx, `dy = ${Math.round(dy)}`, nearX2 + 8, (cy + nearY2) / 2, COLORS.dy, 'left');

                // Hypotenuse = actual distance
                drawSolidLine(ctx, cx, cy, nearX2, nearY2, COLORS.dist, 2);
                drawLabel(ctx, `√(dx²+dy²) = ${Math.round(dist)}`, (cx + nearX2) / 2 - 8, (cy + nearY2) / 2 + 14, COLORS.dist);

                // Right-angle marker at corner
                const sz = 6;
                const sx = nearX2 > cx ? 1 : -1;
                const sy = nearY2 > cy ? 1 : -1;
                ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(nearX2 - sx * sz, cy);
                ctx.lineTo(nearX2 - sx * sz, cy + sy * sz);
                ctx.lineTo(nearX2, cy + sy * sz);
                ctx.stroke();
            } else if (dx > 0 && dy === 0) {
                // Edge region — only horizontally separated, vertically overlapping
                const my = overlapYmid;

                // Distance line (which IS the dx component here)
                drawSolidLine(ctx, nearX1, my, nearX2, my, COLORS.dist, 2);
                drawLabel(ctx, `dx = ${Math.round(dx)}`, (nearX1 + nearX2) / 2, my - 14, COLORS.dx);

                // Show dy=0 annotation — draw a bracket showing the overlap
                const oTop = Math.max(a.top, b.top);
                const oBot = Math.min(a.bottom, b.bottom);
                const bx = (nearX1 + nearX2) / 2;
                ctx.strokeStyle = COLORS.dy;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(bx - 3, oTop);
                ctx.lineTo(bx + 3, oTop);
                ctx.moveTo(bx, oTop);
                ctx.lineTo(bx, oBot);
                ctx.moveTo(bx - 3, oBot);
                ctx.lineTo(bx + 3, oBot);
                ctx.stroke();
                ctx.setLineDash([]);
                drawLabel(ctx, `dy = 0`, bx + 8, my + 14, COLORS.dy, 'left');
            } else if (dy > 0 && dx === 0) {
                // Edge region — only vertically separated, horizontally overlapping
                const mx = overlapXmid;

                // Distance line (which IS the dy component here)
                drawSolidLine(ctx, mx, nearY1, mx, nearY2, COLORS.dist, 2);
                drawLabel(ctx, `dy = ${Math.round(dy)}`, mx + 8, (nearY1 + nearY2) / 2, COLORS.dy, 'left');

                // Show dx=0 annotation — draw a bracket showing the overlap
                const oLeft = Math.max(a.left, b.left);
                const oRight = Math.min(a.right, b.right);
                const by = (nearY1 + nearY2) / 2;
                ctx.strokeStyle = COLORS.dx;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(oLeft, by - 3);
                ctx.lineTo(oLeft, by + 3);
                ctx.moveTo(oLeft, by);
                ctx.lineTo(oRight, by);
                ctx.moveTo(oRight, by - 3);
                ctx.lineTo(oRight, by + 3);
                ctx.stroke();
                ctx.setLineDash([]);
                drawLabel(ctx, `dx = 0`, (oLeft + oRight) / 2, by - 14, COLORS.dx);
            }
        }

        // 5. Draw sticky notes (on top of measurement lines)
        drawStickyNote(ctx, a, COLORS.rectA);
        drawStickyNote(ctx, b, COLORS.rectB);

        // Letter labels on notes
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillText('A', a.center().x, a.center().y);
        ctx.fillText('B', b.center().x, b.center().y);

        // 6. Update header label
        if (overlapping) {
            label.textContent = 'dx = 0, dy = 0 → distance = 0 (overlapping)';
        } else {
            label.textContent = `dx = ${Math.round(dx)}, dy = ${Math.round(dy)} → distance = ${Math.round(dist)}px`;
        }
    };

    // ── Pointer events ───────────────────────────────────────────

    const getCanvasPos = (e: PointerEvent): Point => {
        const r = canvas.getBoundingClientRect();
        return new Point(e.clientX - r.left, e.clientY - r.top);
    };

    canvas.addEventListener('pointerdown', (e) => {
        const pos = getCanvasPos(e);
        const hit = hitTest(pos.x, pos.y);
        if (hit) {
            dragging = hit;
            const rect = hit === 'a' ? rectA : rectB;
            dragOffset = new Point(pos.x - rect.left, pos.y - rect.top);
            canvas.setPointerCapture(e.pointerId);
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        const pos = getCanvasPos(e);
        if (dragging) {
            const newLeft = pos.x - dragOffset.x;
            const newTop = pos.y - dragOffset.y;
            if (dragging === 'a') {
                rectA = new Rect(newLeft, newTop, NOTE_W, NOTE_H);
            } else {
                rectB = new Rect(newLeft, newTop, NOTE_W, NOTE_H);
            }
            render();
        } else {
            canvas.style.cursor = hitTest(pos.x, pos.y) ? 'grab' : 'default';
        }
    });

    canvas.addEventListener('pointerup', () => {
        dragging = null;
        canvas.style.cursor = 'default';
    });

    render();
};
