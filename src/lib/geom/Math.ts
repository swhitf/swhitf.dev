
export const roundClamp = (val: number, factor: number = 1) =>
    Math.round(val / factor) * factor;

export const round = (val: number, precision: number = 0) => {
    const f = Math.pow(10, precision);
    return Math.round(val * f) / f;
};

export const toRadians = (degrees: number) => {
    const deg2rad = (Math.PI * 2) / 360;
    return degrees * deg2rad;
};

export const toDegrees = (radians: number) => {
    const rad2deg = 360 / (Math.PI * 2);
    return radians * rad2deg;
};

export const roundRadians = (radians: number, factor: number = 1) => {
    const d = Math.round(toDegrees(radians));
    const rd = Math.round(d / factor) * factor;
    return toRadians(rd);
};
