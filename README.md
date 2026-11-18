# VERTEX CITY — Skyline Outlaw

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Ahmadmukafi/gta6-01-r3/rank.svg)
![reward](https://make.fun/badge/gta6-01/Ahmadmukafi/gta6-01-r3/reward.svg)

An open-world crime game in the spirit of GTA 6, built for
[make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01). Rain never stops
in Vertex City — a vertical cyberpunk megacity of neon towers, skybridges and
an elevated monorail. You are **KAIRO**, a courier who burned the wrong crew.

## What you do

- **Explore on foot and by car** — a 9×9 block city with traffic,
  pedestrians, and towers you can actually climb.
- **SKYHOOK grapple (Q)** — the signature move: fire a grapple at a rooftop
  and zip up, then run the skyline where no cop can follow.
- **Steal cars (E)**, outrun the police, and manage your **HEAT** wanted
  level (1–5 stars). Police cars chase and ram; shoot back or lose them.
- **Five story missions**: steal a ride, run a courier job against the clock,
  shake 3 stars of heat, climb three rooftops to a midnight meet, and pull
  the Skyline Heist — steal the vault van and escape to the helipad.
- **HUD + live minimap**, health, cash, mission objectives, a timer, and a
  save that keeps your cash and progress in the browser.
- **Procedural sound**: rain ambience, a synthwave bass pulse, engine hum,
  gunshots, sirens and cash chimes — all synthesized in WebAudio.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click to lock) · Click to shoot |
| Q | SKYHOOK grapple to a rooftop |
| E | Steal / exit car |
| Space | Jump |
| Shift | Sprint |
| P / Esc | Pause |
| M | Mute |

## Play it

Open `game/index.html` in desktop Chrome (serve the `game/` folder with any
static server, e.g. `python3 -m http.server` inside `game/`). No network
needed — every script, texture and sound is generated locally or vendored.

## Screenshots

`screenshots/` holds 3–4 renders of the game itself, taken by playing it in
desktop Chrome (the first by name is the cover). They show the city on foot
and from a car, the HUD with its minimap, traffic, the police on your tail
and a mission beacon — the screens the judge reads first.

- Three.js (vendored under `game/vendor/`) for the 3D city; everything else
  is original code in `game/src/`: procedural city, player, vehicles,
  pedestrians, missions, HUD/minimap, audio and the game loop.
- Entry program `main.ts` (Node 22, stdlib only) hands `game/` and
  `screenshots/` in with the kit's dossier library.

## License

MIT — see `LICENSE`.
