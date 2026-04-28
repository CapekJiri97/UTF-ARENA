export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function expForLevel(l) {
  return 20 + (l - 1) * 20;
}

export function isPointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    let intersect = ((pts[i].y > py) !== (pts[j].y > py)) && (px < (pts[j].x - pts[i].x) * (py - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distToPoly(px, py, pts) {
  let inside = isPointInPoly(px, py, pts), minDist = Infinity, closestPt = null, closestNorm = null;
  for(let i=0; i<pts.length; i++) {
    let p1 = pts[i], p2 = pts[(i+1)%pts.length];
    let l2 = (p2.x-p1.x)**2 + (p2.y-p1.y)**2;
    let t = l2===0 ? 0 : ((px-p1.x)*(p2.x-p1.x) + (py-p1.y)*(p2.y-p1.y))/l2;
    t = Math.max(0, Math.min(1, t)); let cx = p1.x + t*(p2.x-p1.x), cy = p1.y + t*(p2.y-p1.y);
    let d = Math.hypot(px-cx, py-cy);
    if (d < minDist) { minDist = d; closestPt = {x:cx, y:cy}; let nx = (p2.y-p1.y), ny = -(p2.x-p1.x), nl = Math.hypot(nx,ny); closestNorm = {x:nx/nl, y:ny/nl}; }
  } 
  return { inside, minDist, closestPt, closestNorm };
}

export function smoothPolygon(pts, iterations = 2) {
  let smoothed = pts;
  for(let it=0; it<iterations; it++) {
      let next = [];
      for(let i=0; i<smoothed.length; i++) {
          let p1 = smoothed[i], p2 = smoothed[(i+1)%smoothed.length];
          next.push({x: 0.75*p1.x + 0.25*p2.x, y: 0.75*p1.y + 0.25*p2.y});
          next.push({x: 0.25*p1.x + 0.75*p2.x, y: 0.25*p1.y + 0.75*p2.y});
      }
      smoothed = next;
  }
  return smoothed;
}