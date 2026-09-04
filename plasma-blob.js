(() => {
    "use strict";

    const canvas = document.getElementById("plasma-panel");
    const panel = canvas?.closest(".plasma-panel");
    if (!canvas || !panel) return;

    const CONFIG = Object.freeze({
        desktopDpr: 1.65,
        mobileDpr: 1.4,
        maximumPixels: 650000,
        simulationScale: 0.48,
        simulationMaxWidth: 256,
        simulationMaxHeight: 144,
        velocityLimit: 1450,
        reducedFrameInterval: 120,
        clickRippleDuration: 1.35,
        clickRippleStrength: 1.15,
        clickResetDuration: 3.65
    });
    const CLICK_COLORS = Object.freeze([
        Object.freeze({ name: "Blue", hue: 0.98, rgb: Object.freeze([0.055, 0.445, 0.99]) }),
        Object.freeze({ name: "Orange", hue: 0.17, rgb: Object.freeze([1.0, 0.285, 0.035]) }),
        Object.freeze({ name: "Green", hue: 0.34, rgb: Object.freeze([0.035, 0.82, 0.31]) }),
        Object.freeze({ name: "Pink", hue: 0.51, rgb: Object.freeze([1.0, 0.16, 0.61]) }),
        Object.freeze({ name: "Red", hue: 0.68, rgb: Object.freeze([0.98, 0.035, 0.075]) }),
        Object.freeze({ name: "Purple", hue: 0.84, rgb: Object.freeze([0.48, 0.09, 0.94]) })
    ]);
    const root = document.documentElement;
    const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
    const mobileQuery = matchMedia("(max-width: 768px)");
    const selfTestEnabled = location.search.includes("selftest");
    const abortController = new AbortController();
    const { signal } = abortController;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const approach = (from, to, seconds, tau) => from + (to - from) * (1 - Math.exp(-seconds / tau));
    const wake = () => window.requestParvAnimationFrame?.();

    let gl = canvas.getContext("webgl2", {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance"
    });
    let destroyed = false;
    let visible = !document.hidden;
    let intersecting = true;
    let lost = false;
    let dirty = true;
    let boundsDirty = true;
    let resizeTimer = 0;
    let reducedTimer = 0;
    let lastTime = 0;
    let time = 0;
    let width = 1;
    let height = 1;
    let scale = 1;
    let bounds = null;
    let frameCount = 0;
    let memoryActivity = 0;
    let vao = null;
    let buffer = null;
    let simProgram = null;
    let displayProgram = null;
    let copyProgram = null;
    let simU = null;
    let displayU = null;
    let copyU = null;
    let targets = null;
    let ready = false;

    const pointer = {
        inside: false, type: "mouse", clientX: 0, clientY: 0,
        x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, px: 0.5, py: 0.5,
        vx: 0, vy: 0, tvx: 0, tvy: 0, ex: 0.5, ey: 0.5,
        eventTime: 0, lastMove: 0, strength: 0, energy: 0, ring: 0,
        rippleX: 0.5, rippleY: 0.5, rippleAge: -1, rippleStrength: 0,
        colorIndex: -1, drawHue: CLICK_COLORS[0].hue, drawEnabled: 0,
        drawR: 0.91, drawG: 0.94, drawB: 1
    };

    const vertex = `#version 300 es
        layout(location=0) in vec2 a; out vec2 uv;
        void main(){ uv=a*.5+.5; gl_Position=vec4(a,0.,1.); }`;

    const simulation = `#version 300 es
        precision highp float;
        in vec2 uv; out vec4 outState;
        uniform sampler2D state; uniform vec2 texel,res,pointer,previous,velocity,ripple;
        uniform float strength,energy,radius,time,delta,reduced,rippleAge,rippleStrength,rippleDuration,rippleResetDuration,drawHue,drawEnabled;
        const float ZERO=128.0/255.0, RANGE=127.0/255.0, VMAX=.72, TAU=6.2831853;
        vec2 dec(vec2 v){return (v-ZERO)/RANGE*VMAX;}
        vec2 enc(vec2 v){return ZERO+clamp(v/VMAX,-1.,1.)*RANGE;}
        vec4 get(vec2 p){return texture(state,clamp(p,texel*.5,1.-texel*.5));}
        float seg(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-(a+d*clamp(dot(p-a,d)/max(dot(d,d),.0001),0.,1.)));}
        vec2 safe(vec2 v){float l=length(v);return l>.00001?v/l:vec2(0.);}
        vec2 ambient(vec2 p){
          float asp=res.x/max(res.y,1.), t=time*mix(1.,.16,reduced);
          vec2 q=(p-.5)*vec2(asp,1.);
          float a=q.x*2.1+t*.105,b=q.y*2.72-t*.082,c=(q.x+q.y*.58)*1.46-t*.061,d=(q.y-q.x*.31)*1.88+t*.047;
          vec2 curl=vec2(sin(a)*cos(b)*2.72+cos(c)*cos(d)*1.88*.46,-cos(a)*sin(b)*2.1-cos(c)*cos(d)*.405);
          return curl*mix(.018,.0022,reduced)/vec2(asp,1.);
        }
        vec2 source(vec2 p){
          float t=time*mix(1.,.13,reduced);
          float a=sin((p.x*1.08+p.y*.31)*TAU+t*.082+.7),b=sin((p.y*.86-p.x*.24)*TAU-t*.057+2.1);
          float c=cos((p.x*.47+p.y*.62)*TAU+t*.041+4.2),d=cos((p.x*.82-p.y*.38)*TAU-t*.069+1.35);
          float mass=clamp(.51+a*.245+b*.155+c*.085,.035,.965);
          float depth=clamp(.49+d*.235+b*.145-c*.095,.035,.965);
          return vec2(mix(.72,.985,mass),depth);
        }
        void main(){
          float dt=clamp(delta,1./120.,1./30.); vec4 local=get(uv); vec2 vel=dec(local.rg);
          vec2 ppx=uv*res, a=previous*res, b=pointer*res; float f=clamp(1.-seg(ppx,a,b)/max(radius,1.),0.,1.); f=f*f*(3.-2.*f);
          vec2 vuv=velocity/max(res,vec2(1.)); float speed=clamp(length(velocity)/1050.,0.,1.);
          vec2 direction=safe(vuv), radial=safe(uv-pointer), tangent=vec2(-radial.y,radial.x);
          float side=direction.x*radial.y-direction.y*radial.x, interaction=f*strength*mix(1.,.2,reduced);
          vec2 injected=vuv*interaction*(.30+speed*.52)
            +tangent*side*interaction*energy*(.06+speed*.11)
            -radial*dot(radial,direction)*interaction*speed*.052;
          vec2 ripplePoint=ripple*res;
          float maxRippleRadius=max(
            max(length(ripplePoint),length(vec2(res.x-ripplePoint.x,ripplePoint.y))),
            max(length(vec2(ripplePoint.x,res.y-ripplePoint.y)),length(res-ripplePoint))
          );
          float rippleProgress=clamp(rippleAge/max(rippleDuration,.001),0.,1.);
          float rippleRadius=rippleProgress*maxRippleRadius*1.035;
          float rippleWidth=mix(42.,14.,rippleProgress);
          float rippleDistance=length((uv-ripple)*res);
          float wave=exp(-pow((rippleDistance-rippleRadius)/max(rippleWidth,1.),2.));
          float waveEnvelope=(1.-rippleProgress)*(1.-rippleProgress)*rippleStrength;
          vec2 rippleDir=safe(uv-ripple), rippleTangent=vec2(-rippleDir.y,rippleDir.x);
          vec2 rippleKick=(rippleDir*.42+rippleTangent*sin(rippleRadius*.026+time*1.35)*.13)*wave*waveEnvelope;
          injected+=rippleKick;
          vec2 back=clamp(uv-(vel+ambient(uv)+injected)*dt,texel*.5,1.-texel*.5);
          vec4 adv=get(back), near=(get(back+vec2(texel.x,0.))+get(back-vec2(texel.x,0.))+get(back+vec2(0.,texel.y))+get(back-vec2(0.,texel.y)))*.25;
          vec2 nextVel=mix(dec(adv.rg),dec(near.rg),1.-exp(-1.75*dt))*exp(-.40*dt);
          vec2 dyes=mix(adv.ba,near.ba,1.-exp(-.28*dt));
          nextVel+=injected*(1.-exp(-9.*dt)); float l=length(nextVel); if(l>VMAX)nextVel*=VMAX/l;
          float resetEnvelope=smoothstep(rippleDuration,rippleDuration+.18,rippleAge)
            *(1.-smoothstep(rippleDuration+.35,rippleResetDuration,rippleAge));
          float restoreRate=mix(.050,1.45,resetEnvelope);
          dyes=mix(dyes,source(uv),1.-exp(-restoreRate*dt));
          vec2 selectedDye=vec2(drawHue,.76);
          float trailInk=interaction*drawEnabled*clamp(.07+energy*.16+speed*.12,0.,.34);
          float rippleInk=wave*waveEnvelope*drawEnabled*.26;
          dyes=mix(dyes,selectedDye,clamp(trailInk+rippleInk,0.,.48));
          outState=vec4(enc(nextVel),clamp(dyes,.018,.982));
        }`;

    const display = `#version 300 es
        precision highp float;
        in vec2 uv; out vec4 outColor;
        uniform sampler2D state; uniform vec2 res,texel,pointer;
        uniform float time,ring,theme,reduced,drawEnabled; uniform vec3 cursorColor;
        const float ZERO=128.0/255.0,RANGE=127.0/255.0,VMAX=.72;
        vec2 dec(vec2 v){return (v-ZERO)/RANGE*VMAX;}
        vec3 palette(float x){
          vec3 blue=vec3(.055,.445,.990),orange=vec3(1.,.285,.035),green=vec3(.035,.820,.310),pink=vec3(1.,.160,.610),red=vec3(.980,.035,.075),purple=vec3(.480,.090,.940);
          float h=clamp(x,0.,1.);vec3 c=mix(blue,orange,smoothstep(0.,.17,h));
          c=mix(c,green,smoothstep(.17,.34,h));c=mix(c,pink,smoothstep(.34,.51,h));
          c=mix(c,red,smoothstep(.51,.68,h));c=mix(c,purple,smoothstep(.68,.84,h));
          return mix(c,blue,smoothstep(.84,1.,h));
        }
        void main(){
          vec4 s=texture(state,uv);vec2 v=dec(s.rg);vec4 r=texture(state,clamp(uv-v*mix(.052,.018,reduced),texel,1.-texel));
          float a=mix(s.b,r.b,.48),b=mix(s.a,r.a,.42);
          float material=clamp(a+(b-.5)*.045+sin((a-b)*6.2831853)*.018,0.,1.);
          vec2 grad=vec2(dFdx(material),dFdy(material))*res;float ridge=clamp(length(grad)*.012,0.,1.);
          vec3 normal=normalize(vec3(-grad*.018,1.));float light=.76+max(dot(normal,normalize(vec3(-.36,.48,.8))),0.)*.34;
          float overlap=1.-smoothstep(.035,.30,abs(a-b)),speed=clamp(length(v)/VMAX,0.,1.);
          vec3 color=palette(material)*light;color+=vec3(.075,.315,.68)*ridge*.16;color+=vec3(.48,.10,.61)*overlap*.085;color+=vec3(.09,.34,.74)*speed*.12;
          color*=.985+sin(time*mix(.17,.035,reduced)+material*4.2)*.018;color*=mix(1.,.91,theme);
          float d=length((uv-pointer)*res);float line=1.-smoothstep(.4,1.35,abs(d-15.));
          vec3 ringColor=mix(mix(vec3(.91,.94,1.),vec3(.98),theme),cursorColor,drawEnabled);
          color=mix(color,ringColor,line*ring*.72);
          outColor=vec4(max(color,0.),1.);
        }`;

    const copy = `#version 300 es
        precision highp float; in vec2 uv; out vec4 c; uniform sampler2D source;
        void main(){c=texture(source,uv);}`;

    const shader = (type, source, label) => {
        const value = gl?.createShader(type);
        if (!value) return null;
        gl.shaderSource(value, source);
        gl.compileShader(value);
        if (gl.getShaderParameter(value, gl.COMPILE_STATUS)) return value;
        console.error(`Plasma ${label} shader:`, gl.getShaderInfoLog(value));
        gl.deleteShader(value);
        return null;
    };
    const program = (fragment, label) => {
        const vs = shader(gl.VERTEX_SHADER, vertex, `${label} vertex`);
        const fs = shader(gl.FRAGMENT_SHADER, fragment, `${label} fragment`);
        if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return null; }
        const value = gl.createProgram();
        gl.attachShader(value, vs); gl.attachShader(value, fs); gl.linkProgram(value);
        gl.deleteShader(vs); gl.deleteShader(fs);
        if (gl.getProgramParameter(value, gl.LINK_STATUS)) return value;
        console.error(`Plasma ${label} program:`, gl.getProgramInfoLog(value));
        gl.deleteProgram(value);
        return null;
    };
    const locations = (value, names) => Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(value, name)]));
    const freeTargets = (value) => {
        if (!gl || !value || lost) return;
        value.fbos.forEach((item) => gl.deleteFramebuffer(item));
        value.textures.forEach((item) => gl.deleteTexture(item));
    };
    const release = () => {
        if (gl && !lost) {
            freeTargets(targets);
            if (buffer) gl.deleteBuffer(buffer);
            if (vao) gl.deleteVertexArray(vao);
            if (simProgram) gl.deleteProgram(simProgram);
            if (displayProgram) gl.deleteProgram(displayProgram);
            if (copyProgram) gl.deleteProgram(copyProgram);
        }
        targets = null; vao = null; buffer = null; simProgram = null; displayProgram = null; copyProgram = null; ready = false;
    };
    const initialize = () => {
        if (!gl) { panel.classList.add("is-plasma-fallback", "is-plasma-css-fallback"); return false; }
        simProgram = program(simulation, "simulation");
        displayProgram = program(display, "display");
        copyProgram = program(copy, "copy");
        if (!simProgram || !displayProgram || !copyProgram) { release(); panel.classList.add("is-plasma-fallback", "is-plasma-css-fallback"); return false; }
        vao = gl.createVertexArray(); buffer = gl.createBuffer();
        gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null);
        simU = locations(simProgram, ["state","texel","res","pointer","previous","velocity","ripple","strength","energy","radius","time","delta","reduced","rippleAge","rippleStrength","rippleDuration","rippleResetDuration","drawHue","drawEnabled"]);
        displayU = locations(displayProgram, ["state","res","texel","pointer","time","ring","theme","reduced","cursorColor","drawEnabled"]);
        copyU = locations(copyProgram, ["source"]);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        return true;
    };

    const seed = (w, h) => {
        const data = new Uint8Array(w * h * 4), tau = Math.PI * 2;
        for (let y = 0, i = 0; y < h; y += 1) for (let x = 0; x < w; x += 1, i += 4) {
            const u = (x + .5) / w, v = (y + .5) / h;
            const a = Math.sin((u*1.08+v*.31)*tau+.7), b = Math.sin((v*.86-u*.24)*tau+2.1);
            const c = Math.cos((u*.47+v*.62)*tau+4.2), d = Math.cos((u*.82-v*.38)*tau+1.35);
            data[i] = 128; data[i+1] = 128;
            const mass = clamp(.51+a*.245+b*.155+c*.085,.035,.965);
            data[i+2] = Math.round((.72 + mass * .265)*255);
            data[i+3] = Math.round(clamp(.49+d*.235+b*.145-c*.095,.035,.965)*255);
        }
        return data;
    };
    const makeTargets = (w, h, previous) => {
        const textures = [], fbos = [], initial = seed(w, h);
        for (let i = 0; i < 2; i += 1) {
            const texture = gl.createTexture(), fbo = gl.createFramebuffer();
            if (!texture || !fbo) { textures.forEach((x) => gl.deleteTexture(x)); fbos.forEach((x) => gl.deleteFramebuffer(x)); return null; }
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,initial);
            gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteTexture(texture); gl.deleteFramebuffer(fbo); textures.forEach((x) => gl.deleteTexture(x)); fbos.forEach((x) => gl.deleteFramebuffer(x)); return null; }
            textures.push(texture); fbos.push(fbo);
        }
        const value = { width:w, height:h, textures, fbos, read:0 };
        if (previous) {
            gl.useProgram(copyProgram); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, previous.textures[previous.read]); gl.uniform1i(copyU.source,0); gl.viewport(0,0,w,h);
            fbos.forEach((fbo) => { gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.drawArrays(gl.TRIANGLES,0,3); });
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.bindTexture(gl.TEXTURE_2D,null); return value;
    };

    const refreshBounds = () => { bounds = canvas.getBoundingClientRect(); boundsDirty = false; return bounds; };
    const updatePointer = () => {
        if (!pointer.inside) return;
        const box = boundsDirty || !bounds ? refreshBounds() : bounds;
        pointer.x = clamp((pointer.clientX - box.left) / Math.max(box.width,1),0,1);
        pointer.y = clamp(1 - (pointer.clientY - box.top) / Math.max(box.height,1),0,1);
    };
    const quantize = (value, floor) => Math.max(floor, Math.round(value / 16) * 16);
    const simSize = () => {
        const fit = Math.min(CONFIG.simulationScale, CONFIG.simulationMaxWidth / width, CONFIG.simulationMaxHeight / height);
        return { w:quantize(width * fit,96), h:quantize(height * fit,64) };
    };
    const resize = () => {
        if (destroyed) return;
        const box = canvas.getBoundingClientRect(); width = Math.max(1,box.width); height = Math.max(1,box.height);
        const wanted = Math.min(devicePixelRatio || 1, mobileQuery.matches ? CONFIG.mobileDpr : CONFIG.desktopDpr);
        scale = Math.min(wanted, Math.sqrt(CONFIG.maximumPixels / Math.max(width * height,1)));
        const w = Math.max(1,Math.round(width * scale)), h = Math.max(1,Math.round(height * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        if (ready && !lost) {
            const size = simSize();
            if (!targets || targets.width !== size.w || targets.height !== size.h) {
                const previous = targets, next = makeTargets(size.w,size.h,previous);
                if (next) { targets = next; if (previous) freeTargets(previous); panel.classList.remove("is-plasma-fallback","is-plasma-css-fallback"); canvas.dataset.plasmaRenderer = "webgl2-ping-pong"; canvas.dataset.simulationSize = `${size.w}x${size.h}`; }
                else if (!previous) panel.classList.add("is-plasma-fallback","is-plasma-css-fallback");
            }
        }
        boundsDirty = true; updatePointer(); dirty = true; wake();
    };
    const debounceResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize,150); };

    const move = (event) => {
        pointer.clientX = event.clientX; pointer.clientY = event.clientY; pointer.type = event.pointerType || "mouse"; updatePointer();
        const now = performance.now();
        if (pointer.eventTime) {
            const seconds = clamp((now-pointer.eventTime)/1000,.006,.085), vx = (pointer.x-pointer.ex)*width/seconds, vy = (pointer.y-pointer.ey)*height/seconds, length = Math.hypot(vx,vy), ratio = length > CONFIG.velocityLimit ? CONFIG.velocityLimit/length : 1;
            pointer.tvx = vx*ratio; pointer.tvy = vy*ratio;
        }
        pointer.ex = pointer.x; pointer.ey = pointer.y; pointer.eventTime = now; pointer.lastMove = now; dirty = true; wake();
    };
    const enter = (event) => {
        const fresh = !pointer.inside; pointer.inside = true; boundsDirty = true; move(event);
        if (fresh) { pointer.sx=pointer.x; pointer.sy=pointer.y; pointer.px=pointer.x; pointer.py=pointer.y; pointer.vx=0; pointer.vy=0; pointer.tvx=0; pointer.tvy=0; pointer.ex=pointer.x; pointer.ey=pointer.y; }
        if (finePointerQuery.matches && !reducedQuery.matches) root.classList.add("plasma-pointer-active");
    };
    const pointerDown = (event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        enter(event);
        pointer.colorIndex = (pointer.colorIndex + 1) % CLICK_COLORS.length;
        const selected = CLICK_COLORS[pointer.colorIndex];
        pointer.drawHue = selected.hue;
        pointer.drawEnabled = 1;
        [pointer.drawR, pointer.drawG, pointer.drawB] = selected.rgb;
        if (reducedQuery.matches) { if (event.pointerType === "touch") leave(); dirty = true; wake(); return; }
        pointer.rippleX = pointer.x; pointer.rippleY = pointer.y; pointer.rippleAge = 0; pointer.rippleStrength = CONFIG.clickRippleStrength;
        if (event.pointerType === "touch") leave();
        dirty = true; wake();
    };
    const leave = () => { pointer.inside=false; pointer.eventTime=0; root.classList.remove("plasma-pointer-active"); dirty=true; wake(); };
    const updatePhysics = (now, dt) => {
        pointer.px = pointer.sx; pointer.py = pointer.sy;
        if (now - pointer.lastMove > 42) { const d=Math.exp(-dt/(reducedQuery.matches?.06:.13)); pointer.tvx*=d; pointer.tvy*=d; }
        pointer.sx = approach(pointer.sx,pointer.x,dt,reducedQuery.matches?.075:.052); pointer.sy = approach(pointer.sy,pointer.y,dt,reducedQuery.matches?.075:.052);
        const attack = now-pointer.lastMove <= 62 ? .042 : .28; pointer.vx = approach(pointer.vx,pointer.tvx,dt,attack); pointer.vy = approach(pointer.vy,pointer.tvy,dt,attack);
        const target = pointer.inside ? (reducedQuery.matches?.22:1) : 0; pointer.strength = approach(pointer.strength,target,dt,target>pointer.strength?.048:.42);
        const speed=clamp(Math.hypot(pointer.vx,pointer.vy)/1050,0,1), e=reducedQuery.matches?0:speed*pointer.strength; pointer.energy=approach(pointer.energy,e,dt,e>pointer.energy?.055:.52);
        const ring=pointer.inside&&pointer.type==="mouse"&&finePointerQuery.matches&&!reducedQuery.matches?1:0; pointer.ring=approach(pointer.ring,ring,dt,ring>.05?.055:.16);
        if (pointer.rippleAge >= 0) {
            pointer.rippleAge += dt;
            const progress = clamp(pointer.rippleAge / CONFIG.clickRippleDuration, 0, 1);
            pointer.rippleStrength = reducedQuery.matches || progress >= 1
                ? 0
                : CONFIG.clickRippleStrength;
            if (pointer.rippleAge >= CONFIG.clickResetDuration) {
                pointer.rippleAge = -1;
                pointer.rippleStrength = 0;
            }
        } else pointer.rippleStrength = 0;
        memoryActivity=Math.max(memoryActivity*Math.exp(-dt/8.5),speed*pointer.strength);
    };
    const simulate = (dt) => {
        const read=targets.read, write=1-read, radius=clamp(Math.min(width,height)*.145,30,56);
        gl.bindFramebuffer(gl.FRAMEBUFFER,targets.fbos[write]); gl.viewport(0,0,targets.width,targets.height); gl.useProgram(simProgram); gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,targets.textures[read]);
        gl.uniform1i(simU.state,0); gl.uniform2f(simU.texel,1/targets.width,1/targets.height); gl.uniform2f(simU.res,width,height);
        gl.uniform2f(simU.pointer,pointer.sx,pointer.sy); gl.uniform2f(simU.previous,pointer.px,pointer.py); gl.uniform2f(simU.velocity,pointer.vx,pointer.vy); gl.uniform2f(simU.ripple,pointer.rippleX,pointer.rippleY);
        gl.uniform1f(simU.strength,pointer.strength); gl.uniform1f(simU.energy,pointer.energy); gl.uniform1f(simU.radius,radius); gl.uniform1f(simU.time,time); gl.uniform1f(simU.delta,dt); gl.uniform1f(simU.reduced,reducedQuery.matches?1:0); gl.uniform1f(simU.rippleAge,Math.max(pointer.rippleAge,0)); gl.uniform1f(simU.rippleStrength,pointer.rippleStrength); gl.uniform1f(simU.rippleDuration,CONFIG.clickRippleDuration); gl.uniform1f(simU.rippleResetDuration,CONFIG.clickResetDuration); gl.uniform1f(simU.drawHue,pointer.drawHue); gl.uniform1f(simU.drawEnabled,pointer.drawEnabled);
        gl.drawArrays(gl.TRIANGLES,0,3); targets.read=write;
    };
    const displayFrame = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,canvas.width,canvas.height); gl.useProgram(displayProgram);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,targets.textures[targets.read]);
        gl.uniform1i(displayU.state,0); gl.uniform2f(displayU.res,width,height); gl.uniform2f(displayU.texel,1/targets.width,1/targets.height);
        gl.uniform2f(displayU.pointer,pointer.sx,pointer.sy); gl.uniform1f(displayU.time,time); gl.uniform1f(displayU.ring,pointer.ring); gl.uniform1f(displayU.theme,document.body.classList.contains("dark-mode")?1:0); gl.uniform1f(displayU.reduced,reducedQuery.matches?1:0); gl.uniform3f(displayU.cursorColor,pointer.drawR,pointer.drawG,pointer.drawB); gl.uniform1f(displayU.drawEnabled,pointer.drawEnabled);
        gl.drawArrays(gl.TRIANGLES,0,3); gl.bindVertexArray(null);
    };
    const scheduleReduced = () => {
        clearTimeout(reducedTimer);
        // Reduced motion stays still between explicit input, theme, and resize updates.
    };
    const renderFrame = (now, deltaMs) => {
        if (destroyed || lost || !visible || !intersecting || !ready || !targets) return;
        if (reducedQuery.matches && !dirty && lastTime && now-lastTime<CONFIG.reducedFrameInterval) return;
        const dt=clamp((lastTime?now-lastTime:deltaMs||16.67)/1000,.001,.05); lastTime=now; time+=dt; updatePhysics(now,dt); simulate(dt); displayFrame(); dirty=false; frameCount+=1;
        if (selfTestEnabled) {
            const rippleProgress=pointer.rippleAge<0?0:clamp(pointer.rippleAge/CONFIG.clickRippleDuration,0,1);
            const resetProgress=pointer.rippleAge<=CONFIG.clickRippleDuration?0:clamp((pointer.rippleAge-CONFIG.clickRippleDuration)/(CONFIG.clickResetDuration-CONFIG.clickRippleDuration),0,1);
            canvas.dataset.rippleActive=String(pointer.rippleAge>=0);
            canvas.dataset.rippleProgress=rippleProgress.toFixed(3);
            canvas.dataset.rippleResetProgress=resetProgress.toFixed(3);
            canvas.dataset.rippleOrigin=`${pointer.rippleX.toFixed(3)},${pointer.rippleY.toFixed(3)}`;
            canvas.dataset.selectedColor=pointer.colorIndex>=0?CLICK_COLORS[pointer.colorIndex].name:"None";
            canvas.dataset.colorIndex=String(pointer.colorIndex);
        }
        if (frameCount%30===0) { canvas.dataset.frameCount=String(frameCount); canvas.dataset.memoryActivity=memoryActivity.toFixed(3); canvas.dataset.deviceScale=scale.toFixed(2); }
        scheduleReduced();
    };
    const settling = () => Math.abs(pointer.x-pointer.sx)>.0001||Math.abs(pointer.y-pointer.sy)>.0001||Math.abs(pointer.vx)>.4||Math.abs(pointer.vy)>.4||pointer.strength>.002||pointer.energy>.002||pointer.ring>.002||pointer.rippleAge>=0;
    const needsAnimation = () => !destroyed && !lost && ready && Boolean(targets) && visible && intersecting && (!reducedQuery.matches || dirty);

    const onScroll = () => { boundsDirty=true; if (pointer.inside && document.elementFromPoint(pointer.clientX,pointer.clientY)!==canvas) leave(); else updatePointer(); dirty=true; wake(); };
    const onVisibility = () => { visible=!document.hidden; lastTime=0; if (!visible) leave(); else scheduleReduced(); wake(); };
    const onMotion = () => { pointer.tvx=0; pointer.tvy=0; pointer.energy=0; if (reducedQuery.matches) { root.classList.remove("plasma-pointer-active"); pointer.ring=0; pointer.rippleAge=-1; pointer.rippleStrength=0; } else if (pointer.inside&&finePointerQuery.matches) root.classList.add("plasma-pointer-active"); lastTime=0; dirty=true; scheduleReduced(); wake(); };
    const onLost = (event) => { event.preventDefault(); lost=true; ready=false; targets=null; simProgram=null; displayProgram=null; copyProgram=null; vao=null; buffer=null; panel.classList.add("is-plasma-fallback","is-plasma-css-fallback"); leave(); };
    const onRestored = () => { lost=false; gl=canvas.getContext("webgl2"); ready=initialize(); lastTime=0; resize(); };

    const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
        intersecting=Boolean(entries[0]?.isIntersecting); lastTime=0; if (!intersecting) leave(); else { resize(); scheduleReduced(); } wake();
    },{threshold:.01}) : null;
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(debounceResize) : null;
    const themeObserver = new MutationObserver(() => { dirty=true; wake(); });

    canvas.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") enter(event); }, {passive:true,signal});
    canvas.addEventListener("pointermove", (event) => { if (event.pointerType !== "touch") move(event); }, {passive:true,signal});
    window.bindParvCanvasActivation(canvas, pointerDown, {signal});
    canvas.addEventListener("pointerup",(event) => { if (event.pointerType !== "touch") move(event); if (event.pointerType!=="mouse") leave(); },{passive:true,signal}); canvas.addEventListener("pointerleave",leave,{passive:true,signal}); canvas.addEventListener("pointercancel",leave,{passive:true,signal});
    canvas.addEventListener("webglcontextlost",onLost,{signal}); canvas.addEventListener("webglcontextrestored",onRestored,{signal});
    addEventListener("scroll",onScroll,{passive:true,signal}); addEventListener("resize",debounceResize,{passive:true,signal}); addEventListener("blur",leave,{signal}); document.addEventListener("visibilitychange",onVisibility,{signal});
    if (reducedQuery.addEventListener) reducedQuery.addEventListener("change",onMotion); else reducedQuery.addListener(onMotion);
    themeObserver.observe(document.body,{attributes:true,attributeFilter:["class"]}); resizeObserver?.observe(panel); observer?.observe(panel);

    ready=initialize(); resize(); scheduleReduced();
    window.parvPlasmaController = {
        renderFrame, needsAnimation,
        destroy: () => {
            if (destroyed) return; destroyed=true; abortController.abort(); clearTimeout(resizeTimer); clearTimeout(reducedTimer); observer?.disconnect(); resizeObserver?.disconnect(); themeObserver.disconnect(); root.classList.remove("plasma-pointer-active");
            if (reducedQuery.removeEventListener) reducedQuery.removeEventListener("change",onMotion); else reducedQuery.removeListener(onMotion); release();
        },
        getState: () => ({
            renderer: ready&&targets ? "webgl2-ping-pong" : "fallback", webGLReady:ready&&Boolean(targets), framebufferComplete:Boolean(targets), simulationFormat:"rgba8",
            simulationWidth:targets?.width||0, simulationHeight:targets?.height||0, canvasWidth:width, canvasHeight:height, deviceScale:scale, frameCount, memoryActivity,
            pointerInside:pointer.inside, pointerStrength:pointer.strength, pointerEnergy:pointer.energy, rippleAge:pointer.rippleAge,
            selectedColor:pointer.colorIndex>=0?CLICK_COLORS[pointer.colorIndex].name:"None", colorIndex:pointer.colorIndex, isIntersecting:intersecting
        })
    };
})();
