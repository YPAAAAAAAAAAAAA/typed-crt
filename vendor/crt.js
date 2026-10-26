/* typed-crt — original pocket CRT typewriter.
   idea after @steve245270533 (steve245270533/typed-crt); clean-room implementation, no code copied. */
(function () {
  "use strict";

  var THEMES = [
    { name: "Moss", room: "#050806", spill: "rgba(96,210,120,0.18)", shellT: "#2a382c", shellB: "#121814", recess: "#070d09", glass: "#07140c", glassMid: "#12321c", ink: "#d4ffc0", hot: "#f6fff0", dim: "#8ed9a8", frA: "#f0ff9a", frB: "#62ffd0", led: "#8dff74" },
    { name: "Honey", room: "#100c08", spill: "rgba(255,170,70,0.18)", shellT: "#3a2c1c", shellB: "#1a120c", recess: "#140e08", glass: "#1a1008", glassMid: "#3a2410", ink: "#ffd07a", hot: "#fff6d8", dim: "#e0a24c", frA: "#ff8a4a", frB: "#ffe7a4", led: "#ffb44a" },
    { name: "Glacier", room: "#06090f", spill: "rgba(120,190,255,0.18)", shellT: "#1c2836", shellB: "#10161e", recess: "#0a1018", glass: "#07131c", glassMid: "#123044", ink: "#c4e8ff", hot: "#f4fbff", dim: "#86c0de", frA: "#d8f4ff", frB: "#7aa6ff", led: "#8fd4ff" },
    { name: "Petal", room: "#10080c", spill: "rgba(255,130,170,0.16)", shellT: "#3a2230", shellB: "#1a1016", recess: "#160910", glass: "#1a0c12", glassMid: "#3a1828", ink: "#ffc6d8", hot: "#fff2f6", dim: "#e090aa", frA: "#ffd0e4", frB: "#ff8ab0", led: "#ff9ec0" },
    { name: "Bone", room: "#0e0d0b", spill: "rgba(240,220,180,0.12)", shellT: "#343028", shellB: "#16140f", recess: "#14120e", glass: "#16130f", glassMid: "#2e291f", ink: "#f6e8c8", hot: "#fffaf0", dim: "#d4c4a4", frA: "#fff4d4", frB: "#e4c898", led: "#f0d8a8" },
    { name: "Voltage", room: "#07080a", spill: "rgba(200,255,70,0.16)", shellT: "#24301a", shellB: "#10140c", recess: "#0c1208", glass: "#0c1408", glassMid: "#1e3210", ink: "#e6ff6e", hot: "#f8ffd4", dim: "#c6e25a", frA: "#f4ffb0", frB: "#9dff9a", led: "#d8ff4a" }
  ];

  var GLOWS = [
    { name: "Soft", k: 0.45 },
    { name: "Warm", k: 0.95 },
    { name: "Hot", k: 1.45 }
  ];

  var CARDS = [
    { name: "Field", runs: [
      { k: "hot", t: "FIELD NOTE 07\n" },
      { k: "ink", t: "the tube remembers\nwhat the room forgot.\n" },
      { k: "dim", t: "hold still.\n" },
      { k: "ink", t: "phosphor catches up." }
    ]},
    { name: "Weather", runs: [
      { k: "hot", t: "GLASS WEATHER\n" },
      { k: "ink", t: "slow scanline rain.\na " },
      { k: "hot", t: "warm spot" },
      { k: "ink", t: "\nnear the cursor.\n" },
      { k: "dim", t: "no forecast.\njust glow." }
    ]},
    { name: "Night", runs: [
      { k: "hot", t: "NIGHT DESK\n" },
      { k: "ink", t: "channel open.\nyou are the\n" },
      { k: "hot", t: "only light" },
      { k: "ink", t: "\non this floor.\n" },
      { k: "dim", t: "type anyway." }
    ]},
    { name: "Postcard", runs: [
      { k: "hot", t: "POSTCARD\n" },
      { k: "ink", t: "wish you were\nphosphor.\n" },
      { k: "ink", t: "love, from the bezel,\n" },
      { k: "hot", t: "sixty hertz" },
      { k: "ink", t: ".\n" },
      { k: "dim", t: "unsigned." }
    ]}
  ];

  var cv = document.getElementById("glass");
  var knob = document.getElementById("knob");
  var tray = document.getElementById("tray");
  var ctx = cv.getContext("2d", { alpha: false });
  if (!ctx) return;

  var themeIx = 0;
  var glowIx = 1;
  var cardIx = 0;
  var flat = [];
  var lines = [];
  var placed = [];
  var caret = { x: 16, y: 16 };
  var shown = 0;
  var acc = 0;
  var fs = 18;
  var lh = 26;
  var cw = 12;
  var padX = 16;
  var cssW = 2;
  var cssH = 2;
  var dpr = 1;
  var shell = { x: 0, y: 0, w: 2, h: 2 };
  var glass = { x: 0, y: 0, w: 2, h: 2 };
  var shellR = 18;
  var glassR = 10;
  var glyphs = null;
  var gctx = null;
  var plate = null;
  var pctx = null;
  var noise = null;
  var npat = null;
  var actx = null;
  var down = null;
  var sent = false;
  var started = false;
  var lastT = 0;

  function theme() { return THEMES[themeIx]; }
  function glowK() { return GLOWS[glowIx].k; }

  function inkOf(k) {
    var th = theme();
    if (k === "hot") return th.hot;
    if (k === "dim") return th.dim;
    return th.ink;
  }

  function rr(c, x, y, w, h, r) {
    var rad = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  function track(c, text, x, y, gap) {
    var total = 0;
    var i;
    for (i = 0; i < text.length; i++) total += c.measureText(text[i]).width + gap;
    total -= gap;
    var cx = x - total * 0.5;
    for (i = 0; i < text.length; i++) {
      c.fillText(text[i], cx, y);
      cx += c.measureText(text[i]).width + gap;
    }
  }

  function makeNoise() {
    noise = document.createElement("canvas");
    noise.width = 96;
    noise.height = 96;
    var nctx = noise.getContext("2d");
    var img = nctx.createImageData(96, 96);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }

  function fitCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cssW = cv.clientWidth || 0;
    cssH = cv.clientHeight || 0;
    if (cssW < 8 || cssH < 8) return false;
    var bw = Math.max(2, Math.round(cssW * dpr));
    var bh = Math.max(2, Math.round(cssH * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    return true;
  }

  function placeShell() {
    var marginX = Math.max(10, cssW * 0.03);
    var marginTop = Math.max(10, cssH * 0.018);
    var foot = 56;
    var x = marginX;
    var y = marginTop;
    var w = Math.max(80, cssW - marginX * 2);
    var h = Math.max(120, cssH - marginTop - foot);
    shell = { x: x, y: y, w: w, h: h };
    var topBand = Math.max(16, Math.min(36, h * 0.048));
    var chin = h > 430 ? Math.max(48, Math.min(72, h * 0.09)) : Math.max(32, h * 0.08);
    var lip = Math.max(11, Math.min(18, w * 0.042));
    glass = {
      x: x + lip,
      y: y + topBand,
      w: Math.max(40, w - lip * 2),
      h: Math.max(48, h - topBand - chin)
    };
    shellR = Math.max(16, Math.min(30, w * 0.065));
    glassR = Math.max(8, shellR * 0.46);
    shell.topBand = topBand;
    shell.chin = chin;
    shell.lip = lip;
  }

  function flatten(card) {
    var out = [];
    for (var r = 0; r < card.runs.length; r++) {
      var run = card.runs[r];
      for (var i = 0; i < run.t.length; i++) out.push({ c: run.t[i], k: run.k });
    }
    return out;
  }

  function wrapChars(chars, maxW, adv) {
    var out = [];
    var cur = [];
    var width = 0;
    function pushLine() {
      out.push(cur);
      cur = [];
      width = 0;
    }
    var i = 0;
    while (i < chars.length) {
      var ch = chars[i];
      if (ch.c === "\n") {
        pushLine();
        i++;
        continue;
      }
      if (ch.c === " ") {
        if (!cur.length) { i++; continue; }
        if (width + adv > maxW) { pushLine(); i++; continue; }
        cur.push({ c: " ", k: ch.k, i: i });
        width += adv;
        i++;
        continue;
      }
      var word = [];
      var j = i;
      while (j < chars.length && chars[j].c !== " " && chars[j].c !== "\n") {
        word.push({ c: chars[j].c, k: chars[j].k, i: j });
        j++;
      }
      var ww = word.length * adv;
      if (cur.length && width + ww > maxW) pushLine();
      if (ww > maxW) {
        for (var a = 0; a < word.length; a++) {
          if (cur.length && width + adv > maxW) pushLine();
          cur.push(word[a]);
          width += adv;
        }
      } else {
        for (var b = 0; b < word.length; b++) {
          cur.push(word[b]);
          width += adv;
        }
      }
      i = j;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function intendedBreaks(chars) {
    var n = 1;
    for (var i = 0; i < chars.length; i++) if (chars[i].c === "\n") n++;
    if (chars.length && chars[chars.length - 1].c === "\n") n--;
    return n;
  }

  function primeCount() {
    var breaks = 0;
    var at = Math.min(flat.length, 18);
    for (var i = 0; i < flat.length; i++) {
      if (flat[i].c === "\n") {
        breaks++;
        if (breaks === 3) { at = i + 1; break; }
      }
    }
    var half = Math.floor(flat.length * 0.58);
    var n = Math.max(at, half);
    if (n >= flat.length) n = Math.max(1, flat.length - 10);
    return n;
  }

  function ensureBuffers() {
    var pw = Math.max(2, Math.round(glass.w * dpr));
    var ph = Math.max(2, Math.round(glass.h * dpr));
    if (glyphs && glyphs.width === pw && glyphs.height === ph) return;
    glyphs = document.createElement("canvas");
    glyphs.width = pw;
    glyphs.height = ph;
    gctx = glyphs.getContext("2d", { alpha: true });
    plate = document.createElement("canvas");
    plate.width = pw;
    plate.height = ph;
    pctx = plate.getContext("2d", { alpha: true });
  }

  function drawChar(g, ch, x, y) {
    var th = theme();
    g.globalAlpha = 0.5;
    g.fillStyle = th.frA;
    g.fillText(ch.c, x + 0.7, y);
    g.fillStyle = th.frB;
    g.fillText(ch.c, x - 0.7, y);
    g.globalAlpha = 1;
    g.fillStyle = inkOf(ch.k);
    g.fillText(ch.c, x, y);
  }

  function locateCaret() {
    for (var i = 0; i < placed.length; i++) {
      if (placed[i].i >= shown) return { x: placed[i].x, y: placed[i].y };
    }
    if (!placed.length) return { x: padX, y: Math.max(8, glass.h * 0.36) };
    var last = placed[placed.length - 1];
    return { x: last.x + cw, y: last.y };
  }

  function rebuildGlyphs() {
    ensureBuffers();
    var guard = 0;
    var room = Math.max(40, glass.w - Math.max(14, glass.w * 0.08) * 2);
    fs = Math.max(14, Math.min(22, room / 13.8));
    padX = Math.max(14, glass.w * 0.08);
    var want = intendedBreaks(flat);
    while (guard < 8) {
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.font = "600 " + fs + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      gctx.textBaseline = "top";
      cw = Math.max(6, gctx.measureText("M").width);
      var lead = glass.h > 560 ? 1.62 : 1.4;
      lh = Math.round(fs * lead);
      var maxW = Math.max(cw + 2, glass.w - padX * 2 - cw);
      lines = wrapChars(flat, maxW, cw);
      var fitsH = lines.length * lh <= glass.h - 16;
      var fitsW = lines.length <= want;
      if ((fitsH && fitsW) || fs <= 14) break;
      fs = Math.max(14, fs - 1);
      guard++;
    }
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.clearRect(0, 0, glass.w, glass.h);
    gctx.font = "600 " + fs + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    gctx.textBaseline = "top";
    var blockH = lines.length * lh;
    var y0 = Math.max(8, (glass.h - blockH) * 0.42);
    placed = [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var x = padX;
      var y = y0 + li * lh;
      for (var ci = 0; ci < line.length; ci++) {
        var ch = line[ci];
        if (ch.i < shown && ch.c !== " ") drawChar(gctx, ch, x, y);
        placed.push({ i: ch.i, c: ch.c, x: x, y: y, k: ch.k });
        x += cw;
      }
    }
    caret = locateCaret();
  }

  function composePlate(now) {
    if (!plate || !glyphs) return;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, plate.width, plate.height);
    var k = glowK();
    var spread = Math.max(1, 1.6 * dpr * k);
    pctx.globalCompositeOperation = "lighter";
    pctx.globalAlpha = 0.22 * k;
    pctx.drawImage(glyphs, -spread, 0);
    pctx.drawImage(glyphs, spread, 0);
    pctx.drawImage(glyphs, 0, -spread * 0.65);
    pctx.drawImage(glyphs, 0, spread * 0.65);
    pctx.globalAlpha = 0.1 * k;
    pctx.drawImage(glyphs, -spread * 2, -spread, plate.width + spread * 4, plate.height + spread * 2);
    pctx.globalCompositeOperation = "source-over";
    pctx.globalAlpha = 1;
    pctx.drawImage(glyphs, 0, 0);
    if (Math.sin(now * 0.009) > -0.25) {
      pctx.fillStyle = theme().ink;
      pctx.globalAlpha = 0.92;
      var x = caret.x * dpr;
      var y = caret.y * dpr + fs * dpr * 0.08;
      var w = Math.max(2, cw * dpr * 0.68);
      var h = fs * dpr * 0.76;
      pctx.fillRect(x, y, w, h);
      pctx.globalAlpha = 1;
    }
  }

  function screw(c, x, y) {
    c.beginPath();
    c.arc(x, y, 3.1, 0, Math.PI * 2);
    c.fillStyle = "rgba(0,0,0,0.38)";
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.28)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 2, y);
    c.lineTo(x + 2, y);
    c.stroke();
  }

  function paint(now) {
    var th = theme();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.room;
    ctx.fillRect(0, 0, cssW, cssH);
    var cx = shell.x + shell.w * 0.5;
    var cy = shell.y + shell.h * 0.42;
    var spill = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(shell.w, shell.h) * 0.62);
    spill.addColorStop(0, th.spill);
    spill.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spill;
    ctx.fillRect(0, 0, cssW, cssH);

    var ground = ctx.createRadialGradient(cx, shell.y + shell.h, 8, cx, shell.y + shell.h + 8, shell.w * 0.48);
    ground.addColorStop(0, "rgba(0,0,0,0.45)");
    ground.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ground;
    ctx.fillRect(shell.x, shell.y + shell.h - 10, shell.w, 36);

    var body = ctx.createLinearGradient(shell.x, shell.y, shell.x, shell.y + shell.h);
    body.addColorStop(0, th.shellT);
    body.addColorStop(0.55, th.shellT);
    body.addColorStop(1, th.shellB);
    rr(ctx, shell.x, shell.y, shell.w, shell.h, shellR);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    var inset = 12;
    screw(ctx, shell.x + inset, shell.y + inset);
    screw(ctx, shell.x + shell.w - inset, shell.y + inset);
    screw(ctx, shell.x + inset, shell.y + shell.h - inset);
    screw(ctx, shell.x + shell.w - inset, shell.y + shell.h - inset);

    ctx.fillStyle = "rgba(255,248,236,0.46)";
    ctx.font = "600 " + Math.max(10, Math.min(13, shell.topBand * 0.42)) + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    track(ctx, "TYPED CRT", shell.x + shell.w * 0.5, shell.y + shell.topBand * 0.48, 2.4);

    rr(ctx, glass.x - 5, glass.y - 5, glass.w + 10, glass.h + 10, glassR + 4);
    ctx.fillStyle = th.recess;
    ctx.fill();

    ctx.save();
    rr(ctx, glass.x, glass.y, glass.w, glass.h, glassR);
    ctx.clip();

    var pg = ctx.createRadialGradient(glass.x + glass.w * 0.5, glass.y + glass.h * 0.42, glass.w * 0.08, glass.x + glass.w * 0.5, glass.y + glass.h * 0.5, Math.max(glass.w, glass.h) * 0.72);
    pg.addColorStop(0, th.glassMid);
    pg.addColorStop(1, th.glass);
    ctx.fillStyle = pg;
    ctx.fillRect(glass.x, glass.y, glass.w, glass.h);

    composePlate(now);
    if (plate) {
      var flick = 0.94 + 0.06 * Math.sin(now * 0.02);
      var jx = Math.sin(now * 0.013) * 0.4;
      var jy = Math.sin(now * 0.0041) * 0.3;
      var strips = 18;
      var bow = glass.w * 0.03;
      ctx.save();
      ctx.globalAlpha = flick;
      for (var s = 0; s < strips; s++) {
        var t0 = s / strips;
        var t1 = (s + 1) / strips;
        var tm = (t0 + t1) * 0.5;
        var bend = Math.sin(tm * Math.PI);
        var insetX = (1 - bend) * bow;
        var sy = Math.round(t0 * plate.height);
        var sy2 = Math.round(t1 * plate.height);
        var sh = Math.max(1, sy2 - sy);
        ctx.drawImage(
          plate,
          0, sy, plate.width, sh,
          glass.x + insetX + jx,
          glass.y + jy + t0 * glass.h,
          glass.w - insetX * 2,
          (t1 - t0) * glass.h
        );
      }
      ctx.restore();
    }

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    var step = 3;
    for (var yy = glass.y + 1; yy < glass.y + glass.h; yy += step) ctx.fillRect(glass.x, yy, glass.w, 1);

    var span = glass.h + 48;
    var sweepY = glass.y - 24 + ((now * 0.042) % span);
    var sg = ctx.createLinearGradient(0, sweepY, 0, sweepY + 26);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(255,255,255,0.075)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(glass.x, sweepY, glass.w, 26);

    if (noise) {
      if (!npat) npat = ctx.createPattern(noise, "repeat");
      if (npat) {
        ctx.save();
        ctx.globalAlpha = 0.055;
        var nx = (now * 0.03) % 96;
        var ny = (now * 0.017) % 96;
        ctx.translate(nx, ny);
        ctx.fillStyle = npat;
        ctx.fillRect(glass.x - nx - 8, glass.y - ny - 8, glass.w + 24, glass.h + 24);
        ctx.restore();
      }
    }

    var vg = ctx.createRadialGradient(glass.x + glass.w * 0.5, glass.y + glass.h * 0.46, glass.w * 0.18, glass.x + glass.w * 0.5, glass.y + glass.h * 0.5, Math.max(glass.w, glass.h) * 0.68);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.72, "rgba(0,0,0,0.05)");
    vg.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = vg;
    ctx.fillRect(glass.x, glass.y, glass.w, glass.h);

    var shade = ctx.createLinearGradient(0, glass.y, 0, glass.y + glass.h * 0.2);
    shade.addColorStop(0, "rgba(0,0,0,0.28)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(glass.x, glass.y, glass.w, glass.h * 0.2);

    ctx.save();
    ctx.translate(glass.x + glass.w * 0.48, glass.y + glass.h * 0.1);
    ctx.rotate(-0.18);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.beginPath();
    ctx.ellipse(0, 0, glass.w * 0.34, Math.max(3, glass.h * 0.012), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    rr(ctx, glass.x, glass.y, glass.w, glass.h, glassR);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    var chinTop = glass.y + glass.h;
    var chinBot = shell.y + shell.h - 8;
    var mid = (chinTop + chinBot) * 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(glass.x, chinTop + 6);
    ctx.lineTo(glass.x + glass.w, chinTop + 6);
    ctx.stroke();

    var slots = 5;
    var slotW = Math.min(86, shell.w * 0.24);
    var slotX = shell.x + shell.lip + 2;
    var slotGap = 7;
    var slotSpan = slots * slotGap;
    for (var si = 0; si < slots; si++) {
      var sy = mid - slotSpan * 0.5 + si * slotGap;
      rr(ctx, slotX, sy, slotW, 3.2, 1.4);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(slotX + 1, sy + 2.2, slotW - 2, 0.8);
    }

    var lx = shell.x + shell.w - shell.lip - 16;
    var pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.004));
    var lg = ctx.createRadialGradient(lx, mid, 0, lx, mid, 12);
    lg.addColorStop(0, th.led);
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.8 * pulse;
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, mid, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = th.led;
    ctx.beginPath();
    ctx.arc(lx, mid, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function poke() {
    if (sent) return;
    if (window.__gbSandbox && window.__gbSandbox.ready) {
      sent = true;
      window.__gbSandbox.ready();
    }
  }

  function step(dt) {
    if (shown >= flat.length) return;
    acc += dt;
    var changed = false;
    var guard = 0;
    while (acc > 0 && shown < flat.length && guard < 6) {
      var ch = flat[shown];
      var cost = 34;
      if (ch.c === "\n") cost = 150;
      else if (ch.c === "." || ch.c === ",") cost = 100;
      else if (ch.c === " ") cost = 22;
      if (acc < cost) break;
      acc -= cost;
      shown++;
      changed = true;
      guard++;
      if (actx && ch.c !== "\n" && ch.c !== " ") blip(150 + (ch.c.charCodeAt(0) % 42) * 7);
    }
    if (changed) rebuildGlyphs();
  }

  function frame(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(48, t - lastT);
    lastT = t;
    step(dt);
    paint(t);
    if (!sent) poke();
    requestAnimationFrame(frame);
  }

  function blip(freq) {
    if (!actx) return;
    var t0 = actx.currentTime;
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.018, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + 0.05);
  }

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!actx) actx = new AC();
      if (actx.state === "suspended") actx.resume();
    } catch (err) {
      actx = null;
    }
  }

  function markTray() {
    var dots = document.querySelectorAll("#swatches .dot");
    var i;
    for (i = 0; i < dots.length; i++) dots[i].className = "dot" + (i === themeIx ? " on" : "");
    var gl = document.querySelectorAll("#glows button");
    for (i = 0; i < gl.length; i++) gl[i].className = i === glowIx ? "on" : "";
    var cd = document.querySelectorAll("#cards button");
    for (i = 0; i < cd.length; i++) cd[i].className = i === cardIx ? "on" : "";
    document.body.style.background = theme().room;
  }

  function loadCard(ix, mode) {
    cardIx = (ix + CARDS.length) % CARDS.length;
    flat = flatten(CARDS[cardIx]);
    shown = mode === "replay" ? 0 : primeCount();
    acc = 0;
    rebuildGlyphs();
    markTray();
  }

  function eat(el) {
    var evs = ["pointerdown", "pointerup", "pointermove", "touchstart", "touchend", "touchmove", "mousedown", "mouseup", "click", "wheel"];
    for (var i = 0; i < evs.length; i++) {
      el.addEventListener(evs[i], function (e) { e.stopPropagation(); }, { passive: false });
    }
  }

  function buildTray() {
    var sw = document.getElementById("swatches");
    var gl = document.getElementById("glows");
    var cd = document.getElementById("cards");
    var i;
    for (i = 0; i < THEMES.length; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dot";
      b.style.background = THEMES[i].ink;
      b.setAttribute("aria-label", THEMES[i].name);
      b.setAttribute("data-i", String(i));
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        themeIx = Number(e.currentTarget.getAttribute("data-i"));
        markTray();
        rebuildGlyphs();
      });
      sw.appendChild(b);
    }
    for (i = 0; i < GLOWS.length; i++) {
      var g = document.createElement("button");
      g.type = "button";
      g.textContent = GLOWS[i].name;
      g.setAttribute("data-i", String(i));
      g.addEventListener("click", function (e) {
        e.stopPropagation();
        glowIx = Number(e.currentTarget.getAttribute("data-i"));
        markTray();
      });
      gl.appendChild(g);
    }
    for (i = 0; i < CARDS.length; i++) {
      var c = document.createElement("button");
      c.type = "button";
      c.textContent = CARDS[i].name;
      c.setAttribute("data-i", String(i));
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        var n = Number(e.currentTarget.getAttribute("data-i"));
        if (n === cardIx) loadCard(n, "replay");
        else loadCard(n, "prime");
      });
      cd.appendChild(c);
    }
    markTray();
  }

  function bindPointers() {
    eat(knob);
    eat(tray);
    knob.addEventListener("click", function (e) {
      e.stopPropagation();
      unlock();
      var open = tray.hasAttribute("hidden");
      if (open) tray.removeAttribute("hidden");
      else tray.setAttribute("hidden", "");
      knob.setAttribute("aria-expanded", open ? "true" : "false");
    });
    cv.addEventListener("pointerdown", function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      unlock();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    }, { passive: false });
    function endPtr(e) {
      if (!down || e.pointerId !== down.id) return;
      var dx = e.clientX - down.x;
      var dy = e.clientY - down.y;
      var dt = performance.now() - down.t;
      down = null;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16 && dt < 480) loadCard(cardIx, "replay");
      else if (dx <= -42 && Math.abs(dx) > Math.abs(dy)) loadCard(cardIx + 1, "prime");
      else if (dx >= 42 && Math.abs(dx) > Math.abs(dy)) loadCard(cardIx - 1, "prime");
    }
    cv.addEventListener("pointerup", endPtr);
    cv.addEventListener("pointercancel", function (e) {
      if (down && e.pointerId === down.id) down = null;
    });
  }

  function onResize() {
    if (!fitCanvas()) return;
    placeShell();
    rebuildGlyphs();
  }

  function boot() {
    if (!fitCanvas()) {
      requestAnimationFrame(boot);
      return;
    }
    placeShell();
    if (!started) {
      started = true;
      makeNoise();
      buildTray();
      bindPointers();
      addEventListener("resize", onResize);
      loadCard(0, "prime");
    }
    paint(performance.now() || 0);
    poke();
    requestAnimationFrame(frame);
  }

  boot();
})();
