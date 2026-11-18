// VERTEX CITY — cars. Arcade driving, traffic that loops the road grid,
// and police that chase the player when the HEAT is up. Cars are built
// from boxes with neon underglow so they read at night.
(function () {
  var CFG = VC.CFG;

  var CAR_COLORS = [0xff3df0, 0x37e6ff, 0xffc857, 0x7dffce, 0xff5a5a, 0xc9a0ff, 0xe8e8e8, 0x223344];

  function makeCarMesh(color, isPolice) {
    var g = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: color, roughness: 0.25, metalness: 0.8 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
    body.position.y = 0.55;
    g.add(body);
    var cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.55, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.1, metalness: 0.9 })
    );
    cabin.position.set(0, 1.1, -0.2);
    g.add(cabin);
    // Neon underglow.
    var glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 4.8),
      new THREE.MeshBasicMaterial({ color: isPolice ? 0xff2222 : color, transparent: true, opacity: 0.35 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.06;
    g.add(glow);
    // Headlights + taillights.
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    var tl = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    [-0.7, 0.7].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), hl);
      h.position.set(x, 0.55, 2.22);
      g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), tl);
      t.position.set(x, 0.55, -2.22);
      g.add(t);
    });
    // Wheels.
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
    var wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    g.userData.wheels = [];
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.38, p[1]);
      g.add(w);
      g.userData.wheels.push(w);
    });
    if (isPolice) {
      var bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.18, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x2244ff })
      );
      bar.position.set(0, 1.5, -0.2);
      g.add(bar);
      g.userData.lightBar = bar;
    }
    return g;
  }

  VC.createCar = function (scene, x, z, heading, color, isPolice) {
    var mesh = makeCarMesh(color === undefined ? CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0] : color, !!isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    return {
      mesh: mesh,
      pos: mesh.position,
      heading: heading,
      speed: 0,
      health: isPolice ? CFG.policeCarHealth : 100,
      isPolice: !!isPolice,
      targetSpeed: 0,
      steer: 0,
      dead: false,
    };
  };

  function hitsTower(city, x, z, margin) {
    for (var i = 0; i < city.colliders.length; i++) {
      var c = city.colliders[i];
      if (x > c.minX - margin && x < c.maxX + margin &&
          z > c.minZ - margin && z < c.maxZ + margin) return true;
    }
    return false;
  }

  // Simple arcade car step: accelerate, steer, and slide along towers
  // by moving one axis at a time (blocked axis stops, the other slides).
  VC.stepCar = function (car, dt, city, throttle, steerInput) {
    if (car.dead) return;
    var accel = throttle > 0 ? CFG.carAccel : throttle < 0 ? -CFG.carBrake : 0;
    car.speed += accel * dt;
    if (throttle === 0) car.speed *= Math.pow(0.4, dt); // rolling drag
    car.speed = Math.max(-10, Math.min(CFG.carTopSpeed, car.speed));
    if (Math.abs(car.speed) > 0.5) {
      car.heading += steerInput * CFG.carTurn * dt * (car.speed / CFG.carTopSpeed) * (car.speed >= 0 ? 1 : -1);
    }
    var stepX = -Math.sin(car.heading) * car.speed * dt;
    var stepZ = -Math.cos(car.heading) * car.speed * dt;
    if (!hitsTower(city, car.pos.x + stepX, car.pos.z, 1.4)) {
      car.pos.x += stepX;
    } else {
      car.speed *= 0.6; // scraped a tower: lose speed, keep sliding
    }
    if (!hitsTower(city, car.pos.x, car.pos.z + stepZ, 1.4)) {
      car.pos.z += stepZ;
    } else {
      car.speed *= 0.6;
    }
    var h = city.half;
    car.pos.x = Math.max(-h, Math.min(h, car.pos.x));
    car.pos.z = Math.max(-h, Math.min(h, car.pos.z));
    car.mesh.rotation.y = car.heading;
    var wheels = car.mesh.userData.wheels || [];
    for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += car.speed * dt * 2.5;
  };

  // Traffic: cars cruise the road grid, turning at intersections.
  VC.createTraffic = function (scene, city, count) {
    var cars = [];
    var half = city.half;
    function roadCoord() {
      // Snap to a road centre line.
      var k = (Math.random() * (CFG.blocks + 1)) | 0;
      return -half + k * CFG.pitch;
    }
    for (var i = 0; i < count; i++) {
      var horizontal = Math.random() < 0.5;
      var x = horizontal ? (Math.random() * 2 - 1) * half : roadCoord();
      var z = horizontal ? roadCoord() : (Math.random() * 2 - 1) * half;
      var heading = horizontal ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
      var car = VC.createCar(scene, x, z, heading);
      car.speed = 8 + Math.random() * 6;
      car.cruise = car.speed;
      cars.push(car);
    }
    // Parked cars near spawn: easy first steal, and the street looks lived-in.
    for (var p = 0; p < CFG.parkedCars.length; p++) {
      var spot = CFG.parkedCars[p];
      var parked = VC.createCar(scene, spot.x, spot.z, spot.heading);
      parked.speed = 0;
      parked.cruise = 0;
      cars.push(parked);
    }
    return {
      cars: cars,
      update: function (dt, playerPos) {
        for (var i = 0; i < cars.length; i++) {
          var car = cars[i];
          if (car.dead || car.playerDriven) continue; // never drive the player's car
          // Keep cruising; at an intersection sometimes turn (only while moving).
          var onRoadX = Math.abs(((car.pos.x + half) % CFG.pitch) - CFG.pitch / 2) < 6;
          var onRoadZ = Math.abs(((car.pos.z + half) % CFG.pitch) - CFG.pitch / 2) < 6;
          if (car.speed > 1 && onRoadX && onRoadZ && Math.random() < dt * 0.25) {
            car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
          }
          // Gentle avoidance of the player on foot.
          var dx = car.pos.x - playerPos.x, dz = car.pos.z - playerPos.z;
          var throttle = 0;
          if (dx * dx + dz * dz < 30 && Math.abs(car.speed) > 1) {
            throttle = -0.6; // brake for the player
          } else {
            // Proportional cruise control toward the car's own pace.
            throttle = Math.max(-0.5, Math.min(1, (car.cruise - car.speed) / 4));
          }
          VC.stepCar(car, dt, city, throttle, 0);
        }
      },
    };
  };

  // Police: spawn at the edge, chase the player, ram on foot or in a car.
  VC.createPolice = function (scene, city) {
    var units = [];
    return {
      units: units,
      spawn: function (playerPos) {
        if (units.length >= CFG.policeMax) return;
        var angle = Math.random() * Math.PI * 2;
        var x = playerPos.x + Math.cos(angle) * 55;
        var z = playerPos.z + Math.sin(angle) * 55;
        x = Math.max(-city.half, Math.min(city.half, x));
        z = Math.max(-city.half, Math.min(city.half, z));
        var car = VC.createCar(scene, x, z, 0, 0x111122, true);
        units.push(car);
      },
      update: function (dt, playerPos, onFoot, player) {
        for (var i = units.length - 1; i >= 0; i--) {
          var car = units[i];
          if (car.dead) {
            scene.remove(car.mesh);
            units.splice(i, 1);
            continue;
          }
          if (car.playerDriven) continue; // jacked by the player: not police any more
          // Steer toward the player.
          var dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
          var want = Math.atan2(-dx, -dz);
          var diff = want - car.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          var steer = Math.max(-1, Math.min(1, diff * 1.5));
          var dist = Math.hypot(dx, dz);
          var throttle = dist > 4 ? 1 : 0.3;
          VC.stepCar(car, dt, city, throttle, steer);
          // Ram damage when touching the player.
          if (dist < 2.6 && onFoot) {
            player.hurt(14 * dt);
            var push = 6 * dt;
            player.pos.x -= (dx / (dist || 1)) * push;
            player.pos.z -= (dz / (dist || 1)) * push;
          }
          // Light bar flashes.
          if (car.mesh.userData.lightBar) {
            car.mesh.userData.lightBar.material.color.setHex(
              (Math.floor(performance.now() / 300) % 2) ? 0xff2222 : 0x2244ff
            );
          }
        }
      },
      clear: function () {
        for (var i = 0; i < units.length; i++) scene.remove(units[i].mesh);
        units.length = 0;
      },
    };
  };
})();
