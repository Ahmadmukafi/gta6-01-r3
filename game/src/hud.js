// VERTEX CITY — HUD and minimap. Health, cash, HEAT stars, mission
// objective, speed, crosshair, damage flash, and a live 2D minimap that
// draws roads, the player, police, traffic and the mission beacon.
(function () {
  VC.createHUD = function (city) {
    var el = function (id) { return document.getElementById(id); };
    var map = el('minimap');
    var mctx = map.getContext('2d');
    var half = city.half;

    function drawMinimap(playerPos, heading, police, traffic, beaconPos) {
      var W = map.width, H = map.height;
      var scale = W / (half * 2 + 40);
      function toX(x) { return W / 2 + x * scale; }
      function toY(z) { return H / 2 + z * scale; }
      mctx.fillStyle = 'rgba(5,8,18,0.92)';
      mctx.fillRect(0, 0, W, H);
      // Roads.
      mctx.strokeStyle = '#2a3350';
      mctx.lineWidth = 5;
      for (var k = 0; k <= VC.CFG.blocks; k++) {
        var p = toX(-half + k * VC.CFG.pitch);
        mctx.beginPath(); mctx.moveTo(p, 0); mctx.lineTo(p, H); mctx.stroke();
        var q = toY(-half + k * VC.CFG.pitch);
        mctx.beginPath(); mctx.moveTo(0, q); mctx.lineTo(W, q); mctx.stroke();
      }
      // Buildings as blocks.
      mctx.fillStyle = '#1b2340';
      for (var i = 0; i < city.colliders.length; i++) {
        var c = city.colliders[i];
        mctx.fillRect(toX(c.minX), toY(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
      }
      // Mission beacon.
      if (beaconPos) {
        mctx.fillStyle = '#ffc857';
        mctx.beginPath();
        mctx.arc(toX(beaconPos.x), toY(beaconPos.z), 6, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#ffc857';
        mctx.beginPath();
        mctx.arc(toX(beaconPos.x), toY(beaconPos.z), 10 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2);
        mctx.stroke();
      }
      // Traffic.
      mctx.fillStyle = '#8fa3c8';
      for (var t = 0; t < traffic.length; t++) {
        mctx.fillRect(toX(traffic[t].pos.x) - 1.5, toY(traffic[t].pos.z) - 1.5, 3, 3);
      }
      // Police.
      mctx.fillStyle = '#ff3344';
      for (var u = 0; u < police.length; u++) {
        mctx.beginPath();
        mctx.arc(toX(police[u].pos.x), toY(police[u].pos.z), 4, 0, Math.PI * 2);
        mctx.fill();
      }
      // Player arrow.
      var px = toX(playerPos.x), py = toY(playerPos.z);
      mctx.save();
      mctx.translate(px, py);
      mctx.rotate(-heading + Math.PI);
      mctx.fillStyle = '#37e6ff';
      mctx.beginPath();
      mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
      mctx.fill();
      mctx.restore();
      // North tick.
      mctx.fillStyle = '#6d7fa8';
      mctx.font = 'bold 11px monospace';
      mctx.fillText('N', 6, 13);
    }

    return {
      setHealth: function (hp) {
        el('hp-fill').style.width = Math.max(0, hp) + '%';
        el('hp-num').textContent = Math.ceil(Math.max(0, hp));
      },
      setCash: function (cash) {
        el('cash').textContent = '$' + Math.floor(cash).toLocaleString('en-US');
      },
      setHeat: function (stars) {
        var s = '';
        for (var i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
        el('heat').textContent = s;
        el('heat').style.color = stars >= 4 ? '#ff3344' : stars >= 2 ? '#ffc857' : '#37e6ff';
      },
      setObjective: function (text) {
        el('objective').textContent = text;
      },
      setMissionTitle: function (text) {
        el('mission-title').textContent = text;
      },
      setMissionCount: function (text) {
        el('mission-count').textContent = text;
      },
      setSpeed: function (kph, inCar) {
        el('speed').style.display = inCar ? 'block' : 'none';
        el('speed-num').textContent = Math.round(Math.abs(kph) * 3.6);
      },
      setTimer: function (seconds) {
        var t = el('timer');
        if (seconds > 0) {
          t.style.display = 'block';
          t.textContent = '⏱ ' + Math.ceil(seconds) + 's';
          t.style.color = seconds < 15 ? '#ff3344' : '#ffc857';
        } else {
          t.style.display = 'none';
        }
      },
      setCrosshair: function (show) {
        el('crosshair').style.display = show ? 'block' : 'none';
      },
      damageFlash: function () {
        var d = el('damage');
        d.style.opacity = '0.55';
        setTimeout(function () { d.style.opacity = '0'; }, 120);
      },
      toast: function (text, ms) {
        var t = el('toast');
        t.textContent = text;
        t.style.opacity = '1';
        clearTimeout(t._timer);
        t._timer = setTimeout(function () { t.style.opacity = '0'; }, ms || 2600);
      },
      drawMinimap: drawMinimap,
    };
  };
})();
