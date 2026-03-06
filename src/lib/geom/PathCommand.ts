import { Point } from './Point';

const ArgCounts: Record<string, number> = {
    m: 2, l: 2, t: 2, h: 1, v: 1, s: 4, q: 4, c: 6, a: 7, z: 0
};

const CommandParsers: Record<string, (cmd: string, args: string[]) => any> = {
    m: (cmd, args) => [cmd, new Point(parseFloat(args[0]), parseFloat(args[1]))],
    l: (cmd, args) => [cmd, new Point(parseFloat(args[0]), parseFloat(args[1]))],
    h: (cmd, args) => [cmd, parseFloat(args[0])],
    v: (cmd, args) => [cmd, parseFloat(args[0])],
    q: (cmd, args) => [cmd,
        new Point(parseFloat(args[0]), parseFloat(args[1])),
        new Point(parseFloat(args[2]), parseFloat(args[3]))
    ],
    s: (cmd, args) => [cmd,
        new Point(parseFloat(args[0]), parseFloat(args[1])),
        new Point(parseFloat(args[2]), parseFloat(args[3]))
    ],
    c: (cmd, args) => [cmd,
        new Point(parseFloat(args[0]), parseFloat(args[1])),
        new Point(parseFloat(args[2]), parseFloat(args[3])),
        new Point(parseFloat(args[4]), parseFloat(args[5]))
    ],
    t: (cmd, args) => [cmd, new Point(parseFloat(args[0]), parseFloat(args[1]))],
    a: (cmd, args) => [cmd,
        new Point(parseFloat(args[0]), parseFloat(args[1])),
        parseFloat(args[2]),
        parseInt(args[3]) as 0 | 1,
        parseInt(args[4]) as 0 | 1,
        new Point(parseFloat(args[5]), parseFloat(args[6]))
    ],
    z: (cmd) => [cmd]
};

const normalize = (pathString: string) => {
    return pathString
        .replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, ' $1 ')
        .replace(/(\d)-/g, '$1 -')
        .replace(/\s+/g, ' ').trim();
};

const tokenize = (normalString: string) => {
    const cr = /[MmLlHhVvCcSsQqTtAaZz]/;
    const tokens = [] as string[];
    let current = '';
    for (const char of normalString) {
        if (cr.test(char) && current.length > 0) {
            tokens.push(current.trim());
            current = '';
        }
        current += char;
    }
    if (current.length > 0) {
        tokens.push(current.trim());
    }
    return tokens;
};

const dechunk = (tokens: string[]) => {
    return tokens.flatMap(t => {
        const [command, ...args] = t.split(' ');
        const argCount = ArgCounts[command.toLowerCase()];
        if (command.toLowerCase() === 'z') return [command];
        const batches = [] as string[][];
        for (let i = 0; i < args.length; i += argCount) {
            batches.push(args.slice(i, i + argCount).map(x => x.trim()));
        }
        return batches.map(x => [command, ...x].join(' '));
    });
};

export type PathCommand =
    ['M' | 'm' | 'L' | 'l', Point] |
    ['H' | 'h', number] |
    ['V' | 'v', number] |
    ['Q' | 'q', Point, Point] |
    ['C' | 'c', Point, Point, Point] |
    ['S' | 's', Point, Point] |
    ['T' | 't', Point] |
    ['A' | 'a', Point, number, 0 | 1, 0 | 1, Point] |
    ['Z' | 'z']
    ;

export const PathCommand = {
    from(pathString: string): PathCommand[] {
        const normalized = normalize(pathString);
        const tokenized = tokenize(normalized);
        const dechunked = dechunk(tokenized);
        return dechunked.map(block => {
            const [command, ...args] = block.split(' ');
            const parser = CommandParsers[command.toLowerCase()];
            if (!parser) throw new Error(`Unknown path command: ${command}`);
            return parser(command, args);
        });
    }
};
