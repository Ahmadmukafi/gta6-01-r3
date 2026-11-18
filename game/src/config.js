// VERTEX CITY — Skyline Outlaw. Tuning constants for the whole game.
// Every number lives here so the city, the player, the cars and the
// missions all agree on the same scale. Units are metres, time seconds.
window.VC = window.VC || {};
VC.CFG = {
  // City grid: 9 x 9 blocks, each block 44 m, roads 12 m wide.
  blocks: 9,
  blockSize: 44,
  roadWidth: 12,
  pitch: 56, // blockSize + roadWidth
  // Building heights: downtown towers rise toward the centre.
  minHeight: 14,
  maxHeight: 95,
  downtownBoost: 55,
  // Player on foot.
  walkSpeed: 8,
  sprintSpeed: 13.5,
  jumpSpeed: 9.5,
  gravity: 26,
  playerRadius: 0.6,
  playerHeight: 1.8,
  // SKYHOOK grapple: the signature move. Fire at a rooftop and zip up.
  grappleRange: 70,
  grappleSpeed: 26,
  grappleCooldown: 1.2,
  // Cars.
  carTopSpeed: 34,
  carAccel: 16,
  carBrake: 30,
  carTurn: 1.9,
  trafficCount: 28,
  // Parked cars near the spawn intersection so the first steal (mission
  // 1) never means hunting the whole city for a ride. They sit at the
  // road edges, on the road centrelines' shoulders, so traffic passes by.
  parkedCars: [
    { x: 31.5, z: 118, heading: 0 },
    { x: 24.5, z: 164, heading: Math.PI },
    { x: 52, z: 143.5, heading: Math.PI / 2 },
  ],
  pedCount: 46,
  // Wanted / HEAT: 0-5 stars. Crimes add heat, hiding sheds it.
  heatDecayDelay: 18,
  heatDecayRate: 0.25,
  policeMax: 6,
  // Combat.
  playerHealth: 100,
  pistolDamage: 34,
  pistolRange: 60,
  policeCarHealth: 120,
  // Missions.
  missionReward: [400, 600, 800, 1000, 2500],
  // Look: permanent rain-soaked cyberpunk night.
  fogNear: 40,
  fogFar: 260,
  rainDrops: 2600,
  skyColor: 0x070312,
  // Camera: third-person orbit distance behind the player.
  camDist: 8,
  // Starting cash.
  startCash: 250,
  // Save slot in localStorage.
  saveKey: 'vertex-city-save-v1',
};
