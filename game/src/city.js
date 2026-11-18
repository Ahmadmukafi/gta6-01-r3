// VERTEX CITY — the city itself. A procedural rain-soaked cyberpunk
// megacity: a 9x9 grid of towers that rise toward downtown, neon signs,
// skybridges between the tallest towers, an elevated monorail ring and
// permanent rain. Everything is generated from a seed, no assets.
(function () {
  var CFG = VC.CFG;

  // Small deterministic PRNG so the city is the same every run.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Window texture: dark facade with lit windows in cyan / magenta / amber.
  function windowTexture(rand) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#161624'; g.fillRect(0, 0, 64, 128);
    var palette = ['#37e6ff', '#ff3df0', '#ffc857', '#7dffce', '#c9f2ff'];
    for (var y = 6; y < 122; y += 10) {
      for (var x = 5; x < 58; x += 9) {
        if (rand() < 0.42) {
          g.fillStyle = palette[(rand() * palette.length) | 0];
          g.globalAlpha = 0.55 + rand() * 0.45;
          g.fillRect(x, y, 6, 7);
        }
      }
    }
    g.globalAlpha = 1;
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Neon sign texture: glowing text on a dark plate.
  function signTexture(text, color, sub) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = '#050208'; g.fillRect(0, 0, 256, 96);
    g.strokeStyle = color; g.lineWidth = 3;
    g.strokeRect(4, 4, 248, 88);
    g.font = 'bold 44px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, 128, sub ? 38 : 48);
    if (sub) {
      g.font = 'bold 20px monospace';
      g.fillText(sub, 128, 72);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Ground texture: wet asphalt with the road grid painted in.
  function groundTexture() {
    var size = 1024;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = '#101019'; g.fillRect(0, 0, size, size);
    // Subtle wet sheen blotches.
    for (var i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(60,70,110,' + (Math.random() * 0.08) + ')';
      g.fillRect(Math.random() * size, Math.random() * size, 3 + Math.random() * 22, 3 + Math.random() * 22);
    }
    var half = (CFG.blocks * CFG.pitch) / 2;
    var px = size / (CFG.blocks * CFG.pitch);
    // Roads: lighter strips along every grid line.
    g.fillStyle = '#232333';
    for (var k = 0; k <= CFG.blocks; k++) {
      var pos = (k * CFG.pitch - half) * px + size / 2;
      g.fillRect(0, pos - (CFG.roadWidth / 2) * px, size, CFG.roadWidth * px);
      g.fillRect(pos - (CFG.roadWidth / 2) * px, 0, CFG.roadWidth * px, size);
    }
    // Centre dashes.
    g.fillStyle = '#8a7b2e';
    for (var k2 = 0; k2 <= CFG.blocks; k2++) {
      var p2 = (k2 * CFG.pitch - half) * px + size / 2;
      for (var d = 0; d < size; d += 32) {
        g.fillRect(d, p2 - 1, 16, 2);
        g.fillRect(p2 - 1, d, 2, 16);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  var SIGNS = [
    ['VERTEX', '#37e6ff', 'CITY'],
    ['RAMEN', '#ff3df0', '24 HOUR'],
    ['NOVA', '#ffc857', 'HOTEL'],
    ['NEON', '#7dffce', 'BAR'],
    ['CYBER', '#ff5a5a', 'CLINIC'],
    ['SKYDECK', '#37e6ff', 'PARKING'],
    ['ORBIT', '#c9a0ff', 'CASINO'],
    ['VOLT', '#ffe14d', 'CHARGE'],
  ];

  VC.buildCity = function (scene) {
    var rand = mulberry32(1337);
    var colliders = [];   // {minX,maxX,minZ,maxZ,h} for foot/car collision
    var rooftops = [];    // {x,z,w,d,h} flat tops you can grapple onto
    var group = new THREE.Group();
    scene.add(group);

    var half = (CFG.blocks * CFG.pitch) / 2;

    // Ground: one plane exactly the city size, over a larger dark base
    // so the texture's road grid lines up with the towers.
    var base = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.9 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.15;
    group.add(base);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.blocks * CFG.pitch, CFG.blocks * CFG.pitch),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.35, metalness: 0.55, emissive: 0x141428, emissiveIntensity: 0.7 })
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    // Buildings: 1-2 towers per block, taller toward downtown.
    var winTexA = windowTexture(rand);
    var winTexB = windowTexture(rand);
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.9 });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.6, metalness: 0.4 });
    var tall = [];
    for (var bx = 0; bx < CFG.blocks; bx++) {
      for (var bz = 0; bz < CFG.blocks; bz++) {
        var cx = -half + bx * CFG.pitch + CFG.pitch / 2;
        var cz = -half + bz * CFG.pitch + CFG.pitch / 2;
        var distC = Math.max(Math.abs(cx), Math.abs(cz)) / half; // 0 centre, 1 edge
        var count = rand() < 0.45 ? 2 : 1;
        for (var n = 0; n < count; n++) {
          var w = 16 + rand() * 16;
          var d = 16 + rand() * 16;
          var h = CFG.minHeight + rand() * (CFG.maxHeight - CFG.minHeight) * (1 - distC * 0.55) + (1 - distC) * CFG.downtownBoost * 0.4;
          h = Math.round(h);
          var ox = count === 2 ? (n === 0 ? -9 : 9) : 0;
          var oz = count === 2 ? (n === 0 ? -9 : 9) : 0;
          var x = cx + ox, z = cz + oz;
          var mat = new THREE.MeshStandardMaterial({
            map: rand() < 0.5 ? winTexA : winTexB,
            emissive: 0xffffff, emissiveMap: rand() < 0.5 ? winTexA : winTexB,
            emissiveIntensity: 1.15, roughness: 0.7, metalness: 0.25,
          });
          var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(x, h / 2, z);
          group.add(mesh);
          // Roof cap + glowing rim.
          var cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
          cap.position.set(x, h + 0.4, z);
          group.add(cap);
          var rim = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.8, 0.35, d + 0.8),
            new THREE.MeshBasicMaterial({ color: rand() < 0.5 ? 0x37e6ff : 0xff3df0 })
          );
          rim.position.set(x, h + 0.9, z);
          group.add(rim);
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h });
          rooftops.push({ x: x, z: z, w: w, d: d, h: h });
          if (h > 55) tall.push({ x: x, z: z, w: w, d: d, h: h });
          // Neon sign on some towers, facing a random road.
          if (rand() < 0.4) {
            var s = SIGNS[(rand() * SIGNS.length) | 0];
            var sign = new THREE.Mesh(
              new THREE.PlaneGeometry(18, 6.75),
              new THREE.MeshBasicMaterial({ map: signTexture(s[0], s[1], s[2]), transparent: true })
            );
            var face = (rand() * 4) | 0;
            var sy = 8 + rand() * (h - 16);
            if (face === 0) { sign.position.set(x, sy, z + d / 2 + 0.3); }
            else if (face === 1) { sign.position.set(x, sy, z - d / 2 - 0.3); sign.rotation.y = Math.PI; }
            else if (face === 2) { sign.position.set(x + w / 2 + 0.3, sy, z); sign.rotation.y = Math.PI / 2; }
            else { sign.position.set(x - w / 2 - 0.3, sy, z); sign.rotation.y = -Math.PI / 2; }
            group.add(sign);
          }
        }
      }
    }

    // Skybridges between neighbouring tall towers.
    for (var i = 0; i < tall.length; i++) {
      for (var j = i + 1; j < tall.length; j++) {
        var a = tall[i], b = tall[j];
        var dx = b.x - a.x, dz = b.z - a.z;
        var dist = Math.hypot(dx, dz);
        if (dist > 40 && dist < 85 && Math.abs(a.h - b.h) < 25) {
          var y = Math.min(a.h, b.h) - 6 - rand() * 8;
          if (y < 20) continue;
          var bridge = new THREE.Mesh(
            new THREE.BoxGeometry(dist, 1.6, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x232c44, roughness: 0.5, metalness: 0.5, emissive: 0x0a2a33, emissiveIntensity: 0.6 })
          );
          bridge.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
          bridge.rotation.y = -Math.atan2(dz, dx);
          group.add(bridge);
        }
      }
    }

    // Elevated monorail ring around downtown + a moving train.
    var railY = 16;
    var railMat = new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.4, metalness: 0.7 });
    var ringR = half * 0.55;
    var rail = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.7, 8, 72), railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = railY;
    group.add(rail);
    var train = new THREE.Group();
    for (var car = 0; car < 3; car++) {
      var tc = new THREE.Mesh(
        new THREE.BoxGeometry(7, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x10131f, roughness: 0.3, metalness: 0.6, emissive: 0x37e6ff, emissiveIntensity: 0.35 })
      );
      tc.position.x = -car * 7.6;
      train.add(tc);
    }
    train.position.y = railY + 1.8;
    group.add(train);

    // Street lamps: emissive posts, no real lights (perf).
    var lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
    var lampMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    var bulbGeo = new THREE.SphereGeometry(0.35, 8, 8);
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (var lx = 0; lx <= CFG.blocks; lx++) {
      for (var lz = 0; lz <= CFG.blocks; lz++) {
        if ((lx + lz) % 2) continue;
        var px2 = -half + lx * CFG.pitch + CFG.roadWidth / 2 + 1;
        var pz2 = -half + lz * CFG.pitch + CFG.roadWidth / 2 + 1;
        var post = new THREE.Mesh(lampGeo, lampMat);
        post.position.set(px2, 3, pz2);
        group.add(post);
        var bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(px2, 6.1, pz2);
        group.add(bulb);
      }
    }

    // Rain: one Points cloud, recycled in update().
    var rainCount = CFG.rainDrops;
    var rainPos = new Float32Array(rainCount * 3);
    var rainVel = new Float32Array(rainCount);
    for (var r = 0; r < rainCount; r++) {
      rainPos[r * 3] = (rand() - 0.5) * (half * 2 + 60);
      rainPos[r * 3 + 1] = rand() * 90;
      rainPos[r * 3 + 2] = (rand() - 0.5) * (half * 2 + 60);
      rainVel[r] = 38 + rand() * 22;
    }
    var rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    var rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x9fd8ff, size: 0.35, transparent: true, opacity: 0.55, sizeAttenuation: true,
    }));
    scene.add(rain);

    // Lightning: a directional light that flashes on a timer.
    var bolt = new THREE.DirectionalLight(0xbfd8ff, 0);
    bolt.position.set(120, 200, -80);
    scene.add(bolt);
    var nextBolt = 6 + rand() * 9;
    var boltT = 0;

    var trainAngle = 0;
    return {
      colliders: colliders,
      rooftops: rooftops,
      half: half,
      update: function (dt, t, playerPos) {
        // Rain falls around the player.
        var pos = rainGeo.attributes.position.array;
        for (var i = 0; i < rainCount; i++) {
          pos[i * 3 + 1] -= rainVel[i] * dt;
          if (pos[i * 3 + 1] < 0) {
            pos[i * 3 + 1] = 80 + Math.random() * 10;
            pos[i * 3] = playerPos.x + (Math.random() - 0.5) * 160;
            pos[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 160;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
        // Monorail circles downtown; cars trail along the tangent.
        trainAngle += dt * 0.045;
        train.position.x = Math.cos(trainAngle) * ringR;
        train.position.z = Math.sin(trainAngle) * ringR;
        train.rotation.y = -trainAngle - Math.PI / 2;
        // Lightning.
        nextBolt -= dt;
        if (nextBolt <= 0) { boltT = 0.28; nextBolt = 7 + Math.random() * 11; }
        if (boltT > 0) {
          boltT -= dt;
          bolt.intensity = boltT > 0.14 ? 2.4 : 0.9;
        } else {
          bolt.intensity = 0;
        }
      },
    };
  };
})();
