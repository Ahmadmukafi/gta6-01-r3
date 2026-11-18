// VERTEX CITY — pedestrians. Neon-dressed citizens stroll the sidewalks,
// scatter when a car barrels at them or a shot rings out, and occasionally
// cross the street on the zebra lines.
(function () {
  var CFG = VC.CFG;

  var COATS = [0xff3df0, 0x37e6ff, 0xffc857, 0x7dffce, 0xff8a5c, 0xc9a0ff, 0xdddddd];

  function makePedMesh(color) {
    var g = new THREE.Group();
    var coat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.32),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })
    );
    coat.position.y = 0.95;
    g.add(coat);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.7 })
    );
    head.position.y = 1.48;
    g.add(head);
    var legMat = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.85 });
    var l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), legMat);
    l1.position.set(-0.13, 0.3, 0);
    var l2 = l1.clone();
    l2.position.x = 0.13;
    g.add(l1); g.add(l2);
    g.userData.legs = [l1, l2];
    return g;
  }

  VC.createPeds = function (scene, city, count) {
    var peds = [];
    var half = city.half;
    for (var i = 0; i < count; i++) {
      var mesh = makePedMesh(COATS[(Math.random() * COATS.length) | 0]);
      var x = (Math.random() * 2 - 1) * half;
      var z = (Math.random() * 2 - 1) * half;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      peds.push({
        mesh: mesh,
        pos: mesh.position,
        heading: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 1.4,
        phase: Math.random() * 6,
        panic: 0,
        dead: false,
      });
    }
    return {
      list: peds,
      update: function (dt, playerPos, playerSpeed, shooting, trafficCars) {
        for (var i = 0; i < peds.length; i++) {
          var p = peds[i];
          if (p.dead) continue;
          // Panic: flee from a fast car or gunfire nearby.
          var dx = p.pos.x - playerPos.x, dz = p.pos.z - playerPos.z;
          var d2 = dx * dx + dz * dz;
          if ((playerSpeed > 12 && d2 < 120) || (shooting && d2 < 900)) p.panic = 2.5;
          // A speeding traffic car bearing down also scatters the crowd.
          if (trafficCars) {
            for (var tc = 0; tc < trafficCars.length; tc++) {
              var c = trafficCars[tc];
              if (c.dead || Math.abs(c.speed) < 10) continue;
              var cdx = p.pos.x - c.pos.x, cdz = p.pos.z - c.pos.z;
              if (cdx * cdx + cdz * cdz < 64) {
                p.panic = 2.5;
                dx = cdx; dz = cdz;
                break;
              }
            }
          }
          var speed = p.speed;
          if (p.panic > 0) {
            p.panic -= dt;
            speed = 5.5;
            p.heading = Math.atan2(-dx, -dz);
          } else if (Math.random() < dt * 0.08) {
            // Wander: pick a new heading, prefer staying on sidewalks.
            p.heading += (Math.random() - 0.5) * 2.2;
          }
          p.pos.x += -Math.sin(p.heading) * speed * dt;
          p.pos.z += -Math.cos(p.heading) * speed * dt;
          // Keep inside the city and out of towers.
          if (Math.abs(p.pos.x) > half - 2 || Math.abs(p.pos.z) > half - 2) {
            p.heading += Math.PI;
          }
          for (var c = 0; c < city.colliders.length; c++) {
            var col = city.colliders[c];
            if (p.pos.x > col.minX && p.pos.x < col.maxX && p.pos.z > col.minZ && p.pos.z < col.maxZ) {
              p.pos.x -= -Math.sin(p.heading) * speed * dt * 2;
              p.pos.z -= -Math.cos(p.heading) * speed * dt * 2;
              p.heading += Math.PI / 2;
            }
          }
          p.phase += dt * speed * 3;
          p.mesh.rotation.y = p.heading;
          var legs = p.mesh.userData.legs;
          legs[0].rotation.x = Math.sin(p.phase) * 0.6;
          legs[1].rotation.x = -Math.sin(p.phase) * 0.6;
        }
      },
    };
  };
})();
