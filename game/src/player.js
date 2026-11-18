// VERTEX CITY — the player on foot. Third-person orbit camera, WASD
// movement, sprint, jump, shooting, and the signature SKYHOOK grapple:
// aim at a rooftop and zip up to it, then run the skyline.
(function () {
  var CFG = VC.CFG;

  VC.createPlayer = function (scene, city, startPos) {
    // Body: hooded courier in a cyan jacket, built from boxes.
    var body = new THREE.Group();
    var jacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.75, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x14b8d4, roughness: 0.6, emissive: 0x0a5568, emissiveIntensity: 0.7 })
    );
    jacket.position.y = 1.05;
    body.add(jacket);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 })
    );
    head.position.y = 1.62;
    body.add(head);
    var hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.6 })
    );
    hood.position.y = 1.86;
    body.add(hood);
    var legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.8 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), legMat);
    legL.position.set(-0.16, 0.35, 0);
    var legR = legL.clone();
    legR.position.x = 0.16;
    body.add(legL); body.add(legR);
    var gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 })
    );
    gun.position.set(0.32, 1.15, 0.25);
    body.add(gun);
    body.position.copy(startPos);
    scene.add(body);

    // Grapple line (hidden until fired).
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    var line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x37e6ff }));
    line.visible = false;
    scene.add(line);

    var state = {
      group: body,
      pos: startPos.clone(),
      vel: new THREE.Vector3(),
      yaw: Math.PI,
      pitch: -0.25,
      camDist: CFG.camDist,
      onGround: true,
      groundY: 0,
      health: CFG.playerHealth,
      cash: CFG.startCash,
      grappling: false,
      grappleTarget: new THREE.Vector3(),
      grappleCooldown: 0,
      walkPhase: 0,
      armed: true,
      dead: false,
    };

    // Push the player out of any tower whose roof is above their feet.
    // Standing on a roof (feet at or above its height) never collides.
    function collideXZ(p, radius) {
      for (var i = 0; i < city.colliders.length; i++) {
        var c = city.colliders[i];
        if (p.y >= c.h - 0.4) continue;
        var nx = Math.max(c.minX, Math.min(p.x, c.maxX));
        var nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        var dx = p.x - nx, dz = p.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            var d = Math.sqrt(d2);
            p.x = nx + (dx / d) * radius;
            p.z = nz + (dz / d) * radius;
          } else {
            p.x = c.maxX + radius;
          }
        }
      }
      var h = city.half;
      p.x = Math.max(-h, Math.min(h, p.x));
      p.z = Math.max(-h, Math.min(h, p.z));
    }

    function groundHeightAt(x, z) {
      var g = 0;
      for (var i = 0; i < city.colliders.length; i++) {
        var c = city.colliders[i];
        if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
          if (c.h > g) g = c.h;
        }
      }
      return g;
    }

    state.findGrappleTarget = function () {
      // Nearest rooftop within range, above the player, roughly ahead.
      var best = null, bestD = CFG.grappleRange;
      var fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
      for (var i = 0; i < city.rooftops.length; i++) {
        var r = city.rooftops[i];
        var dx = r.x - state.pos.x, dz = r.z - state.pos.z;
        var d = Math.hypot(dx, dz);
        if (d > bestD || r.h < state.pos.y + 4) continue;
        var dot = (dx * fx + dz * fz) / (d || 1);
        if (dot < -0.2) continue; // must be roughly in front
        best = r; bestD = d;
      }
      if (!best) return null;
      return new THREE.Vector3(best.x, best.h + 0.1, best.z);
    };

    state.fireGrapple = function () {
      if (state.grappleCooldown > 0 || state.grappling) return false;
      var t = state.findGrappleTarget();
      if (!t) return false;
      state.grappling = true;
      state.grappleTarget.copy(t);
      state.grappleCooldown = CFG.grappleCooldown;
      line.visible = true;
      return true;
    };

    state.update = function (dt, input) {
      if (state.dead) return;
      state.grappleCooldown = Math.max(0, state.grappleCooldown - dt);

      if (state.grappling) {
        var to = new THREE.Vector3().subVectors(state.grappleTarget, state.pos);
        var dist = to.length();
        if (dist < 1.2) {
          state.grappling = false;
          line.visible = false;
          state.vel.set(0, 0, 0);
        } else {
          to.normalize();
          state.pos.addScaledVector(to, CFG.grappleSpeed * dt);
          state.vel.set(0, 0, 0);
        }
        var lp = lineGeo.attributes.position.array;
        lp[0] = state.pos.x; lp[1] = state.pos.y + 1.2; lp[2] = state.pos.z;
        lp[3] = state.grappleTarget.x; lp[4] = state.grappleTarget.y; lp[5] = state.grappleTarget.z;
        lineGeo.attributes.position.needsUpdate = true;
        collideXZ(state.pos, CFG.playerRadius);
        body.position.copy(state.pos);
        return;
      }

      // Camera-relative movement.
      var sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
      var speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
      var f = (input.keys['KeyW'] ? 1 : 0) - (input.keys['KeyS'] ? 1 : 0);
      var r = (input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0);
      var fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
      var rx = -fz, rz = fx;
      var mx = fx * f + rx * r, mz = fz * f + rz * r;
      var ml = Math.hypot(mx, mz);
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        state.pos.x += mx * speed * dt;
        state.pos.z += mz * speed * dt;
        state.walkPhase += dt * speed * 1.6;
        body.rotation.y = Math.atan2(mx, mz);
        // Walk cycle: legs swing.
        legL.rotation.x = Math.sin(state.walkPhase) * 0.7;
        legR.rotation.x = -Math.sin(state.walkPhase) * 0.7;
      } else {
        legL.rotation.x *= 0.8;
        legR.rotation.x *= 0.8;
      }

      // Gravity + jump, with rooftop landings.
      state.vel.y -= CFG.gravity * dt;
      if (input.jumpPressed && state.onGround) {
        state.vel.y = CFG.jumpSpeed;
        state.onGround = false;
        input.jumpPressed = false;
      }
      state.pos.y += state.vel.y * dt;
      var gy = groundHeightAt(state.pos.x, state.pos.z);
      if (state.pos.y <= gy) {
        state.pos.y = gy;
        state.vel.y = 0;
        state.onGround = true;
      } else if (state.pos.y > gy + 0.05) {
        state.onGround = false;
      }
      state.groundY = gy;

      collideXZ(state.pos, CFG.playerRadius);
      body.position.copy(state.pos);
    };

    state.cameraUpdate = function (camera) {
      // Orbit behind the player: yaw sets the side, pitch the height.
      // The camera walks out from the player and stops before entering
      // a tower, so it never clips inside a facade.
      var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      var dirX = Math.sin(state.yaw) * cp;
      var dirZ = Math.cos(state.yaw) * cp;
      var dirY = -sp;
      var eye = new THREE.Vector3(state.pos.x, state.pos.y + 1.6, state.pos.z);
      function blockedAt(d) {
        var x = eye.x + dirX * d, y = eye.y + dirY * d, z = eye.z + dirZ * d;
        for (var i = 0; i < city.colliders.length; i++) {
          var c = city.colliders[i];
          if (y < c.h && x > c.minX - 0.5 && x < c.maxX + 0.5 &&
              z > c.minZ - 0.5 && z < c.maxZ + 0.5) return true;
        }
        return false;
      }
      var best = state.camDist;
      if (blockedAt(best)) {
        var lo = 1.2, hi = best;
        for (var it = 0; it < 8; it++) {
          var mid = (lo + hi) / 2;
          if (blockedAt(mid)) hi = mid; else lo = mid;
        }
        best = Math.max(1.2, lo - 0.3);
      }
      camera.position.set(
        eye.x + dirX * best,
        Math.max(eye.y + dirY * best, state.pos.y + 1.0),
        eye.z + dirZ * best
      );
      camera.lookAt(state.pos.x, state.pos.y + 1.6, state.pos.z);
    };

    state.hurt = function (amount) {
      if (state.dead) return;
      state.health -= amount;
      if (state.health <= 0) {
        state.health = 0;
        state.dead = true;
      }
    };

    state.reset = function (pos) {
      state.pos.copy(pos);
      state.vel.set(0, 0, 0);
      state.health = CFG.playerHealth;
      state.dead = false;
      state.grappling = false;
      line.visible = false;
      body.position.copy(pos);
    };

    return state;
  };
})();
