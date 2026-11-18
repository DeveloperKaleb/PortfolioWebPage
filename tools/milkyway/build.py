"""Builds rubin/milkyway.png, the Milky Way behind the Solar System map, from the star counts
fetch.py kept (counts.csv.gz).

The picture is the whole sky in galactic coordinates, half a degree to a pixel: longitude
0 to 360 left to right, latitude +90 at the top to -90 at the bottom, grey from 0 (as
sparse as the sky gets, toward the galaxy's poles) to 255 (its densest, the bulge). Each
cell's count is divided by its area (cells shrink toward the poles), softened over about
a degree, and taken as a logarithm, as the eye takes brightness; the dark lanes of dust
are where Gaia sees fewer stars. Plain Python, no libraries: the PNG is written by hand.
"""
import gzip
import math
import os
import struct
import zlib

here = os.path.dirname(os.path.abspath(__file__))
W, H = 720, 360

grid = [[0.0] * W for _ in range(H)]
with gzip.open(os.path.join(here, 'counts.csv.gz'), 'rt') as f:
    next(f)
    for line in f:
        li, bi, n = line.strip().split(',')
        li, bi = int(float(li)), int(float(bi))
        if 0 <= li < W and 0 <= bi < H:
            grid[H - 1 - bi][li] += float(n)  # row 0 is latitude +90

# Per unit of sky: a cell's area goes as the cosine of its latitude.
for r in range(H):
    b = 90 - (r + 0.5) / 2
    area = math.cos(math.radians(b))
    grid[r] = [v / area for v in grid[r]]


def blur(rows, sigma, wrap):
    """A Gaussian along each row; longitude wraps round, latitude does not."""
    k = [math.exp(-0.5 * (i / sigma) ** 2) for i in range(-3 * int(sigma + 1), 3 * int(sigma + 1) + 1)]
    half = len(k) // 2
    out = []
    for row in rows:
        n = len(row)
        new = []
        for x in range(n):
            s = w = 0.0
            for j, kj in enumerate(k):
                xx = x + j - half
                if wrap:
                    xx %= n
                elif not 0 <= xx < n:
                    continue
                s += kj * row[xx]
                w += kj
            new.append(s / w)
        out.append(new)
    return out


grid = blur(grid, 1.2, True)
grid = [list(c) for c in zip(*blur([list(c) for c in zip(*grid)], 1.2, False))]

logs = [math.log10(v + 1) for row in grid for v in row]
ranked = sorted(logs)
low = ranked[int(0.02 * len(ranked))]
high = ranked[int(0.9995 * len(ranked))]
pixels = bytearray()
for r in range(H):
    pixels.append(0)  # PNG filter: none
    for c in range(W):
        t = (math.log10(grid[r][c] + 1) - low) / (high - low)
        pixels.append(round(255 * min(1.0, max(0.0, t))))


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 0, 0, 0, 0)) \
    + chunk(b'IDAT', zlib.compress(bytes(pixels), 9)) + chunk(b'IEND', b'')
out = os.path.join(here, '..', '..', 'rubin', 'milkyway.png')
with open(out, 'wb') as f:
    f.write(png)
print(f'{W}x{H}, {len(png):,} bytes; log counts {low:.2f} to {high:.2f}')
