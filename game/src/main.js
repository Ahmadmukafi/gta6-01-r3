// VERTEX CITY — Skyline Outlaw. Boot, game loop and the glue between
// every system: input, driving, shooting, HEAT (wanted), missions,
// save/load and the menu / pause / busted / complete screens.
(function () {
  var CFG = VC.CFG;

  var SAVE_KEY = CFG.saveKey;

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSave(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  window.addEventListener('DOMContentLoaded', function () {
    var canvasHolder = document.getElementById('game');
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    canvasHolder.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(CFG.skyColor);
    scene.fog = new THREE.Fog(CFG.skyColor, CFG.fogNear, CFG.fogFar);
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

    // Night lighting: brighter ambient so the streets read, a cool moon
    // and a warm street-level hemisphere for the neon glow.
    scene.add(new THREE.AmbientLight(0x51628a, 1.7));
    var moon = new THREE.DirectionalLight(0x8fb4ff, 0.9);
    moon.position.set(80, 140, 40);
    scene.add(moon);
    var hemi = new THREE.HemisphereLight(0x3a2a5e, 0x14141f, 0.9);
    scene.add(hemi);

    var city = VC.buildCity(scene);
    var hud = VC.createHUD(city);
    var audio = VC.createAudio();
    var missions = VC.createMissions(scene, city);
    var traffic = VC.createTraffic(scene, city, CFG.trafficCount);
    var peds = VC.createPeds(scene, city, CFG.pedCount);
    var police = VC.createPolice(scene, city);

    var save = loadSave();
    // Spawn on the road at the south edge, facing straight downtown
    // down the street so the first frame is a clean street canyon.
    var spawn = new THREE.Vector3(28, 0, 140);
    var player = VC.createPlayer(scene, city, spawn);
    player.yaw = 0;
    if (save) {
      player.cash = save.cash || CFG.startCash;
      if (save.missionIndex > 0) missions.start(Math.min(save.missionIndex, 4));
    }

    var G = {
      state: 'menu', // menu | playing | paused | busted | complete
      inCar: null,
      heat: 0,
      heatTimer: 0,
      sirenTimer: 0,
      spawnTimer: 0,
      shooting: false,
      shootCooldown: 0,
      mouseDown: false,
      keys: {},
      jumpPressed: false,
      startedAt: 0,
    };

    var input = { keys: G.keys, jumpPressed: false };

    // ---- Input ----
    window.addEventListener('keydown', function (e) {
      G.keys[e.code] = true;
      if (e.code === 'Space' && !e.repeat) { input.jumpPressed = true; e.preventDefault(); }
      if (e.code === 'KeyQ') player.fireGrapple();
      if (e.code === 'KeyE') toggleCar();
      if (e.code === 'KeyM') audio.toggleMute();
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
    renderer.domElement.addEventListener('mousedown', function (e) {
      if (e.button === 0) G.mouseDown = true;
      if (document.pointerLockElement !== renderer.domElement) {
        // Pointer lock needs a real user gesture; headless or denied
        // lock must never break the game, so swallow the rejection.
        try {
          var p = renderer.domElement.requestPointerLock();
          if (p && p.catch) p.catch(function () {});
        } catch (err) {}
      }
    });
    window.addEventListener('mouseup', function (e) { if (e.button === 0) G.mouseDown = false; });
    document.addEventListener('mousemove', function (e) {
      if (G.state !== 'playing') return;
      if (document.pointerLockElement === renderer.domElement) {
        player.yaw -= e.movementX * 0.0026;
        player.pitch = Math.max(-0.9, Math.min(0.45, player.pitch + e.movementY * 0.002));
      }
    });
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- Car enter / exit ----
    var parkedCars = [];
    function nearestCar(maxDist) {
      var best = null, bestD = maxDist;
      var all = traffic.cars.concat(police.units);
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.dead) continue;
        var d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }
    function toggleCar() {
      if (G.state !== 'playing') return;
      if (G.inCar) {
        // Exit beside the car.
        var car = G.inCar;
        car.playerDriven = false;
        G.inCar = null;
        car.speed = 0;
        player.pos.set(car.pos.x + 2.5, 0, car.pos.z);
        player.group.visible = true;
        audio.setEngine(false, 0);
        hud.setCrosshair(true);
        hud.toast('You left the car');
      } else {
        var car2 = nearestCar(4.5);
        if (car2) {
          G.inCar = car2;
          car2.playerDriven = true;
          player.group.visible = false;
          audio.engineStart();
          addHeat(1);
          hud.setCrosshair(false);
          hud.toast('Car jacked! The city saw that — HEAT up');
        }
      }
    }

    // ---- HEAT (wanted) ----
    function addHeat(n) {
      G.heat = Math.min(5, G.heat + n);
      G.heatTimer = CFG.heatDecayDelay;
      hud.setHeat(G.heat);
    }
    function setHeat(n) {
      G.heat = Math.max(G.heat, n);
      G.heatTimer = CFG.heatDecayDelay;
      hud.setHeat(G.heat);
    }

    // ---- Shooting ----
    var tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    var tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe14d }));
    tracer.visible = false;
    scene.add(tracer);
    var tracerT = 0;

    function shoot(dt) {
      if (G.shootCooldown > 0) return;
      G.shootCooldown = 0.22;
      audio.shoot();
      G.shooting = true;
      var origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var tp = tracerGeo.attributes.position.array;
      tp[0] = origin.x; tp[1] = origin.y; tp[2] = origin.z;
      var end = origin.clone().addScaledVector(dir, CFG.pistolRange);
      // Hit police cars first.
      var hit = null, hitD = CFG.pistolRange;
      var targets = police.units.concat(traffic.cars);
      for (var i = 0; i < targets.length; i++) {
        var c = targets[i];
        if (c.dead) continue;
        var to = new THREE.Vector3(c.pos.x - origin.x, 0.6 - origin.y, c.pos.z - origin.z);
        var along = to.dot(dir);
        if (along < 0 || along > hitD) continue;
        var perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < 2.4) { hit = c; hitD = along; }
      }
      if (hit) {
        end = origin.clone().addScaledVector(dir, hitD);
        hit.health -= CFG.pistolDamage;
        addHeat(1);
        if (hit.health <= 0 && !hit.dead) {
          hit.dead = true;
          explode(hit.pos);
          if (hit.isPolice) {
            player.cash += 150;
            hud.toast('Police car destroyed — +$150');
          }
        }
      }
      tp[3] = end.x; tp[4] = end.y; tp[5] = end.z;
      tracerGeo.attributes.position.needsUpdate = true;
      tracer.visible = true;
      tracerT = 0.07;
    }

    // Explosion: expanding orange sphere + smoke puff, then gone.
    var explosions = [];
    function explode(pos) {
      var m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.9 })
      );
      m.position.set(pos.x, 1.2, pos.z);
      scene.add(m);
      explosions.push({ mesh: m, t: 0 });
      audio.crash();
    }

    // ---- Screens ----
    function show(id) {
      ['menu', 'pause', 'busted', 'complete', 'hud'].forEach(function (s) {
        var e = document.getElementById('screen-' + s);
        if (e) e.style.display = s === id ? 'flex' : 'none';
      });
    }
    function startGame() {
      audio.unlock();
      G.state = 'playing';
      G.startedAt = performance.now();
      show('hud');
      hud.setHealth(player.health);
      hud.setCash(player.cash);
      hud.setHeat(G.heat);
      if (!missions.active && !missions.done) {
        var def = missions.start(0);
        hud.setMissionTitle(def.title);
        hud.setObjective(def.brief);
        hud.toast('Mission 1: ' + def.title);
      }
      // Show the current mission even when continuing a saved game.
      if (missions.def) {
        hud.setMissionTitle(missions.def.title);
        hud.setObjective(missions.objective);
        hud.setMissionCount(missions.progress());
      }
      if (document.pointerLockElement !== renderer.domElement) {
        try {
          var pl = renderer.domElement.requestPointerLock();
          if (pl && pl.catch) pl.catch(function () {});
        } catch (err) {}
      }
    }
    function togglePause() {
      if (G.state === 'playing') { G.state = 'paused'; show('pause'); }
      else if (G.state === 'paused') { G.state = 'playing'; show('hud'); }
    }
    function bust() {
      G.state = 'busted';
      document.exitPointerLock();
      show('busted');
      audio.fail();
      writeSave({ cash: Math.floor(player.cash * 0.5), missionIndex: missions.index });
    }
    function completeGame() {
      G.state = 'complete';
      document.exitPointerLock();
      show('complete');
      document.getElementById('final-cash').textContent = '$' + Math.floor(player.cash).toLocaleString('en-US');
      var mins = Math.floor((performance.now() - G.startedAt) / 60000);
      document.getElementById('final-time').textContent = mins + ' min';
      audio.missionDone();
      writeSave({ cash: Math.floor(player.cash), missionIndex: 5 });
    }

    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-retry').addEventListener('click', function () {
      player.reset(spawn);
      police.clear();
      G.heat = 0;
      hud.setHeat(0);
      // Retry the mission you were on, not the first one.
      var cur = missions.index;
      missions.start(cur);
      hud.setMissionTitle(missions.def.title);
      hud.setObjective(missions.objective);
      hud.setMissionCount(missions.progress());
      startGame();
    });
    document.getElementById('btn-again').addEventListener('click', function () {
      player.reset(spawn);
      player.cash = CFG.startCash;
      police.clear();
      G.heat = 0;
      missions.start(0);
      startGame();
    });
    document.getElementById('btn-continue').addEventListener('click', function () {
      var s = loadSave();
      if (s) {
        player.cash = s.cash || CFG.startCash;
        hud.setCash(player.cash);
      }
      startGame();
    });
    if (!save) document.getElementById('btn-continue').style.display = 'none';

    // ---- Main loop ----
    var clock = new THREE.Clock();
    var lastHud = 0;
    var lastHealth = CFG.playerHealth;
    function animate() {
      requestAnimationFrame(animate);
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.elapsedTime;

      if (G.state === 'playing') {
        // Player or car.
        if (G.inCar) {
          var car = G.inCar;
          var th = (G.keys['KeyW'] ? 1 : 0) - (G.keys['KeyS'] ? 1 : 0);
          var st = (G.keys['KeyA'] ? 1 : 0) - (G.keys['KeyD'] ? 1 : 0);
          VC.stepCar(car, dt, city, th, st);
          player.pos.copy(car.pos);
          player.yaw = car.heading + Math.PI;
          audio.setEngine(true, Math.abs(car.speed) / CFG.carTopSpeed);
          // Running over peds / ramming traffic raises HEAT.
          for (var i = 0; i < traffic.cars.length; i++) {
            var tc = traffic.cars[i];
            if (tc === car || tc.dead) continue;
            var ddx = tc.pos.x - car.pos.x, ddz = tc.pos.z - car.pos.z;
            if (ddx * ddx + ddz * ddz < 9 && Math.abs(car.speed) > 8) {
              tc.dead = true;
              explode(tc.pos);
              addHeat(1);
              car.speed *= 0.5;
            }
          }
        } else {
          player.update(dt, input);
          input.jumpPressed = false;
          audio.setEngine(false, 0);
          if (G.mouseDown) shoot(dt);
        }
        G.shootCooldown = Math.max(0, G.shootCooldown - dt);
        if (tracerT > 0) {
          tracerT -= dt;
          if (tracerT <= 0) tracer.visible = false;
        }
        G.shooting = false;

        // Camera: chase the car, orbit the player on foot.
        if (G.inCar) {
          var c = G.inCar;
          var bx = c.pos.x + Math.sin(c.heading) * 10;
          var bz = c.pos.z + Math.cos(c.heading) * 10;
          camera.position.lerp(new THREE.Vector3(bx, 4.5, bz), 1 - Math.pow(0.001, dt));
          camera.lookAt(c.pos.x, 1.5, c.pos.z);
        } else {
          player.cameraUpdate(camera, dt);
        }

        // HEAT: spawn police, decay when quiet.
        if (G.heat > 0) {
          G.heatTimer -= dt;
          G.spawnTimer -= dt;
          if (G.spawnTimer <= 0) {
            var want = Math.min(G.heat, 2) + (G.heat >= 4 ? 2 : 0);
            if (police.units.length < want) police.spawn(player.pos);
            G.spawnTimer = 4;
          }
          G.sirenTimer -= dt;
          if (G.sirenTimer <= 0) { audio.siren(); G.sirenTimer = 2.2; }
          if (G.heatTimer <= 0) {
            G.heat = Math.max(0, G.heat - 1);
            G.heatTimer = CFG.heatDecayDelay;
            hud.setHeat(G.heat);
          }
        }
        police.update(dt, player.pos, !G.inCar, player);
        traffic.update(dt, player.pos);
        peds.update(dt, player.pos, G.inCar ? Math.abs(G.inCar.speed) : 0, G.mouseDown, traffic.cars);

        // Missions.
        var res = missions.update(dt, player.pos, !!G.inCar, G.heat);
        if (res === 'advance') {
          hud.setObjective(missions.objective);
          hud.toast('Objective updated');
          audio.pickup();
        } else if (res === 'complete') {
          var reward = missions.reward();
          player.cash += reward;
          hud.setCash(player.cash);
          hud.toast('Mission complete — +$' + reward);
          audio.missionDone();
          setHeat(0);
          police.clear();
          if (missions.allDone()) {
            completeGame();
          } else {
            var next = missions.next();
            if (next) {
              hud.setMissionTitle(next.title);
              hud.setObjective(next.brief);
              hud.setMissionCount(missions.progress());
              hud.toast('Next mission: ' + next.title);
              if (next.setHeat) setHeat(next.setHeat);
            }
          }
        } else if (res === 'fail') {
          hud.toast('Mission failed — time up! Restarting it…');
          audio.fail();
          missions.start(missions.index);
        }
        if (missions.timer > 0) hud.setTimer(missions.timer);
        else hud.setTimer(0);

        // Explosions animate out.
        for (var e = explosions.length - 1; e >= 0; e--) {
          var ex = explosions[e];
          ex.t += dt;
          ex.mesh.scale.setScalar(1 + ex.t * 9);
          ex.mesh.material.opacity = Math.max(0, 0.9 - ex.t * 2.2);
          if (ex.t > 0.45) {
            scene.remove(ex.mesh);
            explosions.splice(e, 1);
          }
        }

        // Death.
        if (player.dead) bust();

        // HUD refresh (10 Hz is plenty). A health drop flashes red.
        if (t - lastHud > 0.1) {
          lastHud = t;
          if (player.health < lastHealth) hud.damageFlash();
          lastHealth = player.health;
          hud.setHealth(player.health);
          hud.setCash(player.cash);
          hud.setSpeed(G.inCar ? G.inCar.speed : 0, !!G.inCar);
          var bp = missions.active ? missions.targetPos() : null;
          hud.drawMinimap(player.pos, G.inCar ? G.inCar.heading : player.yaw, police.units, traffic.cars, bp);
        }
      }

      // The city lives even on the menu screen (attract mode).
      city.update(dt, t, player.pos);
      renderer.render(scene, camera);
    }
    animate();
    show('menu');
  });
})();
