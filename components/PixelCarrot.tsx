'use client';

export default function PixelCarrot({ size = 64 }: { size?: number }) {
    // 0: transparent, 1: dark orange, 2: mid orange, 3: light orange, 4: dark green, 5: mid green, 6: light green, 7: shadow/face
    const grid = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 6, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 4, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 5, 6, 6, 5, 4, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 5, 6, 6, 5, 4, 4, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 5, 6, 6, 5, 4, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 1, 1, 4, 4, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 3, 3, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 3, 7, 2, 7, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 3, 2, 7, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 3, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 3, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 3, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    const colors: Record<number, string> = {
        0: 'transparent',
        1: '#9a3412', // dark orange border
        2: '#f97316', // mid orange
        3: '#fb923c', // light orange highlight
        4: '#14532d', // dark green border
        5: '#22c55e', // mid green
        6: '#86efac', // light green highlight
        7: '#431407', // eyes/mouth (darkest brown)
    };

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(16, 1fr)`,
                width: size,
                height: size,
                imageRendering: 'pixelated'
            }}
        >
            {grid.flat().map((cell, i) => (
                <div key={i} style={{ backgroundColor: colors[cell] }} />
            ))}
        </div>
    );
}
