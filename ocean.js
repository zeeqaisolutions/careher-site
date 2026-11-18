// Night ocean, the same shader as the Care4Her app. Decorative only.
(() => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return; // the CSS gradient on the canvas stays as the fallback
  const VERTEX = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
  const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform float t;

const float PI = 3.14159265;
const float G = 9.81;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

// Ocean height: directional swells obeying deep-water dispersion (w = sqrt(g k)),
// with crests sharpened and phases perturbed by noise so the sea never repeats.
float sea(vec2 p, int octaves) {
  float h = 0.0;
  float k = 0.18;       // wavenumber, rad/m
  float a = 0.55;       // amplitude, m
  float ang = 0.35;
  float warp = fbm(p * 0.045 + t * 0.02) * 6.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    vec2 dir = vec2(cos(ang), sin(ang));
    float w = sqrt(G * k);
    float ph = dot(dir, p) * k - w * t + warp * (0.6 + 0.15 * float(i));
    float s = 0.5 + 0.5 * sin(ph);
    h += a * (pow(s, 2.2) * 2.0 - 0.75);   // sharp crests, broad troughs
    k *= 1.75;
    a *= 0.48;
    ang += 2.1;
  }
  return h;
}

vec3 moonDir = normalize(vec3(0.11, 0.24, 1.0));

vec3 skyColor(vec3 rd, bool withStars) {
  float y = max(rd.y, 0.0);
  vec3 zenith = vec3(0.008, 0.013, 0.040);
  vec3 horizon = vec3(0.055, 0.075, 0.165);
  vec3 c = mix(horizon, zenith, pow(y, 0.45));

  float m = max(dot(rd, moonDir), 0.0);
  c += vec3(0.30, 0.36, 0.60) * pow(m, 220.0) * 0.6;   // inner halo
  c += vec3(0.18, 0.22, 0.42) * pow(m, 8.0) * 0.18;    // wide glow
  // Moon disc with limb darkening and faint maria.
  float disc = smoothstep(0.99987, 0.99991, m);
  if (disc > 0.0) {
    vec3 side = normalize(cross(moonDir, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, moonDir);
    vec2 mp = vec2(dot(rd, side), dot(rd, up)) * 75.0;
    float maria = fbm(mp * 2.2 + 4.0);
    float limb = sqrt(clamp(1.0 - dot(mp, mp), 0.0, 1.0));
    c = mix(c, vec3(0.92, 0.91, 0.86) * (0.72 + 0.28 * limb) * (0.82 + 0.18 * maria), disc);
  }

  if (withStars && rd.y > 0.0) {
    vec2 sp = rd.xz / (rd.y + 0.25);
    // Milky Way: a faint tilted band of dust.
    vec3 bandN = normalize(vec3(0.55, 0.35, -0.75));
    float band = exp(-pow(dot(rd, bandN) / 0.22, 2.0));
    c += vec3(0.07, 0.08, 0.13) * band * (0.35 + 0.9 * fbm(sp * 3.5)) * smoothstep(0.02, 0.3, rd.y);
    // Two star layers: sparse bright ones and a fine dust of dim ones.
    for (int l = 0; l < 2; l++) {
      float scale = l == 0 ? 26.0 : 70.0;
      vec2 q = sp * scale;
      vec2 cell = floor(q);
      float r = hash(cell + float(l) * 31.0);
      float thresh = l == 0 ? 0.88 : 0.72 + 0.22 * (1.0 - band);
      if (r > thresh) {
        vec2 o = vec2(hash(cell + 3.7), hash(cell + 9.1)) - 0.5;
        float d = length(fract(q) - 0.5 - o * 0.7);
        float size = l == 0 ? 0.055 : 0.04;
        float tw = 0.6 + 0.4 * sin(t * (1.5 + r * 4.0) + r * 60.0);
        tw *= mix(0.55, 1.0, smoothstep(0.0, 0.35, rd.y)); // more scintillation low in the sky
        vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.88, 0.72), hash(cell + 5.5));
        float bright = l == 0 ? 1.6 : 0.55;
        c += tint * smoothstep(size, 0.0, d) * tw * bright * (r - thresh) / (1.0 - thresh);
      }
    }
  }
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  // On the water: a slow swell lifts and tilts the view.
  float bob = sin(t * 0.55) * 0.06 + sin(t * 0.31 + 1.0) * 0.04;
  vec3 ro = vec3(0.0, 2.4 + bob, t * 0.6);
  vec3 rd = normalize(vec3(uv.x + sin(t * 0.23) * 0.01, uv.y - 0.02 + bob * 0.05, 1.25));

  vec3 col;
  if (rd.y > 0.0) {
    col = skyColor(rd, true);
  } else {
    float dist = ro.y / -rd.y;
    vec2 p = ro.xz + rd.xz * dist;
    // Fewer octaves and a wider normal step far away: no shimmering aliasing.
    int oct = dist < 30.0 ? 8 : dist < 90.0 ? 6 : 4;
    float e = 0.05 + dist * 0.004;
    float h = sea(p, oct);
    vec3 n = normalize(vec3(sea(p - vec2(e, 0.0), oct) - sea(p + vec2(e, 0.0), oct),
                            2.0 * e,
                            sea(p - vec2(0.0, e), oct) - sea(p + vec2(0.0, e), oct)));
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(20.0, 260.0, dist)));

    vec3 refl = reflect(rd, n);
    refl.y = abs(refl.y);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 deep = vec3(0.002, 0.008, 0.022);
    vec3 scatter = vec3(0.010, 0.045, 0.060) * max(h + 0.2, 0.0) * pow(max(dot(n, moonDir), 0.0), 2.0);
    col = mix(deep + scatter, skyColor(refl, false), fres);

    // Moon glitter: sharp highlights inside a broader moonlit path.
    vec3 hv = normalize(moonDir - rd);
    float nh = max(dot(n, hv), 0.0);
    // Close to the camera the surface is smooth and highlights turn into blobs: fade them.
    float near = smoothstep(4.0, 16.0, dist);
    col += vec3(0.95, 0.96, 1.0) * pow(nh, 1400.0) * 2.2 * near;
    col += vec3(0.30, 0.36, 0.55) * pow(nh, 120.0) * 0.22 * (0.4 + 0.6 * near);

    // Haze toward the horizon.
    float fog = 1.0 - exp(-dist * 0.012);
    col = mix(col, vec3(0.050, 0.068, 0.150), fog);
  }

  col *= 1.0 - 0.28 * dot(uv, uv);        // vignette
  col = 1.0 - exp(-col * 1.1);            // soft tone map
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0; // dither: no banding in the sky
  gl_FragColor = vec4(col, 1.0);
}
`;
  const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
  const vs = compile(gl.VERTEX_SHADER, VERTEX), fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "res"), uT = gl.getUniformLocation(prog, "t");
  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(canvas.clientWidth * scale);
    canvas.height = Math.round(canvas.clientHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (reduce.matches) draw(0);
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const start = performance.now();
  let raf = 0, last = 0;
  const draw = (now) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, reduce.matches ? 12 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now) => { raf = requestAnimationFrame(loop); if (now - last < 33) return; last = now; draw(now); };
  const run = () => {
    cancelAnimationFrame(raf);
    if (document.visibilityState === "hidden") return;
    if (reduce.matches) draw(0); else raf = requestAnimationFrame(loop);
  };
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", run);
  reduce.addEventListener("change", run);
  resize();
  run();
  canvas.classList.add("on");
})();
