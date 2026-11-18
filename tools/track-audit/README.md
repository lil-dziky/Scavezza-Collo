# Track audit tools

Headless tools used to audit and tune the 23 circuits (no browser needed, Node 16+; Python + matplotlib for plots).

```
node harness.js                 # extracts the track code from ../../index.html into lib.js
node analyze.js audit.json      # per track: length, corners (distance, direction, angle, radius), straights, clearance
python3 plot.py audit.json 0 spa.png     # map of track #0 with corner radii (red <30 m, orange <70 m)
node fo.js 5 4820 4890          # lap position (metres after the start line) -> fraction used by the edit options
```

Track definitions live in `index.html` (`const TRACKS=[...]`). Per-track options added for the audit:

| option | meaning |
|---|---|
| `pit:'R'/'L'` | which side of the start straight the pit lane is on (driver's right / left) |
| `ro:[[m0,m1,'R'/'L'/'B',widthM,surf]]` | run-off stretches, metres after the start line; surf 0 grass, 1 tarmac, 2 gravel |
| `cz:[[m0,m1]]` | concrete wall stretches (armco elsewhere) |
| `kerbs:0` / `kerbs:'all'` / `kr:` | no kerbs / continuous strip / corner radius (m) under which corners get kerbs |
| `kz:[[m0,m1,side]]`, `kn:[[m0,m1]]` | force kerbs on / off for a stretch |
| `str:[[f0,f1]]` | straighten a stretch (fractions of the traced lap) |
| `chc:[[f,lenM,ampM,rampM]]` | add a chicane (sideways jog and back); negative amp flips the first corner |
| `rz:[[f0,f1,Rpx]]` | corner radius for one stretch |
| `sfF:f` | pin the start line to a fraction of the traced lap |
