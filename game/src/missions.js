// VERTEX CITY — missions. Five story jobs for KAIRO, the skyline outlaw:
// steal a ride, run a courier job, shake the heat, climb the rooftops,
// then pull the skyline heist. Each mission has a beacon pillar in the
// world, a minimap blip, an objective line and a cash reward.
(function () {
  var CFG = VC.CFG;

  var DEFS = [
    {
      id: 'wheels',
      title: 'FIRST WHEELS',
      brief: 'NOVA needs a driver. Steal any car (E) and bring it to the Skydeck garage.',
      target: { x: -84, z: -84, r: 8 },
      needCar: true,
    },
    {
      id: 'courier',
      title: 'COURIER RUN',
      brief: 'Pick up the package at the Ramen bar, then deliver it across town in 90 seconds.',
      stages: [
        { x: 84, z: 56, r: 6, text: 'Pick up the package' },
        { x: -112, z: 112, r: 8, text: 'Deliver the package — 90s on the clock' },
      ],
      timer: 90,
    },
    {
      id: 'heat',
      title: 'HEAT WAVE',
      brief: 'The crew set you up — 3 stars of heat. Lose the cops: reach the hideout under the monorail.',
      target: { x: 0, z: 112, r: 9 },
      setHeat: 3,
    },
    {
      id: 'rooftops',
      title: 'ROOFTOP RENDEZVOUS',
      brief: 'The meet is on the roofs. SKYHOOK (Q) up three towers to reach NOVA.',
      stages: [
        { x: 28, z: 28, r: 10, text: 'Grapple to the first roof (Q)', roof: true },
        { x: -28, z: 28, r: 10, text: 'Second roof — keep climbing', roof: true },
        { x: -28, z: -28, r: 10, text: 'The meet — top of the spire', roof: true },
      ],
    },
    {
      id: 'heist',
      title: 'SKYLINE HEIST',
      brief: 'The vault van is parked by the casino. Steal it, then escape to the helipad on the tallest spire.',
      stages: [
        { x: 112, z: -28, r: 7, text: 'Steal the vault van (E)' },
        { x: 0, z: 0, r: 10, text: 'Escape to the helipad!', roof: true },
      ],
    },
  ];

  VC.createMissions = function (scene, city) {
    // Beacon: a glowing pillar of light marking the objective.
    var beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 120, 12, 1, true);
    var beaconMat = new THREE.MeshBasicMaterial({
      color: 0x37e6ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    });
    var beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.visible = false;
    scene.add(beacon);
    var markerGeo = new THREE.SphereGeometry(1.1, 12, 12);
    var marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xffc857 }));
    marker.visible = false;
    scene.add(marker);

    var state = {
      index: 0,
      stage: 0,
      active: false,
      done: false,
      timer: 0,
      beacon: beacon,
      marker: marker,
      def: null,
      objective: '',
      flash: 0,
    };

    function currentTarget() {
      if (!state.def) return null;
      if (state.def.stages) return state.def.stages[state.stage];
      return state.def.target;
    }

    state.start = function (i) {
      state.index = i;
      state.stage = 0;
      state.def = DEFS[i];
      state.active = true;
      state.done = false;
      state.timer = state.def.timer || 0;
      state.objective = state.def.stages ? state.def.stages[0].text : state.def.brief;
      state.flash = 0;
      beacon.visible = true;
      marker.visible = true;
      return state.def;
    };

    state.targetPos = function () {
      var t = currentTarget();
      if (!t) return null;
      // Rooftop targets sit on the tallest tower near the point.
      if (t.roof) {
        var best = null, bestD = 1e9;
        for (var i = 0; i < city.rooftops.length; i++) {
          var r = city.rooftops[i];
          var d = Math.hypot(r.x - t.x, r.z - t.z);
          if (d < bestD) { bestD = d; best = r; }
        }
        if (best) return { x: best.x, z: best.z, y: best.h, r: t.r };
      }
      return { x: t.x, z: t.z, y: 0, r: t.r };
    };

    // Returns 'advance' | 'complete' | 'fail' | null.
    state.update = function (dt, playerPos, inCar, heat) {
      if (!state.active) return null;
      var t = state.targetPos();
      if (t) {
        beacon.position.set(t.x, 60, t.z);
        marker.position.set(t.x, (t.y || 0) + 3 + Math.sin(performance.now() / 300) * 0.5, t.z);
      }
      if (state.timer > 0) {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.active = false;
          beacon.visible = false;
          marker.visible = false;
          return 'fail';
        }
      }
      if (!t) return null;
      var dx = playerPos.x - t.x, dz = playerPos.z - t.z;
      var dy = playerPos.y - (t.y || 0);
      var arrived = Math.hypot(dx, dz) < t.r && Math.abs(dy) < 6;
      if (state.def.needCar && !inCar) arrived = false;
      if (!arrived) return null;
      if (state.def.stages && state.stage < state.def.stages.length - 1) {
        state.stage++;
        state.objective = state.def.stages[state.stage].text;
        return 'advance';
      }
      state.active = false;
      state.done = true;
      beacon.visible = false;
      marker.visible = false;
      return 'complete';
    };

    state.next = function () {
      if (state.index + 1 < DEFS.length) return state.start(state.index + 1);
      return null;
    };

    state.reward = function () {
      return CFG.missionReward[state.index] || 500;
    };

    state.progress = function () {
      return 'MISSION ' + (state.index + 1) + ' / ' + DEFS.length;
    };

    state.allDone = function () {
      return state.index >= DEFS.length - 1 && state.done;
    };

    return state;
  };
})();
