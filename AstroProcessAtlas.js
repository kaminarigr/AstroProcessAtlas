#feature-id    Utilities > AstroProcessAtlas
#feature-icon  AstroProcessAtlas.svg
#feature-info  Generates a workspace history graph with image dependencies, masks, thumbnails and process parameters.

/*
 * AstroProcessAtlas
 * Copyright (c) 2026 YoruHikari Astrophotography (https://www.yoruhikari.gr/)
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#include <pjsr/StdIcon.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/Sizer.jsh>

var ASTROPROCESS_ATLAS_VERSION = "0.1.5";

var ICON_ERROR = (typeof StdIcon_Error !== "undefined") ? StdIcon_Error : 4;
var ICON_INFO = (typeof StdIcon_Information !== "undefined") ? StdIcon_Information : 2;
var BUTTON_OK = (typeof StdButton_Ok !== "undefined") ? StdButton_Ok : 0x00000400;

function createThumbnailFromView(view, outputPath, maxSize) {
   try {
      // Image.render() is the native PJSR bitmap API. No changes to image pixels or STF.
      var bitmap = view.image.render();
      if (!bitmap || bitmap.isNull) throw new Error("Image.render() returned an empty bitmap");
      var scale = Math.min(1, maxSize / bitmap.width, maxSize / bitmap.height);
      var thumbWidth = Math.max(1, Math.round(bitmap.width * scale));
      var thumbHeight = Math.max(1, Math.round(bitmap.height * scale));

      var scaledBitmap = bitmap.scaledTo(thumbWidth, thumbHeight);
      bitmap = null;
      if (scaledBitmap.save(outputPath) === false) throw new Error("Bitmap.save() failed");
      return true;
   } catch (e) {
      Console.writeln("Thumbnail generation error: " + e.message);
      return false;
   }
}

function getProcessName(proc) {
   if (!proc) return "Process Step";
   try {
      if (typeof proc.processId === "function") return proc.processId();
      if (proc.processId) return proc.processId;
      if (proc.description) return proc.description;
      if (proc.id) return proc.id;
      if (proc.name) return proc.name;
   } catch (e) {}
   return "Process Step";
}

function getProcessTitle(proc) {
   var name = getProcessName(proc);
   if (name !== "Script" && name !== "Process Step") return name;
   var path = "";
   try {
      if (typeof proc.filePath === "string") path = proc.filePath;
   } catch (e) {}
   if (!path) {
      try {
         // Some history instances expose the path only through serialization.
         var match = /\.filePath\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*;/.exec(proc.toSource());
         if (match) path = match[1].charAt(0) === '"' ? JSON.parse(match[1]) :
            match[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      } catch (e) {}
   }
   var filename = path.replace(/\\/g, "/").split("/").pop();
   return /\.js$/i.test(filename) ? filename.replace(/\.js$/i, "") : name;
}

function escapeHTML(value) {
   return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function readProcessingSteps(view) {
   // View.processing is a ProcessContainer, not an array.
   var processing = view.processing;
   if (!processing || typeof processing.at !== "function")
      throw new Error("View.processing is unavailable in this version of PixInsight.");
   var steps = [];
   for (var i = 0; i < processing.length; ++i)
      steps.push(processing.at(i));
   return steps;
}

function readHistoryMasks(processing, count) {
   var result = {source: "", steps: []};
   for (var i = 0; i < count; ++i)
      result.steps.push({status: "unknown", name: "", inverted: null});
   try {
      // Masks belong to ProcessContainer entries, not the process returned by at().
      result.source = processing.toSource("JavaScript", "HistoryReportContainer", 0);
      var declaration = /\b(?:var|let|const)\s+(\w+)\s*=\s*new\s+ProcessContainer\b/.exec(result.source);
      var root = /\bHistoryReportContainer\s*=\s*new\s+ProcessContainer\b/.test(result.source) ?
         "HistoryReportContainer" : declaration ? declaration[1] : "";
      if (!root) return result;
      for (i = 0; i < count; ++i) result.steps[i].status = "unrecorded";
      // Read serialization as data; never execute generated process code.
      var calls = new RegExp("\\b" + root + "\\.setMask\\s*\\(\\s*(\\d+)\\s*,([\\s\\S]*?)\\)\\s*;", "g");
      var call;
      while ((call = calls.exec(result.source)) !== null) {
         var index = Number(call[1]);
         if (index >= count) continue;
         var args = /^\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*(?:,\s*(true|false))?\s*$/.exec(call[2]);
         if (!args) { result.steps[index].status = "unknown"; continue; }
         var name;
         if (args[1].charAt(0) === '"') name = JSON.parse(args[1]);
         else name = args[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
         result.steps[index] = {status: name ? "recorded" : "unrecorded", name: name,
            inverted: args[2] ? args[2] === "true" : null};
      }
   } catch (e) {
      Console.writeln("History mask metadata unavailable: " + e.message);
   }
   return result;
}

function exportMaskThumbnail(name, thumbDir, relativeDir, cache, view) {
   // Capture before navigating the target history. One PNG per available mask view.
   for (var i = 0; i < cache.length; ++i)
      if (cache[i].name === name) return cache[i];
   var thumbnail = {name: name, src: "", reason: "The mask image is closed or has been deleted."};
   cache.push(thumbnail);
   try {
      if (!view) view = View.viewById(name);
      if (!view || view.isNull) return thumbnail;
      var filename = "mask_" + cache.length + ".png";
      if (createThumbnailFromView(view, thumbDir + "/" + filename, 220)) {
         thumbnail.src = relativeDir + "/" + filename;
         thumbnail.reason = "";
      } else thumbnail.reason = "Mask thumbnail creation failed — see the PixInsight console.";
   } catch (e) {
      Console.writeln("Mask thumbnail unavailable for " + name + ": " + e.message);
   }
   return thumbnail;
}

function maskThumbnailHTML(thumbnail, inverted) {
   if (!thumbnail) return "";
   if (!thumbnail.src) return '<p class="thumb-note">' + escapeHTML(thumbnail.reason) + '</p>';
   return '<figure class="mask-thumbnail"><a href="' + escapeHTML(thumbnail.src) + '" target="_blank" rel="noopener">' +
      '<img data-no-i18n src="' + escapeHTML(thumbnail.src) + '" alt="Mask ' + escapeHTML(thumbnail.name) + '"' +
      (inverted === true ? ' class="mask-inverted"' : '') + '></a><figcaption>' +
      'Preview of the available mask <span data-no-i18n>' + escapeHTML(thumbnail.name) + '</span>' +
      (inverted === true ? ' — inverted' : '') +
      '.<br>Current mask contents may differ from the version used when this step was applied.' +
      (inverted === null ? '<br>Historical inversion is unknown; shown without inversion.' : '') +
      '</figcaption></figure>';
}

function historyMaskHTML(info, thumbnail) {
   if (info.status === "recorded")
      return '<p class="mask-info"><span class="badge-mask">Historical mask: <span data-no-i18n>' + escapeHTML(info.name) +
         '</span></span> — ' + (info.inverted === null ? 'inversion: not recorded' :
         info.inverted ? 'inverted' : 'not inverted') + '</p>' + maskThumbnailHTML(thumbnail, info.inverted);
   return '<p class="thumb-note">' + (info.status === "unrecorded" ?
      'No mask was recorded for this step in the available history.' :
      'Historical mask information is unavailable for this step.') + '</p>';
}

function currentMaskHTML(window) {
   try {
      var mask = window.mask;
      if (!mask || mask.isNull || !mask.mainView || mask.mainView.isNull)
         return "No mask is currently attached.";
      return '<span data-no-i18n>' + escapeHTML(mask.mainView.fullId || mask.mainView.id) + '</span>' + " — " +
         (window.maskEnabled ? "enabled" : "disabled") + " — " +
         (window.maskInverted ? "inverted" : "normal");
   } catch (e) { return "Current mask information is unavailable."; }
}

function getProcessParameters(proc) {
   // Native serialization includes scalar, table and array parameters without truncation.
   try {
      return proc.toSource();
   } catch (e) {
      Console.writeln("Parameter serialization error: " + e.message);
      return "Could not retrieve parameters: " + e.message;
   }
}

function numberText(x) { return String(Number(x)); }

function parameterTable(headers, rows, visibleRows) {
   if (visibleRows && rows.length > visibleRows)
      return parameterTable(headers, rows.slice(0, visibleRows)) + '<details class="parameter-details"><summary>Details — remaining ' +
         (rows.length - visibleRows) + ' entries</summary>' + parameterTable(headers, rows.slice(visibleRows)) + '</details>';
   var html = "<div class=\"table-scroll\"><table><thead><tr>";
   for (var i = 0; i < headers.length; ++i) html += "<th>" + escapeHTML(headers[i]) + "</th>";
   html += "</tr></thead><tbody>";
   for (var r = 0; r < rows.length; ++r) {
      html += "<tr>";
      for (var c = 0; c < rows[r].length; ++c) html += (headers[c] === 'Connection origin' || headers[c] === 'Category' ? '<td>' : '<td data-no-i18n>') + escapeHTML(rows[r][c]) + "</td>";
      html += "</tr>";
   }
   return html + "</tbody></table></div>";
}

function serializedArrayEntries(value) {
   // Split only at the outer array level. Commas in paths, comments and nested rows are data.
   if (value.charAt(0) !== '[') return null;
   var entries = [], start = 1, depth = 1, quote = '', lineComment = false, blockComment = false;
   for (var i = 1; i < value.length; ++i) {
      var c = value.charAt(i), next = value.charAt(i+1);
      if (lineComment) { if (c === '\n' || c === '\r') lineComment = false; continue; }
      if (blockComment) { if (c === '*' && next === '/') { blockComment = false; ++i; } continue; }
      if (quote) { if (c === '\\') ++i; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '/' && next === '/') { lineComment = true; ++i; continue; }
      if (c === '/' && next === '*') { blockComment = true; ++i; continue; }
      if (c === '[' || c === '{' || c === '(') ++depth;
      else if (c === ']' || c === '}' || c === ')') {
         --depth;
         if (depth === 0) {
            var last = value.slice(start, i).trim();
            if (last) entries.push(last);
            return entries;
         }
      } else if (c === ',' && depth === 1) { entries.push(value.slice(start, i).trim()); start = i+1; }
   }
   return null;
}

function compactParameterValue(value) {
   var entries = serializedArrayEntries(value), preview, rest, label;
   if (entries && entries.length <= 5 && value.split(/\r?\n/).length <= 5) return '<pre class="parameter-value">' + escapeHTML(value) + '</pre>';
   if (entries && entries.length > 5) {
      preview = entries.slice(0,5).join(',\n');
      rest = entries.slice(5).join(',\n');
      label = 'Details — remaining ' + (entries.length-5) + ' entries';
   } else {
      var lines = value.split(/\r?\n/);
      if (lines.length > 5) {
         preview = lines.slice(0,5).join('\n'); rest = lines.slice(5).join('\n');
         label = 'Details — remaining ' + (lines.length-5) + ' lines';
      } else if (value.length > 300) {
         preview = value.slice(0,300) + '…'; rest = value.slice(300); label = 'Details — rest of value';
      } else return '<pre class="parameter-value">' + escapeHTML(value) + '</pre>';
   }
   return '<pre class="parameter-value">' + escapeHTML(preview) + '</pre><details class="parameter-details"><summary>' +
      escapeHTML(label) + '</summary><pre class="parameter-value">' + escapeHTML(rest) + '</pre></details>';
}

function integrationParameterTable(assignments) {
   var html = '<div class="table-scroll"><table class="integration-parameters"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>';
   for (var i = 0; i < assignments.length; ++i)
      html += '<tr><td data-no-i18n>' + escapeHTML(assignments[i][0]) + '</td><td>' + compactParameterValue(assignments[i][1]) + '</td></tr>';
   return html + '</tbody></table></div>';
}

function histogramExpression(row, input) {
   if (!row || row.length !== 5) throw new Error("Invalid histogram row");
   for (var i = 0; i < 5; ++i) if (!isFinite(row[i])) throw new Error("Invalid histogram value");
   var low = Number(row[0]), m = Number(row[1]), high = Number(row[2]);
   var rangeLow = Number(row[3]), rangeHigh = Number(row[4]);
   if (high < low || rangeHigh <= rangeLow) throw new Error("Invalid histogram range");
   var x = input;
   if (low !== 0 || high !== 1)
      x = 1 + (high-low) === 1 ? numberText(low) :
         "min(1,max(0,((" + x + ")-" + numberText(low) + ")/" + numberText(high-low) + "))";
   if (m !== 0.5) x = "mtf(" + numberText(m) + "," + x + ")";
   if (rangeLow !== 0 || rangeHigh !== 1)
      x = "((" + x + ")-(" + numberText(rangeLow) + "))/" + numberText(rangeHigh-rangeLow);
   return x;
}

var CURVE_CHANNELS = ["R", "G", "B", "K", "A", "L", "a", "b", "c", "H", "S"];
var CURVE_LABELS = ["Red", "Green", "Blue", "RGB/K", "Alpha", "CIE L*", "CIE a*", "CIE b*", "CIE c*", "Hue", "Saturation"];

function curveIsIdentity(points) {
   return points && points.length === 2 && points[0][0] === 0 && points[0][1] === 0 &&
      points[1][0] === 1 && points[1][1] === 1;
}

function curveType(proc, key, source) {
   var type = proc[key + "t"];
   var names = ["Linear", "CubicSpline", "AkimaSubsplines"];
   for (var i = 0; i < names.length; ++i)
      if (typeof proc[names[i]] === "number" && type === proc[names[i]]) return names[i];
   // Serialization names are stable across versions, without relying on enum numbers.
   var match = new RegExp("\\." + key + "t\\s*=\\s*[^;]*\\.(Linear|CubicSpline|AkimaSubsplines)\\s*;").exec(source);
   if (match) return match[1];
   throw new Error("Unknown interpolation for " + key);
}

function curveSegments(points, type) {
   var n = points.length, slopes = [], segments = [], i;
   if (n < 2 || points[0][0] !== 0 || points[n-1][0] !== 1) throw new Error("Invalid curve endpoints");
   for (i = 0; i < n; ++i) {
      if (!isFinite(points[i][0]) || !isFinite(points[i][1])) throw new Error("Invalid curve point");
      if (i < n-1) {
         var h = points[i+1][0]-points[i][0];
         if (h <= 0) throw new Error("Curve input points must increase");
         slopes.push((points[i+1][1]-points[i][1])/h);
      }
   }
   if (type === "AkimaSubsplines" && n < 5) type = "CubicSpline";
   var second = [], work = [], left = [], right = [];
   if (type === "CubicSpline") {
      second[0] = second[n-1] = work[0] = 0;
      for (i = 1; i < n-1; ++i) {
         var span = points[i+1][0]-points[i-1][0];
         var s = (points[i][0]-points[i-1][0])/span;
         var p = s*second[i-1]+2;
         second[i] = (s-1)/p;
         work[i] = (6*(slopes[i]-slopes[i-1])/span-s*work[i-1])/p;
      }
      for (i = n-2; i > 0; --i) second[i] = second[i]*second[i+1]+work[i];
   } else if (type === "AkimaSubsplines") {
      // Extended chord slopes and separate left/right tangents preserve Akima corners.
      var m = [3*slopes[0]-2*slopes[1], 2*slopes[0]-slopes[1]].concat(slopes);
      m.push(2*slopes[n-2]-slopes[n-3], 3*slopes[n-2]-2*slopes[n-3]);
      for (i = 0; i < n; ++i) {
         var f = Math.abs(m[i+1]-m[i]), e = Math.abs(m[i+3]-m[i+2])+f;
         left[i] = 1+e !== 1 ? m[i+1]+f*(m[i+2]-m[i+1])/e : m[i+1];
         right[i] = 1+e !== 1 ? left[i] : m[i+2];
      }
   } else if (type !== "Linear") throw new Error("Unsupported curve interpolation");
   for (i = 0; i < n-1; ++i) {
      var dx = points[i+1][0]-points[i][0], b = slopes[i], c = 0, d = 0;
      if (type === "CubicSpline") {
         b -= dx*(2*second[i]+second[i+1])/6;
         c = second[i]/2;
         d = (second[i+1]-second[i])/(6*dx);
      } else if (type === "AkimaSubsplines") {
         b = right[i];
         c = (3*slopes[i]-2*b-left[i+1])/dx;
         d = (b+left[i+1]-2*slopes[i])/(dx*dx);
      }
      segments.push({x:points[i][0], end:points[i+1][0], a:points[i][1], b:b, c:c, d:d});
   }
   return segments;
}

function curveValue(segments, x) {
   var i = 0;
   while (i < segments.length-1 && x >= segments[i].end) ++i;
   var s = segments[i], dx = x-s.x;
   return Math.min(1, Math.max(0, s.a+dx*(s.b+dx*(s.c+dx*s.d))));
}

function curveExpression(points, type, input) {
   if (curveIsIdentity(points)) return input;
   var segments = curveSegments(points, type), expression = "";
   for (var i = segments.length-1; i >= 0; --i) {
      var s = segments[i], dx = "((" + input + ")-" + numberText(s.x) + ")";
      var poly = "(" + numberText(s.a) + "+" + dx + "*(" + numberText(s.b) + "+" + dx +
         "*(" + numberText(s.c) + "+" + dx + "*" + numberText(s.d) + ")))";
      expression = expression ? "iif((" + input + ")<" + numberText(s.end) + "," + poly + "," + expression + ")" : poly;
   }
   return "min(1,max(0," + expression + "))";
}

function curveGraph(points, type) {
   var segments = curveSegments(points, type), path = "";
   for (var i = 0; i <= 160; ++i) {
      var x = i/160, y = curveValue(segments, x);
      path += (i ? " L" : "M") + (24+200*x).toFixed(2) + "," + (224-200*y).toFixed(2);
   }
   var svg = '<svg class="curve-graph" viewBox="0 0 248 248" role="img" aria-label="Input to Output curve">' +
      '<rect x="24" y="24" width="200" height="200" fill="#11111b" stroke="#45475a"/>' +
      '<path d="M24,224 L224,24" stroke="#585b70" stroke-dasharray="4 4" fill="none"/>' +
      '<path d="' + path + '" stroke="#89b4fa" stroke-width="2" fill="none"/>';
   for (i = 0; i < points.length; ++i)
      svg += '<circle cx="' + (24+200*points[i][0]) + '" cy="' + (224-200*points[i][1]) + '" r="3" fill="#fab387"/>';
   return svg + '<text x="105" y="243" fill="#cdd6f4">Input</text><text x="2" y="16" fill="#cdd6f4">Output</text></svg>';
}

function copyBlock(label, text) {
   return '<div class="copy-block"><b>' + escapeHTML(label) + '</b> <button type="button" onclick="copyCode(this)">Copy</button>' +
      '<textarea readonly spellcheck="false">' + escapeHTML(text) + '</textarea></div>';
}

function readableParameters(proc, source) {
   var name = getProcessName(proc), html = "";
   try {
      if (name === "HistogramTransformation") {
         var rows = [], labels = ["Red", "Green", "Blue", "RGB/K", "Alpha"];
         for (var i = 0; i < proc.H.length; ++i) rows.push([labels[i]].concat(proc.H[i]));
         return parameterTable(["Channel", "Shadows", "Midtones", "Highlights", "Range low", "Range high"], rows);
      }
      if (name === "CurvesTransformation") {
         for (var c = 0; c < CURVE_CHANNELS.length; ++c) {
            var key = CURVE_CHANNELS[c], points = proc[key];
            var identity = curveIsIdentity(points);
            var type = curveType(proc, key, source);
            html += '<details' + (identity ? '' : ' open') + '><summary>' + CURVE_LABELS[c] +
               ' — ' + type + (identity ? ' — unchanged' : ' — ' + points.length + ' points') + '</summary>';
            html += '<div class="curve-layout">' + curveGraph(points, type) + parameterTable(["Input (X)", "Output (Y)"], points, 5) + '</div></details>';
         }
         return html;
      }
      // Parse display-only assignments, never evaluate generated process code.
      var assignments = [], match, re = /\b\w+\.([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g;
      while ((match = re.exec(source)) !== null) assignments.push([match[1], match[2].trim()]);
      return assignments.length ? integrationParameterTable(assignments) : '<p>Parameters are shown in the full code below.</p>';
   } catch (e) {
      return html + '<p>Could not format parameters: ' + escapeHTML(e.message) + '</p>';
   }
}

function pixelMathSection(proc, source, isColor) {
   var name = getProcessName(proc);
   if (name !== "HistogramTransformation" && name !== "CurvesTransformation") return "";
   var html = '<details open><summary>PixelMath</summary>', expressions = [], labels = [];
   try {
      if (name === "HistogramTransformation") {
         if (!proc.H || proc.H.length < 4) throw new Error("The H table was not found.");
         if (isColor) {
            for (var c = 0; c < 3; ++c) {
               expressions.push(histogramExpression(proc.H[3], histogramExpression(proc.H[c], '$T[' + c + ']')));
               labels.push(["R", "G", "B"][c]);
            }
         } else { expressions.push(histogramExpression(proc.H[3], '$T')); labels.push('RGB/K'); }
         if (proc.H.length > 4 && String(proc.H[4]) !== '0,0.5,1,0,1')
            html += '<p>The Alpha transformation is not included in the RGB/K expressions.</p>';
      } else {
         if (isColor) {
            var unsupported = [];
            for (var j = 5; j < CURVE_CHANNELS.length; ++j)
               if (!curveIsIdentity(proc[CURVE_CHANNELS[j]])) unsupported.push(CURVE_LABELS[j]);
            if (unsupported.length) throw new Error('The full transformation for ' + unsupported.join(', ') +
               ' requires color space conversions. Use the original CurvesTransformation from the full code.');
         }
         var kt = curveType(proc, 'K', source);
         if (isColor) {
            for (var c = 0; c < 3; ++c) {
               var key = CURVE_CHANNELS[c];
               expressions.push(curveExpression(proc.K, kt, curveExpression(proc[key], curveType(proc, key, source), '$T[' + c + ']')));
               labels.push(key);
            }
         } else { expressions.push(curveExpression(proc.K, kt, '$T')); labels.push('RGB/K'); }
         if (!curveIsIdentity(proc.A)) html += '<p>The Alpha curve is not included in the RGB/K expressions.</p>';
      }
      html += '<p>Apply to the image <b>before this step</b>. ' + (isColor ?
         'Disable Use a single RGB/K expression and enter each expression in the R, G, B tabs.' :
         'Enter the expression in the RGB/K tab with Use a single RGB/K expression enabled.') +
         ' Rescale result: off · Truncate result: on [0,1]. A masked step requires the same mask and mask state.</p>';
      for (var i = 0; i < expressions.length; ++i) html += copyBlock(labels[i], expressions[i]);
      html += '<p>The expressions reproduce the mathematical transformation for values [0,1]. Rounding and the original process LUTs may cause small numerical differences.</p>';
   } catch (e) { html += '<p>' + escapeHTML(e.message) + '</p>'; }
   return html + '</details>';
}

function reportStyles() {
   var html = '';
   html += '.step-group{padding:14px;border:1px solid #45475a;border-radius:8px;margin-bottom:18px;scroll-margin-top:15px}.step-group>h3{margin:8px 0}.step-group>.comparison{max-width:440px;margin-bottom:12px}.step-group>details>.step-card{margin-top:12px}.step-group>details>summary{margin:10px 0}';
   html += '.graph-node.is-focused.is-selected rect{stroke:#f9e2af;stroke-width:3}#back_to_top{position:fixed;right:24px;bottom:24px;z-index:20;padding:12px 18px;box-shadow:0 4px 16px #0008}#back_to_top[hidden]{display:none}@media(max-width:700px){#back_to_top{right:12px;bottom:12px}}';
   html += '.graph-legend{display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0}.legend-item{display:inline-flex;align-items:center;gap:8px;font-size:13px}.graph-legend svg{flex:none}.graph-node,.edge{transition:opacity .15s,filter .15s}.graph-node.is-dimmed{opacity:.16;filter:blur(2px)}.edge.is-dimmed{opacity:.10;filter:blur(1px)}.graph-node.is-focused rect{stroke:#cba6f7;stroke-width:2}.parameter-value{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px Consolas,monospace;max-width:900px}.parameter-details{margin:8px 0 0}.parameter-details summary{font:12px sans-serif}.integration-parameters td{vertical-align:top;}';
   html += "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #181825; color: #cdd6f4; padding: 25px; margin: 0; }\n";
   html += "h1 { color: #89b4fa; border-bottom: 2px solid #313244; padding-bottom: 8px; font-size: 22px; margin-top: 0; }\n";
   html += ".meta-info { background: #1e1e2e; padding: 12px 18px; border-radius: 8px; border: 1px solid #313244; margin-bottom: 20px; font-size: 13px; color: #a6adc8; }\n";
   html += ".step-card { display: flex; background: #1e1e2e; border: 1px solid #313244; margin-bottom: 14px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }\n";
   html += ".thumb-box { width: 440px; min-width: 440px; background: #11111b; display: flex; align-items: center; justify-content: center; padding: 10px; border-right: 1px solid #313244; }\n";
   html += ".thumb-box img { max-width: min(400px, 100%); max-height: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.7); }\n";
   html += '.report-footer{margin-top:40px;padding:24px 12px;border-top:1px solid #313244;text-align:center;color:#a6adc8;font-size:13px}.report-footer a{color:#89b4fa;text-decoration:none}.report-footer a:hover{text-decoration:underline}@media(max-width:1000px){.step-card{flex-direction:column}.thumb-box{width:auto;min-width:0;border-right:0;border-bottom:1px solid #313244}}';
   html += ".details-box { padding: 14px 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }\n";
   html += ".step-num { font-size: 13px; font-weight: bold; color: #f5e0dc; text-transform: uppercase; letter-spacing: 1px; }\n";
   html += ".step-title { font-size: 17px; font-weight: bold; color: #89b4fa; margin: 4px 0 8px 0; }\n";
   html += ".params-text { font-size: 12px; color: #bac2de; background: #11111b; padding: 8px 12px; border-radius: 6px; font-family: 'Consolas', monospace; overflow-wrap: anywhere; white-space: pre-wrap; margin-top: 6px; }\n";
   html += ".badge-mask { background: #f38ba8; color: #11111b; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px; }\n";
   html += ".badge-project { background: #fab387; color: #11111b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 10px; }\n";
   html += ".mask-thumbnail { margin:12px 0; max-width:340px; } .mask-thumbnail img { max-width:220px; max-height:220px; border:1px solid #45475a; border-radius:6px; } .mask-thumbnail figcaption { margin-top:6px; color:#a6adc8; font-size:11px; line-height:1.5; } .mask-inverted { filter:invert(1); }\n";
   html += "table { border-collapse: collapse; margin: 10px 0; font-size: 13px; } th,td { border: 1px solid #45475a; padding: 7px 10px; text-align: left; white-space: pre-wrap; } th { color: #89b4fa; } .table-scroll { overflow-x: auto; } .details-box { min-width: 0; } details { margin: 12px 0; } summary { cursor: pointer; color: #89b4fa; } .curve-layout { display:flex; gap:16px; flex-wrap:wrap; align-items:center; } .curve-graph { width:248px; height:248px; } .thumb-box { flex-direction:column; gap:10px; } .thumb-note { font-size:11px; color:#a6adc8; } textarea { box-sizing:border-box; width:100%; min-height:100px; resize:vertical; background:#11111b; color:#cdd6f4; border:1px solid #45475a; padding:10px; font-family:Consolas,monospace; } button { cursor:pointer; background:#89b4fa; border:0; border-radius:4px; padding:5px 12px; margin:6px; } .copy-block { margin:12px 0; } @media(max-width:700px) { .step-card { flex-direction:column; } .thumb-box { width:auto; } }\n";
   return html;
}

function processingItems(container) {
   var result = [];
   if (container && typeof container.at === "function")
      for (var i = 0; i < container.length; ++i) result.push(container.at(i));
   return result;
}

function executionTime(proc) {
   try {
      var xml = proc.toSource("XPSM 1.0");
      var match = /<time\b[^>]*\bstart="([^"]+)"/.exec(xml);
      if (match && isFinite(Date.parse(match[1]))) return match[1];
   } catch (e) {}
   return "";
}

function collectWorkspaceRecord(window, index) {
   var view = window.mainView;
   var record = {window:window, view:view, id:view.fullId || view.id, anchor:"image_" + index,
      filePath:window.filePath || "", historyIndex:view.historyIndex, isColor:view.image.isColor,
      steps:[], error:"", initialNote:"", currentMaskInfo:currentMaskHTML(window),
      currentMaskThumbnail:null, currentMaskInverted:window.maskInverted, currentThumb:""};
   var containers = [], initial = null;
   try { initial = view.initialProcessing; } catch (e) {}
   if (initial && typeof initial.at === "function") containers.push({container:initial, phase:"initial"});
   else record.initialNote = "Initial state history is unavailable through the API.";
   try {
      var live = view.processing;
      if (!live || typeof live.at !== "function") throw new Error("View.processing unavailable");
      containers.push({container:live, phase:"live"});
   } catch (e) { record.error = e.message; }
   record.historySources = [];
   for (var c = 0; c < containers.length; ++c) {
      var group = containers[c], items = processingItems(group.container);
      var masks = readHistoryMasks(group.container, items.length);
      if (masks.source) record.historySources.push({phase:group.phase, source:masks.source});
      for (var i = 0; i < items.length; ++i) {
         var proc = items[i], number = record.steps.length;
         record.steps.push({proc:proc, source:getProcessParameters(proc), title:getProcessTitle(proc),
            phase:group.phase, liveIndex:group.phase === "live" ? i+1 : null,
            redo:group.phase === "live" && i+1 > record.historyIndex,
            time:executionTime(proc), mask:masks.steps[i], maskThumb:null,
            anchor:record.anchor + "_step_" + number, thumb:"", thumbNote:""});
      }
   }
   return record;
}

function collectWorkspaceThumbnails(records, thumbDir, relativeDir) {
   var masks = [], generatedFiles = [];
   // Freeze all current images/masks before navigating any image's history.
   for (var r = 0; r < records.length; ++r) {
      var record = records[r], filename = record.anchor + "_current.png";
      if (createThumbnailFromView(record.view, thumbDir + "/" + filename, 440)) {
         record.currentThumb = relativeDir + "/" + filename;generatedFiles.push(thumbDir+'/'+filename);
      }
      for (var i = 0; i < record.steps.length; ++i) {
         var step = record.steps[i];
         if (step.mask.status === "recorded")
            step.maskThumb = exportMaskThumbnail(step.mask.name, thumbDir, relativeDir, masks);
      }
      try {
         var mask = record.window.mask;
         if (mask && !mask.isNull && mask.mainView && !mask.mainView.isNull)
            record.currentMaskThumbnail = exportMaskThumbnail(mask.mainView.fullId || mask.mainView.id,
               thumbDir, relativeDir, masks, mask.mainView);
      } catch (e) { Console.writeln("Mask preview error: " + e.message); }
   }
   for (var r = 0; r < records.length; ++r) {
      var record = records[r];
      var states = {}, dimensions = {};
      var captureState = function(index, filename) {
         if (Object.prototype.hasOwnProperty.call(states, '$'+index)) return states['$'+index];
         try {
            if (record.view.historyIndex !== index) record.view.historyIndex = index;
            if (record.view.historyIndex !== index) return '';
            dimensions['$'+index] = {width:record.view.image.width,height:record.view.image.height};
            if (createThumbnailFromView(record.view, thumbDir + '/' + filename, 1200)) {
               generatedFiles.push(thumbDir+'/'+filename);
               return states['$'+index] = relativeDir + '/' + filename;
            }
         } catch (e) { Console.writeln(record.id + ' comparison state unavailable: ' + e.message); }
         states['$'+index] = '';
         return '';
      };
      try {
         for (var i = 0; i < record.steps.length; ++i) {
            var step = record.steps[i];
            step.thumb = record.currentThumb;
            step.thumbNote = "Current image — no pixels are available for this step.";
            step.beforeThumb = ''; step.afterThumb = '';
            if (step.phase === "initial") continue;
            step.beforeThumb = captureState(step.liveIndex-1, record.anchor + '_state_' + (step.liveIndex-1) + '.png');
            try {
               if (record.view.historyIndex !== step.liveIndex) record.view.historyIndex = step.liveIndex;
               if (record.view.historyIndex === step.liveIndex) {
                  var filename = step.anchor + ".png";
                  var after = states['$'+step.liveIndex] || captureState(step.liveIndex, filename);
                  if (after) {
                     step.thumb = step.afterThumb = after;
                     step.thumbNote = "Image after step " + step.liveIndex;
                     var beforeSize=dimensions['$'+(step.liveIndex-1)],afterSize=dimensions['$'+step.liveIndex];
                     if(beforeSize&&afterSize&&(beforeSize.width!==afterSize.width||beforeSize.height!==afterSize.height)) {
                        step.beforeThumb='';step.comparisonReason='Before/after comparison unavailable: image dimensions changed.';
                     }
                  }
               }
            } catch (e) { Console.writeln(record.id + " step image unavailable: " + e.message); }
         }
      } finally {
         if (record.view.historyIndex !== record.historyIndex) record.view.historyIndex = record.historyIndex;
         if (record.view.historyIndex !== record.historyIndex)
            throw new Error("Failed to restore history: " + record.id);
      }
   }
   for(var i=0;i<masks.length;++i)if(masks[i].src)generatedFiles.push(thumbDir+'/'+masks[i].src.slice(masks[i].src.lastIndexOf('/')+1));
   return generatedFiles;
}

function addReference(refs, name, kind, detail) {
   if (typeof name !== "string" || !name.trim()) return;
   name = name.trim();
   for (var i = 0; i < refs.length; ++i)
      if (refs[i].name === name && refs[i].kind === kind && refs[i].detail === detail) return;
   refs.push({name:name, kind:kind, detail:detail});
}

function imageReferences(step, records) {
   var proc = step.proc, name = getProcessName(proc), refs = [];
   if (step.mask.status === "recorded") addReference(refs, step.mask.name, "mask", "Historical mask");
   try {
      if (name === "ChannelCombination" || name === "LRGBCombination") {
         var labels = name === "LRGBCombination" ? ["R", "G", "B", "L"] : ["Channel 1", "Channel 2", "Channel 3"];
         for (var i = 0; i < proc.channels.length; ++i)
            if (proc.channels[i][0]) addReference(refs, proc.channels[i][1], "input", labels[i]);
      }
      if (name === "PixelMath") {
         // Only match known image IDs; unknown tokens could be functions or local symbols.
         var expressions = [proc.expression || ""];
         if (!proc.useSingleExpression) expressions.push(proc.expression1 || "", proc.expression2 || "");
         var symbols = {}, declaration;
         var symbolRE = /\b([A-Za-z_]\w*)\s*=/g;
         while ((declaration = symbolRE.exec(proc.symbols || "")) !== null) symbols["$" + declaration[1]] = true;
         for (var e = 0; e < expressions.length; ++e) {
            var text = expressions[e].replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
            var localRE = /\b([A-Za-z_]\w*)\s*=(?!=)/g;
            while ((declaration = localRE.exec(text)) !== null) symbols["$" + declaration[1]] = true;
            var token, tokenRE = /\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)?\b/g;
            while ((token = tokenRE.exec(text)) !== null) {
               if (text.charAt(token.index-1) === '$' || symbols["$" + token[0]] || text.slice(tokenRE.lastIndex).match(/^\s*\(/)) continue;
               for (var r = 0; r < records.length; ++r)
                  if (records[r].id === token[0]) addReference(refs, token[0], "input", "PixelMath expression " + (e+1));
            }
         }
         if (proc.createNewImage) addReference(refs, proc.newImageId, "output", "PixelMath newImageId");
      }
      if (name === "ChannelExtraction")
         for (var i = 0; i < proc.channels.length; ++i)
            if (proc.channels[i][0]) addReference(refs, proc.channels[i][1], "output", "ChannelExtraction");
      // Explicit ID parameters, rather than matching arbitrary text or filename similarity.
      var keys = ["referenceViewId", "referenceImageId", "sourceViewId", "sourceImageId", "maskViewId", "maskImageId"];
      for (var i = 0; i < keys.length; ++i)
         if (typeof proc[keys[i]] === "string") addReference(refs, proc[keys[i]], /mask/i.test(keys[i]) ? "mask" : "reference", keys[i]);
   } catch (e) { Console.writeln("Reference extraction error: " + e.message); }
   return refs;
}

function workspaceStepGroups(record) {
   var groups = [];
   var i = 0;
   while (i < record.steps.length) {
      var first = record.steps[i];
      var end = i + 1;
      if (getProcessTitle(first.proc).toLowerCase() === 'perfectpalettepicker') {
         while (end < record.steps.length && record.steps[end].redo === first.redo && getProcessTitle(record.steps[end].proc).toLowerCase() === 'perfectpalettepicker') {
            ++end;
         }
         if (end - i >= 2 && end < record.steps.length && record.steps[end].redo === first.redo && getProcessName(record.steps[end].proc) === 'PixelMath') {
            ++end;
         }
      }
      var members = record.steps.slice(i, end);
      var group = {anchor:members.length > 1 ? first.anchor + '_group' : first.anchor, members:members,
         title:members.length > 1 ? 'PerfectPalettePicker' : first.title};
      for (var m = 0; m < members.length; ++m) {
         members[m].groupAnchor = group.anchor;
         members[m].displayNumber = groups.length + 1;
         members[m].substepNumber = members.length > 1 ? m + 1 : 0;
      }
      groups.push(group);
      i = end;
   }
   record.displayGroups = groups;
   return groups;
}

function workspaceGraph(records) {
   var graph = {nodes:[], edges:[], unresolved:[]}, headerById = {};
   for (var r = 0; r < records.length; ++r) {
      var record = records[r];
      headerById["$" + record.id] = record.anchor;
      graph.nodes.push({id:record.anchor, image:record.id, label:record.id, x:24+r*290, y:30, header:true});
      var previous = record.anchor;
      var groups = workspaceStepGroups(record);
      for (var i = 0; i < groups.length; ++i) {
         var group = groups[i];
         var step = group.members[0];
         var memberIds = [], search = '', hasMask = false, time = '';
         for (var m = 0; m < group.members.length; ++m) {
            memberIds.push(group.members[m].anchor);
            search += ' ' + group.members[m].source + ' ' + (group.members[m].mask.name || '');
            hasMask = hasMask || group.members[m].mask.status === 'recorded';
            if (!time) time = group.members[m].time;
         }
         graph.nodes.push({id:group.anchor, memberIds:memberIds, image:record.id, label:(i+1) + ". " + group.title,
            x:24+r*290, y:160+i*105, header:false, time:time,
            tool:group.members.length > 1 ? 'PerfectPalettePicker' : getProcessName(step.proc), hasMask:hasMask,
            search:(record.id+' '+record.filePath+' '+group.title+search).toLowerCase(),
            phase:step.phase, redo:step.redo});
         graph.edges.push({from:previous, to:group.anchor, kind:"sequence", provenance:'recorded', detail:step.phase === "initial" ? "Initial state history" : "History sequence", redo:step.redo});
         previous = group.anchor;
      }
   }
   for (var r = 0; r < records.length; ++r)
      for (var i = 0; i < records[r].steps.length; ++i) {
         var step = records[r].steps[i], refs = imageReferences(step, records);
         step.references = refs;
         step.possibleInputs = [];
         for (var j = 0; j < refs.length; ++j) {
            var ref = refs[j], imageNode = headerById["$" + ref.name];
            if (ref.name === records[r].id) continue;
            if (!imageNode) { graph.unresolved.push({image:records[r].id, step:step.anchor, name:ref.name, detail:ref.detail}); continue; }
            graph.edges.push({from:ref.kind === "output" ? step.groupAnchor : imageNode,
               to:ref.kind === "output" ? imageNode : step.groupAnchor, kind:ref.kind, detail:ref.detail,
               provenance:ref.kind === 'mask' ? 'recorded' : 'parameter',
               uncertain:true, redo:step.redo});
         }
         var knownInput = false;
         for (var g = 0; g < records[r].steps.length; ++g) {
            if (records[r].steps[g].groupAnchor !== step.groupAnchor) continue;
            var groupRefs = imageReferences(records[r].steps[g], records);
            for (var j = 0; j < groupRefs.length; ++j) {
               if ((groupRefs[j].kind === 'input' || groupRefs[j].kind === 'reference') && headerById['$' + groupRefs[j].name]) knownInput = true;
            }
         }
         for (var j = 0; j < refs.length; ++j) {
            if ((refs[j].kind === 'input' || refs[j].kind === 'reference') && headerById['$' + refs[j].name]) {
               knownInput = true;
            }
         }
         if (!step.redo && !knownInput && getProcessTitle(step.proc).toLowerCase() === 'perfectpalettepicker') {
            for (var s = 0; s < records.length; ++s) {
               if (records[s].isOriginalInput && records[s].id !== records[r].id) {
                  step.possibleInputs.push(records[s].id);
                  var duplicate = false;
                  for (var e = 0; e < graph.edges.length; ++e) {
                     if (graph.edges[e].kind === 'possible' && graph.edges[e].from === records[s].anchor && graph.edges[e].to === step.groupAnchor) duplicate = true;
                  }
                  if (!duplicate) graph.edges.push({from:records[s].anchor, to:step.groupAnchor, kind:'possible', provenance:'possible',
                     detail:'User-selected original input; actual use by PerfectPalettePicker is unconfirmed', uncertain:true, redo:false});
               }
            }
         }
      }
   return graph;
}

function orderWorkspaceGraph(records, graph) {
   var pending = [];
   var ordered = [];
   var nodesById = {};
   var dependencies = {};
   var i, r, n, e;
   for (i = 0; i < records.length; ++i) {
      if (records[i].isOriginalInput) {
         ordered.push(records[i]);
      } else {
         pending.push(records[i]);
      }
   }
   for (n = 0; n < graph.nodes.length; ++n) {
      nodesById['$' + graph.nodes[n].id] = graph.nodes[n];
   }
   for (e = 0; e < graph.edges.length; ++e) {
      var edge = graph.edges[e];
      if (edge.redo || edge.kind === 'sequence' || edge.kind === 'possible') {
         continue;
      }
      var sourceNode = nodesById['$' + edge.from];
      var targetNode = nodesById['$' + edge.to];
      if (sourceNode && targetNode && sourceNode.image !== targetNode.image) {
         var key = '$' + targetNode.image;
         if (!dependencies[key]) {
            dependencies[key] = [];
         }
         dependencies[key].push(sourceNode.image);
      }
   }
   while (pending.length > 0) {
      var choice = -1;
      for (i = 0; i < pending.length; ++i) {
         var blocked = false;
         var inputs = dependencies['$' + pending[i].id] || [];
         for (var d = 0; d < inputs.length; ++d) {
            for (var p = 0; p < pending.length; ++p) {
               if (pending[p].id === inputs[d]) {
                  blocked = true;
               }
            }
         }
         if (!blocked) {
            if (choice < 0) {
               choice = i;
            } else if (!pending[choice].filePath && pending[i].filePath) {
               choice = i;
            }
         }
      }
      if (choice < 0) {
         choice = 0;
      }
      ordered.push(pending.splice(choice, 1)[0]);
   }
   for (r = 0; r < ordered.length; ++r) {
      for (n = 0; n < graph.nodes.length; ++n) {
         if (graph.nodes[n].image === ordered[r].id) {
            graph.nodes[n].x = 24 + r*290;
            if (graph.nodes[n].header) {
               graph.nodes[n].originalInput = !!ordered[r].isOriginalInput;
            }
         }
      }
   }
   return ordered;
}

function graphEdgePath(edge, nodes) {
   var a = null, b = null;
   for (var i = 0; i < nodes.length; ++i) {
      if (nodes[i].id === edge.from) a = nodes[i];
      if (nodes[i].id === edge.to) b = nodes[i];
   }
   if (!a || !b) return "";
   if (edge.kind === "sequence") return "M" + (a.x+125) + "," + (a.y+72) + " L" + (b.x+125) + "," + b.y;
   var ax = a.x+250, ay = a.y+36, bx = b.x, by = b.y+36;
   if (a.x > b.x) { ax = a.x; bx = b.x+250; }
   if (a.x === b.x) { bx = b.x+250; }
   var bend = Math.max(45, Math.abs(bx-ax)/2);
   return "M" + ax + "," + ay + " C" + (ax+bend) + "," + ay + " " + (bx-bend) + "," + by + " " + bx + "," + by;
}

function workspaceOverviewHTML(records, graph) {
   var height = 170, width = Math.max(310, records.length*290+35);
   for (var i = 0; i < graph.nodes.length; ++i) height = Math.max(height, graph.nodes[i].y+100);
   var html = '<section><h2>Image and process tree</h2><p>Each column represents an image. Solid lines show its history sequence. Dashed lines connect image/mask references; the exact historical version of the source image is unknown. This is not an absolute shared timeline.</p>';
   html+='<p>Original inputs appear first, followed by known dependencies where possible. Column order does not establish when files were opened or images were created.</p>';
   html += '<div class="graph-legend" aria-label="Line legend">';
   var legendKinds = ['sequence', 'input', 'mask', 'output', 'manual', 'possible'];
   var legendLabels = ['Sequence', 'Input / reference', 'Mask', 'Output', 'Your connection', 'Possible connection'];
   for (var l = 0; l < legendKinds.length; ++l)
      html += '<span class="legend-item"><svg width="64" height="16" viewBox="0 0 64 16" aria-hidden="true"><path class="edge edge-' + legendKinds[l] + '" d="M2,8 H60"/></svg>' + legendLabels[l] + '</span>';
   html += '</div><p>Hover highlights related images. Clicking filters the history and keeps the highlight. Click an empty area of the tree or select “All” to reset. Redo steps are not part of the current image.</p>';
   html += '<label class="zoom-control"><span>Zoom</span><input type="range" min="30" max="150" value="100" oninput="document.getElementById(\'workspace_graph\').style.width=(' + width + '*this.value/100)+\'px\'"></label>';
   html += '<div class="graph-scroll" onclick="graphBackgroundClick(event)"><svg id="workspace_graph" width="' + width + '" viewBox="0 0 ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg">';
   html += '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#a6adc8"/></marker></defs><g id="graph_edges">';
   for (var i = 0; i < graph.edges.length; ++i) {
      var edge = graph.edges[i];
      html += '<path tabindex="0" data-provenance="' + edge.provenance + '" data-from="' + edge.from + '" data-to="' + edge.to + '" class="edge edge-' + edge.kind + (edge.redo ? ' redo-edge' : '') + '" d="' + graphEdgePath(edge, graph.nodes) + '" marker-end="url(#arrow)"><title>' + escapeHTML(provenanceLabel(edge.provenance) + ': ' + edge.detail) + (edge.uncertain ? ' — unknown historical version' : '') + '</title></path>';
   }
   html += '</g><g id="manual_edges"></g>';
   for (var i = 0; i < graph.nodes.length; ++i) {
      var node = graph.nodes[i];
      var subtitle = 'Processing step';
      if (node.header) {
         subtitle = node.originalInput ? 'Original input (selected)' : 'Image / unknown source version';
      } else if (node.redo) {
         subtitle = 'Redo — not applied';
      } else if (node.phase === 'initial') {
         subtitle = 'Inherited / initial history';
      }
      html += '<a href="#' + node.id + '" onclick="selectGraphNode(\'' + node.id + '\',event)" onfocus="focusGraphImage(\'' + node.id + '\')" onblur="clearGraphFocus()"><g data-node="' + node.id + '" onmouseenter="focusGraphImage(\'' + node.id + '\')" onmouseleave="clearGraphFocus()" class="graph-node' + (node.redo ? ' redo-node' : '') + '">' +
         '<rect x="' + node.x + '" y="' + node.y + '" width="250" height="72" rx="8"/>' +
         '<title data-no-i18n>' + escapeHTML(node.label + (node.time ? ' — ' + node.time : '')) + '</title>' +
         '<text data-no-i18n x="' + (node.x+10) + '" y="' + (node.y+26) + '">' + escapeHTML(node.label.length > 31 ? node.label.slice(0,28)+'…' : node.label) + '</text>' +
         '<text class="graph-small" x="' + (node.x+10) + '" y="' + (node.y+50) + '">' + escapeHTML(subtitle) + '</text></g></a>';
   }
   html += '</svg></div>';
   html += '<details><summary>Add a connection that was not recorded in history</summary><p>Additional connections are your report annotations. Use Export to save them and Import when reopening the same report.</p><label>From <select id="manual_from">';
   var options = '';
   for (var i = 0; i < graph.nodes.length; ++i) options += '<option value="' + graph.nodes[i].id + '" data-no-i18n>' + escapeHTML(graph.nodes[i].image + ' — ' + graph.nodes[i].label) + '</option>';
   html += options + '</select></label> <label>To <select id="manual_to">' + options + '</select></label> <input id="manual_note" placeholder="e.g. SHO created from SII/Ha/OIII">';
   html += '<button onclick="addManualEdge()">Add</button><button onclick="exportManualEdges()">Export JSON</button><label>Import JSON <input type="file" accept=".json" onchange="importManualEdges(this)"></label><button onclick="clearManualEdges()">Clear annotations</button><p id="manual_status" aria-live="polite"></p></details>';
   if (graph.unresolved.length) {
      var rows = [];
      for (var i = 0; i < graph.unresolved.length; ++i) rows.push([graph.unresolved[i].image, graph.unresolved[i].name, graph.unresolved[i].detail]);
      html += '<details><summary>References to missing or renamed images (' + rows.length + ')</summary>' + parameterTable(['Image', 'Reference', 'Source'], rows) + '</details>';
   }
   var timed = [], missing = 0;
   for (var r = 0; r < records.length; ++r)
      for (var i = 0; i < records[r].steps.length; ++i) {
         var step = records[r].steps[i];
         if (step.time) timed.push({image:records[r].id, step:step, order:timed.length}); else ++missing;
      }
   timed.sort(function(a,b) { return Date.parse(a.step.time)-Date.parse(b.step.time) || a.order-b.order; });
   html += '<details><summary>Available execution times (' + timed.length + ' steps · ' + missing + ' without timestamps)</summary><p>Timestamps may be absent or refer to inherited steps. Matching timestamps do not prove the order between two images.</p>';
   var rows = [];
   for (var i = 0; i < timed.length; ++i) rows.push([timed[i].step.time, timed[i].image, timed[i].step.title, timed[i].step.redo ? 'Redo' : timed[i].step.phase]);
   html += parameterTable(['ISO timestamp', 'Image', 'Process', 'History'], rows) + '</details></section>';
   return html;
}

function provenanceLabel(kind) {
   if (kind === 'possible') return 'Possible connection (unconfirmed)';
   return kind === 'recorded' ? 'Recorded in history' : kind === 'parameter' ? 'Detected from parameters' : 'User annotation';
}

function comparisonHTML(step) {
   if (!step.beforeThumb || !step.afterThumb)
      return '<p class="comparison-unavailable">' + (step.comparisonReason || 'Before/after comparison unavailable: historical pixels are missing.') + '</p>';
   return '<div class="comparison" data-before="' + escapeHTML(step.beforeThumb) + '" data-after="' + escapeHTML(step.afterThumb) + '">' +
      '<div class="compare-stage"><img src="' + escapeHTML(step.afterThumb) + '" alt="After" loading="lazy">' +
      '<img class="compare-before" src="' + escapeHTML(step.beforeThumb) + '" alt="Before" loading="lazy">' +
      '<span class="compare-label before-label">Before</span><span class="compare-label after-label">After</span>' +
      '<span class="compare-divider" aria-hidden="true"><span>↔</span></span>' +
      '<input class="compare-slider" type="range" min="0" max="100" value="50" aria-label="Before / after" oninput="moveComparison(this)" onchange="moveComparison(this)"></div>' +
      '<button type="button" onclick="openComparison(this)">Enlarge comparison</button></div>';
}

function imageReportHTML(record, emit) {
   var groups = record.displayGroups || workspaceStepGroups(record);
   var html = '<section class="image-report" data-image="' + record.anchor + '" id="' + record.anchor + '"><h2 data-no-i18n>' + escapeHTML(record.id) + '</h2>';
   html += '<div class="meta-info">' + (record.currentThumb ? '<img class="image-snapshot" src="' + escapeHTML(record.currentThumb) + '" alt="Current image">' : '') +
      '<b>File:</b> ' + (record.filePath ? '<span data-no-i18n>' + escapeHTML(record.filePath) + '</span>' : 'No file path') + '<br><b>Total Process Steps:</b> ' + groups.length +
      (groups.length !== record.steps.length ? ' · <b>Original history entries:</b> ' + record.steps.length : '') +
      ' · Current history position: ' + record.historyIndex + '<br><b>Current mask:</b> ' + record.currentMaskInfo +
      maskThumbnailHTML(record.currentMaskThumbnail, record.currentMaskInverted) + '</div>';
   if (record.error || record.initialNote) html += '<p>' + escapeHTML(record.error || record.initialNote) + '</p>';
   if (!record.steps.length) html += '<p>No history steps were found for this image.</p>';
   if (emit) { emit(html); html = ''; }
   for (var i = 0; i < record.steps.length; ++i) {
      var step = record.steps[i];
      var groupStart = null, groupEnd = false;
      for (var g = 0; g < groups.length; ++g) {
         if (groups[g].members.length > 1) {
            if (groups[g].members[0] === step) groupStart = groups[g];
            if (groups[g].members[groups[g].members.length-1] === step) groupEnd = true;
         }
      }
      if (groupStart) {
         var finalMember = groupStart.members[groupStart.members.length-1];
         html += '<div class="step-group" id="' + groupStart.anchor + '"><div class="step-num">Step ' + step.displayNumber + ' of ' + groups.length + '</div><h3>PerfectPalettePicker</h3><p>Grouped from consecutive history entries; original records are preserved below.</p>' +
            comparisonHTML({beforeThumb:step.beforeThumb, afterThumb:finalMember.afterThumb}) +
            '<details open><summary>Show recorded component steps (' + groupStart.members.length + ')</summary>';
      }
      html += '<div class="step-card" id="' + step.anchor + '"><div class="thumb-box">' + (step.beforeThumb && step.afterThumb ? comparisonHTML(step) : (step.thumb ?
         '<img src="' + escapeHTML(step.thumb) + '" alt="' + escapeHTML(step.thumbNote) + '">' : 'Thumbnail unavailable — see PixInsight console') +
         comparisonHTML(step)) +
         '<div class="thumb-note">' + escapeHTML(step.thumbNote) + '<br>Without screen stretch (STF).</div></div><div class="details-box">';
      html += '<div class="step-num">' + (step.substepNumber ? 'Substep ' + step.displayNumber + '.' + step.substepNumber : 'Step ' + step.displayNumber + ' of ' + groups.length) + '</div><div class="step-title" data-no-i18n>' + escapeHTML(step.title) + '</div>';
      html += '<p class="thumb-note">' + (step.phase === 'initial' ? 'Initial state history — pixels for this step are unavailable.' :
         'Position ' + step.liveIndex + ' in history') + (step.redo ? ' [Redo / not applied at the current position]' : '') +
         (step.time ? ' · ' + escapeHTML(step.time) : ' · Execution time: not recorded') + '</p>';
      html += historyMaskHTML(step.mask, step.maskThumb);
      if (step.possibleInputs && step.possibleInputs.length) {
         html += '<p class="possible-info">Possible inputs from user-selected originals (unconfirmed): <span data-no-i18n>' + escapeHTML(step.possibleInputs.join(', ')) + '</span></p>';
      }
      if (step.references && step.references.length) {
         var rows = [];
         for (var j = 0; j < step.references.length; ++j) rows.push([step.references[j].name, step.references[j].kind, step.references[j].detail,
            provenanceLabel(step.references[j].kind === 'mask' ? 'recorded' : 'parameter') + ' — unknown historical version']);
         html += parameterTable(['Image reference', 'Role', 'Parameter', 'Connection origin'], rows);
      }
      html += replayStepHTML(record, step) + readableParameters(step.proc, step.source) + pixelMathSection(step.proc, step.source, record.isColor) +
         '<details><summary>Full process code / all parameters</summary>' + copyBlock('PixInsight JavaScript', step.source) + '</details></div></div>';
      if (groupEnd) html += '</details></div>';
      if (emit) { emit(html); html = ''; }
   }
   for (var i = 0; i < record.historySources.length; ++i) {
      html += '<details><summary>Full history code — ' + record.historySources[i].phase + '</summary>' + copyBlock('History ProcessContainer', record.historySources[i].source) + '</details>';
      if (emit) { emit(html); html = ''; }
   }
   if (emit) { emit(html + '</section>'); return ''; }
   return html + '</section>';
}

// Bound UTF-8 allocations and keep surrogate pairs intact between writes.
function writeReportText(file, text) {
   for (var start = 0; start < text.length;) {
      var end = Math.min(start + 65536, text.length);
      if (end < text.length) {
         var last = text.charCodeAt(end - 1);
         if (last >= 0xD800 && last <= 0xDBFF) --end;
      }
      file.write(ByteArray.stringToUTF8(text.substring(start, end)));
      start = end;
   }
}

function replayStepHTML(record, step) {
   var refs = step.references || [];
   var prefix = String.fromCharCode(47, 47) + ' ';
   var newline = String.fromCharCode(10);
   var lines = ['Image: ' + record.id, 'Step: ' + step.title,
      'Apply to an image in the state BEFORE this step. Use matching dimensions and color space.'];
   if (step.redo) lines.push('Redo step: not applied to the current image.');
   for (var i = 0; i < refs.length; ++i)
      lines.push(refs[i].kind + ': ' + refs[i].name + ' (' + refs[i].detail.replace(/[\r\n]/g, ' ') + '); historical source version unknown.');
   if (step.mask.status === 'recorded')
      lines.push('Enable mask ' + step.mask.name + '; inversion: ' + (step.mask.inverted === null ? 'UNKNOWN' : step.mask.inverted ? 'ON' : 'OFF') + '. Historical mask pixels are unavailable.');
   else lines.push('Mask: ' + (step.mask.status === 'unknown' ? 'historical information unavailable; verify manually.' : 'none recorded in the available history.'));
   lines.push('The original serialized process is below. Review its execution target and output settings before running.');
   var requirements = '';
   for (var i = 0; i < lines.length; ++i) requirements += prefix + lines[i] + newline;
   return '<details class="replay-step"><summary>Copy step for replay</summary><p>Replay requirements: use the image state before this step, matching reference images and the recorded mask state. Historical source and mask pixels may be unavailable. Review execution targets and output settings.</p>' + copyBlock('Process code with requirements', requirements + newline + step.source) + '</details>';
}

function processingSummaryHTML(records) {
   var inputs=[],combinations=[],masks=[],tools=[],toolCounts={},maskNames={},inputNames={};
   for(var r=0;r<records.length;++r)for(var i=0;i<records[r].steps.length;++i){
      var step=records[r].steps[i];if(step.redo)continue;
      var name=getProcessName(step.proc);toolCounts['$'+name]=(toolCounts['$'+name]||0)+1;
      if(/^(ChannelCombination|LRGBCombination|PixelMath)$/.test(name))combinations.push(records[r].id+' — '+step.title);
      if(step.mask.status==='recorded')maskNames['$'+step.mask.name]=step.mask.name;
      var refs=step.references||[];
      for(var j=0;j<refs.length;++j)if(refs[j].kind==='input'||refs[j].kind==='reference'){
         inputNames['$'+refs[j].name]=refs[j].name;
      }
   }
   for(var key in inputNames)inputs.push(inputNames[key]);
   for(var key in maskNames)masks.push(maskNames[key]);
   for(var key in toolCounts)tools.push(key.slice(1)+' × '+toolCounts[key]);
   var originals=[],opened=[];
   for(var r=0;r<records.length;++r){if(records[r].isOriginalInput)originals.push(records[r].id);else if(records[r].filePath)opened.push(records[r].id);}
   var rows=[['Original inputs (selected)',originals.join(', ')||'—'],['File-backed images (origin unconfirmed)',opened.join(', ')||'—'],['Referenced inputs',inputs.sort().join(', ')||'—'],['Channel combinations / PixelMath',combinations.join('\n')||'—'],['Historical masks',masks.sort().join(', ')||'—'],['Processes used',tools.sort().join(', ')||'—']];
   var html='<section class="processing-summary"><h2>Processing summary</h2><p>Overview of applied steps across the selected images. Input references do not establish a complete or absolute chronology. Select the final image explicitly.</p>'+parameterTable(['Category','Images / processes'],rows);
   html+='<label>Final image <select id="final_image" onchange="selectFinalImage(this.value)"><option value="">Not selected</option>';
   for(var r=0;r<records.length;++r)html+='<option data-no-i18n value="'+records[r].anchor+'">'+escapeHTML(records[r].id)+'</option>';
   html+='</select></label><div id="final_preview"></div><p>Final image selection is saved in this browser. It does not rewrite the HTML file.</p></section>';
   return html;
}

function embedReportThumbnails(records, directory, generatedFiles, emitAsset) {
   var cache={},files=[];
   var embed=function(src){
      if(!src||src.indexOf('data:')===0)return src;
      if(cache['$'+src])return cache['$'+src];
      var filename=src.slice(src.lastIndexOf('/')+1),path=directory+'/'+filename;
      files.push(path);
      var data = 'data:image/png;base64,'+File.readFile(path).toBase64();
      if (emitAsset) {
         var key = '#apa_asset_' + files.length;
         emitAsset(key, data);
         return cache['$'+src] = key;
      }
      return cache['$'+src] = data;
   };
   try {
      for(var r=0;r<records.length;++r){var record=records[r];
         record.currentThumb=embed(record.currentThumb);
         if(record.currentMaskThumbnail)record.currentMaskThumbnail.src=embed(record.currentMaskThumbnail.src);
         for(var i=0;i<record.steps.length;++i){var step=record.steps[i];
            step.thumb=embed(step.thumb);step.beforeThumb=embed(step.beforeThumb);step.afterThumb=embed(step.afterThumb);
            if(step.maskThumb)step.maskThumb.src=embed(step.maskThumb.src);
         }
      }
   } finally {
      if(generatedFiles)files=generatedFiles;
      for(var i=0;i<files.length;++i)try{File.remove(files[i]);}catch(e){Console.writeln('Temporary thumbnail cleanup: '+e.message);}
      try{File.removeDirectory(directory);}catch(e){Console.writeln('Temporary directory cleanup: '+e.message);}
   }
}

function showAboutDialog() {
   var dialog = new Dialog;
   dialog.windowTitle = "About AstroProcessAtlas";
   var label = new Label(dialog);
   label.useRichText = true;
   label.text = "<b>AstroProcessAtlas</b><br>Version: " + ASTROPROCESS_ATLAS_VERSION + "<br><br>Author: YoruHikari<br>https://www.yoruhikari.gr/";
   var website = new PushButton(dialog); website.text = "Visit website";
   website.onClick = function() { Dialog.openBrowser("https://www.yoruhikari.gr/"); };
   var close = new PushButton(dialog); close.text = "Close";
   close.onClick = function() { dialog.ok(); };
   var buttons = new HorizontalSizer;
   buttons.spacing = 8; buttons.add(website); buttons.addStretch(); buttons.add(close);
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 16; dialog.sizer.spacing = 12;
   dialog.sizer.add(label); dialog.sizer.add(buttons);
   dialog.adjustToContents(); dialog.execute();
}

function chooseWorkspaceWindows(windows) {
   var dialog = new Dialog;
   dialog.windowTitle = "AstroProcessAtlas — Select images";
   var label = new Label(dialog);
   label.text = "Select the images for your report. The list includes all open PixInsight images, including hidden/iconized images and images in other virtual workspaces.";
   label.wordWrapping = true;
   var sourceLabel=new Label(dialog);
   sourceLabel.text='Original input images: select only the actual starting images. Reopened images and edited exports are not selected automatically.';
   sourceLabel.wordWrapping=true;
   var sources=new TreeBox(dialog);sources.numberOfColumns=1;sources.headerVisible=false;sources.setMinSize(520,120);
   for (var s = 0; s < windows.length; ++s) {
      var sourceNode = new TreeBoxNode(sources);
      sourceNode.setText(0, windows[s].mainView.fullId || windows[s].mainView.id);
      sourceNode.checkable = true;
      sourceNode.checked = false;
   }
   var tree = new TreeBox(dialog);
   tree.numberOfColumns = 1;
   tree.headerVisible = false;
   tree.setMinSize(520, 280);
   for (var i = 0; i < windows.length; ++i) {
      var node = new TreeBoxNode(tree);
      node.setText(0, windows[i].mainView.fullId || windows[i].mainView.id);
      node.checkable = true;
      node.checked = true;
   }
   var all = new PushButton(dialog); all.text = "All";
   all.onClick = function() { for (var i = 0; i < tree.numberOfChildren; ++i) tree.child(i).checked = true; };
   var none = new PushButton(dialog); none.text = "None";
   none.onClick = function() { for (var i = 0; i < tree.numberOfChildren; ++i) tree.child(i).checked = false; };
   var ok = new PushButton(dialog); ok.text = "Generate report";
   ok.onClick = function() { dialog.ok(); };
   var cancel = new PushButton(dialog); cancel.text = "Cancel";
   cancel.onClick = function() { dialog.cancel(); };
   var about = new ToolButton(dialog);
   about.icon = dialog.scaledResource(":/icons/info.png");
   about.toolTip = "About";
   about.onClick = showAboutDialog;
   var buttons = new HorizontalSizer;
   buttons.spacing = 8; buttons.add(about); buttons.add(all); buttons.add(none); buttons.addStretch(); buttons.add(ok); buttons.add(cancel);
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 12; dialog.sizer.spacing = 10;
   var embed = new CheckBox(dialog);embed.text='Single HTML file (embed thumbnails)';embed.checked=true;
   dialog.sizer.add(label); dialog.sizer.add(tree, 100);dialog.sizer.add(sourceLabel);dialog.sizer.add(sources);dialog.sizer.add(embed); dialog.sizer.add(buttons);
   dialog.adjustToContents();
   if (!dialog.execute()) return [];
   var selected = [];
   for (var i = 0; i < windows.length; ++i) if (tree.child(i).checked) selected.push(windows[i]);
   selected.embedThumbnails=embed.checked;
   selected.originalInputIds=[];
   for(var i=0;i<windows.length;++i)if(tree.child(i).checked&&sources.child(i).checked)selected.originalInputIds.push(windows[i].mainView.fullId||windows[i].mainView.id);
   return selected;
}

function generateHistoryReport() {
   var available = ImageWindow.windows || [];
   if (!available.length && ImageWindow.activeWindow && !ImageWindow.activeWindow.isNull) available = [ImageWindow.activeWindow];
   if (!available.length) {
      new MessageBox("There are no open images in PixInsight.", "Error", ICON_ERROR, BUTTON_OK).execute(); return;
   }
   var windows = chooseWorkspaceWindows(available);
   if (!windows.length) return;
   var save = new SaveFileDialog;
   save.caption = "Save AstroProcessAtlas HTML";
   save.filters = [["HTML Files (*.html)", "*.html"]];
   save.initialPath = "AstroProcessAtlas_Report.html";
   if (!save.execute()) return;
   var path = save.fileName;
   var baseDir = File.extractDrive(path) + File.extractDirectory(path);
   var basename = File.extractName(path), thumbDir = baseDir + "/" + basename + "_thumbs";
   if(windows.embedThumbnails)thumbDir=(File.systemTempDirectory||baseDir)+'/YoruHikari_history_'+(new Date()).getTime()+'_'+Math.floor(Math.random()*1000000);
   if (typeof Directory !== "undefined") {
      if (!Directory.exists(thumbDir)) Directory.createDirectory(thumbDir);
   } else if (typeof File.createDirectory === "function") File.createDirectory(thumbDir);
   var records = [], total = 0;
   // Metadata and process instances are captured before any history navigation.
   for (var i = 0; i < windows.length; ++i) {
      var record=collectWorkspaceRecord(windows[i], i);record.isOriginalInput=false;
      for(var j=0;j<windows.originalInputIds.length;++j)if(windows.originalInputIds[j]===record.id)record.isOriginalInput=true;
      records.push(record);total += workspaceStepGroups(record).length;
   }
   var graph = workspaceGraph(records);
   records=orderWorkspaceGraph(records,graph);
   var thumbnailFiles=collectWorkspaceThumbnails(records, thumbDir, basename + "_thumbs");
   var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>AstroProcessAtlas</title><style>' + reportStyles() +
      'h2{color:#89b4fa} .graph-scroll{overflow:auto;max-height:760px;border:1px solid #45475a;margin:14px 0} #workspace_graph{display:block;height:auto;background:#11111b} .edge{fill:none;stroke:#89b4fa;stroke-width:1.8} .edge-input,.edge-reference{stroke:#f9e2af;stroke-dasharray:6 4} .edge-mask{stroke:#f38ba8;stroke-dasharray:6 4} .edge-output{stroke:#a6e3a1;stroke-dasharray:6 4} .edge-manual{stroke:#cba6f7;stroke-dasharray:4 3} .edge-possible{stroke:#94e2d5;stroke-dasharray:2 7;stroke-width:2} .possible-info{color:#94e2d5} .redo-edge,.redo-node{opacity:.45} .graph-node rect{fill:#1e1e2e;stroke:#45475a} .graph-node:hover rect{stroke:#89b4fa} .graph-node text{fill:#cdd6f4;font:13px sans-serif} .graph-node .graph-small{fill:#a6adc8;font-size:10px} .image-snapshot{max-width:160px;max-height:160px;display:block;margin-bottom:10px} .image-report{scroll-margin-top:15px} select,input{max-width:100%;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;padding:6px} .step-card{scroll-margin-top:15px} </style></head><body>';
   html += '<p><label>Language / Γλώσσα <select id="report_language" onchange="setReportLanguage(this.value)"><option value="en" data-no-i18n>English</option><option value="el" data-no-i18n>Ελληνικά</option></select></label></p>';
   html += '<h1>AstroProcessAtlas</h1><div class="meta-info"><b>Images:</b> ' + records.length + ' · <b>Total Process Steps:</b> ' + total + ' · ' + escapeHTML((new Date()).toLocaleString()) +
      '<p>Includes the selected open images and their available initial/recent history. Closed images, older mask versions and unrecorded connections cannot be recovered automatically. Image references are detected in PixelMath, ChannelCombination, LRGBCombination, ChannelExtraction, specific image ID parameters and masks. The same initial processing may appear in multiple images.</p></div>';
   html += processingSummaryHTML(records);
   var tools = [], seenTools = {};
   for (var n = 0; n < graph.nodes.length; ++n) if (!graph.nodes[n].header && !seenTools['$'+graph.nodes[n].tool]) {
      seenTools['$'+graph.nodes[n].tool] = true; tools.push(graph.nodes[n].tool);
   }
   tools.sort();
   html += '<div class="report-filters"><label>Search <input id="report_search" type="search" placeholder="Image, tool, mask or parameter" oninput="applyReportFilters()"></label> <label>Tool <select id="tool_filter" onchange="applyReportFilters()"><option value="all">All tools</option>';
   for (var t=0;t<tools.length;++t) html += '<option data-no-i18n value="' + escapeHTML(tools[t]) + '">' + escapeHTML(tools[t]) + '</option>';
   html += '</select></label> <label><input id="mask_filter" type="checkbox" onchange="applyReportFilters()">Steps with masks</label> <label><input id="applied_filter" type="checkbox" onchange="applyReportFilters()">Applied steps only</label> <button onclick="resetReportFilters()">Reset filters</button><p id="filter_status" aria-live="polite"></p></div>';
   html += '<p class="provenance-legend"><b>Connection origin:</b> Recorded in history · Detected from parameters · User annotation. Hover or focus a line for its origin and parameter. A recorded mask name does not identify its historical pixel version.</p>';
   html += workspaceOverviewHTML(records, graph);
   html += '<p><label>Show image history <select id="image_filter" onchange="showImage(this.value)"><option value="all">All</option>';
   for (var i = 0; i < records.length; ++i) html += '<option value="' + records[i].anchor + '" data-no-i18n>' + escapeHTML(records[i].id) + '</option>';
   html += '</select></label></p>';
   var file = new File;
   file.createForWriting(path);
   try {
   writeReportText(file, html); html = '';
   if (windows.embedThumbnails) {
      writeReportText(file, '<script>var reportEmbeddedAssets={};');
      embedReportThumbnails(records, thumbDir, thumbnailFiles, function(key, data) {
         writeReportText(file, 'reportEmbeddedAssets["' + key + '"]="');
         writeReportText(file, data);
         writeReportText(file, '";');
      });
      writeReportText(file, '</script>');
   }
   var emit = function(fragment) { writeReportText(file, fragment); };
   for (var i = 0; i < records.length; ++i) imageReportHTML(records[i], emit);
   html += '<footer class="report-footer"><a href="https://www.yoruhikari.gr/" target="_blank" rel="noopener noreferrer">© 2026 YoruHikari Astrophotography</a></footer>';
   html += '<button id="back_to_top" type="button" hidden onclick="scrollToReportTop()" aria-label="Back to top">↑ Back to top</button>';
   html += '<div id="comparison_dialog" role="dialog" aria-modal="true" aria-label="Before / after" hidden onclick="if(event.target===this)closeComparison()"><div class="comparison-panel"><button id="comparison_close" type="button" onclick="closeComparison()">Close</button><p>Preview up to 1200 pixels; without STF. Zoom and pan are shared by both images.</p><label class="zoom-control"><span>Zoom</span><input id="comparison_zoom" type="range" min="100" max="400" value="100" oninput="zoomComparison(this.value)" onchange="zoomComparison(this.value)"></label><div id="comparison_viewport"><div id="comparison_content"></div></div></div></div>';
   // Escape HTML delimiters in inline JSON: names/code must never close a script tag.
   html += '<style>.report-filters{padding:12px;border:1px solid #45475a;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.report-filters input[type=checkbox]{width:auto}.is-filtered,[hidden]{display:none!important}.compare-stage{position:relative;line-height:0}.compare-stage img{display:block;width:100%;max-width:none!important;max-height:none!important}.compare-before{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}.compare-label{position:absolute;top:10px;background:#111b;padding:5px;line-height:1.3;pointer-events:none}.before-label{left:8px}.after-label{right:8px}.comparison input[type=range]{width:100%;padding:0}.comparison-unavailable{font-size:12px;color:#f9e2af}#comparison_dialog{width:min(1100px,94vw);max-height:94vh;background:#181825;color:#cdd6f4;border:1px solid #89b4fa}#comparison_dialog::backdrop{background:#000b}#comparison_viewport{overflow:auto;max-height:70vh}#comparison_content{width:100%}#comparison_dialog .comparison{width:100%}#comparison_dialog .comparison>button{display:none}.edge:focus{stroke-width:4;outline:none}.provenance-legend{font-size:13px;color:#bac2de}</style>';
   html += '<style>.zoom-control{display:inline-flex;align-items:center;gap:10px;margin:8px 0}.zoom-control span{white-space:nowrap}.zoom-control input[type=range]{width:220px;max-width:55vw;margin:0;vertical-align:middle}.graph-node.is-tool-match rect,.graph-node.is-tool-match:hover rect{stroke:#fab387!important;stroke-width:3px!important}.compare-divider{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 3px #000;pointer-events:none;z-index:2}.compare-divider span{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;padding:10px;background:#181825;border:2px solid #fff;line-height:1;color:#fff}.comparison .compare-stage .compare-slider{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:ew-resize;z-index:3}.compare-stage:focus-within{outline:2px solid #fab387}.compare-label{z-index:4}#comparison_dialog{position:fixed;inset:0;z-index:10000;width:auto;max-height:none;background:#000b;border:0;padding:20px;display:flex;align-items:center;justify-content:center}.comparison-panel{background:#181825;border:1px solid #89b4fa;padding:16px;width:1100px;max-width:94vw;max-height:90vh;overflow:auto}#comparison_viewport{max-height:65vh}</style>';
   html += '<script>var workspaceGraphData=' + JSON.stringify(graph).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') + ';' + reportBrowserScript() + '</script></body></html>';
   writeReportText(file, html);
   } finally { file.close(); }
   new MessageBox("AstroProcessAtlas created.\nImages: " + records.length + " · Steps: " + total + "\n\n" + path, "Success", ICON_INFO, BUTTON_OK).execute();
}

var REPORT_TRANSLATIONS = [
   [
      "View.processing is unavailable in this version of PixInsight.",
      "Το View.processing δεν είναι διαθέσιμο σε αυτή την έκδοση του PixInsight."
   ],
   [
      "The mask image is closed or has been deleted.",
      "Η εικόνα της μάσκας δεν είναι ανοιχτή ή έχει διαγραφεί."
   ],
   [
      "Mask thumbnail creation failed — see the PixInsight console.",
      "Αποτυχία δημιουργίας thumbnail μάσκας — δες την κονσόλα του PixInsight."
   ],
   [
      "Preview of the available mask",
      "Προεπισκόπηση της διαθέσιμης μάσκας"
   ],
   [
      "inverted",
      "αντεστραμμένη"
   ],
   [
      "Current mask contents may differ from the version used when this step was applied.",
      "Τρέχον περιεχόμενο της μάσκας· μπορεί να διαφέρει από την έκδοσή της όταν εφαρμόστηκε το βήμα."
   ],
   [
      "Historical inversion is unknown; shown without inversion.",
      "Η ιστορική αντιστροφή είναι άγνωστη· εμφανίζεται χωρίς αντιστροφή."
   ],
   [
      "Historical mask",
      "Ιστορική μάσκα"
   ],
   [
      "inversion: not recorded",
      "αντιστροφή: δεν καταγράφηκε"
   ],
   [
      "not inverted",
      "κανονική (not inverted)"
   ],
   [
      "No mask was recorded for this step in the available history.",
      "Δεν καταγράφηκε μάσκα σε αυτό το βήμα στο διαθέσιμο ιστορικό."
   ],
   [
      "Historical mask information is unavailable for this step.",
      "Η ιστορική πληροφορία μάσκας για αυτό το βήμα δεν είναι διαθέσιμη."
   ],
   [
      "No mask is currently attached.",
      "Δεν υπάρχει συνδεδεμένη μάσκα τώρα."
   ],
   [
      "Current mask information is unavailable.",
      "Η τρέχουσα πληροφορία μάσκας δεν είναι διαθέσιμη."
   ],
   [
      "Could not retrieve parameters:",
      "Δεν ήταν δυνατή η ανάκτηση των παραμέτρων:"
   ],
   [
      "Details — remaining",
      "Λεπτομέρειες — υπόλοιπα"
   ],
   [
      "entries",
      "στοιχεία"
   ],
   [
      "lines",
      "γραμμές"
   ],
   [
      "Details — rest of value",
      "Λεπτομέρειες — συνέχεια τιμής"
   ],
   [
      "unchanged",
      "χωρίς αλλαγή"
   ],
   [
      "points",
      "σημεία"
   ],
   [
      "Parameters are shown in the full code below.",
      "Οι παράμετροι εμφανίζονται στον πλήρη κώδικα παρακάτω."
   ],
   [
      "Could not format parameters:",
      "Δεν ήταν δυνατή η μορφοποίηση:"
   ],
   [
      "The H table was not found.",
      "Δεν βρέθηκε ο πίνακας H."
   ],
   [
      "The Alpha transformation is not included in the RGB/K expressions.",
      "Η μεταβολή Alpha δεν περιλαμβάνεται στις εκφράσεις RGB/K."
   ],
   [
      "The full transformation for",
      "Η πλήρης μετατροπή για"
   ],
   [
      "requires color space conversions. Use the original CurvesTransformation from the full code.",
      "απαιτεί μετατροπές χρωματικού χώρου. Χρησιμοποίησε το αρχικό CurvesTransformation από τον πλήρη κώδικα."
   ],
   [
      "The Alpha curve is not included in the RGB/K expressions.",
      "Η καμπύλη Alpha δεν περιλαμβάνεται στις εκφράσεις RGB/K."
   ],
   [
      "Apply to the image",
      "Εφάρμοσε στην εικόνα"
   ],
   [
      "before this step",
      "πριν από αυτό το βήμα"
   ],
   [
      "Disable Use a single RGB/K expression and enter each expression in the R, G, B tabs.",
      "Απενεργοποίησε το Use a single RGB/K expression και βάλε κάθε έκφραση στην καρτέλα R, G, B."
   ],
   [
      "Enter the expression in the RGB/K tab with Use a single RGB/K expression enabled.",
      "Βάλε την έκφραση στην καρτέλα RGB/K με Use a single RGB/K expression."
   ],
   [
      "A masked step requires the same mask and mask state.",
      "Για masked βήμα χρειάζεται η ίδια μάσκα και κατάσταση μάσκας."
   ],
   [
      "The expressions reproduce the mathematical transformation for values [0,1]. Rounding and the original process LUTs may cause small numerical differences.",
      "Οι εκφράσεις αναπαράγουν τον μαθηματικό μετασχηματισμό για τιμές [0,1]. Η στρογγυλοποίηση και τα LUT του αρχικού process μπορούν να δώσουν μικρές αριθμητικές διαφορές."
   ],
   [
      "Initial state history is unavailable through the API.",
      "Το ιστορικό της αρχικής κατάστασης δεν είναι διαθέσιμο από το API."
   ],
   [
      "Current image — no pixels are available for this step.",
      "Τρέχουσα εικόνα — δεν υπάρχουν διαθέσιμα pixels για αυτό το βήμα."
   ],
   [
      "Image after step",
      "Εικόνα μετά το βήμα"
   ],
   [
      "Failed to restore history:",
      "Αποτυχία επαναφοράς ιστορικού:"
   ],
   [
      "Initial state history",
      "Ιστορικό αρχικής κατάστασης"
   ],
   [
      "History sequence",
      "Σειρά ιστορικού"
   ],
   [
      "Image and process tree",
      "Δέντρο εικόνων και βημάτων"
   ],
   [
      "Each column represents an image. Solid lines show its history sequence. Dashed lines connect image/mask references; the exact historical version of the source image is unknown. This is not an absolute shared timeline.",
      "Κάθε στήλη είναι μία εικόνα. Οι συνεχείς γραμμές δείχνουν τη σειρά του ιστορικού της. Οι διακεκομμένες συνδέουν αναφορές σε εικόνες/μάσκες: η ακριβής ιστορική έκδοση της εικόνας προέλευσης δεν είναι γνωστή. Δεν αποτελεί απόλυτη κοινή χρονογραμμή."
   ],
   [
      "Line legend",
      "Υπόμνημα γραμμών"
   ],
   [
      "Input / reference",
      "Είσοδος / αναφορά"
   ],
   [
      "Your connection",
      "Δική σου σύνδεση"
   ],
   [
      "Hover highlights related images. Clicking filters the history and keeps the highlight. Click an empty area of the tree or select “All” to reset. Redo steps are not part of the current image.",
      "Hover: ξεχωρίζουν οι συνδεδεμένες εικόνες. Κλικ: φιλτράρει το ιστορικό και κρατά την επισήμανση. Κλικ σε κενό σημείο του δέντρου ή επιλογή «Όλες»: επαναφορά. Τα βήματα Redo δεν ανήκουν στην τρέχουσα εικόνα."
   ],
   [
      "unknown historical version",
      "άγνωστη ιστορική έκδοση"
   ],
   [
      "Image / unknown source version",
      "Εικόνα / άγνωστη έκδοση πηγής"
   ],
   [
      "Redo — not applied",
      "Redo — μη εφαρμοσμένο"
   ],
   [
      "Inherited / initial history",
      "Κληρονομημένο / αρχικό ιστορικό"
   ],
   [
      "Processing step",
      "Βήμα επεξεργασίας"
   ],
   [
      "Add a connection that was not recorded in history",
      "Πρόσθεσε σύνδεση που δεν καταγράφηκε στο ιστορικό"
   ],
   [
      "Additional connections are your report annotations. Use Export to save them and Import when reopening the same report.",
      "Οι πρόσθετες συνδέσεις είναι δικές σου σημειώσεις στο report. Χρησιμοποίησε Export για να τις κρατήσεις και Import όταν ανοίξεις ξανά το ίδιο report."
   ],
   [
      "e.g. SHO created from SII/Ha/OIII",
      "π.χ. δημιουργία SHO από SII/Ha/OIII"
   ],
   [
      "Clear annotations",
      "Καθαρισμός σημειώσεων"
   ],
   [
      "References to missing or renamed images",
      "Αναφορές σε εικόνες που λείπουν ή έχουν μετονομαστεί"
   ],
   [
      "Available execution times",
      "Διαθέσιμοι χρόνοι εκτέλεσης"
   ],
   [
      "without timestamps",
      "χωρίς χρόνο"
   ],
   [
      "Timestamps may be absent or refer to inherited steps. Matching timestamps do not prove the order between two images.",
      "Οι χρόνοι μπορεί να απουσιάζουν ή να αφορούν κληρονομημένα βήματα. Ίδιος χρόνος δεν αποδεικνύει τη σειρά μεταξύ δύο εικόνων."
   ],
   [
      "ISO timestamp",
      "Χρόνος ISO"
   ],
   [
      "No file path",
      "Δεν υπάρχει διαδρομή αρχείου"
   ],
   [
      "Current image",
      "Τρέχουσα εικόνα"
   ],
   [
      "Current mask",
      "Τρέχουσα μάσκα"
   ],
   [
      "No history steps were found for this image.",
      "Δεν βρέθηκαν βήματα ιστορικού για αυτή την εικόνα."
   ],
   [
      "Without screen stretch (STF).",
      "Χωρίς screen stretch (STF)."
   ],
   [
      "pixels for this step are unavailable.",
      "τα pixels αυτού του βήματος δεν είναι διαθέσιμα."
   ],
   [
      "in history",
      "στο ιστορικό"
   ],
   [
      "not applied at the current position",
      "δεν έχει εφαρμοστεί στην τρέχουσα θέση"
   ],
   [
      "Execution time: not recorded",
      "Χρόνος εκτέλεσης: δεν καταγράφηκε"
   ],
   [
      "Image reference",
      "Αναφορά εικόνας"
   ],
   [
      "Full process code / all parameters",
      "Πλήρης κώδικας process / όλες οι παράμετροι"
   ],
   [
      "Full history code",
      "Πλήρης κώδικας ιστορικού"
   ],
   [
      "Includes the selected open images and their available initial/recent history. Closed images, older mask versions and unrecorded connections cannot be recovered automatically. Image references are detected in PixelMath, ChannelCombination, LRGBCombination, ChannelExtraction, specific image ID parameters and masks. The same initial processing may appear in multiple images.",
      "Περιλαμβάνονται οι επιλεγμένες ανοιχτές εικόνες και το διαθέσιμο αρχικό/νεότερο ιστορικό τους. Κλειστές εικόνες, παλιές εκδόσεις μάσκας και συνδέσεις που δεν καταγράφηκαν δεν μπορούν να ανακτηθούν αυτόματα. Αναφορές εικόνων εντοπίζονται σε PixelMath, ChannelCombination, LRGBCombination, ChannelExtraction, συγκεκριμένες παραμέτρους image ID και μάσκες. Η ίδια αρχική επεξεργασία μπορεί να εμφανίζεται σε περισσότερες από μία εικόνες."
   ],
   [
      "Show image history",
      "Προβολή ιστορικού εικόνας"
   ],
   [
      "Back to top",
      "Επιστροφή στην κορυφή"
   ],
   [
      "User annotation:",
      "Σημείωση χρήστη:"
   ],
   [
      "user connections. Use Export JSON to save.",
      "συνδέσεις χρήστη. Χρειάζεται Export JSON για αποθήκευση."
   ],
   [
      "Select two different nodes.",
      "Επίλεξε δύο διαφορετικούς κόμβους."
   ],
   [
      "User connection",
      "Σύνδεση χρήστη"
   ],
   [
      "These annotations belong to a different report.",
      "Οι σημειώσεις ανήκουν σε διαφορετικό report."
   ],
   [
      "Invalid connection.",
      "Μη έγκυρη σύνδεση."
   ],
   [
      "Could not read the file.",
      "Δεν ήταν δυνατή η ανάγνωση του αρχείου."
   ],
   [
      "disabled",
      "ανενεργή"
   ],
   [
      "enabled",
      "ενεργή"
   ],
   [
      "normal",
      "κανονική"
   ],
   [
      "Sequence",
      "Σειρά"
   ],
   [
      "Mask",
      "Μάσκα"
   ],
   [
      "Output",
      "Έξοδος"
   ],
   [
      "From",
      "Από"
   ],
   [
      "To",
      "Προς"
   ],
   [
      "Add",
      "Προσθήκη"
   ],
   [
      "Image",
      "Εικόνα"
   ],
   [
      "Reference",
      "Αναφορά"
   ],
   [
      "Source",
      "Πηγή"
   ],
   [
      "History",
      "Ιστορικό"
   ],
   [
      "Position",
      "Θέση"
   ],
   [
      "Role",
      "Ρόλος"
   ],
   [
      "Parameter",
      "Παράμετρος"
   ],
   [
      "steps",
      "βήματα"
   ],
   [
      "All",
      "Όλες"
   ],
   [
      "Value",
      "Τιμή"
   ],
   [
      "Copy",
      "Αντιγραφή"
   ],
   [
      "Copied",
      "Αντιγράφηκε"
   ],
   [
      "Selected — Ctrl+C",
      "Επιλέχθηκε — Ctrl+C"
   ],
   [
      "Images:",
      "Εικόνες:"
   ],
   [
      "Total Process Steps:",
      "Σύνολο βημάτων:"
   ],
   [
      "Current history position:",
      "Τρέχουσα θέση ιστορικού:"
   ],
   [
      "File:",
      "Αρχείο:"
   ],
   [
      "Thumbnail unavailable — see PixInsight console",
      "Μη διαθέσιμο thumbnail — δες την κονσόλα του PixInsight"
   ],
   [
      "Channel",
      "Κανάλι"
   ],
   [
      "Shadows",
      "Σκιές"
   ],
   [
      "Midtones",
      "Μεσαίοι τόνοι"
   ],
   [
      "Highlights",
      "Φωτεινοί τόνοι"
   ],
   [
      "Range low",
      "Κάτω όριο εύρους"
   ],
   [
      "Range high",
      "Άνω όριο εύρους"
   ],
   [
      "Input (X)",
      "Είσοδος (X)"
   ],
   [
      "Output (Y)",
      "Έξοδος (Y)"
   ],
   [
      "Input",
      "Είσοδος"
   ],
   [
      "Export JSON",
      "Εξαγωγή JSON"
   ],
   [
      "Import JSON",
      "Εισαγωγή JSON"
   ]
];

REPORT_TRANSLATIONS = REPORT_TRANSLATIONS.concat([
   ['Substep','Υποβήμα'],['Original history entries:','Αρχικές εγγραφές ιστορικού:'],
   ['Grouped from consecutive history entries; original records are preserved below.','Ομαδοποίηση από διαδοχικές εγγραφές ιστορικού· οι αρχικές εγγραφές διατηρούνται παρακάτω.'],['Show recorded component steps','Προβολή επιμέρους καταγεγραμμένων βημάτων'],
   ['Possible connection','Πιθανή σύνδεση'],['Possible connection (unconfirmed)','Πιθανή σύνδεση (μη επιβεβαιωμένη)'],
   ['User-selected original input; actual use by PerfectPalettePicker is unconfirmed','Αρχική εικόνα επιλεγμένη από τον χρήστη· η πραγματική χρήση της από το PerfectPalettePicker δεν έχει επιβεβαιωθεί'],
   ['Possible inputs from user-selected originals (unconfirmed):','Πιθανές είσοδοι από τις επιλεγμένες αρχικές εικόνες (μη επιβεβαιωμένες):'],
   ['Original input (selected)','Αρχική εικόνα (επιλεγμένη)'],['Original inputs appear first, followed by known dependencies where possible. Column order does not establish when files were opened or images were created.','Οι αρχικές εικόνες εμφανίζονται πρώτες και ακολουθούν οι γνωστές εξαρτήσεις όπου είναι δυνατό. Η σειρά των στηλών δεν αποδεικνύει πότε ανοίχτηκαν αρχεία ή δημιουργήθηκαν εικόνες.'],
   ['Original inputs (selected)','Αρχικές εικόνες (επιλεγμένες)'],['File-backed images (origin unconfirmed)','Εικόνες με αρχείο (μη επιβεβαιωμένη προέλευση)'],
   ['Processing summary','Σύνοψη επεξεργασίας'],['Overview of applied steps across the selected images. Input references do not establish a complete or absolute chronology. Select the final image explicitly.','Σύνοψη των εφαρμοσμένων βημάτων στις επιλεγμένες εικόνες. Οι αναφορές εισόδου δεν τεκμηριώνουν πλήρη ή απόλυτη χρονολογική σειρά. Επίλεξε την τελική εικόνα.'],
   ['Referenced inputs','Αναφορές εισόδου'],['Channel combinations / PixelMath','Συνδυασμοί καναλιών / PixelMath'],['Historical masks','Ιστορικές μάσκες'],['Processes used','Εργαλεία που χρησιμοποιήθηκαν'],['Category','Κατηγορία'],['Images / processes','Εικόνες / εργαλεία'],['Final image','Τελική εικόνα'],['Not selected','Δεν επιλέχθηκε'],
   ['Final image selection is saved in this browser. It does not rewrite the HTML file.','Η επιλογή τελικής εικόνας αποθηκεύεται σε αυτόν τον browser. Δεν αλλάζει το αρχείο HTML.'],
   ['Copy step for replay','Αντιγραφή βήματος για επανάληψη'],['Process code with requirements','Κώδικας process με προϋποθέσεις'],
   ['Replay requirements: use the image state before this step, matching reference images and the recorded mask state. Historical source and mask pixels may be unavailable. Review execution targets and output settings.','Προϋποθέσεις επανάληψης: χρησιμοποίησε την κατάσταση της εικόνας πριν από το βήμα, τις αντίστοιχες εικόνες αναφοράς και την καταγεγραμμένη κατάσταση μάσκας. Τα ιστορικά pixels εισόδου και μάσκας μπορεί να μην είναι διαθέσιμα. Έλεγξε τους στόχους εκτέλεσης και τις ρυθμίσεις εξόδου.'],
   ['Before / after','Πριν / μετά'],['Before','Πριν'],['After','Μετά'],['Enlarge comparison','Μεγέθυνση σύγκρισης'],
   ['Before/after comparison unavailable: historical pixels are missing.','Η σύγκριση πριν/μετά δεν είναι διαθέσιμη: λείπουν ιστορικά pixels.'],
   ['Before/after comparison unavailable: image dimensions changed.','Η σύγκριση πριν/μετά δεν είναι διαθέσιμη: άλλαξαν οι διαστάσεις της εικόνας.'],
   ['Preview up to 1200 pixels; without STF. Zoom and pan are shared by both images.','Προεπισκόπηση έως 1200 pixels, χωρίς STF. Η μεγέθυνση και η μετακίνηση είναι κοινές για τις δύο εικόνες.'],
   ['Zoom','Μεγέθυνση'],['Close','Κλείσιμο'],['Search','Αναζήτηση'],['Tool','Εργαλείο'],['All tools','Όλα τα εργαλεία'],
   ['Image, tool, mask or parameter','Εικόνα, εργαλείο, μάσκα ή παράμετρος'],['Steps with masks','Βήματα με μάσκα'],
   ['Applied steps only','Μόνο εφαρμοσμένα βήματα'],['Reset filters','Επαναφορά φίλτρων'],['matching steps','βήματα που ταιριάζουν'],
   ['Connection origin','Προέλευση σύνδεσης'],['Recorded in history','Καταγεγραμμένη στο ιστορικό'],
   ['Detected from parameters','Εντοπισμένη από παραμέτρους'],['User annotation','Σημείωση χρήστη'],
   ['Hover or focus a line for its origin and parameter. A recorded mask name does not identify its historical pixel version.',
    'Με hover ή εστίαση σε γραμμή βλέπεις την προέλευση και την παράμετρό της. Το καταγεγραμμένο όνομα μάσκας δεν προσδιορίζει την ιστορική έκδοση των pixels της.']
]);

function reportBrowserScript() {
   return 'var reportTranslations=' + JSON.stringify(REPORT_TRANSLATIONS).replace(/</g, '\\u003c') + ';try{(' + WORKSPACE_BROWSER_SOURCE + ')();}catch(error){var status=document.getElementById("filter_status");if(status)status.textContent="Report controls failed: "+error.message;}';
}

// Browser code is embedded as text: PJSR must not parse or reserialize browser-only JavaScript.
var WORKSPACE_BROWSER_SOURCE = [
   "function workspaceBrowserMain() {",
   "   if(typeof reportEmbeddedAssets!=='undefined'){",
   "      var assets=document.querySelectorAll('[src],[href],[data-before],[data-after]');",
   "      for(var ai=0;ai<assets.length;++ai)for(var aj=0;aj<4;++aj){",
   "         var attribute=['src','href','data-before','data-after'][aj],asset=assets[ai].getAttribute(attribute);",
   "         if(asset&&reportEmbeddedAssets[asset])assets[ai].setAttribute(attribute,reportEmbeddedAssets[asset]);",
   "      }",
   "   }",
   "   window.addEventListener('error',function(event){",
   "      var status=document.getElementById('filter_status');",
   "      if(status)status.textContent='Report controls failed: '+(event.message||'Unknown error');",
   "   });",
   "   var reportLanguage = 'en';",
   "   function translated(text) {",
   "      if (reportLanguage === 'en') return text;",
   "      var pairs = reportTranslations.slice().sort(function(a,b){return b[0].length-a[0].length;});",
   "      // Replace in one pass so translated text cannot be translated a second time.",
   "      var pattern = pairs.map(function(p){return p[0].replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');}).join('|');",
   "      return text.replace(new RegExp('\\\\b(?:'+pattern+')(?![A-Za-z])','g'),function(match){for(var i=0;i<pairs.length;++i)if(pairs[i][0]===match)return pairs[i][1];return match;})",
   "         .replace(/Step (\\d+) of (\\d+)/g,'\u0392\u03ae\u03bc\u03b1 $1 \u03b1\u03c0\u03cc $2')",
   "         .replace(/\u039b\u03b5\u03c0\u03c4\u03bf\u03bc\u03ad\u03c1\u03b5\u03b9\u03b5\u03c2 \u2014 \u03c5\u03c0\u03cc\u03bb\u03bf\u03b9\u03c0\u03b1 (\\d+) \u03b3\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2/g,'\u039b\u03b5\u03c0\u03c4\u03bf\u03bc\u03ad\u03c1\u03b5\u03b9\u03b5\u03c2 \u2014 \u03c5\u03c0\u03cc\u03bb\u03bf\u03b9\u03c0\u03b5\u03c2 $1 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2');",
   "   }",
   "   window.setReportLanguage = function(language) {",
   "      reportLanguage = language === 'el' ? 'el' : 'en';",
   "      document.documentElement.lang = reportLanguage;",
   "      var walker = document.createTreeWalker(document.body,4), node;",
   "      while ((node=walker.nextNode())) {",
   "         var parent=node.parentElement;",
   "         if(!parent || parent.closest('script,style,textarea,pre,[data-no-i18n]'))continue;",
   "         if(node._lastTranslation !== node.nodeValue)node._englishText=node.nodeValue;",
   "         node.nodeValue=translated(node._englishText);node._lastTranslation=node.nodeValue;",
   "      }",
   "      var elements=document.querySelectorAll('[title],[alt],[placeholder],[aria-label]');",
   "      for(var i=0;i<elements.length;++i) {",
   "         if(elements[i].closest('[data-no-i18n]'))continue;",
   "         var attrs=['title','alt','placeholder','aria-label'];",
   "         for(var j=0;j<attrs.length;++j)if(elements[i].hasAttribute(attrs[j])) {",
   "            var key='_english_'+attrs[j];",
   "            if(elements[i][key]===undefined)elements[i][key]=elements[i].getAttribute(attrs[j]);",
   "            elements[i].setAttribute(attrs[j],translated(elements[i][key]));",
   "         }",
   "      }",
   "      var selector=document.getElementById('report_language');if(selector)selector.value=reportLanguage;",
   "   };",
   "   var selectedNode = null;",
   "   window.selectFinalImage=function(id){",
   "      var section=id?document.getElementById(id):null,preview=document.getElementById('final_preview');",
   "      if(!preview)return;while(preview.firstChild)preview.removeChild(preview.firstChild);",
   "      if(section){var image=section.querySelector('.image-snapshot');if(image)preview.appendChild(image.cloneNode(true));}",
   "      var select=document.getElementById('final_image');if(select)select.value=section?id:'';",
   "      try{window.localStorage.setItem('YoruHikari_final_'+window.location.href,section?id:'');}catch(e){}",
   "   };",
   "   var searchSelectedImage = null;",
   "   function searchedImage() {",
   "      var query=filterValue('report_search').trim().toLowerCase();",
   "      if(!query)return null;",
   "      for(var i=0;i<nodes.length;++i)if(nodes[i].header&&nodes[i].image.toLowerCase()===query)return nodes[i];",
   "      return null;",
   "   }",
   "   function filterValue(id) { var element=document.getElementById(id);return element?element.value:''; }",
   "   function filterChecked(id) { var element=document.getElementById(id);return !!(element&&element.checked); }",
   "   function matchesFilter(node) {",
   "      var query=filterValue('report_search').trim().toLowerCase(),tool=filterValue('tool_filter');",
   "      if(tool&&tool!=='all'&&node.tool!==tool)return false;",
   "      if(filterChecked('mask_filter')&&!node.hasMask)return false;",
   "      if(filterChecked('applied_filter')&&node.redo)return false;",
   "      var words=query.split(/\\s+/);",
   "      for(var i=0;i<words.length;++i)if(words[i]&&(node.search||node.image.toLowerCase()).indexOf(words[i])<0)return false;",
   "      return true;",
   "   }",
   "   window.applyReportFilters = function() {",
   "      var image=searchedImage();",
   "      if(image){searchSelectedImage=image.id;if(filterValue('image_filter')!==image.id){window.showImage(image.id,true);return;}}",
   "      else if(searchSelectedImage){searchSelectedImage=null;window.showImage('all',true);return;}",
   "      var matching={},count=0,imageID=filterValue('image_filter')||'all';",
   "      for(var i=0;i<nodes.length;++i)if(!nodes[i].header&&matchesFilter(nodes[i])) {",
   "         matching[nodes[i].id]=true;",
   "         var members=nodes[i].memberIds||[];for(var m=0;m<members.length;++m)matching[members[m]]=true;",
   "         var header=null;for(var j=0;j<nodes.length;++j)if(nodes[j].header&&nodes[j].image===nodes[i].image)header=nodes[j];",
   "         if(imageID==='all'||(header&&header.id===imageID))++count;",
   "      }",
   "      var cards=document.querySelectorAll('.step-card');",
   "      for(var i=0;i<cards.length;++i)cards[i].hidden=!matching[cards[i].id];",
   "      var containers=document.querySelectorAll('.step-group');for(var i=0;i<containers.length;++i)containers[i].hidden=!matching[containers[i].id];",
   "      var groups=document.querySelectorAll('#workspace_graph .graph-node'),visible={};",
   "      for(var i=0;i<groups.length;++i){var node=find(groups[i].getAttribute('data-node'));",
   "         if(!node)continue;",
   "         var imageMatches=imageID==='all';",
   "         for(var j=0;j<nodes.length;++j)if(nodes[j].header&&nodes[j].id===imageID&&nodes[j].image===node.image)imageMatches=true;",
   "         var tool=filterValue('tool_filter');",
   "         groups[i].classList.toggle('is-tool-match',!!(!node.header&&tool&&tool!=='all'&&node.tool===tool&&imageMatches&&matching[node.id]));",
   "         // Preserve the chronology; use highlighting rather than removing graph processes.",
   "         visible[node.id]=true;groups[i].classList.remove('is-filtered');",
   "      }",
   "      var paths=document.querySelectorAll('#workspace_graph path[data-from]');",
   "      for(var i=0;i<paths.length;++i)paths[i].classList.toggle('is-filtered',!visible[paths[i].getAttribute('data-from')]||!visible[paths[i].getAttribute('data-to')]);",
   "      var result=document.getElementById('filter_status');",
   "      if(result){var text=count+' matching steps';result.textContent=translated(text);if(result.firstChild){result.firstChild._englishText=text;result.firstChild._lastTranslation=result.firstChild.nodeValue;}}",
   "   };",
   "   window.resetReportFilters = function(){",
   "      var search=document.getElementById('report_search'),tool=document.getElementById('tool_filter');",
   "      if(search)search.value='';if(tool)tool.value='all';",
   "      var mask=document.getElementById('mask_filter'),applied=document.getElementById('applied_filter');",
   "      if(mask)mask.checked=false;if(applied)applied.checked=false;window.showImage('all');",
   "   };",
   "   window.moveComparison=function(input){",
   "      var comparison=input.closest('.comparison'),image=comparison.querySelector('.compare-before');",
   "      image.style.clipPath='inset(0 '+(100-Number(input.value))+'% 0 0)';",
   "      var divider=comparison.querySelector('.compare-divider');if(divider)divider.style.left=Number(input.value)+'%';",
   "   };",
   "   var comparisonTrigger=null,previousBodyOverflow='';",
   "   window.openComparison=function(button){",
   "      var comparison=button.closest('.comparison'),dialog=document.getElementById('comparison_dialog');",
   "      var content=document.getElementById('comparison_content');",
   "      while(content.firstChild)content.removeChild(content.firstChild);",
   "      var clone=comparison.cloneNode(true);",
   "      // DOM cloning omits our translation caches. Restore English before localizing the clone.",
   "      function restoreEnglish(original,copy) {",
   "         if(original.nodeType===3&&original._englishText!==undefined)copy.nodeValue=original._englishText;",
   "         var attrs=['title','alt','placeholder','aria-label'];",
   "         if(copy.setAttribute)for(var a=0;a<attrs.length;++a)if(original['_english_'+attrs[a]]!==undefined)",
   "            copy.setAttribute(attrs[a],original['_english_'+attrs[a]]);",
   "         for(var c=0;c<original.childNodes.length;++c)restoreEnglish(original.childNodes[c],copy.childNodes[c]);",
   "      }",
   "      restoreEnglish(comparison,clone);",
   "      content.appendChild(clone);content.style.width='100%';",
   "      document.getElementById('comparison_zoom').value=100;",
   "      var viewport=document.getElementById('comparison_viewport');viewport.scrollTop=viewport.scrollLeft=0;",
   "      comparisonTrigger=button;previousBodyOverflow=document.body.style?document.body.style.overflow:'';",
   "      dialog.hidden=false;if(dialog.removeAttribute)dialog.removeAttribute('hidden');",
   "      if(document.body.style)document.body.style.overflow='hidden';",
   "      window.setReportLanguage(reportLanguage);",
   "      var close=document.getElementById('comparison_close');if(close&&close.focus)close.focus();",
   "   };",
   "   window.closeComparison=function(){var dialog=document.getElementById('comparison_dialog');",
   "      if(dialog.setAttribute)dialog.setAttribute('hidden','');",
   "      dialog.hidden=true;",
   "      if(document.body.style)document.body.style.overflow=previousBodyOverflow;",
   "      if(comparisonTrigger&&comparisonTrigger.focus)comparisonTrigger.focus();",
   "   };",
   "   window.zoomComparison=function(value){document.getElementById('comparison_content').style.width=Number(value)+'%';};",
   "   window.showImage = function(id,fromSearch) {",
   "      var node=id==='all'?null:find(id);",
   "      if(id!=='all'&&(!node||!node.header))return;",
   "      if(!fromSearch&&(searchSelectedImage||searchedImage())){",
   "         var search=document.getElementById('report_search');if(search)search.value=node?node.image:'';",
   "         searchSelectedImage=node?node.id:null;",
   "      }",
   "      selectedNode=node?node.id:null;",
   "      var sections = document.querySelectorAll('.image-report');",
   "      for (var i=0;i<sections.length;++i) sections[i].hidden = id !== 'all' && sections[i].getAttribute('data-image') !== id;",
   "      var filter=document.getElementById('image_filter');if(filter)filter.value=id;",
   "      window.clearGraphFocus();",
   "      window.applyReportFilters();",
   "   };",
   "   window.selectGraphNode = function(id,event) {",
   "      var node=find(id);if(!node)return;",
   "      if(event)event.stopPropagation();",
   "      for(var i=0;i<nodes.length;++i)if(nodes[i].header&&nodes[i].image===node.image){",
   "         window.showImage(nodes[i].id);selectedNode=id;paintGraphFocus(id);break;",
   "      }",
   "   };",
   "   window.graphBackgroundClick = function(event) {",
   "      if(event.target.closest&&event.target.closest('[data-node], a, path[data-from]'))return;",
   "      window.showImage('all');",
   "   };",
   "   window.copyCode = function(button) {",
   "      var t=button.parentNode.querySelector('textarea'); t.focus(); t.select(); t.setSelectionRange(0,t.value.length);",
   "      function done(){button.textContent=translated('Copied');setTimeout(function(){button.textContent=translated('Copy');},1500);}",
   "      function fallback(){try{if(document.execCommand('copy')){done();return;}}catch(e){}button.textContent=translated('Selected \u2014 Ctrl+C');}",
   "      if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t.value).then(done,fallback); else fallback();",
   "   };",
   "   var manual = [], ns = 'http://www.w3.org/2000/svg', nodes = workspaceGraphData.nodes;",
   "   function find(id){for(var i=0;i<nodes.length;++i)if(nodes[i].id===id)return nodes[i];return null;}",
   "   var activeFocus = null;",
   "   function paintGraphFocus(id) {",
   "      var active=find(id);if(!active)return;",
   "      activeFocus=id;",
   "      var related={};related['$'+active.image]=true;",
   "      var edges=workspaceGraphData.edges.concat(manual);",
   "      for(var i=0;i<edges.length;++i){",
   "         var a=find(edges[i].from),b=find(edges[i].to);if(!a||!b)continue;",
   "         if(a.image===active.image)related['$'+b.image]=true;",
   "         if(b.image===active.image)related['$'+a.image]=true;",
   "      }",
   "      var groups=document.querySelectorAll('#workspace_graph .graph-node');",
   "      for(var i=0;i<groups.length;++i){",
   "         var node=find(groups[i].getAttribute('data-node'));",
   "         groups[i].classList.toggle('is-dimmed',!!node&&!related['$'+node.image]);",
   "         groups[i].classList.toggle('is-focused',!!node&&node.image===active.image);",
   "         groups[i].classList.toggle('is-selected',!!node&&node.id===selectedNode);",
   "      }",
   "      var paths=document.querySelectorAll('#workspace_graph path[data-from]');",
   "      for(var i=0;i<paths.length;++i){",
   "         var a=find(paths[i].getAttribute('data-from')),b=find(paths[i].getAttribute('data-to'));",
   "         var visible=a&&b&&(a.image===active.image||b.image===active.image||",
   "            (a.image===b.image&&related['$'+a.image]));",
   "         paths[i].classList.toggle('is-dimmed',!visible);",
   "      }",
   "   }",
   "   window.focusGraphImage = function(id) { paintGraphFocus(selectedNode || id); };",
   "   window.clearGraphFocus = function() {",
   "      if(selectedNode){paintGraphFocus(selectedNode);return;}",
   "      activeFocus=null;",
   "      var items=document.querySelectorAll('#workspace_graph .is-dimmed, #workspace_graph .is-focused, #workspace_graph .is-selected');",
   "      for(var i=0;i<items.length;++i){items[i].classList.remove('is-dimmed');items[i].classList.remove('is-focused');items[i].classList.remove('is-selected');}",
   "   };",
   "   function status(text){var el=document.getElementById('manual_status');el.textContent=translated(text);if(el.firstChild){el.firstChild._englishText=text;el.firstChild._lastTranslation=el.firstChild.nodeValue;}}",
   "   function draw(){",
   "      var group=document.getElementById('manual_edges');while(group.firstChild)group.removeChild(group.firstChild);",
   "      for(var i=0;i<manual.length;++i){",
   "         var edge=manual[i],a=find(edge.from),b=find(edge.to);if(!a || !b)continue;",
   "         var path=document.createElementNS(ns,'path'),ax=a.x+250,ay=a.y+36,bx=b.x,by=b.y+36;",
   "         if(a.x>b.x){ax=a.x;bx=b.x+250;}if(a.x===b.x)bx=b.x+250;",
   "         var bend=Math.max(45,Math.abs(bx-ax)/2);",
   "         path.setAttribute('d','M'+ax+','+ay+' C'+(ax+bend)+','+ay+' '+(bx-bend)+','+by+' '+bx+','+by);",
   "         path.setAttribute('class','edge edge-manual');path.setAttribute('marker-end','url(#arrow)');",
   "         path.setAttribute('data-from',edge.from);path.setAttribute('data-to',edge.to);",
   "         path.setAttribute('data-provenance','manual');path.setAttribute('tabindex','0');",
   "         var title=document.createElementNS(ns,'title');title.setAttribute('data-no-i18n','');title.textContent=translated('User annotation: ')+edge.detail;path.appendChild(title);group.appendChild(path);",
   "      }",
   "      status(manual.length+' user connections. Use Export JSON to save.');",
   "      if(activeFocus)window.focusGraphImage(activeFocus);",
   "      window.applyReportFilters();",
   "   }",
   "   window.addManualEdge=function(){",
   "      var from=document.getElementById('manual_from').value,to=document.getElementById('manual_to').value;",
   "      if(from===to){status('Select two different nodes.');return;}",
   "      manual.push({from:from,to:to,detail:document.getElementById('manual_note').value||'User connection'});draw();",
   "   };",
   "   window.clearManualEdges=function(){manual=[];draw();};",
   "   window.exportManualEdges=function(){",
   "      var identities=nodes.map(function(n){return{id:n.id,image:n.image,label:n.label};});",
   "      var blob=new Blob([JSON.stringify({version:1,nodes:identities,edges:manual},null,2)],{type:'application/json'});",
   "      var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='workspace_history_links.json';link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);",
   "   };",
   "   window.importManualEdges=function(input){",
   "      if(!input.files.length)return;var reader=new FileReader();",
   "      reader.onload=function(){try{",
   "         var data=JSON.parse(reader.result),identities=nodes.map(function(n){return{id:n.id,image:n.image,label:n.label};});",
   "         if(data.version!==1 || !Array.isArray(data.edges) || JSON.stringify(data.nodes)!==JSON.stringify(identities))throw Error('These annotations belong to a different report.');",
   "         var edges=[];for(var i=0;i<data.edges.length;++i){var e=data.edges[i];if(!find(e.from)||!find(e.to)||e.from===e.to||typeof e.detail!=='string')throw Error('Invalid connection.');edges.push({from:e.from,to:e.to,detail:e.detail});}",
   "         manual=edges;draw();",
   "      }catch(e){status('Import: '+e.message);}};",
   "      reader.onerror=function(){status('Could not read the file.');};reader.readAsText(input.files[0]);",
   "   };",
   "   var topButton=document.getElementById('back_to_top');",
   "   function updateTopButton(){if(topButton)topButton.hidden=(window.scrollY||window.pageYOffset||0)<500;}",
   "   window.scrollToReportTop=function(){",
   "      var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;",
   "      window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});",
   "   };",
   "   if(topButton){window.addEventListener('scroll',updateTopButton,{passive:true});updateTopButton();}",
   "   window.addEventListener('keydown',function(event){",
   "      var dialog=document.getElementById('comparison_dialog');",
   "      if((event.key==='Escape'||event.keyCode===27)&&dialog&&!dialog.hidden)window.closeComparison();",
   "      if((event.key==='Enter'||event.keyCode===13)&&event.target&&event.target.id==='report_search')window.applyReportFilters();",
   "   });",
   "   window.applyReportFilters();",
   "   try{var savedFinal=window.localStorage.getItem('YoruHikari_final_'+window.location.href);if(savedFinal)window.selectFinalImage(savedFinal);}catch(e){}",
   "}"
].join("\n");

generateHistoryReport();
