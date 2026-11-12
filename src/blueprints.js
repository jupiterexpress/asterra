// Heights are read back-to-front. Zero is an open courtyard, never buildable space.
export const CONTRACTS = [
  { name: 'THE LANTERN HOUSE', short: 'Lantern House', district: '01 · WELCOME QUARTER',
    description: 'A warm gathering place. Start with a simple rectangular plan.',
    lesson: 'Fill the outline, then finish your building. Keep stacking for a denser build and a better reward.',
    heights: [[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2]], goal: 0.65, tiles: 22,
    wall: 0xc8ccb0, roof: 0x388f89 },
  { name: 'THE STEP HOUSE', short: 'Step House', district: '02 · GARDEN WALK',
    description: 'A neighborhood workshop with a low wing and a taller corner.',
    lesson: 'Build the low wing first. Leave room for the taller side of this stepped plan.',
    heights: [[3, 3, 2, 2], [3, 3, 2, 2], [2, 2, 0, 0], [2, 2, 0, 0]], goal: 0.7, tiles: 28,
    wall: 0xb9bdab, roof: 0x357d79 },
  { name: 'THE COURTYARD', short: 'Courtyard', district: '03 · MOONLIT SQUARE',
    description: 'An open courtyard, two wings, and a tower to light the square.',
    lesson: 'Work around the open courtyard. FLIP and Tile Choice help with the narrow wings.',
    heights: [[3, 3, 3, 2, 2], [2, 2, 0, 2, 2], [2, 2, 0, 2, 2], [2, 0, 0, 0, 2]], goal: 0.75, tiles: 36,
    wall: 0xc5b79b, roof: 0x327b80 },
].map((plan, index) => {
  const w = plan.heights[0].length, d = plan.heights.length, columns = [], cells = [];
  plan.heights.forEach((row, z) => row.forEach((height, x) => {
    if (!height) return;
    const cx = x - Math.floor(w / 2), cz = z - Math.floor(d / 2);
    columns.push([cx, cz, height]);
    for (let y = 0; y < height; y++) cells.push([cx, y, cz]);
  }));
  return { ...plan, index, w, d, columns, cells, keys: new Set(cells.map(c => c.join(','))) };
});

// Small isometric diagrams work equally well in a contract card or a touch picker.
export function voxelSVG(cells, color = '#88c8b7') {
  const project = (x, y, z) => [(x - z) * 14, (x + z) * 7 - y * 17];
  const points = cells.flatMap(([x, y, z]) => [[x, y, z], [x + 1, y, z + 1], [x, y + 1, z], [x + 1, y + 1, z + 1]].map(c => project(...c)));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs) - 18, minY = Math.min(...ys) - 8;
  const path = corners => corners.map((c, i) => `${i ? 'L' : 'M'}${project(...c).join(' ')}`).join('') + 'Z';
  const faces = cells.slice().sort((a, b) => (a[0] + a[2] - b[0] - b[2]) || a[1] - b[1]).map(([x, y, z]) => {
    return `<path fill="${color}" d="${path([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]])}"/><path fill="${color}" fill-opacity=".5" d="${path([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]])}"/><path fill="${color}" fill-opacity=".75" d="${path([[x+1,y,z],[x+1,y,z+1],[x+1,y+1,z+1],[x+1,y+1,z]])}"/>`;
  }).join('');
  return `<svg viewBox="${minX} ${minY} ${Math.max(...xs) - minX + 18} ${Math.max(...ys) - minY + 8}" aria-hidden="true" stroke="#b5dfcc" stroke-width=".6" stroke-linejoin="round">${faces}</svg>`;
}
