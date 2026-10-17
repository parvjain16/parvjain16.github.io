#!/usr/bin/env node
"use strict";

// Generate the site's code-drawn social card. Requires @napi-rs/canvas.
// PARV_CANVAS_MODULE may point to an existing installation of that module.
// No network requests or source-photo changes are needed.
const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, GlobalFonts } = require(process.env.PARV_CANVAS_MODULE || "@napi-rs/canvas");
const root = path.resolve(__dirname, "..");
GlobalFonts.registerFromPath(path.join(root, "fonts/Product Sans Regular.ttf"), "Product Sans");
GlobalFonts.registerFromPath(path.join(root, "fonts/Product Sans Bold.ttf"), "Product Sans");

const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext("2d");
const roundRect = (x, y, w, h, r, fill, stroke) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
};
const text = (value, x, y, size, color, bold = false) => {
    ctx.font = `${bold ? 700 : 400} ${size}px "Product Sans"`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
};

ctx.fillStyle = "#dcdfe2";
ctx.fillRect(0, 0, 1200, 630);
const halo = ctx.createRadialGradient(1040, 230, 10, 1040, 230, 650);
halo.addColorStop(0, "#b4cdf5");
halo.addColorStop(0.56, "#d0dae7");
halo.addColorStop(1, "#dcdfe2");
ctx.fillStyle = halo;
ctx.fillRect(0, 0, 1200, 630);
roundRect(26, 26, 1148, 578, 28, "rgba(255,255,255,0.10)", "rgba(255,255,255,0.70)");

roundRect(76, 65, 48, 48, 14, "#0b0d10");
text("PJ", 85, 99, 25, "#f4f2ef", true);
text("PARV JAIN", 140, 87, 17, "#151d2a", true);
text("PERSONAL WEBSITE", 140, 109, 12, "#526175");

// An abstract orbit/network is an illustration, not a financial chart.
ctx.save();
ctx.beginPath();
ctx.roundRect(775, 143, 351, 347, 30);
ctx.clip();
const glass = ctx.createLinearGradient(775, 145, 1126, 490);
glass.addColorStop(0, "rgba(255,255,255,0.48)");
glass.addColorStop(1, "rgba(208,223,247,0.28)");
ctx.fillStyle = glass;
ctx.fillRect(775, 143, 351, 347);
ctx.save();
ctx.translate(954, 316);
ctx.rotate(-0.25);
for (let i = 0; i < 10; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 54 + i * 13, 37 + i * 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(60,105,163,${0.17 - i * 0.009})`;
    ctx.lineWidth = 1;
    ctx.stroke();
}
ctx.restore();

const points = [[810,215],[858,178],[937,209],[1018,174],[1090,239],[1068,327],[1111,403],[1043,456],[970,416],[899,458],[819,391],[839,311],[912,299],[997,287],[972,351],[900,365]];
const edges = [[0,1],[0,11],[1,2],[2,3],[2,12],[3,4],[4,5],[5,6],[5,13],[6,7],[7,8],[8,9],[8,14],[9,10],[9,15],[10,11],[11,12],[12,13],[12,15],[13,14],[14,15],[2,13],[5,14]];
ctx.strokeStyle = "rgba(38,78,132,0.22)";
ctx.lineWidth = 1.15;
for (const [a, b] of edges) {
    ctx.beginPath();
    ctx.moveTo(...points[a]);
    ctx.lineTo(...points[b]);
    ctx.stroke();
}
for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i % 5 === 0 ? "#1767be" : "#657c9d";
    ctx.fill();
}
const orb = ctx.createRadialGradient(942, 306, 3, 954, 320, 61);
orb.addColorStop(0, "#ffffff");
orb.addColorStop(0.62, "#e8eff8");
orb.addColorStop(1, "#a9bfdc");
ctx.shadowColor = "rgba(31,60,104,0.18)";
ctx.shadowBlur = 24;
ctx.shadowOffsetY = 12;
ctx.beginPath();
ctx.arc(954, 320, 49, 0, Math.PI * 2);
ctx.fillStyle = orb;
ctx.fill();
ctx.shadowColor = "transparent";
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
text("PJ", 932, 331, 31, "#263c59", true);
ctx.restore();
roundRect(775, 143, 351, 347, 30, null, "rgba(255,255,255,0.70)");

// Shallow offset and a chrome gradient echo the liquid-metal name on the site.
ctx.shadowColor = "rgba(20,31,47,0.18)";
ctx.shadowBlur = 7;
ctx.shadowOffsetY = 8;
text("Parv Jain", 73, 276, 118, "#65717f", true);
ctx.shadowColor = "transparent";
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
const chrome = ctx.createLinearGradient(0, 175, 0, 278);
chrome.addColorStop(0, "#8b98a8");
chrome.addColorStop(0.26, "#fafbfc");
chrome.addColorStop(0.47, "#788798");
chrome.addColorStop(0.52, "#354454");
chrome.addColorStop(0.77, "#c8d1dc");
chrome.addColorStop(1, "#526071");
text("Parv Jain", 73, 270, 118, chrome, true);
text("Technology. Business. Building.", 77, 337, 31, "#101a29", true);
text("Computer Science & Business · Indiana University", 78, 381, 21, "#3e4e62");

let pillX = 77;
for (const label of ["Projects", "Finance", "Books"]) {
    ctx.font = '700 16px "Product Sans"';
    const width = Math.ceil(ctx.measureText(label).width) + 63;
    roundRect(pillX, 435, width, 45, 22.5, "rgba(255,255,255,0.52)", "rgba(72,92,120,0.18)");
    text(label, pillX + 20, 464, 16, "#172b45", true);
    ctx.beginPath();
    const x = pillX + width - 27;
    ctx.moveTo(x - 3, 462); ctx.lineTo(x + 4, 455);
    ctx.moveTo(x - 3, 455); ctx.lineTo(x + 4, 455); ctx.lineTo(x + 4, 462);
    ctx.strokeStyle = "#286eb7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    pillX += width + 12;
}

ctx.beginPath();
ctx.moveTo(77, 526); ctx.lineTo(1124, 526);
ctx.strokeStyle = "rgba(60,79,106,0.18)"; ctx.lineWidth = 1; ctx.stroke();
text("parvjain16.github.io", 78, 563, 20, "#263b57");
ctx.textAlign = "right";
text("AI  ·  PRODUCT  ·  ENGINEERING", 1122, 563, 12, "#4a607c", true);
ctx.textAlign = "left";

const output = path.join(root, "assets/social-preview.png");
fs.writeFileSync(output, canvas.toBuffer("image/png"));
console.log(`Created ${output} (1200 × 630, ${fs.statSync(output).size} bytes)`);
