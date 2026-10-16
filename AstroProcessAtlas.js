#feature-id    Utilities > AstroProcessAtlas
#feature-icon  AstroProcessAtlas.svg
#feature-info  Generates workspace history reports with image dependencies, masks, comparisons, process parameters and workflow replay export.

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
#include <pjsr/CryptographicHash.jsh>

var ASTROPROCESS_ATLAS_VERSION = "0.4.0";

function createReportProgress() {
   var dialog = null, label = null, bar = null, value = 0;
   if (typeof Control !== 'undefined' && typeof Graphics !== 'undefined') {
      dialog = new Dialog;
      dialog.windowTitle = 'AstroProcessAtlas — Export progress';
      label = new Label(dialog);
      label.text = 'Preparing report…';
      bar = new Control(dialog);
      bar.setFixedSize(440, 18);
      bar.onPaint = function() {
         var g = new Graphics(this);
         g.fillRect(0, 0, this.width, this.height, new Brush(0xff45475a));
         g.fillRect(0, 0, Math.round(this.width * value / 100), this.height, new Brush(0xff89b4fa));
         g.end();
      };
      dialog.sizer = new VerticalSizer;
      dialog.sizer.margin = 16; dialog.sizer.spacing = 10;
      dialog.sizer.add(label); dialog.sizer.add(bar);
      dialog.adjustToContents(); dialog.show();
   }
   return {
      update:function(percent, text) {
         value = Math.max(value, Math.min(100, Math.floor(percent)));
         if (label) { label.text = value + '% — ' + text; bar.update(); }
         if (typeof processEvents === 'function') processEvents();
      },
      close:function() { if (dialog) dialog.hide(); }
   };
}

var ICON_ERROR = (typeof StdIcon_Error !== "undefined") ? StdIcon_Error : 4;
var ICON_INFO = (typeof StdIcon_Information !== "undefined") ? StdIcon_Information : 2;
var BUTTON_OK = (typeof StdButton_Ok !== "undefined") ? StdButton_Ok : 0x00000400;

function captureAtlasImageStatistics(image) {
   var result={version:1,available:false,method:'uniform-grid',grid:64,rawPixels:true,alphaExcluded:true,channels:[]};
   if(!image||typeof image.sample!=='function'||!image.width||!image.height){result.reason='Image samples unavailable';return result;}
   try{
      result.width=image.width;result.height=image.height;result.isColor=!!image.isColor;
      var count=image.isColor?3:1,nx=Math.min(64,image.width),ny=Math.min(64,image.height);result.gridWidth=nx;result.gridHeight=ny;
      if('bitsPerSample' in image)result.bitsPerSample=image.bitsPerSample;
      for(var c=0;c<count;++c){var values=[],sum=0,black=0,white=0,invalid=0;
         for(var y=0;y<ny;++y)for(var x=0;x<nx;++x){var value=image.sample(Math.min(image.width-1,Math.floor((x+0.5)*image.width/nx)),Math.min(image.height-1,Math.floor((y+0.5)*image.height/ny)),c);if(typeof value!=='number'||!isFinite(value)){invalid++;continue;}values.push(value);sum+=value;if(value<=0)black++;if(value>=1)white++;}
         if(!values.length)throw Error('No finite image samples');values.sort(function(a,b){return a-b;});var quantile=function(p){var index=(values.length-1)*p,lo=Math.floor(index),fraction=index-lo;return values[lo]+(values[Math.min(lo+1,values.length-1)]-values[lo])*fraction;},median=quantile(0.5),mean=sum/values.length,variance=0,deviations=[];
         for(var i=0;i<values.length;++i){variance+=(values[i]-mean)*(values[i]-mean);deviations.push(Math.abs(values[i]-median));}deviations.sort(function(a,b){return a-b;});var mid=(deviations.length-1)/2,mad=(deviations[Math.floor(mid)]+deviations[Math.ceil(mid)])/2;
         result.channels.push({channel:image.isColor?['R','G','B'][c]:'K',samples:values.length,invalidSamples:invalid,mean:mean,median:median,p01:quantile(0.01),p10:quantile(0.1),p90:quantile(0.9),p99:quantile(0.99),minimum:values[0],maximum:values[values.length-1],stddev:Math.sqrt(variance/values.length),mad:mad,blackFraction:black/values.length,whiteFraction:white/values.length});
      }result.available=true;
   }catch(error){result.channels=[];result.reason=String(error.message);}
   return result;
}
function atlasImageStatisticsHTML(statistics) {
   if(!statistics)return '';var before=statistics.before,after=statistics.after,validBefore=before&&before.available,validAfter=after&&after.available;
   if(!validBefore&&!validAfter)return '<details><summary>Recorded image statistics</summary><p>Historical pixel statistics unavailable for this step.</p></details>';
   var compatible=validBefore&&validAfter&&before.width===after.width&&before.height===after.height&&before.channels.length===after.channels.length,rows=[],channels=validAfter?after.channels:before.channels,metrics=[['median','Median'],['mean','Mean'],['p01','P01'],['p10','P10'],['p90','P90'],['p99','P99'],['minimum','Sample minimum'],['maximum','Sample maximum'],['stddev','Standard deviation'],['mad','Median absolute deviation'],['blackFraction','Samples at or below 0'],['whiteFraction','Samples at or above 1']];
   for(var c=0;c<channels.length;++c)for(var m=0;m<metrics.length;++m){var key=metrics[m][0],b=validBefore&&before.channels[c]&&before.channels[c].channel===channels[c].channel?before.channels[c][key]:null,a=validAfter&&after.channels[c]&&after.channels[c].channel===channels[c].channel?after.channels[c][key]:null,percentage=key==='blackFraction'||key==='whiteFraction',format=function(value){return value===null?'—':percentage?(100*value).toFixed(3)+'%':Number(value).toPrecision(6);};rows.push([channels[c].channel,metrics[m][1],format(b),format(a),compatible&&b!==null&&a!==null?format(a-b):'—']);}
   return '<details class="image-statistics"><summary>Recorded image statistics</summary><p>Estimates from up to 4096 uniformly sampled raw pixels per channel, before any preview stretch. Alpha is excluded. MAD measures image spread, not a noise estimate. These are recorded statistics, not predictions for edited replay steps.</p><p>Before: '+(validBefore?before.width+' × '+before.height:'unavailable')+' · After: '+(validAfter?after.width+' × '+after.height:'unavailable')+(compatible?'':' · Delta unavailable: missing or incompatible image states.')+'</p>'+parameterTable(['Channel','Statistic','Before','After','Delta'],rows)+'</details>';
}
function previewAppearance(image) {
   var info = {state:'unknown', auto:false, black:0, midtones:0.5};
   if (!image || typeof image.sample !== 'function' || !image.width || !image.height) return info;
   try{
   var samples=[], channels=image.isColor?3:1, side=32;
   for(var y=0;y<side;++y)for(var x=0;x<side;++x){
      var value=0;
      for(var c=0;c<channels;++c)value+=image.sample(Math.min(image.width-1,Math.floor((x+0.5)*image.width/side)),Math.min(image.height-1,Math.floor((y+0.5)*image.height/side)),c)/channels;
      if(isFinite(value))samples.push(Math.max(0,Math.min(1,value)));
   }
   if(!samples.length)return info;
   samples.sort(function(a,b){return a-b;});
   var median=samples[Math.floor(samples.length/2)], high=samples[Math.floor(samples.length*0.9)];
   info.state=median<0.025&&high<0.15?'dark':'visible';
   info.median=median;
   if(info.state==='dark'&&samples[samples.length-1]>0){
      var deviations=[];for(var i=0;i<samples.length;++i)deviations.push(Math.abs(samples[i]-median));
      deviations.sort(function(a,b){return a-b;});
      info.black=Math.max(0,median-2.8*1.4826*deviations[Math.floor(deviations.length/2)]);
      var normalized=(median||high||samples[samples.length-1]*0.1)-info.black;
      normalized/=1-info.black;
      // The same transform is used for RGB, preserving relative channel balance.
      if(normalized>0&&normalized<1){info.midtones=(0.25-1)*normalized/((2*0.25-1)*normalized-0.25);info.auto=true;}
   }
   return info;
   }catch(error){Console.writeln('Preview statistics unavailable: '+error.message);return {state:'unknown',auto:false};}
}

function previewAppearanceHTML(info) {
   if(!info)return '<span class="appearance-badge">Stretch state: unknown</span>';
   var label=info.gameMask?'GAME mask — stretched':info.stretchRecorded?'Nonlinear stretch recorded in history':info.state==='dark'?'Likely linear / dark (estimated)':info.state==='visible'?'Visible image — stretch state unconfirmed':'Stretch state: unknown';
   return '<span class="appearance-badge">'+label+'</span>'+(info.auto?'<span class="appearance-badge">Auto-stretched preview only</span>':'');
}

function recordedNonlinearStretch(record,index) {
   for(var i=0;i<record.steps.length;++i){
      var step=record.steps[i];if(step.phase==='live'&&step.liveIndex>index)continue;
      if(getProcessName(step.proc)!=='HistogramTransformation')continue;
      try{var rows=step.proc.H;for(var c=0;rows&&c<Math.min(4,rows.length);++c)if(rows[c]&&rows[c].length>=5&&typeof rows[c][1]==='number'&&rows[c][1]!==0.5)return true;}catch(e){}
   }
   return false;
}

function recordedGameMask(record,index) {
   if(record.replayOrigin&&record.replayOrigin.game===true)return true;
   var steps=record.cloneFullSteps||record.steps;
   for(var i=0;i<steps.length;++i){var step=steps[i];if(step.phase==='live'&&step.liveIndex>index)continue;if(/^GAME$/i.test(getProcessTitle(step.proc)))return true;}
   return false;
}

function historyPreviewAppearance(record,index) {
   if(recordedGameMask(record,index))return {state:'mask',gameMask:true,auto:false,black:0,midtones:0.5};
   var appearance=previewAppearance(record.view.image);appearance.stretchRecorded=recordedNonlinearStretch(record,index);return appearance;
}

function createThumbnailFromView(view, outputPath, maxSize, appearance) {
   var preview=null;
   try {
      var bitmap;
      if(appearance&&appearance.auto&&typeof Image==='function'){
         var source=view.image,scale=Math.min(1,maxSize/source.width,maxSize/source.height);
         var width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale)),channels=source.isColor?3:1;
         preview=new Image(width,height,channels,source.colorSpace,32,1);
         var rect=new Rect(0,0,width,height);
         var xs=[],ys=[];
         for(var x=0;x<width;++x)xs.push(Math.min(source.width-1,Math.floor((x+0.5)*source.width/width)));
         for(var y=0;y<height;++y)ys.push(Math.min(source.height-1,Math.floor((y+0.5)*source.height/height)));
         var bulk=typeof source.getSamples==='function'&&source.width<=1048576,row=bulk?new Float32Array(source.width):null;
         for(var c=0;c<channels;++c){
            var values=new Float32Array(width*height);
            for(var y=0;y<height;++y){
               if(bulk)source.getSamples(row,new Rect(0,ys[y],source.width,ys[y]+1),c);
               for(var x=0;x<width;++x){
                  var value=bulk?row[xs[x]]:source.sample(xs[x],ys[y],c);
                  value=Math.max(0,Math.min(1,(value-appearance.black)/(1-appearance.black)));
                  var m=appearance.midtones;
                  values[y*width+x]=value===0?0:value===1?1:(m-1)*value/((2*m-1)*value-m);
               }
            }
            preview.setSamples(values,rect,c);
         }
         bitmap=preview.render();
      }else bitmap=view.image.render();
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
   }finally{if(preview)try{preview.free();}catch(e){}}
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

function exportMaskThumbnail(name, thumbDir, relativeDir, cache, view, maxSize) {
   // Capture before navigating the target history. One PNG per available mask view.
   for (var i = 0; i < cache.length; ++i)
      if (cache[i].name === name) return cache[i];
   var thumbnail = {name: name, src: "", reason: "The mask image is closed or has been deleted."};
   cache.push(thumbnail);
   try {
      if (!view) view = View.viewById(name);
      if (!view || view.isNull) return thumbnail;
      var filename = "mask_" + cache.length + ".png";
      if (createThumbnailFromView(view, thumbDir + "/" + filename, maxSize || 220)) {
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
   if (entries && entries.length <= 1 && value.split(/\r?\n/).length <= 1) return '<pre class="parameter-value">' + escapeHTML(value) + '</pre>';
   if (entries && entries.length > 1) {
      preview = entries.slice(0,1).join(',\n');
      rest = entries.slice(1).join(',\n');
      label = 'Details — remaining ' + (entries.length-1) + ' entries';
   } else {
      var lines = value.split(/\r?\n/);
      if (lines.length > 1) {
         preview = lines.slice(0,1).join('\n'); rest = lines.slice(1).join('\n');
         label = 'Details — remaining ' + (lines.length-1) + ' lines';
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

function copyBlock(label, text, sourceKey) {
   return '<div class="copy-block"><b>' + escapeHTML(label) + '</b> <button type="button" onclick="copyCode(this)">Copy</button>' +
      '<textarea readonly spellcheck="false"'+(sourceKey?' data-apa-source="'+escapeHTML(sourceKey)+'"':'')+'>' + (sourceKey?'':escapeHTML(text)) + '</textarea></div>';
}

function readableParameters(proc, source) {
   var name = getProcessName(proc), html = "";
   try {
      if (name === "HistogramTransformation") {
         var rows = [], labels = ["Red", "Green", "Blue", "RGB/K", "Alpha"];
         for (var i = 0; i < proc.H.length; ++i) rows.push([labels[i]].concat(proc.H[i]));
         return '<div data-matrix-parameter="H">'+parameterTable(["Channel", "Shadows", "Midtones", "Highlights", "Range low", "Range high"], rows)+'</div>';
      }
      if (name === "CurvesTransformation") {
         for (var c = 0; c < CURVE_CHANNELS.length; ++c) {
            var key = CURVE_CHANNELS[c], points = proc[key];
            var identity = curveIsIdentity(points);
            var type = curveType(proc, key, source);
            html += '<details' + (identity ? '' : ' open') + '><summary>' + CURVE_LABELS[c] +
               ' — ' + type + (identity ? ' — unchanged' : ' — ' + points.length + ' points') + '</summary>';
            html += '<div class="curve-layout" data-matrix-parameter="'+key+'">' + curveGraph(points, type) + '<div>'+parameterTable(["Input (X)", "Output (Y)"], points, 1)+'</div></div></details>';
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
   var html = '<details><summary>PixelMath</summary>', expressions = [], labels = [];
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
   html += '.appearance-badge{display:inline-block;padding:4px 8px;margin:4px;border:1px solid #45475a;border-radius:6px;font-size:11px}.completeness{padding:10px;margin:10px 0;border-left:3px solid;font-size:12px}.completeness-recorded{color:#a6e3a1}.completeness-manual{color:#fab387}.completeness-missing{color:#f38ba8}';
   html += ".thumb-box { width: 440px; min-width: 440px; background: #11111b; display: flex; align-items: center; justify-content: center; padding: 10px; border-right: 1px solid #313244; }\n";
   html += ".thumb-box img { max-width: min(400px, 100%); max-height: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.7); }\n";
   html += '.report-footer{margin-top:40px;padding:24px 12px;border-top:1px solid #313244;text-align:center;color:#a6adc8;font-size:13px}.report-footer .project-links{display:flex;justify-content:center;gap:12px 20px;flex-wrap:wrap;margin:16px 0}.report-footer .project-links a{padding:8px 12px;border:1px solid #45475a;border-radius:6px}.report-footer a{color:#89b4fa;text-decoration:none}.report-footer a:hover{text-decoration:underline}@media(max-width:1000px){.step-card{flex-direction:column}.thumb-box{width:auto;min-width:0;border-right:0;border-bottom:1px solid #313244}}';
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
   record.replayOrigin=null;try{if(typeof view.propertyValue==='function'&&(!view.hasProperty||view.hasProperty('AstroProcessAtlas:ChainOrigin'))){var origin=JSON.parse(String(view.propertyValue('AstroProcessAtlas:ChainOrigin')));if(origin&&typeof origin.parent==='string'&&/^[A-Za-z_]\w*$/.test(origin.parent)&&typeof origin.kind==='string')record.replayOrigin=origin;}}catch(e){}
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
            historyEntryIndex:number,
            phase:group.phase, liveIndex:group.phase === "live" ? i+1 : null,
            redo:group.phase === "live" && i+1 > record.historyIndex,
            time:executionTime(proc), mask:masks.steps[i], maskThumb:null,
            anchor:record.anchor + "_step_" + number, thumb:"", thumbNote:""});
      }
   }
   return record;
}

function reportSizeProfile(name) {
   if(name==='small')return {id:'small',label:'Small',thumbnail:240,stage:480,mask:140};
   if(name==='detailed')return {id:'detailed',label:'Detailed',thumbnail:600,stage:1200,mask:300};
   return {id:'normal',label:'Normal',thumbnail:440,stage:800,mask:220};
}

function collectWorkspaceThumbnails(records, thumbDir, relativeDir, progress, profileName) {
   var profile=reportSizeProfile(profileName);
   var masks = [], generatedFiles = [];
   // Freeze all current images/masks before navigating any image's history.
   for (var r = 0; r < records.length; ++r) {
      if (progress) progress(15 + 10*r/records.length, 'Current image and masks: ' + records[r].id);
      var record = records[r], filename = record.anchor + "_current.png";
      record.appearance=historyPreviewAppearance(record,record.historyIndex);
      record.currentStatistics=captureAtlasImageStatistics(record.view.image);
      if (createThumbnailFromView(record.view, thumbDir + "/" + filename, profile.thumbnail, record.appearance)) {
         record.currentThumb = relativeDir + "/" + filename;generatedFiles.push(thumbDir+'/'+filename);
      }
      for (var i = 0; i < record.steps.length; ++i) {
         var step = record.steps[i];
         if (step.mask.status === "recorded")
            step.maskThumb = exportMaskThumbnail(step.mask.name, thumbDir, relativeDir, masks, null, profile.mask);
      }
      try {
         var mask = record.window.mask;
         if (mask && !mask.isNull && mask.mainView && !mask.mainView.isNull)
            record.currentMaskThumbnail = exportMaskThumbnail(mask.mainView.fullId || mask.mainView.id,
               thumbDir, relativeDir, masks, mask.mainView, profile.mask);
      } catch (e) { Console.writeln("Mask preview error: " + e.message); }
   }
   for (var r = 0; r < records.length; ++r) {
      var record = records[r];
      var states = {}, dimensions = {}, appearances={}, stateStatistics={}, linkedStretch=record.appearance&&record.appearance.auto?record.appearance:null;
      var captureState = function(index, filename) {
         if (Object.prototype.hasOwnProperty.call(states, '$'+index)) return states['$'+index];
         try {
            if (record.view.historyIndex !== index) record.view.historyIndex = index;
            if (record.view.historyIndex !== index) return '';
            dimensions['$'+index] = {width:record.view.image.width,height:record.view.image.height};
            stateStatistics['$'+index]=index===record.historyIndex?record.currentStatistics:captureAtlasImageStatistics(record.view.image);
            var appearance=historyPreviewAppearance(record,index);
            if(appearance.auto){if(!linkedStretch)linkedStretch=appearance;appearance.black=linkedStretch.black;appearance.midtones=linkedStretch.midtones;}
            appearances['$'+index]=appearance;
            if (createThumbnailFromView(record.view, thumbDir + '/' + filename, profile.stage, appearance)) {
               generatedFiles.push(thumbDir+'/'+filename);
               return states['$'+index] = relativeDir + '/' + filename;
            }
         } catch (e) { Console.writeln(record.id + ' comparison state unavailable: ' + e.message); }
         states['$'+index] = '';
         return '';
      };
      try {
         for (var i = 0; i < record.steps.length; ++i) {
            if (progress) progress(25 + 45*(r + i/Math.max(1,record.steps.length))/records.length, 'History previews: ' + record.id + ' — ' + (i+1) + '/' + record.steps.length);
            var step = record.steps[i];
            step.thumb = record.currentThumb;
            step.appearance=record.appearance;
            step.thumbNote = "Current image — no pixels are available for this step.";
            step.beforeThumb = ''; step.afterThumb = '';
            step.statistics={before:null,after:null,beforeIndex:step.phase==='initial'?null:step.liveIndex-1,afterIndex:step.phase==='initial'?null:step.liveIndex};
            if (step.phase === "initial") continue;
            step.beforeThumb = captureState(step.liveIndex-1, record.anchor + '_state_' + (step.liveIndex-1) + '.png');
            step.statistics.before=Object.prototype.hasOwnProperty.call(stateStatistics,'$'+(step.liveIndex-1))?stateStatistics['$'+(step.liveIndex-1)]:null;
            step.beforeAppearance=appearances['$'+(step.liveIndex-1)];
            try {
               if (record.view.historyIndex !== step.liveIndex) record.view.historyIndex = step.liveIndex;
               if (record.view.historyIndex === step.liveIndex) {
                  var filename = step.anchor + ".png";
                  var after = states['$'+step.liveIndex] || captureState(step.liveIndex, filename);
                  step.statistics.after=Object.prototype.hasOwnProperty.call(stateStatistics,'$'+step.liveIndex)?stateStatistics['$'+step.liveIndex]:null;
                  if (after) {
                     step.thumb = step.afterThumb = after;
                     step.appearance=step.afterAppearance=appearances['$'+step.liveIndex];
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

function imageIdentityAliases(image){
   var names=[];function add(name){if(typeof name==='string'&&/^[A-Za-z_]\w*$/.test(name)&&name!==image.id&&names.indexOf(name)<0)names.push(name);}
   if('aliases' in image&&Array.isArray(image.aliases))for(var a=0;a<image.aliases.length;++a)add(image.aliases[a]);
   for(var i=0;i<image.steps.length;++i){var step=image.steps[i];if('redo' in step&&step.redo)continue;
      if('action' in step&&step.action==='identifier'&&'identifier' in step)add(step.identifier);
      if('createsImage' in step&&step.createsImage&&'outputId' in step)add(step.outputId);
      if('proc' in step&&step.proc&&typeof getProcessTitle==='function'&&getProcessTitle(step.proc)==='ImageBlend'&&'parameters' in step.proc){var settings=step.proc.parameters,output='',creates=false;for(var si=0;si<settings.length;++si){if(settings[si][0]==='createNewImage')creates=settings[si][1]==='true';if(settings[si][0]==='newViewId')output=settings[si][1];}if(creates)add(output);}
      if('proc' in step&&step.proc&&typeof getProcessName==='function'){var proc=step.proc,tool=getProcessName(proc);if(tool==='ImageIdentifier'&&'id' in proc)add(proc.id);if(tool==='PixelMath'&&'createNewImage' in proc&&proc.createNewImage===true&&'newImageId' in proc)add(proc.newImageId);}
   }return names;
}

function imageReferences(step, records, owner) {
   var proc = step.proc, name = getProcessName(proc), refs = [];
   if (step.mask.status === "recorded") addReference(refs, step.mask.name, "mask", "Historical mask");
   try {
      if(name==='Script'&&getProcessTitle(proc)==='NarrowbandHueCombination'&&'parameters' in proc)for(var hi=0;hi<proc.parameters.length;++hi){var parameter=proc.parameters[hi];if(parameter&&/^view[1-4]$/.test(parameter[0]))addReference(refs,parameter[1],'input','NarrowbandHueCombination '+parameter[0]);}
      if(name==='Script'&&getProcessTitle(proc)==='ImageBlend'&&'parameters' in proc){var blendOutput='',blendCreates=false;for(var bi=0;bi<proc.parameters.length;++bi){var row=proc.parameters[bi];if(row&&row.length===2){if(row[0]==='imageAId'||row[0]==='imageBId')addReference(refs,row[1],'input','ImageBlend '+row[0]);if(row[0]==='newViewId')blendOutput=row[1];if(row[0]==='createNewImage')blendCreates=row[1]==='true';}}if(blendCreates&&/^[A-Za-z_]\w*$/.test(blendOutput))addReference(refs,blendOutput,'output','ImageBlend newViewId');}
      if (name === "LRGBCombination") {
         var labels = name === "LRGBCombination" ? ["R", "G", "B", "L"] : ["Channel 1", "Channel 2", "Channel 3"];
         for (var i = 0; i < proc.channels.length; ++i)
            if (proc.channels[i][0]) addReference(refs, proc.channels[i][1]||(name==="LRGBCombination"&&owner?owner.id+"_"+labels[i]:""), "input", labels[i]);
      }
      if(name==="ChannelCombination"){var combinationRefs=nativeImageReplayParameters(step,owner||{id:""},false);if(combinationRefs&&!combinationRefs.error)for(var cr=0;cr<combinationRefs.parameters.length;++cr)addReference(refs,combinationRefs.parameters[cr].name,"input","Channel "+(combinationRefs.parameters[cr].row+1));}
      if(name==="ColorCalibration"||name==="BackgroundNeutralization"){var nativeRefs=nativeImageReplayParameters(step,owner||{id:""},false);if(nativeRefs&&!nativeRefs.error)for(var nr=0;nr<nativeRefs.parameters.length;++nr)addReference(refs,nativeRefs.parameters[nr].name,"reference",nativeRefs.parameters[nr].parameter);}
      if (name === "PixelMath") {
         var parsedInputs=typeof step.source==='string'?pixelMathReplaySource(step):null;
         if(parsedInputs){for(var pi=0;pi<parsedInputs.inputs.length;++pi)addReference(refs,parsedInputs.inputs[pi],"input","PixelMath expression / symbols");}
         else{

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
                  if (records[r].id === token[0] || imageIdentityAliases(records[r]).indexOf(token[0])>=0) addReference(refs, token[0], "input", "PixelMath expression " + (e+1));
            }
         }
         }
         if (proc.createNewImage) addReference(refs, proc.newImageId, "output", "PixelMath newImageId");
      }
      if (name === "ChannelExtraction")
         for (var i = 0; i < proc.channels.length; ++i)
            if (proc.channels[i][0]) addReference(refs, proc.channels[i][1], "output", "ChannelExtraction");
      // StarXTerminator does not serialize an explicit output image ID.
      // Require the enabled output option, exact naming and corroborating output history.
      if (name === 'StarXTerminator' && proc.stars === true && owner && !step.redo) {
         var outputId = owner.id + '_stars';
         for (var r = 0; r < records.length; ++r) {
            if (records[r].id !== outputId) continue;
            var outputHistory = records[r].starsFullSteps || records[r].steps;
            for (var j = 0; j < outputHistory.length; ++j) {
               var outputStep = outputHistory[j];
               if (!outputStep.redo && getProcessName(outputStep.proc) === 'StarXTerminator') {
                  addReference(refs, outputId, 'output', 'StarXTerminator stars=true — inferred from output name and StarXTerminator history');
                  break;
               }
            }
         }
      }
      // Explicit ID parameters, rather than matching arbitrary text or filename similarity.
      var keys = ["referenceViewId", "referenceImageId", "sourceViewId", "sourceImageId", "maskViewId", "maskImageId"];
      for (var i = 0; i < keys.length; ++i)
         if (typeof proc[keys[i]] === "string") addReference(refs, proc[keys[i]], /mask/i.test(keys[i]) ? "mask" : "reference", keys[i]);
   } catch (e) { Console.writeln("Reference extraction error: " + e.message); }
   return refs;
}

function isSelectiveColorWorkingSpace(step) {
   if (getProcessName(step.proc) !== 'RGBWorkingSpace') return false;
   var expected = 'var P = new RGBWorkingSpace; P.channels=[[1,0.648431,0.330856],[1,0.321152,0.597871],[1,0.155886,0.066044]]; P.gamma=2.2; P.sRGBGamma=true; P.applyGlobalRGBWS=false;';
   var key = historyParameterKey(step.source);
   return !!key && key === historyParameterKey(expected);
}

function workspaceStepGroups(record) {
   var groups = [];
   for (var reset = 0; reset < record.steps.length; ++reset) record.steps[reset].componentOf = '';
   var i = 0;
   while (i < record.steps.length) {
      var first = record.steps[i];
      var end = i + 1;
      var groupTitle = first.title;
      if (i + 2 < record.steps.length && isSelectiveColorWorkingSpace(first) &&
          isSelectiveColorWorkingSpace(record.steps[i+1]) &&
          getProcessTitle(record.steps[i+2].proc).toLowerCase() === 'selectivecolorcorrection' &&
          record.steps[i+1].redo === first.redo && record.steps[i+2].redo === first.redo &&
          record.steps[i+1].phase === first.phase && record.steps[i+2].phase === first.phase) {
         end = i + 3;
         groupTitle = 'SelectiveColorCorrection';
      }
      if (getProcessTitle(first.proc).toLowerCase() === 'perfectpalettepicker') {
         while (end < record.steps.length && record.steps[end].redo === first.redo && getProcessTitle(record.steps[end].proc).toLowerCase() === 'perfectpalettepicker') {
            ++end;
         }
         if (end - i >= 2 && end < record.steps.length && record.steps[end].redo === first.redo && getProcessName(record.steps[end].proc) === 'PixelMath') {
            ++end;
         }
         if (end - i > 1) groupTitle = 'PerfectPalettePicker';
      }
      var members = record.steps.slice(i, end);
      var group = {anchor:members.length > 1 ? first.anchor + '_group' : first.anchor, members:members,
         title:groupTitle};
      for (var m = 0; m < members.length; ++m) {
         members[m].componentOf = members.length > 1 ? group.title : '';
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

function imageColorBadge(node) {
   if (!node.header || typeof node.isColor !== 'boolean') return '';
   var x = node.x + 20, y = node.y + 21, radius = 8;
   var html = '<g class="image-color-badge" role="img" aria-label="' + (node.isColor ? 'Color image (current state)' : 'Grayscale image (current state)') + '"><title>' + (node.isColor ? 'Color image (current state)' : 'Grayscale image (current state)') + '</title>';
   if (node.isColor) {
      var colors = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];
      for (var i = 0; i < colors.length; ++i) {
         var a = i * Math.PI / 3 - Math.PI / 2, b = a + Math.PI / 3;
         html += '<path fill="' + colors[i] + '" d="M' + x + ',' + y + ' L' + (x+radius*Math.cos(a)) + ',' + (y+radius*Math.sin(a)) + ' A8,8 0 0,1 ' + (x+radius*Math.cos(b)) + ',' + (y+radius*Math.sin(b)) + ' Z"/>';
      }
   } else {
      html += '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#fff"/><path fill="#000" d="M' + x + ',' + (y-8) + ' A8,8 0 0,0 ' + x + ',' + (y+8) + ' Z"/>';
   }
   return html + '<circle cx="' + x + '" cy="' + y + '" r="8" fill="none" stroke="#bac2de" stroke-width="1"/></g>';
}

function historyParameterKey(source) {
   // Compare serialized values without comments, formatting or instance variable names.
   // Quoted values remain intact: whitespace inside an expression/path is significant.
   var tokens = [], i = 0;
   while (i < source.length) {
      var c = source.charAt(i), next = source.charAt(i + 1);
      if (/\s/.test(c)) { ++i; continue; }
      if (c === '/' && next === '/') {
         i += 2; while (i < source.length && source.charAt(i) !== '\n') ++i;
      } else if (c === '/' && next === '*') {
         var end = source.indexOf('*/', i + 2); if (end < 0) return '';
         i = end + 2;
      } else if (c === '"' || c === "'") {
         var start = i++, quote = c, closed = false;
         while (i < source.length) {
            c = source.charAt(i++);
            if (c === '\\') ++i;
            else if (c === quote) { closed = true; break; }
         }
         if (!closed) return '';
         var literal = source.slice(start, i);
         if (quote === '"') {
            try { literal = JSON.stringify(JSON.parse(literal)); } catch (e) { return ''; }
         }
         tokens.push(literal);
      } else {
         if (/[A-Za-z_$]/.test(c)) {
            var start = i++; while (i < source.length && /[\w$]/.test(source.charAt(i))) ++i;
            tokens.push(source.slice(start, i));
         } else {
            var token = /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(source.slice(i, i + 80));
            if (token) { tokens.push(String(Number(token[0]))); i += token[0].length; }
            else { tokens.push(c); ++i; }
         }
      }
   }
   if (!tokens.length || tokens[0] !== 'var' || tokens[2] !== '=' || tokens[3] !== 'new') return '';
   var instance = tokens[1];
   for (i = 0; i < tokens.length; ++i) if (tokens[i] === instance) tokens[i] = '$instance';
   return tokens.join(' ');
}

function normalizeWorkspaceCloneHistories(records) {
   var byId = {}, originals = {};
   for (var r = 0; r < records.length; ++r) {
      var record = records[r]; byId['$' + record.id] = record;
      if (record.starsFullSteps) { record.steps = record.starsFullSteps; record.starsOrigin = null; record.displayGroups = null; }
      if (record.cloneFullSteps) { record.steps = record.cloneFullSteps; record.cloneShared = null; record.displayGroups = null; }
      originals['$' + record.id] = record.cloneFullSteps || record.steps;
   }
   for (var r = 0; r < records.length; ++r) {
      var record = records[r], full = originals['$' + record.id];
      var match = /^(.*)_clone(?:[0-9]+)?$/.exec(record.id);
      if (!match || !byId['$' + match[1]]) continue;
      var parent = byId['$' + match[1]], source = originals['$' + parent.id], count = 0;
      while (count < Math.min(full.length, source.length)) {
         var a = full[count], b = source[count];
         if (a.redo || b.redo || getProcessName(a.proc) !== getProcessName(b.proc)) break;
         var am = a.mask || {}, bm = b.mask || {};
         if (am.status !== bm.status || am.name !== bm.name || am.inverted !== bm.inverted) break;
         var ak = historyParameterKey(a.source), bk = historyParameterKey(b.source);
         if (!ak || ak !== bk) break;
         ++count;
      }
      if (!count) continue;
      record.cloneFullSteps = full;
      record.cloneShared = {image:parent.id, anchor:parent.anchor, count:count, lastStep:source[count-1]};
      record.steps = full.slice(count);
      record.displayGroups = null;
   }
}

function normalizeWorkspaceStarsHistories(records) {
   var candidates = [];
   // Check all relationships before removing an output's corroborating origin entry.
   for (var r = 0; r < records.length; ++r) {
      var source = records[r];
      for (var i = 0; i < source.steps.length; ++i) {
         var step = source.steps[i];
         if (step.redo || getProcessName(step.proc) !== 'StarXTerminator' || step.proc.stars !== true) continue;
         var refs = imageReferences(step, records, source);
         for (var j = 0; j < refs.length; ++j) {
            if (refs[j].kind !== 'output' || refs[j].name !== source.id + '_stars') continue;
            for (var o = 0; o < records.length; ++o) {
               var output = records[o]; if (output.id !== refs[j].name) continue;
               for (var k = 0; k < output.steps.length; ++k) {
                  var origin = output.steps[k];
                  if (origin.redo || getProcessName(origin.proc) !== 'StarXTerminator') continue;
                  candidates.push({output:output, origin:origin, source:source, sourceStep:step});
                  break;
               }
            }
         }
      }
   }
   for (var i = 0; i < candidates.length; ++i) {
      var candidate = candidates[i], output = candidate.output;
      if (output.starsOrigin) continue;
      // Keep a process node that is itself needed to explain another selected output.
      var needed = false;
      for (var j = 0; j < candidates.length; ++j)
         if (candidates[j].sourceStep === candidate.origin) needed = true;
      if (needed) continue;
      output.starsFullSteps = output.steps;
      output.starsOrigin = {image:candidate.source.id, anchor:candidate.source.anchor,
         sourceStep:candidate.sourceStep.anchor, removedStep:candidate.origin.anchor};
      output.steps = output.steps.filter(function(step) { return step !== candidate.origin; });
      output.displayGroups = null;
   }
}

function workspaceGraph(records) {
   normalizeWorkspaceCloneHistories(records);
   normalizeWorkspaceStarsHistories(records);
   var graph = {nodes:[], edges:[], unresolved:[]}, headerById = {},aliasHeaders={};
   for (var r = 0; r < records.length; ++r) {
      var record = records[r];
      headerById["$" + record.id] = record.anchor;
      var aliases=imageIdentityAliases(record);for(var ai=0;ai<aliases.length;++ai){var aliasKey='$'+aliases[ai];if(!aliasHeaders[aliasKey])aliasHeaders[aliasKey]=[];aliasHeaders[aliasKey].push({anchor:record.anchor,id:record.id});}
      graph.nodes.push({id:record.anchor, image:record.id, label:record.id, x:24+r*290, y:30, header:true, isColor:record.isColor});
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
            tool:group.members.length > 1 ? group.title : getProcessName(step.proc), hasMask:hasMask,
            search:(record.id+' '+record.filePath+' '+group.title+search).toLowerCase(),
            phase:step.phase, redo:step.redo});
         graph.edges.push({from:previous, to:group.anchor, kind:"sequence", provenance:'recorded', detail:step.phase === "initial" ? "Initial state history" : "History sequence", redo:step.redo});
         previous = group.anchor;
      }
   }
   for (var r = 0; r < records.length; ++r) {
      var shared = records[r].cloneShared;
      if (!shared) continue;
      var from = shared.anchor;
      for (var n = 0; n < graph.nodes.length; ++n) {
         var node = graph.nodes[n];
         if (node.id === shared.lastStep.anchor || (node.memberIds && node.memberIds.indexOf(shared.lastStep.anchor) >= 0)) { from = node.id; break; }
      }
      graph.edges.push({from:from, to:records[r].anchor, kind:'input', provenance:'parameter', uncertain:true, redo:false,
         detail:'Clone relationship inferred from matching image name and common initial process parameters (' + shared.count + ' entries). Exact historical pixels are unconfirmed.'});
   }
   for(var r=0;r<records.length;++r){var origin=records[r].replayOrigin;if(origin&&origin.parent!==records[r].id&&headerById['$'+origin.parent])graph.edges.push({from:headerById['$'+origin.parent],to:records[r].anchor,kind:'input',provenance:'recorded',uncertain:true,redo:false,detail:'Recorded replay lineage: '+origin.kind+' at checkpoint '+origin.stage});}
   for (var r = 0; r < records.length; ++r)
      for (var i = 0; i < records[r].steps.length; ++i) {
         var step = records[r].steps[i], refs = imageReferences(step, records, records[r]);
         step.references = refs;
         step.possibleInputs = [];
         for (var j = 0; j < refs.length; ++j) {
            var ref = refs[j], imageNode = headerById["$" + ref.name];
            var aliases=aliasHeaders['$'+ref.name],aliasImage='';if(!imageNode&&aliases&&aliases.length===1){imageNode=aliases[0].anchor;aliasImage=aliases[0].id;ref.resolvedImage=aliasImage;}
            if (imageNode === records[r].anchor || ref.name === records[r].id) continue;
            if (!imageNode) { graph.unresolved.push({image:records[r].id, step:step.anchor, name:ref.name, detail:ref.detail}); continue; }
            graph.edges.push({from:ref.kind === "output" ? step.groupAnchor : imageNode,
               to:ref.kind === "output" ? imageNode : step.groupAnchor, kind:ref.kind, detail:ref.detail+(aliasImage?' — recorded image alias '+ref.name+' → '+aliasImage:''),
               provenance:ref.kind === 'mask' ? 'recorded' : 'parameter',
               uncertain:true, redo:step.redo});
         }
         var knownInput = false;
         for (var g = 0; g < records[r].steps.length; ++g) {
            if (records[r].steps[g].groupAnchor !== step.groupAnchor) continue;
            var groupRefs = imageReferences(records[r].steps[g], records, records[r]);
            for (var j = 0; j < groupRefs.length; ++j) {
               if ((groupRefs[j].kind === 'input' || groupRefs[j].kind === 'reference') && (headerById['$' + groupRefs[j].name] || aliasHeaders['$'+groupRefs[j].name]&&aliasHeaders['$'+groupRefs[j].name].length===1)) knownInput = true;
            }
         }
         for (var j = 0; j < refs.length; ++j) {
            if ((refs[j].kind === 'input' || refs[j].kind === 'reference') && (headerById['$' + refs[j].name] || aliasHeaders['$'+refs[j].name]&&aliasHeaders['$'+refs[j].name].length===1)) {
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
   // Stable partition: retain the existing dependency order within each group.
   var related = {}, connected = [], isolated = [];
   for (e = 0; e < graph.edges.length; ++e) {
      var relation = graph.edges[e];
      if (relation.redo || relation.kind === 'sequence') continue;
      var from = nodesById['$' + relation.from], to = nodesById['$' + relation.to];
      if (from && to && from.image !== to.image) {
         related['$' + from.image] = true;
         related['$' + to.image] = true;
      }
   }
   for (r = 0; r < ordered.length; ++r) {
      if (related['$' + ordered[r].id]) connected.push(ordered[r]);
      else isolated.push(ordered[r]);
   }
   ordered = connected.concat(isolated);
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

function workspaceOverviewHTML(records, graph, filtersHTML) {
   var appearanceByImage={},completenessByNode={};
   for(var r=0;r<records.length;++r){appearanceByImage['$'+records[r].id]=records[r].appearance;var groups=records[r].displayGroups||workspaceStepGroups(records[r]);for(var g=0;g<groups.length;++g)completenessByNode['$'+groups[g].anchor]=groupCompleteness(groups[g]);}

   var height = 170, width = Math.max(310, records.length*290+35);
   for (var i = 0; i < graph.nodes.length; ++i) height = Math.max(height, graph.nodes[i].y+100);
   var html = '<section><h2>Image and process tree</h2><p id="tree_edit_notice" hidden>Tree edits change the planned workflow. Existing previews document the original processing and are not recalculated.</p><p>Each column represents an image. Solid lines show its history sequence. Dashed lines connect image/mask references; the exact historical version of the source image is unknown. This is not an absolute shared timeline.</p>';
   html+='<p>Step data indicators: green — recorded settings; orange — manual inputs or verification; pink — missing data. Recorded settings do not guarantee identical historical pixels. Stretch labels are estimates from pixel brightness.</p>';
   html+='<p>Connected images appear first; images without cross-image connections appear last. Existing order is preserved within each group. Column order does not establish when files were opened or images were created.</p>';
   html += '<div class="graph-legend" aria-label="Line legend">';
   var legendKinds = ['sequence', 'input', 'mask', 'output', 'manual', 'possible'];
   var legendLabels = ['Sequence', 'Input / reference', 'Mask', 'Output', 'Your connection', 'Possible connection'];
   for (var l = 0; l < legendKinds.length; ++l)
      html += '<span class="legend-item"><svg width="64" height="16" viewBox="0 0 64 16" aria-hidden="true"><path class="edge edge-' + legendKinds[l] + '" d="M2,8 H60"/></svg>' + legendLabels[l] + '</span>';
   html += '</div><p>Hover highlights related images. Clicking filters the history and keeps the highlight. Click an empty area of the tree or select “All” to reset. Redo steps are not part of the current image.</p>';
   html += filtersHTML || '';
   html += '<div class="tree-toolbar"><button type="button" onclick="openAtlasPrintOptions(\'all\')">Print full report / PDF</button><label class="zoom-control"><span>Zoom</span><input type="range" min="30" max="150" value="100" oninput="document.getElementById(\'workspace_graph\').style.width=(' + width + '*this.value/100)+\'px\'"></label><label><input id="tree_edit_mode" type="checkbox">Edit tree</label><button type="button" data-save-report disabled onclick="saveAtlasReport()">Save report (HTML)</button><button id="tree_reset" type="button" disabled onclick="resetAtlasChanges()">Reset unsaved changes</button><span id="tree_dirty" aria-live="polite"></span></div>';
   html += '<p id="tree_edit_help" class="tree-edit-help" hidden>Edit mode: drop on a tile to connect; drop between steps to copy.</p>';
   html += '<details><summary>Organize tree</summary><label for="tree_node_search">Find node</label> <input id="tree_node_search" type="search" oninput="findTreeNodes()" placeholder="Image or process name"><select id="tree_node_results" aria-label="Matching tree nodes" onchange="jumpToTreeNode(this.value)"><option value="">Select a node</option></select><label for="tree_image">Image branch</label> <select id="tree_image" onchange="organizeTree()"><option value="">All images</option>';
   for(var r=0;r<records.length;++r)html+='<option data-no-i18n value="'+records[r].anchor+'">'+escapeHTML(records[r].id)+'</option>';
   html += '</select> <label><input id="tree_path_only" type="checkbox" onchange="organizeTree()">Only the path to this image</label><button type="button" onclick="toggleTreeBranch()">Collapse / expand branch</button><button type="button" onclick="resetTreeOrganization()">Expand all branches</button><p id="tree_organization_status" aria-live="polite"></p></details><aside id="connection_info" hidden aria-live="polite"><h3>Connection details</h3><p id="connection_description" data-no-i18n></p><button type="button" onclick="document.getElementById(\'connection_info\').hidden=true">Close</button></aside><style>.is-tree-hidden{display:none!important}.edge[data-from]{cursor:pointer;pointer-events:stroke;stroke-width:3}#connection_info{padding:12px;border:1px solid #89b4fa;border-radius:8px}#connection_description{white-space:pre-wrap}</style>';
   html += '<div id="graph_scroll" class="graph-scroll" onclick="graphBackgroundClick(event)"><svg id="workspace_graph" width="' + width + '" viewBox="0 0 ' + width + ' ' + height + '" xmlns="http:\u002f\u002fwww.w3.org/2000/svg">';
   html += '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#a6adc8"/></marker></defs><g id="graph_edges">';
   for (var i = 0; i < graph.edges.length; ++i) {
      var edge = graph.edges[i];
      html += '<path role="button" aria-label="Connection details" onclick="showConnection(event,\'history\','+i+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \')showConnection(event,\'history\','+i+')" tabindex="0" data-provenance="' + edge.provenance + '" data-from="' + edge.from + '" data-to="' + edge.to + '" class="edge edge-' + edge.kind + (edge.redo ? ' redo-edge' : '') + '" d="' + graphEdgePath(edge, graph.nodes) + '" marker-end="url(#arrow)"><title>' + escapeHTML(provenanceLabel(edge.provenance) + ': ' + edge.detail) + (edge.uncertain ? ' — unknown historical version' : '') + '</title></path>';
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
      var appearance=appearanceByImage['$'+node.image],complete=completenessByNode['$'+node.id];
      var badge=node.header?'<text class="graph-small" x="'+(node.x+10)+'" y="'+(node.y+66)+'">'+(appearance&&appearance.gameMask?'GAME mask — stretched':appearance&&appearance.stretchRecorded?'Stretch recorded':appearance&&appearance.state==='dark'?'Likely linear / dark':appearance&&appearance.state==='visible'?'Visible — stretch unconfirmed':'Stretch state: unknown')+'</text>':complete?'<g><title>'+complete.label+'</title><circle cx="'+(node.x+235)+'" cy="'+(node.y+50)+'" r="5" fill="'+(complete.level==='recorded'?'#a6e3a1':complete.level==='manual'?'#fab387':'#f38ba8')+'"/></g>':'';
      html += '<a onpointerdown="beginComparisonDrag(event,this.getAttribute(\'data-node\'))" draggable="false" data-node="' + node.id + '" ondragstart="dragComparisonStage(event,this.getAttribute(\'data-node\'))" ondragover="stageDragOver(event)" ondrop="dropComparedNodes(event,this.getAttribute(\'data-node\'))" href="#' + node.id + '" onclick="selectGraphNode(\'' + node.id + '\',event)" onfocus="focusGraphImage(\'' + node.id + '\')" onblur="clearGraphFocus()"><g data-node="' + node.id + '" onmouseenter="focusGraphImage(\'' + node.id + '\')" onmouseleave="clearGraphFocus()" draggable="false" ondragstart="dragComparisonStage(event,this.getAttribute(\'data-node\'))" ondragover="stageDragOver(event)" ondrop="dropComparedNodes(event,this.getAttribute(\'data-node\'))" class="graph-node' + (node.redo ? ' redo-node' : '') + '">' +
         '<rect x="' + node.x + '" y="' + node.y + '" width="250" height="72" rx="8"/>' +
         '<title data-no-i18n>' + escapeHTML(node.label + (node.time ? ' — ' + node.time : '')) + '</title>' +
         imageColorBadge(node) + '<text data-no-i18n x="' + (node.x+(node.header ? 36 : 10)) + '" y="' + (node.y+26) + '">' + escapeHTML(node.label.length > (node.header ? 27 : 31) ? node.label.slice(0,node.header ? 24 : 28)+'…' : node.label) + '</text>' +
         '<text class="graph-small" x="' + (node.x+10) + '" y="' + (node.y+50) + '">' + escapeHTML(subtitle) + '</text>'+badge+'</g></a>';
   }
   html += '</svg></div><style>.tree-delete{display:none}.graph-scroll.tree-editing .tree-delete{display:inline}.tree-delete,.tree-delete *{cursor:pointer}.graph-scroll.tree-editing{border-color:#fab387!important;box-shadow:0 0 0 2px #fab387,inset 0 0 0 1px #fab387}.tree-edit-help{color:#fab387}.stage-pickers{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}.stage-drop{flex:1;min-width:220px;padding:12px;border:2px dashed #45475a;border-radius:8px}.stage-drop select{width:100%}.stage-drop.drag-over{border-color:#fab387;background:#313244}.stage-drop p{font-size:12px;margin:6px 0}.graph-node{touch-action:none;cursor:grab}.graph-node.is-drag-origin{opacity:.35}.graph-node.is-drop-target rect{stroke:#fab387;stroke-width:3px}.stage-drag-ghost{position:fixed;pointer-events:none;z-index:11000;opacity:.85;filter:drop-shadow(0 8px 12px #0008)}.stage-drag-ghost rect{fill:#313244;stroke:#fab387;stroke-width:2px}.stage-drag-ghost text{fill:#cdd6f4;font:13px sans-serif}.stage-drag-ghost .graph-small{fill:#a6adc8;font-size:10px}.stage-marker{pointer-events:none;fill:#fab387;font:bold 12px sans-serif!important}</style>';
   html += '<details id="stage_comparison_controls"><summary>Compare any two stages</summary><p>Select two available previews, including stages from different images. A is on the left; B is on the right. Current image previews are not historical source pixels.</p><div class="stage-pickers"><div id="stage_drop_a" class="stage-drop" ondragover="stageDragOver(event)" ondragleave="this.classList.remove(\'drag-over\')" ondrop="dropComparisonStage(event,\'a\')"><label for="stage_compare_a">A — left</label><select id="stage_compare_a" onchange="syncComparisonStages()"></select><p>Drop a tree node here</p><p id="stage_name_a" data-no-i18n></p></div><div id="stage_drop_b" class="stage-drop" ondragover="stageDragOver(event)" ondragleave="this.classList.remove(\'drag-over\')" ondrop="dropComparisonStage(event,\'b\')"><label for="stage_compare_b">B — right</label><select id="stage_compare_b" onchange="syncComparisonStages()"></select><p>Drop a tree node here</p><p id="stage_name_b" data-no-i18n></p></div></div> <button id="stage_compare_button" type="button" onclick="compareSelectedStages(this)">Compare stages</button><p id="stage_compare_status" aria-live="polite"></p></details>';
   html += '<details><summary>Add a connection that was not recorded in history</summary><p>Connections are included in Save report (HTML), together with tree edits and change history. Browser storage is also used when available.</p><label>From <select id="manual_from">';
   var options = '';
   for (var i = 0; i < graph.nodes.length; ++i) options += '<option value="' + graph.nodes[i].id + '" data-no-i18n>' + escapeHTML(graph.nodes[i].image + ' — ' + graph.nodes[i].label) + '</option>';
   html += options + '</select></label> <label>To <select id="manual_to">' + options + '</select></label> <input id="manual_note" placeholder="e.g. SHO created from SII/Ha/OIII">';
   html += '<button onclick="addManualEdge()">Add</button><button data-save-report disabled onclick="saveAtlasReport()">Save report (HTML)</button><button onclick="clearManualEdges()">Clear annotations</button><p id="manual_status" aria-live="polite"></p></details>';
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

function stepCompleteness(step) {
   var missing=[],manual=[],tool=getProcessName(step.proc);
   if(!step.source)missing.push('Serialized parameters are unavailable.');
   else if(!/\bvar\s+[A-Za-z_]\w*\s*=\s*new\s+[A-Za-z_]\w*/.test(step.source))missing.push('Serialized parameters are unavailable.');
   if(!step.mask||step.mask.status==='unknown')missing.push('Historical mask state is unknown.');
   else if(step.mask.status==='recorded'){
      if(!step.mask.name)missing.push('Historical mask name is missing.');
      else manual.push('The original mask pixels and their version must be supplied.');
   }
   var references=step.references||[];
   for(var i=0;i<references.length;++i)if(references[i].kind==='input'||references[i].kind==='reference'){
      manual.push('Historical input images must be supplied.');break;
   }
   if(step.possibleInputs&&step.possibleInputs.length)manual.push('Possible inputs are unconfirmed.');
   if(tool==='Script'){
      var parameters=null;
      try{parameters=step.proc.parameters;}catch(e){}
      if(!parameters||!parameters.length)missing.push('Script settings were not recorded.');
      else manual.push('Script parameters are recorded; internal masks or cached state may be unavailable.');
   }
   var level=missing.length?'missing':manual.length?'manual':'recorded';
   return {level:level,label:level==='missing'?'Incomplete recorded data':level==='manual'?'Manual inputs / verification needed':'Recorded process settings',
      notes:missing.concat(manual)};
}

function completenessHTML(step) {
   var info=stepCompleteness(step),html='<div class="completeness completeness-'+info.level+'"><b>Step data:</b> <span>'+info.label+'</span>';
   for(var i=0;i<info.notes.length;++i)html+='<div>'+info.notes[i]+'</div>';
   return html+'</div>';
}

function groupCompleteness(group) {
   var result=stepCompleteness(group.members[0]),rank={recorded:0,manual:1,missing:2};
   for(var i=1;i<group.members.length;++i){var next=stepCompleteness(group.members[i]);if(rank[next.level]>rank[result.level])result=next;}
   return result;
}

function imageReportHTML(record, emit, structuredHistory) {
   var groups = record.displayGroups || workspaceStepGroups(record);
   var html = '<section class="image-report" data-image="' + record.anchor + '" id="' + record.anchor + '"><h2 data-no-i18n>' + escapeHTML(record.id) + '</h2>';
   html += '<div class="meta-info">' + previewAppearanceHTML(record.appearance) + (record.currentThumb ? '<img class="image-snapshot" src="' + escapeHTML(record.currentThumb) + '" alt="Current image">' : '') +
      '<b>File:</b> ' + (record.filePath ? '<span data-no-i18n>' + escapeHTML(record.filePath) + '</span>' : 'No file path') + '<br><span id="'+record.anchor+'_process_count"><b>Total Process Steps:</b> ' + groups.length + '</span>' +
      (groups.length !== record.steps.length || record.cloneShared || record.starsOrigin ? ' · <b>Original history entries:</b> ' + (record.cloneFullSteps || record.starsFullSteps || record.steps).length : '') +
      ' · Current history position: ' + record.historyIndex + '<br><b>Current mask:</b> ' + record.currentMaskInfo +
      maskThumbnailHTML(record.currentMaskThumbnail, record.currentMaskInverted) + '</div>';
   if (record.cloneShared) html += '<p>Common initial history is shown on the source image: <a href="#' +
      escapeHTML(record.cloneShared.anchor) + '" onclick="selectGraphNode(' + escapeHTML(JSON.stringify(record.cloneShared.anchor)) +
      ');return false" data-no-i18n>' + escapeHTML(record.cloneShared.image) + '</a> (' +
      record.cloneShared.count + ' entries). Only subsequent clone steps are shown here. This relationship is inferred from the image name and matching parameters.</p>';
   if (record.starsOrigin) html += '<p>StarXTerminator origin is shown on the source image: <a href="#' +
      escapeHTML(record.starsOrigin.sourceStep) + '" onclick="selectGraphNode(' + escapeHTML(JSON.stringify(record.starsOrigin.sourceStep)) +
      ');return false" data-no-i18n>' + escapeHTML(record.starsOrigin.image) + '</a>. The linked output origin is not repeated as a processing step here. Later steps are preserved.</p>';
   if (record.error || record.initialNote) html += '<p>' + escapeHTML(record.error || record.initialNote) + '</p>';
   if (!record.steps.length) html += '<p>' + (record.starsOrigin ? 'No additional history steps were found for this stars output.' : record.cloneShared ? 'No additional history steps were found for this clone.' : 'No history steps were found for this image.') + '</p>';
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
         html += '<div class="step-group" id="' + groupStart.anchor + '"><div class="step-num">Step ' + step.displayNumber + ' of ' + groups.length + '</div><h3 data-no-i18n>' + escapeHTML(groupStart.title) + '</h3><p>Grouped from consecutive history entries; original records are preserved below.</p>' +
            '<div class="completeness completeness-'+groupCompleteness(groupStart).level+'"><b>Step data:</b> '+groupCompleteness(groupStart).label+'</div>'+
            comparisonHTML({beforeThumb:step.beforeThumb, afterThumb:finalMember.afterThumb}) +
            '<details open><summary>Show recorded component steps (' + groupStart.members.length + ')</summary>';
      }
      html += '<div class="step-card" id="' + step.anchor + '"><div class="thumb-box">' + (step.beforeThumb && step.afterThumb ? comparisonHTML(step) : (step.thumb ?
         '<img src="' + escapeHTML(step.thumb) + '" alt="' + escapeHTML(step.thumbNote) + '">' : 'Thumbnail unavailable — see PixInsight console') +
         comparisonHTML(step)) +
         '<div class="thumb-note">' + escapeHTML(step.thumbNote) + '<br>'+previewAppearanceHTML(step.appearance)+
         (step.beforeThumb&&step.afterThumb?'<br>Before: '+previewAppearanceHTML(step.beforeAppearance)+'<br>After: '+previewAppearanceHTML(step.afterAppearance):'')+'</div></div><div class="details-box">';
      html += '<div class="step-num">' + (step.substepNumber ? 'Substep ' + step.displayNumber + '.' + step.substepNumber : 'Step ' + step.displayNumber + ' of ' + groups.length) + '</div><div class="step-title" data-no-i18n>' + escapeHTML(step.title) + '</div>';
      html += '<p class="thumb-note">' + (step.phase === 'initial' ? 'Initial state history — pixels for this step are unavailable.' :
         'Position ' + step.liveIndex + ' in history') + (step.redo ? ' [Redo / not applied at the current position]' : '') +
         (step.time ? ' · ' + escapeHTML(step.time) : ' · Execution time: not recorded') + '</p>';
      html += completenessHTML(step);
      html += atlasImageStatisticsHTML('statistics' in step?step.statistics:null);
      html += historyMaskHTML(step.mask, step.maskThumb);
      if (step.possibleInputs && step.possibleInputs.length) {
         html += '<p class="possible-info">Possible inputs from user-selected originals (unconfirmed): <span data-no-i18n>' + escapeHTML(step.possibleInputs.join(', ')) + '</span></p>';
      }
      if (step.references && step.references.length) {
         var rows = [];
         for (var j = 0; j < step.references.length; ++j) rows.push([step.references[j].name, step.references[j].kind, step.references[j].detail,
            provenanceLabel(step.references[j].kind === 'mask' ? 'recorded' : 'parameter') + ('resolvedImage' in step.references[j]?' — recorded alias of '+step.references[j].resolvedImage:'') + ' — unknown historical version']);
         html += parameterTable(['Image reference', 'Role', 'Parameter', 'Connection origin'], rows);
      }
      html += replayStepHTML(record, step) + readableParameters(step.proc, step.source) + pixelMathSection(step.proc, step.source, record.isColor) +
         '<details><summary>Full process code / all parameters</summary>' + copyBlock('PixInsight JavaScript', step.source,structuredHistory?structuredHistory.steps[i].source:null) + '</details></div></div>';
      if (groupEnd) html += '</details></div>';
      if (emit) { emit(html); html = ''; }
   }
   for (var i = 0; !record.cloneShared && !record.starsOrigin && i < record.historySources.length; ++i) {
      html += '<details><summary>Full history code — ' + record.historySources[i].phase + '</summary>' + copyBlock('History ProcessContainer', record.historySources[i].source,structuredHistory?structuredHistory.containers[i].source:null) + '</details>';
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

// Validate serialized constructors and assignments before using a supported process.
// Execution calls and arbitrary scripts are not accepted.
function replayProcessSource(source, tool) {
   var code = '', i = 0;
   while (i < source.length) {
      var c = source.charAt(i), next = source.charAt(i + 1);
      if (c === '"' || c === "'") {
         var quote = c, closed = false; ++i;
         while (i < source.length) {
            c = source.charAt(i++);
            if (c === '\\') ++i;
            else if (c === quote) { closed = true; break; }
         }
         if (!closed) return null;
         code += '0';
      } else if (c === '/' && next === '/') {
         i += 2; while (i < source.length && source.charAt(i) !== '\n') ++i;
         code += '\n';
      } else if (c === '/' && next === '*') {
         var end = source.indexOf('*/', i + 2); if (end < 0) return null;
         i = end + 2; code += ' ';
      } else { code += c; ++i; }
   }
   var declaration = /^\s*var\s+([A-Za-z_]\w*)\s*=\s*new\s+([A-Za-z_]\w*)\s*(?:\(\s*\))?\s*;/.exec(code);
   if (!declaration || declaration[2] !== tool) return null;
   var variable = declaration[1], rest = code.slice(declaration[0].length);
   var assignment = new RegExp('^\\s*' + variable + '\\.[A-Za-z_]\\w*\\s*=\\s*([^;]+);');
   while (/\S/.test(rest)) {
      var match = assignment.exec(rest); if (!match) return null;
      // Values may contain literal tables, numbers, strings and native enum constants.
      var value = match[1].replace(/\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\b/g, '0')
         .replace(/\b(?:true|false|null)\b/g, '0')
         .replace(/(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g, '0');
      if (/[^\s0\[\],+.-]/.test(value)) return null;
      rest = rest.slice(match[0].length);
   }
   return {source:source, variable:variable};
}


function replaySourceSkeleton(source) {
   var code='',i=0;
   while(i<source.length){var start=i,c=source.charAt(i),n=source.charAt(i+1);
      if(c==='"'||c==="'"){var quote=c,closed=false;++i;while(i<source.length){c=source.charAt(i++);if(c==='\\')++i;else if(c===quote){closed=true;break;}}if(!closed)return null;code+='0'+new Array(i-start).join(' ');}
      else if(c==='/'&&n==='/'){i+=2;while(i<source.length&&!/[\r\n]/.test(source.charAt(i)))++i;code+=new Array(i-start+1).join(' ');}
      else if(c==='/'&&n==='*'){var end=source.indexOf('*/',i+2);if(end<0)return null;i=end+2;code+=source.slice(start,i).replace(/[^\r\n]/g,' ');}
      else{code+=c;++i;}
   }return code;
}
function replayLiteralProperty(source,variable,key) {
   var skeleton=replaySourceSkeleton(source);if(skeleton===null)return undefined;
   var match=new RegExp('\\b'+variable+'\\.'+key+'\\s*=\\s*').exec(skeleton);if(!match)return undefined;
   var start=match.index+match[0].length,end=skeleton.indexOf(';',start),value=source.slice(start,end).trim();
   if(value==='true'||value==='false'||value==='null'||/^-?[0-9.]+$/.test(value))return JSON.parse(value);
   var text='';while(value){var token=/^"(?:[^"\\]|\\.)*"/.exec(value);if(!token)return undefined;text+=JSON.parse(token[0]);value=value.slice(token[0].length).trim();if(value.charAt(0)==='+')value=value.slice(1).trim();else if(value)return undefined;}return text;
}
function replayContainerSource(source) {
   var code=replaySourceSkeleton(source);if(code===null)return null;
   var root=/^\s*var\s+(\w+)\s*=\s*new\s+ProcessContainer\s*(?:\(\s*\))?\s*;/.exec(code);if(!root)return null;
   var variable=root[1],cursor=root[0].length,used={},count=0;
   var allowed={PixelMath:1,HistogramTransformation:1,CurvesTransformation:1,RGBWorkingSpace:1,SCNR:1,ColorSaturation:1,BlurXTerminator:1,NoiseXTerminator:1,GradientCorrection:1,StarXTerminator:1,NarrowbandNormalization:1,UnsharpMask:1,MultiscaleLinearTransform:1,Invert:1,Convolution:1};
   while(/\S/.test(code.slice(cursor))){
      var declaration=/^\s*var\s+(\w+)\s*=\s*new\s+(\w+)\s*(?:\(\s*\))?\s*;/.exec(code.slice(cursor));if(!declaration||!allowed[declaration[2]]||declaration[1]===variable||used['$'+declaration[1]])return null;
      var child=declaration[1],tool=declaration[2];used['$'+child]=true;
      var add=new RegExp('\\b'+variable+'\\s*\\.\\s*add\\s*\\(\\s*'+child+'\\s*\\)\\s*;','g');add.lastIndex=cursor+declaration[0].length;var match=add.exec(code);if(!match)return null;
      var chunk=source.slice(cursor,match.index),parsed=replayProcessSource(chunk,tool);if(!parsed)return null;
      if(tool==='PixelMath'){
         var proc={processId:function(){return 'PixelMath';}};
         var keys=['expression','expression1','expression2','expression3','symbols','useSingleExpression','generateOutput','clearImageCacheAndExit','createNewImage'];
         for(var k=0;k<keys.length;++k)proc[keys[k]]=replayLiteralProperty(chunk,child,keys[k]);
         var pixel=pixelMathReplaySource({proc:proc,source:chunk,mask:{status:'unrecorded'}});if(!pixel||pixel.inputs.length||pixel.createsImage)return null;
      }
      if(tool==='RGBWorkingSpace'&&replayLiteralProperty(chunk,child,'applyGlobalRGBWS')===true)return null;
      if(tool==='StarXTerminator'&&replayLiteralProperty(chunk,child,'stars')===true)return null;
      cursor=match.index+match[0].length;++count;
   }
   return count?{source:source,variable:variable}:null;
}

function isImageOriginStep(step, index) {
   var position = typeof step.historyEntryIndex === 'number' ? step.historyEntryIndex : index;
   return !step.redo && /^(ImageIntegration|FastIntegration)$/.test(getProcessName(step.proc)) && (step.phase === 'initial' || position === 0);
}

function paletteReplaySource(group) {
   if (group.title !== 'PerfectPalettePicker') return null;
   var last = group.members[group.members.length-1], proc = last.proc;
   if (getProcessName(proc) !== 'PixelMath' || proc.useSingleExpression !== false ||
       proc.createNewImage !== false || proc.generateOutput !== true ||
       proc.clearImageCacheAndExit === true || (proc.symbols || '').trim() ||
       (proc.expression3 || '').trim()) return null;
   var parsed = replayProcessSource(last.source, 'PixelMath');
   if (!parsed) return null;
   var inputs = [], expressions = [proc.expression, proc.expression1, proc.expression2];
   for (var e = 0; e < expressions.length; ++e) {
      if (typeof expressions[e] !== 'string' || !expressions[e].trim()) return null;
      // Restrict this first implementation to the arithmetic palette formulas.
      var text = expressions[e].replace(/\b(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\b/g, '0');
      if (/[^A-Za-z0-9_\s+*\/^~().-]/.test(text) || /[A-Za-z_]\w*\s*[.(]/.test(text)) return null;
      var tokens = text.match(/[A-Za-z_]\w*/g) || [];
      for (var t = 0; t < tokens.length; ++t) if (inputs.indexOf(tokens[t]) < 0) inputs.push(tokens[t]);
   }
   if (!inputs.length || inputs.length > 16) return null;
   for (var m = 0; m < group.members.length; ++m) {
      var mask = group.members[m].mask;
      if (!mask || mask.status !== 'unrecorded') return null;
      var refs = group.members[m].references || [];
      for (var r = 0; r < refs.length; ++r)
         if (refs[r].kind !== 'input' && refs[r].kind !== 'reference') return null;
   }
   return {source:parsed.source, variable:parsed.variable, inputs:inputs};
}

function pixelMathTextTokens(text) {
   var tokens = [], i = 0, depth = 0, itemStart = true;
   while (i < text.length) {
      var c = text.charAt(i), next = text.charAt(i+1);
      if (c === '/' && next === '/') { i += 2; while (i < text.length && !/[\r\n]/.test(text.charAt(i))) ++i; }
      else if (c === '/' && next === '*') {
         var end = text.indexOf('*/', i+2); if (end < 0) throw Error('Unterminated PixelMath comment.'); i = end+2;
      } else if (c === '"' || c === "'" || c === '#' || text.substr(i,2) === '->' || text.substr(i,2) === '::') {
         throw Error('PixelMath quoted strings, directives and preview references are not supported by replay.');
      } else {
         var number = /^(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
         if (number) { i += number[0].length; itemStart = false; continue; }
         var name = /^[A-Za-z_]\w*/.exec(text.slice(i));
         if (name) {
            var start = i; i += name[0].length;
            var after = i;
            while (after < text.length) {
               if (/\s/.test(text.charAt(after))) ++after;
               else if (text.charAt(after) === '/' && text.charAt(after+1) === '*') { var end = text.indexOf('*/',after+2); if (end < 0) throw Error('Unterminated PixelMath comment.'); after = end+2; }
               else if (text.charAt(after) === '/' && text.charAt(after+1) === '/') { after += 2; while (after < text.length && !/[\r\n]/.test(text.charAt(after))) ++after; }
               else break;
            }
            tokens.push({name:name[0],start:start,end:i,macro:text.charAt(start-1)==='$',call:text.charAt(after)==='(',noArguments:/^\(\s*\)/.test(text.slice(after)),local:text.charAt(after)==='='&&text.charAt(after+1)!=='=',itemStart:depth===0&&itemStart});
            itemStart = false;
         } else {
            if (c === '(' || c === '[' || c === '{') { ++depth; itemStart = false; }
            else if (c === ')' || c === ']' || c === '}') { --depth; itemStart = false; }
            else if ((c === ',' || c === ';') && depth === 0) itemStart = true;
            else if (!/\s/.test(c)) itemStart = false;
            ++i;
         }
      }
   }
   return tokens;
}

function pixelMathReplaySource(step) {
   if (getProcessName(step.proc) !== 'PixelMath') return null;
   var proc = step.proc, parsed = replayProcessSource(step.source, 'PixelMath');
   if (!parsed || proc.generateOutput === false || proc.clearImageCacheAndExit === true) return null;
   var keys = proc.useSingleExpression === false ? ['expression','expression1','expression2','expression3'] : ['expression','expression3'];
   var texts = [], tokenLists = [], locals = {}, inputs = [], hasExpression = false, requiresTarget = false;
   try {
      for (var e = 0; e < keys.length; ++e) { var text = proc[keys[e]] || ''; texts.push(text); if (text.trim()) hasExpression = true; }
      if (!hasExpression) return null;
      texts.push(proc.symbols || '');
      for (var e = 0; e < texts.length; ++e) {
         var tokens = pixelMathTextTokens(texts[e]); tokenLists.push(tokens);
         for (var t = 0; t < tokens.length; ++t) if (tokens[t].local) locals['$'+tokens[t].name] = true;
         if (e === texts.length-1)
            for (var t = 0; t < tokens.length; ++t) if (tokens[t].itemStart && !tokens[t].call && !tokens[t].macro) locals['$'+tokens[t].name] = true;
      }
      for (var e = 0; e < tokenLists.length; ++e) for (var t = 0; t < tokenLists[e].length; ++t) {
         var token = tokenLists[e][t];
         if (token.macro || (token.call && token.noArguments)) requiresTarget = true;
         if (token.macro) {
            if (['T','target','M','mask'].indexOf(token.name) < 0) return null;
            if ((token.name === 'M' || token.name === 'mask') && (!step.mask || step.mask.status !== 'recorded')) return null;
         } else if (!token.call && !locals['$'+token.name] && ['true','false'].indexOf(token.name) < 0 && inputs.indexOf(token.name) < 0) inputs.push(token.name);
      }
   } catch (e) { return null; }
   return {source:parsed.source,variable:parsed.variable,inputs:inputs,createsImage:proc.createNewImage===true,requiresTarget:requiresTarget,outputId:proc.newImageId||''};
}

function gameReplaySource(step) {
   var proc = step.proc;
   if (getProcessName(proc) !== 'Script' || getProcessTitle(proc).toLowerCase() !== 'game' ||
       typeof proc.md5sum !== 'string' || !/^[0-9a-f]{32}$/i.test(proc.md5sum) ||
       !proc.parameters || proc.parameters.length || !replayProcessSource(step.source, 'Script')) return null;
   // GAME records no drawing settings in the Script instance. Resume from a
   // user-supplied completed mask instead of inventing its geometry.
   return {source:'var P = {};', variable:'P'};
}

function selectiveColorReplaySource(step) {
   if (getProcessName(step.proc) !== 'Script' || getProcessTitle(step.proc).toLowerCase() !== 'selectivecolorcorrection') return null;
   var proc = step.proc, parsed = replayProcessSource(step.source, 'Script');
   if (!parsed || typeof proc.md5sum !== 'string' || !/^[0-9a-f]{32}$/i.test(proc.md5sum) || !proc.parameters || !proc.parameters.length) return null;
   var realKeys = ['maskShadows','maskBalance','maskHighlights','cyan','magenta','yellow','red','green','blue','luminance','starMaskIntensity','saturation','contrast','maskSmoothness','maskIntensity'];
   var boolKeys = ['useStarMask','showMask','invertMask'], values = {}, parameters = [];
   for (var p = 0; p < proc.parameters.length; ++p) {
      var row = proc.parameters[p]; if (!row || row.length !== 2 || typeof row[0] !== 'string' || typeof row[1] !== 'string' || values['$'+row[0]] !== undefined) return null;
      var key = row[0], value = row[1];
      if (realKeys.indexOf(key) >= 0 || key === 'previewMode') {
         if (!value.trim() || !isFinite(Number(value)) || (key === 'previewMode' && Number(value) !== Math.floor(Number(value)))) return null;
      } else if (boolKeys.indexOf(key) >= 0) {
         if (value !== 'true' && value !== 'false') return null;
      } else if (key === 'filterMethod') {
         if (['Red','Green','Blue','Cyan','Magenta','Yellow','Low Saturation','High Saturation','Shadows','Midtones','Highlights','Luminance'].indexOf(value) < 0) return null;
      } else return null;
      values['$'+key] = value; parameters.push([key,value]);
   }
   var required = realKeys.concat(boolKeys, ['previewMode','filterMethod']);
   for (var k = 0; k < required.length; ++k) if (values['$'+required[k]] === undefined) return null;
   var includePath = '', sourceDigest = '';
   try {
      if (typeof coreSrcDirPath !== 'string' || !coreSrcDirPath) return null;
      includePath = coreSrcDirPath.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '') + '/scripts/Toolbox/SelectiveColorCorrection.js';
      if (/["\r\n]/.test(includePath)) return null;
      sourceDigest = (new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(includePath)).toHex();
      if (!/^[0-9a-f]{64}$/i.test(sourceDigest)) return null;
   } catch (e) { return null; }
   return {source:'var P = '+JSON.stringify({filePath:includePath,sourceDigest:sourceDigest,md5sum:proc.md5sum,parameters:parameters})+';',
      variable:'P', starRequired:values.$useStarMask === 'true'};
}

function selectiveColorReplayBlockReason(step) {
   var parameters = step.proc.parameters || [];
   for (var p = 0; p < parameters.length; ++p)
      if (parameters[p] && parameters[p][0] === 'filterMethod' && parameters[p][1] === 'Imported Mask')
         return 'SelectiveColorCorrection imported mask is not recorded and cannot be reconstructed.';
   return 'SelectiveColorCorrection requires complete saved parameters, valid serialization and its readable installed source file.';
}

var DARK_STRUCTURE_GPL_LICENSE = "                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n\n Copyright (C) 2007 Free Software Foundation, Inc. <https:\u002f\u002ffsf.org\u002f>\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n                            Preamble\n\n  The GNU General Public License is a free, copyleft license for\nsoftware and other kinds of works.\n\n  The licenses for most software and other practical works are designed\nto take away your freedom to share and change the works.  By contrast,\nthe GNU General Public License is intended to guarantee your freedom to\nshare and change all versions of a program--to make sure it remains free\nsoftware for all its users.  We, the Free Software Foundation, use the\nGNU General Public License for most of our software; it applies also to\nany other work released this way by its authors.  You can apply it to\nyour programs, too.\n\n  When we speak of free software, we are referring to freedom, not\nprice.  Our General Public Licenses are designed to make sure that you\nhave the freedom to distribute copies of free software (and charge for\nthem if you wish), that you receive source code or can get it if you\nwant it, that you can change the software or use pieces of it in new\nfree programs, and that you know you can do these things.\n\n  To protect your rights, we need to prevent others from denying you\nthese rights or asking you to surrender the rights.  Therefore, you have\ncertain responsibilities if you distribute copies of the software, or if\nyou modify it: responsibilities to respect the freedom of others.\n\n  For example, if you distribute copies of such a program, whether\ngratis or for a fee, you must pass on to the recipients the same\nfreedoms that you received.  You must make sure that they, too, receive\nor can get the source code.  And you must show them these terms so they\nknow their rights.\n\n  Developers that use the GNU GPL protect your rights with two steps:\n(1) assert copyright on the software, and (2) offer you this License\ngiving you legal permission to copy, distribute and\u002for modify it.\n\n  For the developers' and authors' protection, the GPL clearly explains\nthat there is no warranty for this free software.  For both users' and\nauthors' sake, the GPL requires that modified versions be marked as\nchanged, so that their problems will not be attributed erroneously to\nauthors of previous versions.\n\n  Some devices are designed to deny users access to install or run\nmodified versions of the software inside them, although the manufacturer\ncan do so.  This is fundamentally incompatible with the aim of\nprotecting users' freedom to change the software.  The systematic\npattern of such abuse occurs in the area of products for individuals to\nuse, which is precisely where it is most unacceptable.  Therefore, we\nhave designed this version of the GPL to prohibit the practice for those\nproducts.  If such problems arise substantially in other domains, we\nstand ready to extend this provision to those domains in future versions\nof the GPL, as needed to protect the freedom of users.\n\n  Finally, every program is threatened constantly by software patents.\nStates should not allow patents to restrict development and use of\nsoftware on general-purpose computers, but in those that do, we wish to\navoid the special danger that patents applied to a free program could\nmake it effectively proprietary.  To prevent this, the GPL assures that\npatents cannot be used to render the program non-free.\n\n  The precise terms and conditions for copying, distribution and\nmodification follow.\n\n                       TERMS AND CONDITIONS\n\n  0. Definitions.\n\n  \"This License\" refers to version 3 of the GNU General Public License.\n\n  \"Copyright\" also means copyright-like laws that apply to other kinds of\nworks, such as semiconductor masks.\n\n  \"The Program\" refers to any copyrightable work licensed under this\nLicense.  Each licensee is addressed as \"you\".  \"Licensees\" and\n\"recipients\" may be individuals or organizations.\n\n  To \"modify\" a work means to copy from or adapt all or part of the work\nin a fashion requiring copyright permission, other than the making of an\nexact copy.  The resulting work is called a \"modified version\" of the\nearlier work or a work \"based on\" the earlier work.\n\n  A \"covered work\" means either the unmodified Program or a work based\non the Program.\n\n  To \"propagate\" a work means to do anything with it that, without\npermission, would make you directly or secondarily liable for\ninfringement under applicable copyright law, except executing it on a\ncomputer or modifying a private copy.  Propagation includes copying,\ndistribution (with or without modification), making available to the\npublic, and in some countries other activities as well.\n\n  To \"convey\" a work means any kind of propagation that enables other\nparties to make or receive copies.  Mere interaction with a user through\na computer network, with no transfer of a copy, is not conveying.\n\n  An interactive user interface displays \"Appropriate Legal Notices\"\nto the extent that it includes a convenient and prominently visible\nfeature that (1) displays an appropriate copyright notice, and (2)\ntells the user that there is no warranty for the work (except to the\nextent that warranties are provided), that licensees may convey the\nwork under this License, and how to view a copy of this License.  If\nthe interface presents a list of user commands or options, such as a\nmenu, a prominent item in the list meets this criterion.\n\n  1. Source Code.\n\n  The \"source code\" for a work means the preferred form of the work\nfor making modifications to it.  \"Object code\" means any non-source\nform of a work.\n\n  A \"Standard Interface\" means an interface that either is an official\nstandard defined by a recognized standards body, or, in the case of\ninterfaces specified for a particular programming language, one that\nis widely used among developers working in that language.\n\n  The \"System Libraries\" of an executable work include anything, other\nthan the work as a whole, that (a) is included in the normal form of\npackaging a Major Component, but which is not part of that Major\nComponent, and (b) serves only to enable use of the work with that\nMajor Component, or to implement a Standard Interface for which an\nimplementation is available to the public in source code form.  A\n\"Major Component\", in this context, means a major essential component\n(kernel, window system, and so on) of the specific operating system\n(if any) on which the executable work runs, or a compiler used to\nproduce the work, or an object code interpreter used to run it.\n\n  The \"Corresponding Source\" for a work in object code form means all\nthe source code needed to generate, install, and (for an executable\nwork) run the object code and to modify the work, including scripts to\ncontrol those activities.  However, it does not include the work's\nSystem Libraries, or general-purpose tools or generally available free\nprograms which are used unmodified in performing those activities but\nwhich are not part of the work.  For example, Corresponding Source\nincludes interface definition files associated with source files for\nthe work, and the source code for shared libraries and dynamically\nlinked subprograms that the work is specifically designed to require,\nsuch as by intimate data communication or control flow between those\nsubprograms and other parts of the work.\n\n  The Corresponding Source need not include anything that users\ncan regenerate automatically from other parts of the Corresponding\nSource.\n\n  The Corresponding Source for a work in source code form is that\nsame work.\n\n  2. Basic Permissions.\n\n  All rights granted under this License are granted for the term of\ncopyright on the Program, and are irrevocable provided the stated\nconditions are met.  This License explicitly affirms your unlimited\npermission to run the unmodified Program.  The output from running a\ncovered work is covered by this License only if the output, given its\ncontent, constitutes a covered work.  This License acknowledges your\nrights of fair use or other equivalent, as provided by copyright law.\n\n  You may make, run and propagate covered works that you do not\nconvey, without conditions so long as your license otherwise remains\nin force.  You may convey covered works to others for the sole purpose\nof having them make modifications exclusively for you, or provide you\nwith facilities for running those works, provided that you comply with\nthe terms of this License in conveying all material for which you do\nnot control copyright.  Those thus making or running the covered works\nfor you must do so exclusively on your behalf, under your direction\nand control, on terms that prohibit them from making any copies of\nyour copyrighted material outside their relationship with you.\n\n  Conveying under any other circumstances is permitted solely under\nthe conditions stated below.  Sublicensing is not allowed; section 10\nmakes it unnecessary.\n\n  3. Protecting Users' Legal Rights From Anti-Circumvention Law.\n\n  No covered work shall be deemed part of an effective technological\nmeasure under any applicable law fulfilling obligations under article\n11 of the WIPO copyright treaty adopted on 20 December 1996, or\nsimilar laws prohibiting or restricting circumvention of such\nmeasures.\n\n  When you convey a covered work, you waive any legal power to forbid\ncircumvention of technological measures to the extent such circumvention\nis effected by exercising rights under this License with respect to\nthe covered work, and you disclaim any intention to limit operation or\nmodification of the work as a means of enforcing, against the work's\nusers, your or third parties' legal rights to forbid circumvention of\ntechnological measures.\n\n  4. Conveying Verbatim Copies.\n\n  You may convey verbatim copies of the Program's source code as you\nreceive it, in any medium, provided that you conspicuously and\nappropriately publish on each copy an appropriate copyright notice;\nkeep intact all notices stating that this License and any\nnon-permissive terms added in accord with section 7 apply to the code;\nkeep intact all notices of the absence of any warranty; and give all\nrecipients a copy of this License along with the Program.\n\n  You may charge any price or no price for each copy that you convey,\nand you may offer support or warranty protection for a fee.\n\n  5. Conveying Modified Source Versions.\n\n  You may convey a work based on the Program, or the modifications to\nproduce it from the Program, in the form of source code under the\nterms of section 4, provided that you also meet all of these conditions:\n\n    a) The work must carry prominent notices stating that you modified\n    it, and giving a relevant date.\n\n    b) The work must carry prominent notices stating that it is\n    released under this License and any conditions added under section\n    7.  This requirement modifies the requirement in section 4 to\n    \"keep intact all notices\".\n\n    c) You must license the entire work, as a whole, under this\n    License to anyone who comes into possession of a copy.  This\n    License will therefore apply, along with any applicable section 7\n    additional terms, to the whole of the work, and all its parts,\n    regardless of how they are packaged.  This License gives no\n    permission to license the work in any other way, but it does not\n    invalidate such permission if you have separately received it.\n\n    d) If the work has interactive user interfaces, each must display\n    Appropriate Legal Notices; however, if the Program has interactive\n    interfaces that do not display Appropriate Legal Notices, your\n    work need not make them do so.\n\n  A compilation of a covered work with other separate and independent\nworks, which are not by their nature extensions of the covered work,\nand which are not combined with it such as to form a larger program,\nin or on a volume of a storage or distribution medium, is called an\n\"aggregate\" if the compilation and its resulting copyright are not\nused to limit the access or legal rights of the compilation's users\nbeyond what the individual works permit.  Inclusion of a covered work\nin an aggregate does not cause this License to apply to the other\nparts of the aggregate.\n\n  6. Conveying Non-Source Forms.\n\n  You may convey a covered work in object code form under the terms\nof sections 4 and 5, provided that you also convey the\nmachine-readable Corresponding Source under the terms of this License,\nin one of these ways:\n\n    a) Convey the object code in, or embodied in, a physical product\n    (including a physical distribution medium), accompanied by the\n    Corresponding Source fixed on a durable physical medium\n    customarily used for software interchange.\n\n    b) Convey the object code in, or embodied in, a physical product\n    (including a physical distribution medium), accompanied by a\n    written offer, valid for at least three years and valid for as\n    long as you offer spare parts or customer support for that product\n    model, to give anyone who possesses the object code either (1) a\n    copy of the Corresponding Source for all the software in the\n    product that is covered by this License, on a durable physical\n    medium customarily used for software interchange, for a price no\n    more than your reasonable cost of physically performing this\n    conveying of source, or (2) access to copy the\n    Corresponding Source from a network server at no charge.\n\n    c) Convey individual copies of the object code with a copy of the\n    written offer to provide the Corresponding Source.  This\n    alternative is allowed only occasionally and noncommercially, and\n    only if you received the object code with such an offer, in accord\n    with subsection 6b.\n\n    d) Convey the object code by offering access from a designated\n    place (gratis or for a charge), and offer equivalent access to the\n    Corresponding Source in the same way through the same place at no\n    further charge.  You need not require recipients to copy the\n    Corresponding Source along with the object code.  If the place to\n    copy the object code is a network server, the Corresponding Source\n    may be on a different server (operated by you or a third party)\n    that supports equivalent copying facilities, provided you maintain\n    clear directions next to the object code saying where to find the\n    Corresponding Source.  Regardless of what server hosts the\n    Corresponding Source, you remain obligated to ensure that it is\n    available for as long as needed to satisfy these requirements.\n\n    e) Convey the object code using peer-to-peer transmission, provided\n    you inform other peers where the object code and Corresponding\n    Source of the work are being offered to the general public at no\n    charge under subsection 6d.\n\n  A separable portion of the object code, whose source code is excluded\nfrom the Corresponding Source as a System Library, need not be\nincluded in conveying the object code work.\n\n  A \"User Product\" is either (1) a \"consumer product\", which means any\ntangible personal property which is normally used for personal, family,\nor household purposes, or (2) anything designed or sold for incorporation\ninto a dwelling.  In determining whether a product is a consumer product,\ndoubtful cases shall be resolved in favor of coverage.  For a particular\nproduct received by a particular user, \"normally used\" refers to a\ntypical or common use of that class of product, regardless of the status\nof the particular user or of the way in which the particular user\nactually uses, or expects or is expected to use, the product.  A product\nis a consumer product regardless of whether the product has substantial\ncommercial, industrial or non-consumer uses, unless such uses represent\nthe only significant mode of use of the product.\n\n  \"Installation Information\" for a User Product means any methods,\nprocedures, authorization keys, or other information required to install\nand execute modified versions of a covered work in that User Product from\na modified version of its Corresponding Source.  The information must\nsuffice to ensure that the continued functioning of the modified object\ncode is in no case prevented or interfered with solely because\nmodification has been made.\n\n  If you convey an object code work under this section in, or with, or\nspecifically for use in, a User Product, and the conveying occurs as\npart of a transaction in which the right of possession and use of the\nUser Product is transferred to the recipient in perpetuity or for a\nfixed term (regardless of how the transaction is characterized), the\nCorresponding Source conveyed under this section must be accompanied\nby the Installation Information.  But this requirement does not apply\nif neither you nor any third party retains the ability to install\nmodified object code on the User Product (for example, the work has\nbeen installed in ROM).\n\n  The requirement to provide Installation Information does not include a\nrequirement to continue to provide support service, warranty, or updates\nfor a work that has been modified or installed by the recipient, or for\nthe User Product in which it has been modified or installed.  Access to a\nnetwork may be denied when the modification itself materially and\nadversely affects the operation of the network or violates the rules and\nprotocols for communication across the network.\n\n  Corresponding Source conveyed, and Installation Information provided,\nin accord with this section must be in a format that is publicly\ndocumented (and with an implementation available to the public in\nsource code form), and must require no special password or key for\nunpacking, reading or copying.\n\n  7. Additional Terms.\n\n  \"Additional permissions\" are terms that supplement the terms of this\nLicense by making exceptions from one or more of its conditions.\nAdditional permissions that are applicable to the entire Program shall\nbe treated as though they were included in this License, to the extent\nthat they are valid under applicable law.  If additional permissions\napply only to part of the Program, that part may be used separately\nunder those permissions, but the entire Program remains governed by\nthis License without regard to the additional permissions.\n\n  When you convey a copy of a covered work, you may at your option\nremove any additional permissions from that copy, or from any part of\nit.  (Additional permissions may be written to require their own\nremoval in certain cases when you modify the work.)  You may place\nadditional permissions on material, added by you to a covered work,\nfor which you have or can give appropriate copyright permission.\n\n  Notwithstanding any other provision of this License, for material you\nadd to a covered work, you may (if authorized by the copyright holders of\nthat material) supplement the terms of this License with terms:\n\n    a) Disclaiming warranty or limiting liability differently from the\n    terms of sections 15 and 16 of this License; or\n\n    b) Requiring preservation of specified reasonable legal notices or\n    author attributions in that material or in the Appropriate Legal\n    Notices displayed by works containing it; or\n\n    c) Prohibiting misrepresentation of the origin of that material, or\n    requiring that modified versions of such material be marked in\n    reasonable ways as different from the original version; or\n\n    d) Limiting the use for publicity purposes of names of licensors or\n    authors of the material; or\n\n    e) Declining to grant rights under trademark law for use of some\n    trade names, trademarks, or service marks; or\n\n    f) Requiring indemnification of licensors and authors of that\n    material by anyone who conveys the material (or modified versions of\n    it) with contractual assumptions of liability to the recipient, for\n    any liability that these contractual assumptions directly impose on\n    those licensors and authors.\n\n  All other non-permissive additional terms are considered \"further\nrestrictions\" within the meaning of section 10.  If the Program as you\nreceived it, or any part of it, contains a notice stating that it is\ngoverned by this License along with a term that is a further\nrestriction, you may remove that term.  If a license document contains\na further restriction but permits relicensing or conveying under this\nLicense, you may add to a covered work material governed by the terms\nof that license document, provided that the further restriction does\nnot survive such relicensing or conveying.\n\n  If you add terms to a covered work in accord with this section, you\nmust place, in the relevant source files, a statement of the\nadditional terms that apply to those files, or a notice indicating\nwhere to find the applicable terms.\n\n  Additional terms, permissive or non-permissive, may be stated in the\nform of a separately written license, or stated as exceptions;\nthe above requirements apply either way.\n\n  8. Termination.\n\n  You may not propagate or modify a covered work except as expressly\nprovided under this License.  Any attempt otherwise to propagate or\nmodify it is void, and will automatically terminate your rights under\nthis License (including any patent licenses granted under the third\nparagraph of section 11).\n\n  However, if you cease all violation of this License, then your\nlicense from a particular copyright holder is reinstated (a)\nprovisionally, unless and until the copyright holder explicitly and\nfinally terminates your license, and (b) permanently, if the copyright\nholder fails to notify you of the violation by some reasonable means\nprior to 60 days after the cessation.\n\n  Moreover, your license from a particular copyright holder is\nreinstated permanently if the copyright holder notifies you of the\nviolation by some reasonable means, this is the first time you have\nreceived notice of violation of this License (for any work) from that\ncopyright holder, and you cure the violation prior to 30 days after\nyour receipt of the notice.\n\n  Termination of your rights under this section does not terminate the\nlicenses of parties who have received copies or rights from you under\nthis License.  If your rights have been terminated and not permanently\nreinstated, you do not qualify to receive new licenses for the same\nmaterial under section 10.\n\n  9. Acceptance Not Required for Having Copies.\n\n  You are not required to accept this License in order to receive or\nrun a copy of the Program.  Ancillary propagation of a covered work\noccurring solely as a consequence of using peer-to-peer transmission\nto receive a copy likewise does not require acceptance.  However,\nnothing other than this License grants you permission to propagate or\nmodify any covered work.  These actions infringe copyright if you do\nnot accept this License.  Therefore, by modifying or propagating a\ncovered work, you indicate your acceptance of this License to do so.\n\n  10. Automatic Licensing of Downstream Recipients.\n\n  Each time you convey a covered work, the recipient automatically\nreceives a license from the original licensors, to run, modify and\npropagate that work, subject to this License.  You are not responsible\nfor enforcing compliance by third parties with this License.\n\n  An \"entity transaction\" is a transaction transferring control of an\norganization, or substantially all assets of one, or subdividing an\norganization, or merging organizations.  If propagation of a covered\nwork results from an entity transaction, each party to that\ntransaction who receives a copy of the work also receives whatever\nlicenses to the work the party's predecessor in interest had or could\ngive under the previous paragraph, plus a right to possession of the\nCorresponding Source of the work from the predecessor in interest, if\nthe predecessor has it or can get it with reasonable efforts.\n\n  You may not impose any further restrictions on the exercise of the\nrights granted or affirmed under this License.  For example, you may\nnot impose a license fee, royalty, or other charge for exercise of\nrights granted under this License, and you may not initiate litigation\n(including a cross-claim or counterclaim in a lawsuit) alleging that\nany patent claim is infringed by making, using, selling, offering for\nsale, or importing the Program or any portion of it.\n\n  11. Patents.\n\n  A \"contributor\" is a copyright holder who authorizes use under this\nLicense of the Program or a work on which the Program is based.  The\nwork thus licensed is called the contributor's \"contributor version\".\n\n  A contributor's \"essential patent claims\" are all patent claims\nowned or controlled by the contributor, whether already acquired or\nhereafter acquired, that would be infringed by some manner, permitted\nby this License, of making, using, or selling its contributor version,\nbut do not include claims that would be infringed only as a\nconsequence of further modification of the contributor version.  For\npurposes of this definition, \"control\" includes the right to grant\npatent sublicenses in a manner consistent with the requirements of\nthis License.\n\n  Each contributor grants you a non-exclusive, worldwide, royalty-free\npatent license under the contributor's essential patent claims, to\nmake, use, sell, offer for sale, import and otherwise run, modify and\npropagate the contents of its contributor version.\n\n  In the following three paragraphs, a \"patent license\" is any express\nagreement or commitment, however denominated, not to enforce a patent\n(such as an express permission to practice a patent or covenant not to\nsue for patent infringement).  To \"grant\" such a patent license to a\nparty means to make such an agreement or commitment not to enforce a\npatent against the party.\n\n  If you convey a covered work, knowingly relying on a patent license,\nand the Corresponding Source of the work is not available for anyone\nto copy, free of charge and under the terms of this License, through a\npublicly available network server or other readily accessible means,\nthen you must either (1) cause the Corresponding Source to be so\navailable, or (2) arrange to deprive yourself of the benefit of the\npatent license for this particular work, or (3) arrange, in a manner\nconsistent with the requirements of this License, to extend the patent\nlicense to downstream recipients.  \"Knowingly relying\" means you have\nactual knowledge that, but for the patent license, your conveying the\ncovered work in a country, or your recipient's use of the covered work\nin a country, would infringe one or more identifiable patents in that\ncountry that you have reason to believe are valid.\n\n  If, pursuant to or in connection with a single transaction or\narrangement, you convey, or propagate by procuring conveyance of, a\ncovered work, and grant a patent license to some of the parties\nreceiving the covered work authorizing them to use, propagate, modify\nor convey a specific copy of the covered work, then the patent license\nyou grant is automatically extended to all recipients of the covered\nwork and works based on it.\n\n  A patent license is \"discriminatory\" if it does not include within\nthe scope of its coverage, prohibits the exercise of, or is\nconditioned on the non-exercise of one or more of the rights that are\nspecifically granted under this License.  You may not convey a covered\nwork if you are a party to an arrangement with a third party that is\nin the business of distributing software, under which you make payment\nto the third party based on the extent of your activity of conveying\nthe work, and under which the third party grants, to any of the\nparties who would receive the covered work from you, a discriminatory\npatent license (a) in connection with copies of the covered work\nconveyed by you (or copies made from those copies), or (b) primarily\nfor and in connection with specific products or compilations that\ncontain the covered work, unless you entered into that arrangement,\nor that patent license was granted, prior to 28 March 2007.\n\n  Nothing in this License shall be construed as excluding or limiting\nany implied license or other defenses to infringement that may\notherwise be available to you under applicable patent law.\n\n  12. No Surrender of Others' Freedom.\n\n  If conditions are imposed on you (whether by court order, agreement or\notherwise) that contradict the conditions of this License, they do not\nexcuse you from the conditions of this License.  If you cannot convey a\ncovered work so as to satisfy simultaneously your obligations under this\nLicense and any other pertinent obligations, then as a consequence you may\nnot convey it at all.  For example, if you agree to terms that obligate you\nto collect a royalty for further conveying from those to whom you convey\nthe Program, the only way you could satisfy both those terms and this\nLicense would be to refrain entirely from conveying the Program.\n\n  13. Use with the GNU Affero General Public License.\n\n  Notwithstanding any other provision of this License, you have\npermission to link or combine any covered work with a work licensed\nunder version 3 of the GNU Affero General Public License into a single\ncombined work, and to convey the resulting work.  The terms of this\nLicense will continue to apply to the part which is the covered work,\nbut the special requirements of the GNU Affero General Public License,\nsection 13, concerning interaction through a network will apply to the\ncombination as such.\n\n  14. Revised Versions of this License.\n\n  The Free Software Foundation may publish revised and\u002for new versions of\nthe GNU General Public License from time to time.  Such new versions will\nbe similar in spirit to the present version, but may differ in detail to\naddress new problems or concerns.\n\n  Each version is given a distinguishing version number.  If the\nProgram specifies that a certain numbered version of the GNU General\nPublic License \"or any later version\" applies to it, you have the\noption of following the terms and conditions either of that numbered\nversion or of any later version published by the Free Software\nFoundation.  If the Program does not specify a version number of the\nGNU General Public License, you may choose any version ever published\nby the Free Software Foundation.\n\n  If the Program specifies that a proxy can decide which future\nversions of the GNU General Public License can be used, that proxy's\npublic statement of acceptance of a version permanently authorizes you\nto choose that version for the Program.\n\n  Later license versions may give you additional or different\npermissions.  However, no additional obligations are imposed on any\nauthor or copyright holder as a result of your choosing to follow a\nlater version.\n\n  15. Disclaimer of Warranty.\n\n  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY\nAPPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT\nHOLDERS AND\u002fOR OTHER PARTIES PROVIDE THE PROGRAM \"AS IS\" WITHOUT WARRANTY\nOF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,\nTHE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR\nPURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM\nIS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF\nALL NECESSARY SERVICING, REPAIR OR CORRECTION.\n\n  16. Limitation of Liability.\n\n  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING\nWILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND\u002fOR CONVEYS\nTHE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY\nGENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE\nUSE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF\nDATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD\nPARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),\nEVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF\nSUCH DAMAGES.\n\n  17. Interpretation of Sections 15 and 16.\n\n  If the disclaimer of warranty and limitation of liability provided\nabove cannot be given local legal effect according to their terms,\nreviewing courts shall apply local law that most closely approximates\nan absolute waiver of all civil liability in connection with the\nProgram, unless a warranty or assumption of liability accompanies a\ncopy of the Program in return for a fee.\n\n                     END OF TERMS AND CONDITIONS\n\n            How to Apply These Terms to Your New Programs\n\n  If you develop a new program, and you want it to be of the greatest\npossible use to the public, the best way to achieve this is to make it\nfree software which everyone can redistribute and change under these terms.\n\n  To do so, attach the following notices to the program.  It is safest\nto attach them to the start of each source file to most effectively\nstate the exclusion of warranty; and each file should have at least\nthe \"copyright\" line and a pointer to where the full notice is found.\n\n    <one line to give the program's name and a brief idea of what it does.>\n    Copyright (C) <year>  <name of author>\n\n    This program is free software: you can redistribute it and\u002for modify\n    it under the terms of the GNU General Public License as published by\n    the Free Software Foundation, either version 3 of the License, or\n    (at your option) any later version.\n\n    This program is distributed in the hope that it will be useful,\n    but WITHOUT ANY WARRANTY; without even the implied warranty of\n    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n    GNU General Public License for more details.\n\n    You should have received a copy of the GNU General Public License\n    along with this program.  If not, see <https:\u002f\u002fwww.gnu.org\u002flicenses\u002f>.\n\nAlso add information on how to contact you by electronic and paper mail.\n\n  If the program does terminal interaction, make it output a short\nnotice like this when it starts in an interactive mode:\n\n    <program>  Copyright (C) <year>  <name of author>\n    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.\n    This is free software, and you are welcome to redistribute it\n    under certain conditions; type `show c' for details.\n\nThe hypothetical commands `show w' and `show c' should show the appropriate\nparts of the General Public License.  Of course, your program's commands\nmight be different; for a GUI interface, you would use an \"about box\".\n\n  You should also get your employer (if you work as a programmer) or school,\nif any, to sign a \"copyright disclaimer\" for the program, if necessary.\nFor more information on this, and how to apply and follow the GNU GPL, see\n<https:\u002f\u002fwww.gnu.org\u002flicenses\u002f>.\n\n  The GNU General Public License does not permit incorporating your program\ninto proprietary programs.  If your program is a subroutine library, you\nmay consider it more useful to permit linking proprietary applications with\nthe library.  If this is what you want to do, use the GNU Lesser General\nPublic License instead of this License.  But first, please read\n<https:\u002f\u002fwww.gnu.org\u002flicenses\u002fwhy-not-lgpl.html>.\n";

function darkStructureReplaySource(step) {
   if (getProcessName(step.proc) !== 'Script' || getProcessTitle(step.proc).toLowerCase() !== 'darkstructureenhance' ||
       !replayProcessSource(step.source, 'Script') || (step.proc.parameters || []).length) return null;
   try {
      if (typeof coreSrcDirPath !== 'string' || !coreSrcDirPath) return null;
      var path = coreSrcDirPath.replace(/\\/g, '/').replace(/\/+$/, '') + '/scripts/misc/DarkStructureEnhance.js';
      var library = File.readTextFile(path);
      if (!/var window = ImageWindow\.activeWindow;/.test(library) || !/this\.targetView = window\.currentView;/.test(library) ||
          !/function DarkMaskLayersDialog\(/.test(library) || !/function doDark\(/.test(library) || !/\bmain\(\);\s*$/.test(library) ||
          library.indexOf('GNU General Public License') < 0) return null;
      var digest = (new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(path)).toHex();
      if (!/^[0-9a-f]{64}$/i.test(digest)) return null;
      var rawLines = library.split(/\r?\n/), cleaned = [], skipping = false;
      for (var dl = 0; dl < rawLines.length; ++dl) {
         if (skipping || /^#feature/.test(rawLines[dl])) { skipping = /\\\s*$/.test(rawLines[dl]); continue; }
         cleaned.push(rawLines[dl]);
      }
      library = cleaned.join('\n');
      library = library.replace(/\bmain\(\);\s*$/, '').replace('var window = ImageWindow.activeWindow;', 'var window = target.window;')
         .replace('this.targetView = window.currentView;', 'this.targetView = target;')
         .replace(/data\.targetView\.beginProcess\(\);\s*pc\.executeOn\(\s*data\.targetView,\s*false\/\*swapFile\*\/\s*\);\s*data\.targetView\.endProcess\(\);/,
            'data.targetView.beginProcess();try{if(pc.executeOn(data.targetView,false)===false)throw Error("DarkStructureEnhance process failed.");}finally{data.targetView.endProcess();}')
         .replace(/\bTITLE\b/g, 'APA_DSE_TITLE').replace(/\bVERSION\b/g, 'APA_DSE_VERSION').replace(/\bnStarMask\b/g, 'APA_DSE_nStarMask');
      return {source:'var P = ' + JSON.stringify({filePath:path,sourceDigest:digest}) + ';', variable:'P', library:library};
   } catch (e) { return null; }
}

function narrowbandHueReplaySource(step){
   if(getProcessName(step.proc)!=='Script'||getProcessTitle(step.proc)!=='NarrowbandHueCombination'||!replayProcessSource(step.source,'Script'))return null;
   var proc=step.proc;if(!('parameters' in proc)||!Array.isArray(proc.parameters))return null;
   var values={},inputs=[],fields=[],numbers=['view1Hue','view2Hue','view3Hue','view1Amount','view2Amount','view3Amount','view4Amount','scnrAmount'],bools=['linkedStretch','autoStretch'];
   for(var i=0;i<proc.parameters.length;++i){var row=proc.parameters[i];if(!row||row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string'||Object.prototype.hasOwnProperty.call(values,row[0]))return null;var key=row[0],text=row[1];
      if(/^view[1-4]$/.test(key)){if(text&&!/^[A-Za-z_]\w*$/.test(text))return null;values[key]=text;}
      else if(numbers.indexOf(key)>=0){if(!text.trim()||!isFinite(Number(text)))return null;var value=Number(text),hue=/Hue$/.test(key);if(value<0||value>(hue?359:1))return null;values[key]=value;}
      else if(bools.indexOf(key)>=0){if(text!=='true'&&text!=='false')return null;values[key]=text==='true';}else return null;
   }
   var required=numbers.concat(bools);for(var i=0;i<required.length;++i)if(!Object.prototype.hasOwnProperty.call(values,required[i]))return null;
   if(!Object.prototype.hasOwnProperty.call(values,'view1')||!values.view1)return null;
   for(var i=1;i<=4;++i){var key='view'+i;if(!Object.prototype.hasOwnProperty.call(values,key))values[key]='';if(values[key]){fields.push({parameter:key,name:values[key],row:-1});if(inputs.indexOf(values[key])<0)inputs.push(values[key]);}}
   return {source:'var P = '+JSON.stringify(values)+';',variable:'P',inputs:inputs,parameters:fields};
}

function runNarrowbandHueReplay(settings,output,mapping){
   var views=[],owned=[],result=null,kept=false,oldId=output.mainView.id;
   function make(label,color){var id=oldId+'_APA_hue_'+label,n=1;while(!View.viewById(id).isNull)id=oldId+'_APA_hue_'+label+'_'+n++;var window=new ImageWindow(views[0].image.width,views[0].image.height,color?3:1,32,true,color,id);owned.push(window);return window;}
   function fill(window,value){window.mainView.beginProcess(UndoFlag_NoSwapFile);try{window.mainView.image.fill(value);}finally{window.mainView.endProcess();}}
   function execute(process,view){if(process.executeOn(view,false)===false)throw Error('NarrowbandHueCombination process failed.');}
   for(var i=1;i<=4;++i){var name=settings['view'+i];if(!name){views.push({isNull:true});continue;}var id=mapping['$'+name],view=View.viewById(id);if(!view||view.isNull)throw Error('Missing NarrowbandHueCombination input: '+name);if((i<4&&view.image.isColor)||(i===4&&!view.image.isColor))throw Error(i===4?'NarrowbandHueCombination stars input must be RGB.':'NarrowbandHueCombination narrowband inputs must be grayscale.');if(i>1&&(view.image.width!==views[0].image.width||view.image.height!==views[0].image.height))throw Error('NarrowbandHueCombination inputs must have matching dimensions.');views.push(view);}
   try{
      var saturation=make('saturation',false);fill(saturation,1);var factors=[];
      for(var i=0;i<3;++i){if(views[i].isNull)continue;var hue=make('hue'+i,false);fill(hue,settings['view'+(i+1)+'Hue']/360);var colored=make('color'+i,true);fill(colored,0);var combination=new ChannelCombination;combination.colorSpace=ChannelCombination.prototype.HSV;combination.channels=[[true,hue.mainView.id],[true,saturation.mainView.id],[true,views[i].id]];execute(combination,colored.mainView);factors.push('(1-('+settings['view'+(i+1)+'Amount']+'*'+colored.mainView.id+'))');}
      if(!views[3].isNull)factors.push('(1-mtf('+settings.view4Amount+','+views[3].id+'))');
      result=make('result',true);fill(result,0);var pixel=new PixelMath;pixel.expression='1-('+factors.join('*')+')';pixel.expression1='';pixel.expression2='';pixel.expression3='';pixel.symbols='';pixel.useSingleExpression=true;pixel.generateOutput=true;pixel.clearImageCacheAndExit=false;pixel.cacheGeneratedImages=false;pixel.singleThreaded=false;pixel.optimization=true;pixel.use64BitWorkingImage=false;pixel.rescale=false;pixel.truncate=true;pixel.truncateLower=0;pixel.truncateUpper=1;pixel.createNewImage=false;pixel.showNewImage=false;execute(pixel,result.mainView);
      var scnr=new SCNR;scnr.amount=settings.scnrAmount;scnr.colorToRemove=SCNR.prototype.Green;scnr.protectionMode=SCNR.prototype.AverageNeutral;scnr.preserveLightness=true;execute(scnr,result.mainView);
      if(typeof output.mainView.hasProperty==='function'&&output.mainView.hasProperty('AstroProcessAtlas:ChainOrigin'))result.mainView.setPropertyValue('AstroProcessAtlas:ChainOrigin',output.mainView.propertyValue('AstroProcessAtlas:ChainOrigin'));
      output.removeMask();output.forceClose();result.mainView.id=oldId;result.show();kept=true;return result;
   }finally{for(var i=0;i<owned.length;++i)if(!(kept&&owned[i]===result)&&!owned[i].isNull)owned[i].forceClose();}
}

function imageBlendReplaySource(step) {
   if(getProcessTitle(step.proc)!=='ImageBlend'||getProcessName(step.proc)!=='Script')return null;
   var parsed=replayProcessSource(step.source,'Script'),proc=step.proc;if(!parsed||!('parameters' in proc)||!Array.isArray(proc.parameters))return null;
   var real=['aBlackpoint','aHighlights','aMidtones','bBlackpoint','bHighlights','bMidtones','bOpacity','filterRadius','filterHue','filterSat','stfTargetBackground'],bool=['preserveLightness','createNewImage','inheritAstrometricSolution'],strings=['imageAId','imageBId','filterType','stfIndex','mode','newViewId'],values={},inputs=[];
   for(var i=0;i<proc.parameters.length;++i){var row=proc.parameters[i];if(!row||row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string'||('$'+row[0]) in values)return null;var key=row[0],value=row[1];
      if(real.indexOf(key)>=0){if(!value.trim()||!isFinite(Number(value)))return null;values['$'+key]=Number(value);}
      else if(bool.indexOf(key)>=0){if(value!=='true'&&value!=='false')return null;values['$'+key]=value==='true';}
      else if(strings.indexOf(key)>=0)values['$'+key]=value;else return null;
   }
   var required=real.concat(bool,strings);for(var i=0;i<required.length;++i)if(!('$'+required[i] in values))return null;
   if(!/^[A-Za-z_]\w*$/.test(values.$imageAId)||!/^[A-Za-z_]\w*$/.test(values.$imageBId))return null;
   if(['None','Blur','High pass','Hue','Colour'].indexOf(values.$filterType)<0||['None','Linked','Unlinked'].indexOf(values.$stfIndex)<0)return null;
   var modes=['Replace','Darken/Min','Multiply','Colour burn','Linear burn','Darker colour','Lighten/Max','Screen','Colour dodge','Linear dodge/Add','Lighter colour','Overlay','Soft light','Hard light','Vivid light','Linear light','Pin light','Difference','Exclusion','Subtract','Divide','Power','Arctan','Hue','Saturation','Colour','Lightness'];if(modes.indexOf(values.$mode)<0)return null;
   if(values.$aBlackpoint<0||values.$aHighlights>1||values.$aBlackpoint>=values.$aHighlights||values.$bBlackpoint<0||values.$bHighlights>1||values.$bBlackpoint>=values.$bHighlights||values.$aMidtones<0||values.$aMidtones>1||values.$bMidtones<0||values.$bMidtones>1||values.$bOpacity<0||values.$bOpacity>1||values.$filterRadius<0||values.$filterHue<0||values.$filterHue>360||values.$filterSat<0||values.$filterSat>1||values.$stfTargetBackground<=0||values.$stfTargetBackground>=1)return null;
   var root='',files=[];try{if(typeof coreSrcDirPath!=='string'||!coreSrcDirPath)return null;root=coreSrcDirPath.split(String.fromCharCode(92)).join('/').replace(/\/+$/,'')+'/scripts/CosmicPhotons/ImageBlend/lib/';if(/["\r\n]/.test(root))return null;
      for(var i=0;i<2;++i){var path=root+(i?'ImageBlendEngine.js':'Utilities.js'),digest=(new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(path)).toHex();if(!/^[0-9a-f]{64}$/i.test(digest))return null;files.push({path:path,digest:digest});}
   }catch(error){return null;}
   var settings={};for(var key in values)settings[key.slice(1)]=values[key];inputs.push(settings.imageAId);if(inputs.indexOf(settings.imageBId)<0)inputs.push(settings.imageBId);
   return {source:'var P = '+JSON.stringify({settings:settings,files:files})+';',variable:'P',inputs:inputs,createsImage:settings.createNewImage,requiresTarget:false,outputId:settings.newViewId};
}

function copyReplayMetadata(source,target){
   if('keywords' in source)target.keywords=source.keywords;
   var view=source.mainView;if('properties' in view&&typeof view.propertyValue==='function'&&typeof target.mainView.setPropertyValue==='function'){var names=view.properties;for(var i=0;i<names.length;++i){try{target.mainView.setPropertyValue(names[i],view.propertyValue(names[i]));if(typeof view.propertyAttributes==='function'&&typeof target.mainView.setPropertyAttributes==='function')target.mainView.setPropertyAttributes(names[i],view.propertyAttributes(names[i]));}catch(error){if(typeof Console!=='undefined')Console.writeln('Metadata property not copied: '+names[i]+' — '+error.message);}}}
   if('hasAstrometricSolution' in source&&source.hasAstrometricSolution&&typeof target.copyAstrometricSolution==='function')target.copyAstrometricSolution(source);
}

function nativeImageReplayParameters(step,owner,first){
   var tool=getProcessName(step.proc);if(['ColorCalibration','BackgroundNeutralization','LRGBCombination','ChannelCombination'].indexOf(tool)<0)return null;
   var proc=step.proc,parameters=[],inputs=[],error='',creates=false;
   function add(parameter,name,row){if(!name)return;if(typeof name!=='string'||!name.trim()){error='Invalid recorded image reference.';return;}name=name.trim();parameters.push({parameter:parameter,name:name,row:row===undefined?-1:row});if(inputs.indexOf(name)<0)inputs.push(name);}
   if(tool==='ChannelCombination'){
      if(!('channels' in proc)||!proc.channels||proc.channels.length!==3)return {error:'ChannelCombination requires its three recorded channel rows.'};
      var spaces={RGB:['R','G','B'],CIEXYZ:['X','Y','Z'],CIELab:['L','a','b'],CIELch:['L','c','h'],HSV:['H','S','V'],HSI:['H','S','I']},labels=null;
      for(var space in spaces)if((space in proc&&'colorSpace' in proc&&proc.colorSpace===proc[space])||new RegExp('[.]colorSpace\\s*=\\s*(?:ChannelCombination[.]prototype[.]|[A-Za-z_]\\w*[.])'+space+'\\s*;').test(step.source))labels=spaces[space];
      var enabled=0;for(var c=0;c<3;++c){var row=proc.channels[c];if(!row||row.length<2)return {error:'Incomplete ChannelCombination channel parameters.'};if(row[0]){enabled++;if(!row[1]&&!labels)return {error:'ChannelCombination Auto inputs need a recorded color space with known channel labels.'};add('channels',row[1]||owner.id+'_'+labels[c],c);}}
      if(!enabled)error='ChannelCombination has no enabled source channels.';
      creates=!!first&&step.mask&&step.mask.status==='unrecorded'&&!!proc.channels[0][0]&&!!proc.channels[1][0]&&!!proc.channels[2][0];
   }else if(tool==='LRGBCombination'){
      if(!('channels' in proc)||!proc.channels||proc.channels.length!==4)return {error:'LRGBCombination requires its four recorded channel rows.'};
      var lrEnabled=0,lrLabels=['R','G','B','L'];for(var lc=0;lc<4;++lc){var lrRow=proc.channels[lc];if(!lrRow||lrRow.length<3)return {error:'Incomplete LRGBCombination channel parameters.'};if(lrRow[0]){lrEnabled++;add('channels',lrRow[1]||owner.id+'_'+lrLabels[lc],lc);}}
      if(!lrEnabled)error='LRGBCombination has no enabled source channels.';
      creates=!!first&&step.mask&&step.mask.status==='unrecorded'&&!!proc.channels[0][0]&&!!proc.channels[1][0]&&!!proc.channels[2][0];
   }else{
      if(tool==='ColorCalibration'&&!(('manualWhiteBalance' in proc)&&proc.manualWhiteBalance===true)&&'whiteReferenceViewId' in proc)add('whiteReferenceViewId',proc.whiteReferenceViewId);
      if('backgroundReferenceViewId' in proc)add('backgroundReferenceViewId',proc.backgroundReferenceViewId);
   }
   return {parameters:parameters,inputs:inputs,error:error,createsImage:creates,requiresTarget:!creates};
}

function workspaceReplayData(records) {
   var data = [];
   var supported = {HistogramTransformation:true, CurvesTransformation:true, RGBWorkingSpace:true,
      SCNR:true, ColorSaturation:true, BlurXTerminator:true, NoiseXTerminator:true, GradientCorrection:true,
      StarXTerminator:true, NarrowbandNormalization:true, UnsharpMask:true, MultiscaleLinearTransform:true, Invert:true, Convolution:true, ProcessContainer:true, ColorCalibration:true, LRGBCombination:true, BackgroundNeutralization:true, ChannelCombination:true, SpectrophotometricFluxCalibration:true, DynamicCrop:true, FastRotation:true};
   for (var r = 0; r < records.length; ++r) {
      var record = records[r], image = {id:record.id, anchor:record.anchor, version:ASTROPROCESS_ATLAS_VERSION, aliases:imageIdentityAliases(record), originalInputs:[], steps:[]};
      for (var oi = 0; oi < records.length; ++oi) if (records[oi].isOriginalInput) image.originalInputs.push(records[oi].id);
      var groups = workspaceStepGroups(record);
      for (var s = 0; s < groups.length; ++s) {
         var group = groups[s], step = group.members[0];
         if (step.redo) continue;
         if (group.members.length > 1) {
            var palette = paletteReplaySource(group);
            var selective = group.title === 'SelectiveColorCorrection' ? selectiveColorReplaySource(group.members[group.members.length-1]) : null;
            var selectiveReason = group.title === 'SelectiveColorCorrection' ? selectiveColorReplayBlockReason(group.members[group.members.length-1]) : '';
            for (var m = 0; selective && m < group.members.length; ++m)
               if (!group.members[m].mask || group.members[m].mask.status !== 'unrecorded' || (group.members[m].references || []).length) {
                  selective = null; selectiveReason = 'SelectiveColorCorrection needs an unavailable historical mask or reference image.';
               }
            image.steps.push({title:group.title, number:step.displayNumber, substep:0,
               time:step.time || '',
               tool:group.title, reason:palette || selective ? '' : selectiveReason || 'This process is not yet supported by the replay exporter: ' + group.title,
               action:palette ? 'palette' : selective ? 'selective' : 'process', inputs:palette ? palette.inputs : [],
               starRequired:!!(selective && selective.starRequired), identifier:'',
               source:palette ? palette.source : selective ? selective.source : '', variable:palette ? palette.variable : selective ? selective.variable : ''});
            continue;
         }
         if (isImageOriginStep(step, record.steps.indexOf(step))) continue;
         var tool = getProcessName(step.proc), reason = '', source = null, identifier = '', selective = selectiveColorReplaySource(step), dark = darkStructureReplaySource(step), game = gameReplaySource(step), pixel = pixelMathReplaySource(step), blend=imageBlendReplaySource(step), hue=narrowbandHueReplaySource(step), nativeImages=nativeImageReplayParameters(step,record,image.steps.length===0);
         var requiredReferences = (step.references || []).filter(function(ref) {
            if (ref.kind === 'mask' && step.mask && step.mask.status === 'recorded' && ref.name === step.mask.name) return false;
            if(hue&&(ref.kind==='input'||ref.kind==='reference'))return false;
            if(blend&&(ref.kind==='input'||ref.kind==='reference'||ref.kind==='output'))return false;
            if(nativeImages&&(ref.kind==='input'||ref.kind==='reference')&&(nativeImages.inputs||[]).indexOf(ref.name)>=0)return false;
            if (pixel && (ref.kind === 'input' || ref.kind === 'reference' || (ref.kind === 'output' && step.proc.createNewImage === true))) return false;
            return !(tool === 'StarXTerminator' && step.proc.stars === true && ref.kind === 'output');
         });
         if (tool === 'ImageIdentifier') {
            // This changes a view ID, not its pixels. Handle naming once at creation.
            source = replayProcessSource(step.source, tool);
            if (!source) reason = 'Serialized process code is not a supported constructor and parameter assignment sequence.';
            else {
               if (typeof step.proc.id === 'string') identifier = step.proc.id;
               else {
                  var idMatch = /(?:^|\s)\$instance\s*\.\s*id\s*=\s*("(?:\\.|[^"\\])*")\s*;/.exec(historyParameterKey(source.source));
                  try { if (idMatch) identifier = JSON.parse(idMatch[1]); } catch (e) {}
               }
               if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) reason = 'The recorded ImageIdentifier value is empty or invalid.';
            }
         }
         else if (tool === 'PixelMath' && !pixel) reason = 'PixelMath needs valid serialized expressions without quoted strings, directives, preview/global references or cache-only execution.';
         else if(getProcessTitle(step.proc)==='NarrowbandHueCombination'&&!hue)reason='NarrowbandHueCombination needs complete saved channel, hue, amount and SCNR settings. They may be missing when Generate was used without a saved instance.';
         else if(hue&&step.mask&&step.mask.status==='recorded')reason='External masks on NarrowbandHueCombination cannot be restored safely; it generates a separate unmasked RGB result.';
         else if(getProcessTitle(step.proc)==='ImageBlend'&&!blend)reason='ImageBlend needs complete supported saved settings and its installed CosmicPhotons engine and utilities. Newer mask-painting settings are not reconstructed.';
         else if (!supported[tool] && !selective && !dark && !game && !pixel && !blend && !hue) reason = getProcessTitle(step.proc).toLowerCase() === 'selectivecolorcorrection' ? selectiveColorReplayBlockReason(step) : 'This process is not yet supported by the replay exporter: ' + getProcessTitle(step.proc);
         else if(nativeImages&&nativeImages.error)reason=nativeImages.error;
         else if (!step.mask || step.mask.status === 'unknown') reason = 'Historical mask state is unknown.';
         else if (step.mask.status === 'recorded' && !step.mask.name) reason = 'Historical mask state is unknown.';
         else if (step.mask.status === 'recorded' && selective) reason = 'SelectiveColorCorrection needs an unavailable historical mask or reference image.';
         else if (step.mask.status === 'recorded' && dark) reason = 'External masks on grouped scripts cannot be restored safely.';
         else if (step.mask.status === 'recorded' && game) reason = 'External masks on grouped scripts cannot be restored safely.';
         else if (requiredReferences.length) reason = 'This step needs historical reference images or creates another image.';
         else if (tool === 'RGBWorkingSpace' && step.proc.applyGlobalRGBWS === true)
            reason = 'This step uses the global RGB working space, whose historical settings are unavailable.';
         else {
            source = selective || dark || game || pixel || blend || hue || (tool==='ProcessContainer'?replayContainerSource(step.source):replayProcessSource(step.source, tool));
            if (!source) reason = 'Serialized process code is not a supported constructor and parameter assignment sequence.';
         }
         image.steps.push({title:step.title, number:step.displayNumber || s + 1,
            time:step.time || '',
            substep:step.substepNumber || 0, tool:selective ? 'SelectiveColorCorrection' : dark ? 'DarkStructureEnhance' : game ? 'GAME' : blend ? 'ImageBlend' : hue ? 'NarrowbandHueCombination' : tool, reason:reason,
            action:tool === 'ImageIdentifier' ? 'identifier' : selective ? 'selective' : dark ? 'dark' : game ? 'game' : pixel ? 'pixelmath' : blend ? 'imageblend' : hue ? 'huecombination' : 'process', identifier:identifier,
            inputs:hue ? hue.inputs : blend ? blend.inputs : pixel ? pixel.inputs : nativeImages ? nativeImages.inputs : [], imageParameters:hue?hue.parameters:blend?blend.inputs.map(function(name){return {name:name,parameter:'ImageBlend input',row:-1};}):nativeImages?nativeImages.parameters:[],
            createsImage:!!(hue||(blend&&blend.createsImage)||(pixel && pixel.createsImage)||(nativeImages&&nativeImages.createsImage)), requiresTarget:!!((blend&&blend.requiresTarget)||(pixel && pixel.requiresTarget)||(nativeImages&&nativeImages.requiresTarget)), outputId:blend ? blend.outputId : pixel ? pixel.outputId : '',
            warning:hue?'Choose prepared narrowband channels and optional RGB stars. Auto stretch is a preview setting; Generate produces the recorded combination without that preview stretch.':blend?'Choose ImageBlend base and blend images at their recorded processing state. The installed engine applies the saved settings.':tool==='SpectrophotometricFluxCalibration'?'Requires the appropriate astrometric solution, observation metadata, catalog and filters for these data.':tool==='DynamicCrop'||tool==='FastRotation'?'Geometry changes are applied to the replay copy. Following masks must match the resulting dimensions.':nativeImages&&nativeImages.inputs.length?'Choose reference images at their recorded processing state; previews may be replaced by equivalent prepared reference images in chain replay.':pixel && pixel.inputs.length ? 'Choose PixelMath reference images in PixInsight at their recorded processing state.' : game ? 'GAME drawing settings were not recorded. Select the completed original GAME mask in PixInsight; mask creation is not repeated.' : dark ? 'DarkStructureEnhance settings were not recorded. Choose them manually in PixInsight.' : '', library:dark ? dark.library : '',
            starRequired:!!(selective && selective.starRequired),
            mask:step.mask && step.mask.status === 'recorded' ? {name:step.mask.name, inverted:typeof step.mask.inverted === 'boolean' ? step.mask.inverted : null} : null,
            source:source && tool !== 'ImageIdentifier' ? source.source : '', variable:source && tool !== 'ImageIdentifier' ? source.variable : ''});
      }
      var activeGroups=[];for(var gi=0;gi<groups.length;++gi)if(!groups[gi].members[0].redo&&!isImageOriginStep(groups[gi].members[0],record.steps.indexOf(groups[gi].members[0])))activeGroups.push(groups[gi]);
      for(var si=0;si<image.steps.length;++si){var group=activeGroups[si];image.steps[si].anchor=group.anchor;image.steps[si].memberAnchors=[];for(var mi=0;mi<group.members.length;++mi)image.steps[si].memberAnchors.push(group.members[mi].anchor);}
      image.clone=record.cloneShared?{source:record.cloneShared.image,sourceAnchor:record.cloneShared.lastStep.anchor,stage:isImageOriginStep(record.cloneShared.lastStep,0)?0:null}:null;
      image.stars=record.starsOrigin?{source:record.starsOrigin.image,sourceAnchor:record.starsOrigin.sourceStep,stage:null}:null;
      data.push(image);
   }
   for(var r=0;r<data.length;++r){var origin=data[r].clone||data[r].stars;if(!origin)continue;origin.stage=origin.stage===0?0:null;
      for(var q=0;q<data.length;++q)if(data[q].id===origin.source){for(var st=0;st<data[q].steps.length;++st)if(data[q].steps[st].anchor===origin.sourceAnchor||data[q].steps[st].memberAnchors.indexOf(origin.sourceAnchor)>=0)origin.stage=st+1;}
   }
   return data;
}

// Shared by PJSR and the report browser. Generates plain PJSR without eval.
function prepareGraxpertReplay(config,cache){
   if(typeof ExternalProcess!=='function'||typeof PixelMath!=='function')throw Error('GraXpert requires ExternalProcess and PixelMath support.');
   if(!config||(config.correction!=='Subtraction'&&config.correction!=='Division')||typeof config.smoothing!=='number'||!isFinite(config.smoothing)||config.smoothing<0||config.smoothing>1||config.model&&!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(config.model)||['default','cpu','gpu'].indexOf(config.device)<0)throw Error('Invalid user-declared GraXpert settings.');
   var executable=config.executable||cache.executable||'';
   function environment(name){try{return typeof getEnvironmentVariable==='function'?String(getEnvironmentVariable(name)||''):'';}catch(error){return '';}}
   function cleanPath(path){return String(path||'').replace(/^\uFEFF/,'').replace(/^\s+|\s+$/g,'').replace(/^"(.*)"$/,'$1');}
   var home=File.homeDirectory||'',local=environment('LOCALAPPDATA')||(home?home+'/AppData/Local':''),windows=/^[A-Za-z]:[\\/]/.test(home)||!!environment('WINDIR');
   function resolveExecutable(path){path=cleanPath(path);if(!path)return '';if(/[\\/]/.test(path))return File.exists(path)?path:'';var directories=environment('PATH').split(windows?';':':');for(var d=0;d<directories.length;++d){var folder=cleanPath(directories[d]);if(!folder)continue;var candidate=folder+'/'+path;if(windows&&!/\.exe$/i.test(candidate))candidate+='.exe';if(File.exists(candidate))return candidate;}if(windows&&/^graxpert(?:\.exe)?$/i.test(path)&&local&&File.exists(local+'/Programs/GraXpert/GraXpert.exe'))return local+'/Programs/GraXpert/GraXpert.exe';return '';}
   if(!executable){
      var settingsPaths=[local+'/GraXpertScript/GraXpertPath.txt',home+'/Library/Application Support/GraXpertScript/GraXpertPath.txt',home+'/.local/share/GraXpertScript/GraXpertPath.txt',home+'/GraXpertPath.txt'];
      if(typeof File.readTextFile==='function')for(var s=0;s<settingsPaths.length&&!executable;++s)try{if(File.exists(settingsPaths[s]))executable=resolveExecutable(File.readTextFile(settingsPaths[s]));}catch(error){Console.writeln('GraXpert path configuration: '+error.message);}
      if(!executable)executable=resolveExecutable('graxpert');
   }else executable=resolveExecutable(executable)||executable;
   if(!executable){var picker=new OpenFileDialog;picker.caption='Select GraXpert executable';picker.multipleSelections=false;if(!picker.execute())throw Error('GraXpert executable selection cancelled.');executable=picker.fileName;}
   executable=String(executable).replace(/^\s+|\s+$/g,'');if(executable.charAt(0)==='"'&&executable.charAt(executable.length-1)==='"')executable=executable.slice(1,-1);
   if(/^[A-Za-z]:[\\/]/.test(executable)&&typeof File.unixPathToWindows==='function')executable=File.unixPathToWindows(executable);
   if(!executable||!File.exists(executable))throw Error('GraXpert executable is unavailable: '+executable);
   if(/\.(?:lnk|url|bat|cmd|js|py)$/i.test(executable))throw Error('Select the actual GraXpert executable, not a shortcut or script: '+executable);
   config.executable=executable;cache.executable=executable;return config;
}
function runGraxpertReplay(config,output,note){
   var directory=File.systemTempDirectory+'/AstroProcessAtlas_GraXpert_'+(new Date()).getTime()+'_'+Math.floor(Math.random()*1000000000),input=directory+'/input.xisf',paths=[input,directory+'/input_GraXpert.xisf',directory+'/input_GraXpert.fits'],copy=null,opened=[],process=null,tail='',failure=null,owned=false,launch='';
   var logStreams={stdout:{text:'',cr:false},stderr:{text:'',cr:false}},logTruncated=false;
   function emitLog(line,stream){if(!line)return;line=(stream==='stderr'?'[stderr] ':'')+line;tail+=line+'\n';if(tail.length>6000){var cut=tail.indexOf('\n',tail.length-6000);tail=cut>=0&&cut<tail.length-1?tail.substring(cut+1):tail.slice(-6000);logTruncated=true;}Console.writeln(line);}
   function log(text,stream){var buffer=logStreams[stream||'stdout'];text=String(text||'');if(buffer.cr&&text.charAt(0)==='\n')text=text.substring(1);if(text.length)buffer.cr=text.charAt(text.length-1)==='\r';buffer.text+=(text.replace(/\r\n/g,'\n').replace(/\r/g,'\n'));buffer.text=buffer.text.replace(/([^\n])(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]\d{3})/g,'$1\n$2');var end;while((end=buffer.text.indexOf('\n'))>=0){emitLog(buffer.text.substring(0,end),stream);buffer.text=buffer.text.substring(end+1);}if(buffer.text.length>6000){emitLog(buffer.text.substring(0,6000),stream);buffer.text=buffer.text.substring(6000);}}
   function flushLog(){for(var stream in logStreams)if(Object.prototype.hasOwnProperty.call(logStreams,stream)){emitLog(logStreams[stream].text,stream);logStreams[stream].text='';}}
   function consoleLog(){return (logTruncated?'[Earlier output omitted]\n':'')+tail.replace(/\n$/,'');}
   try{
      File.createDirectory(directory);owned=true;var image=output.mainView.image,id='APA_GraXpert_input',suffix=1;while(!View.viewById(id).isNull)id='APA_GraXpert_input_'+suffix++;
      copy=new ImageWindow(image.width,image.height,image.numberOfChannels,image.bitsPerSample,image.isReal,image.isColor,id);copy.mainView.beginProcess(UndoFlag_NoSwapFile);try{copy.mainView.image.assign(image);}finally{copy.mainView.endProcess();}copy.rgbWorkingSpace=output.rgbWorkingSpace;
      if(!copy.saveAs(input,false,false,true,false))throw Error('Unable to write GraXpert input.');
      var nativeInput=/^[A-Za-z]:[\\/]/.test(input)&&typeof File.unixPathToWindows==='function'?File.unixPathToWindows(input):input;
      var args=['-cli',nativeInput,'-correction',config.correction,'-smoothing',String(config.smoothing)];if(config.model)args.push('-ai_version',config.model);if(config.device!=='default')args.push('-gpu',config.device==='gpu'?'true':'false');
      launch='Executable: '+config.executable+'\nArguments: '+JSON.stringify(args);note('GraXpert launch: '+launch);
      note('GraXpert: user-configured new run; executable='+config.executable+'; correction='+config.correction+'; smoothing='+config.smoothing+'; model='+(config.model||'application-selected (not pinned)')+'; device='+config.device);
      process=new ExternalProcess;process.onStandardOutputDataAvailable=function(){log(this.stdout,'stdout');};process.onStandardErrorDataAvailable=function(){log(this.stderr,'stderr');};process.onError=function(code){var names=['Failed to start (check executable, permissions and application dependencies)','Process crashed','Wait timed out','Output read error','Input write error','Unknown external process error'];failure='GraXpert: '+(names[code]||'Unknown external process error')+' (code '+code+')';};
      if(process.start(config.executable,args)===false)throw Error('Unable to start GraXpert.');while(process.isStarting||process.isRunning){processEvents();}
      flushLog();
      if(failure||process.exitCode!==0)throw Error(failure||'GraXpert exited with code '+process.exitCode);
      var path=File.exists(paths[1])?paths[1]:File.exists(paths[2])?paths[2]:'';if(!path)throw Error('GraXpert did not create its expected processed image.');opened=ImageWindow.open(path);if(!opened||opened.length!==1)throw Error('GraXpert output must contain one image.');var result=opened[0].mainView.image;
      if(result.width!==image.width||result.height!==image.height||result.numberOfChannels!==image.numberOfChannels||result.isColor!==image.isColor)throw Error('GraXpert output geometry/color does not match the replay target.');
      output.removeMask();var transfer=new PixelMath;transfer.expression=opened[0].mainView.id;transfer.useSingleExpression=true;transfer.symbols='';transfer.generateOutput=true;transfer.createNewImage=false;transfer.clearImageCacheAndExit=false;transfer.cacheGeneratedImages=false;transfer.use64BitWorkingImage=false;transfer.rescale=false;transfer.truncate=true;transfer.truncateLower=0;transfer.truncateUpper=1;if(transfer.executeOn(output.mainView)===false)throw Error('Unable to apply GraXpert result.');
      if(tail)note('GraXpert console tail:\n  '+consoleLog().replace(/\n/g,'\n  '));return output;
   }catch(error){flushLog();throw Error(error.message+(launch?'\n'+launch:'')+(tail?'\nGraXpert console:\n  '+consoleLog().replace(/\n/g,'\n  '):'\nGraXpert console: no output captured.'));}
   finally{try{if(process&&(process.isStarting||process.isRunning)){process.terminate();process.waitForFinished(5000);}}catch(error){Console.writeln('GraXpert process cleanup: '+error.message);}for(var i=0;i<(opened||[]).length;++i)try{if(!opened[i].isNull)opened[i].forceClose();}catch(error){Console.writeln(error.message);}try{if(copy&&!copy.isNull)copy.forceClose();}catch(error){Console.writeln(error.message);}for(var i=0;owned&&i<paths.length;++i)try{if(File.exists(paths[i]))File.remove(paths[i]);}catch(error){Console.writeln('GraXpert temporary cleanup: '+error.message);}try{if(owned)File.removeDirectory(directory);}catch(error){Console.writeln('GraXpert temporary directory cleanup: '+error.message);}}
}

function preparedReplayPrefix(window,steps){
   var result={count:0,positions:[],reason:''},eligible=0;
   for(var i=0;i<steps.length;++i){var step=steps[i];if((step.executionMode||'auto')!=='auto'||step.reason||step.mask||step.createsImage||step.starRequired||(step.inputs||[]).length||(step.action!=='process'&&step.action!=='pixelmath')||step.tool==='StarXTerminator'||step.tool==='ProcessContainer')break;eligible++;}
   if(!eligible)return result;
   try{
      var view=window.mainView,entries=[],groups=[];try{if(view.initialProcessing)groups.push({container:view.initialProcessing,initial:true});}catch(error){}
      if(view.processing)groups.push({container:view.processing,initial:false});
      for(var g=0;g<groups.length;++g){var group=groups[g],container=group.container;if(!container||typeof container.at!=='function')continue;var count=group.initial?container.length:Math.min(container.length,view.historyIndex),masks=readHistoryMasks(container,count);for(var h=0;h<count;++h){var process=container.at(h);entries.push({key:process?historyParameterKey(process.toSource()):'',mask:masks.steps[h].status,position:group.initial?(h===count-1?0:null):h+1,before:group.initial?null:h});}}
      var keys=[];for(var k=0;k<eligible;++k)keys.push(historyParameterKey(steps[k].recordedSource||steps[k].source||''));
      for(var n=Math.min(eligible,entries.length);n>0;--n){var offset=entries.length-n,match=true;for(var k=0;k<n;++k)if(!keys[k]||keys[k]!==entries[offset+k].key||entries[offset+k].mask!=='unrecorded'){match=false;break;}if(match){result.count=n;result.positions.push(entries[offset].before);for(var k=0;k<n;++k)result.positions.push(entries[offset+k].position);break;}}
      if(!result.count)result.reason='No exact unmasked automatic prefix at the current applied history position.';
   }catch(error){result.reason='Prepared history could not be verified: '+error.message;}
   return result;
}

function atlasReplaySession(key){
   function available(){if(typeof Settings==='undefined'||typeof DataType_String==='undefined')throw Error('PixInsight Settings are required for pause / resume.');}
   function windowById(id){var windows=ImageWindow.windows;for(var i=0;i<windows.length;++i)if(!windows[i].isNull&&windows[i].mainView.id===id)return windows[i];throw Error('Resume image is unavailable: '+id+'. Keep replay images and checkpoints open without renaming them.');}
   function encode(value){if(value===null||typeof value!=='object')return value;if('isNull' in value&&value.isNull===true)return null;if('mainView' in value&&value.mainView){var v=value.mainView,i=v.image;return {apaWindow:v.id,history:v.historyIndex,width:i.width,height:i.height,channels:i.numberOfChannels,bits:i.bitsPerSample,color:i.isColor};}var result=Array.isArray(value)?[]:{};for(var k in value)if(Object.prototype.hasOwnProperty.call(value,k)&&typeof value[k]!=='function')result[k]=encode(value[k]);return result;}
   function decode(value,pending){if(value===null||typeof value!=='object')return value;if('apaWindow' in value&&value.apaWindow){var w=windowById(value.apaWindow),v=w.mainView,i=v.image;if(i.width!==value.width||i.height!==value.height||i.numberOfChannels!==value.channels||i.bitsPerSample!==value.bits||i.isColor!==value.color||(v.id!==pending.target&&v.historyIndex!==value.history)||(v.id===pending.target&&v.historyIndex<value.history))throw Error('Resume checkpoint changed unexpectedly: '+v.id+'. Restore its saved state before continuing.');return w;}var result=Array.isArray(value)?[]:{};for(var k in value)if(Object.prototype.hasOwnProperty.call(value,k))result[k]=decode(value[k],pending);return result;}
   function parseStored(text){
      var prefix='APA-RESUME-HEX1:';
      if(text.indexOf(prefix)===0){var hex=text.slice(prefix.length);if(hex.length%4||/[^0-9a-f]/i.test(hex))throw Error('Incomplete replay resume data. The saved session has been preserved.');var decoded='';for(var h=0;h<hex.length;h+=4)decoded+=String.fromCharCode(parseInt(hex.slice(h,h+4),16));return JSON.parse(decoded);}
      try{return JSON.parse(text);}catch(originalError){
         // Older Settings strings can contain expanded newline/tab escapes.
         // Repair only literal control characters inside quoted JSON strings.
         var repaired='',quoted=false,escaped=false;
         for(var i=0;i<text.length;++i){var c=text.charAt(i),code=text.charCodeAt(i);if(quoted&&code<32){repaired+='\\u'+('0000'+code.toString(16)).slice(-4);escaped=false;continue;}repaired+=c;if(escaped){escaped=false;continue;}if(quoted&&c==='\\'){escaped=true;continue;}if(c==='"')quoted=!quoted;}
         try{return JSON.parse(repaired);}catch(repairError){throw Error('Unable to read the older replay resume data: '+repairError.message+'. The saved session has been preserved; do not close replay images.');}
      }
   }
   function read(){available();var text=Settings.read(key,DataType_String);if(!text)return null;var saved=parseStored(String(text));if(saved.version!==1)throw Error('Unsupported replay resume state.');return saved;}
   function write(state){available();var json=JSON.stringify({version:1,pending:encode(state.pending),data:encode(state)}),text='APA-RESUME-HEX1:';for(var i=0;i<json.length;++i)text+=('0000'+json.charCodeAt(i).toString(16)).slice(-4);Settings.write(key,DataType_String,text);if(Settings.read(key,DataType_String)!==text)throw Error('PixInsight could not store the complete replay resume state.');}
   function clear(){available();Settings.remove(key);}
   function choose(saved){var target=null;try{target=windowById(saved.pending.target);}catch(error){}var before=saved.pending.history,changed=!!target&&target.mainView.historyIndex>before,decision='cancel';var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Resume replay';var label=new Label(dialog);label.wordWrapping=true;label.setMinWidth(520);label.text='Paused step: '+saved.pending.title+'\nTarget: '+saved.pending.target+'\n'+(!target?'The replay target is unavailable. Restore it or discard this saved replay.':changed?'Changes detected. Continue without applying the recorded process again.':'No changes detected. Cancel to return to the process interface, or explicitly skip this step.')+'\nKeep all replay images and checkpoints open in this PixInsight session.';var next=new PushButton(dialog);next.text='Continue after applying';next.enabled=changed;next.onClick=function(){if(next.enabled){decision='applied';dialog.ok();}};var skip=new PushButton(dialog);skip.text='Skip without applying';skip.enabled=(!('skipAllowed' in saved.pending)||saved.pending.skipAllowed!==false)&&!!target&&target.mainView.historyIndex===before;skip.onClick=function(){if(skip.enabled){decision='skipped';dialog.ok();}};var cancel=new PushButton(dialog);cancel.text='Cancel';cancel.onClick=function(){dialog.cancel();};var discard=new PushButton(dialog);discard.text='Discard saved replay';discard.onClick=function(){var confirm=new MessageBox('Discard this saved replay? Completed branch images remain open; temporary checkpoints will be released.','AstroProcessAtlas',StdIcon_Warning,StdButton_Yes,StdButton_No);if(confirm.execute()===StdButton_Yes){decision='discard';dialog.ok();}};var buttons=new HorizontalSizer;buttons.spacing=8;buttons.add(next);buttons.add(skip);buttons.addStretch();buttons.add(cancel);buttons.add(discard);dialog.sizer=new VerticalSizer;dialog.sizer.margin=14;dialog.sizer.spacing=10;dialog.sizer.add(label);dialog.sizer.add(buttons);dialog.adjustToContents();dialog.execute();return decision;}
   function discard(saved){var keep={},data=saved.data;function retain(map){for(var k in map)if(Object.prototype.hasOwnProperty.call(map,k)&&map[k]&&'apaWindow' in map[k]&&map[k].apaWindow)keep[map[k].apaWindow]=true;}retain('outputs' in data?data.outputs:{});retain('stars' in data?data.stars:{});if('output' in data&&data.output&&data.output.apaWindow)keep[data.output.apaWindow]=true;try{windowById(saved.pending.target).removeMask();}catch(error){}var windows=ImageWindow.windows;for(var i=0;i<windows.length;++i){var window=windows[i],id=window.mainView.id;if(!Object.prototype.hasOwnProperty.call(keep,id)&&'ownedImages' in data&&data.ownedImages&&Object.prototype.hasOwnProperty.call(data.ownedImages,'$'+id)&&data.ownedImages['$'+id]){if(typeof window.removeMaskReferences==='function')window.removeMaskReferences();window.forceClose();}}clear();}
   function changes(saved){var lines=[];try{var view=windowById(saved.pending.target).mainView,history=view.processing;for(var i=saved.pending.history;history&&typeof history.at==='function'&&i<view.historyIndex;++i)lines.push('Adapted process parameters:\n'+history.at(i).toSource());}catch(error){lines.push('Adapted parameter capture unavailable: '+error.message);}return lines.join('\n');}
   function announce(pending){new MessageBox('Replay paused before '+pending.title+' on '+pending.target+'.\nClose this message so the script can finish, then adjust and apply the process normally.\nRun the SAME replay .js again to continue. Do not close or rename replay images or checkpoints. The attached mask remains active.','AstroProcessAtlas - Replay paused',StdIcon_Information,StdButton_Ok).execute();}
   return {read:read,write:write,clear:clear,decode:decode,choose:choose,discard:discard,changes:changes,announce:announce,windowById:windowById};
}

function runInteractiveReplayStep(process,output,step,note){
   if(!process||typeof process.launch!=='function')throw Error('Interactive adjustment is unavailable for '+step.title);
   output.show();if(typeof output.bringToFront==='function')output.bringToFront();
   if(process.launch()===false)throw Error('Unable to open '+step.title+' settings.');
   var pause=Error('Replay paused for manual adjustment of '+step.title);pause.atlasPause={target:output.mainView.id,history:output.mainView.historyIndex,title:step.title};
   note('Paused for manual adjustment on '+output.mainView.id+'. Run the same replay script again after applying.');throw pause;
}

function buildWorkspaceReplayScript(image, start, end) {
   if (!image || start < 0 || end < start || end >= image.steps.length ||
       start !== Math.floor(start) || end !== Math.floor(end)) throw Error('Select a valid step range.');
   var selected = image.steps.slice(start, end + 1), factories = [], manifest = [], identifier = '';
   for (var i = 0; i < selected.length; ++i) {
      var step = selected[i];
      manifest.push({title:step.title, tool:step.tool, number:step.number, substep:step.substep,executionMode:step.executionMode||'auto',
         recordedSource:(step.action==='process'||step.action==='pixelmath')?step.source||'':'',manualDerivedOrigin:!!step.manualDerivedOrigin, reason:step.reason || (step.action === 'palette' && i > 0 ? 'Start the selected range at PerfectPalettePicker and choose its prepared inputs.' : step.action === 'game' && i > 0 ? 'Start the selected range at GAME and select its completed original mask.' : step.action === 'external' && i > 0 ? 'Start the selected range at the external prepared result.' : ''),
         action:step.action, inputs:step.inputs || [], imageParameters:step.imageParameters||[], createsImage:!!step.createsImage, requiresTarget:!!step.requiresTarget, outputId:step.outputId||'', starRequired:!!step.starRequired, mask:step.mask || null, time:step.time || ''});
      if (!step.reason && step.action === 'identifier') identifier = step.identifier;
      factories.push(step.reason || step.action === 'identifier' || step.action === 'external' || step.action === 'skip' ? 'null' : 'function(){\n' + step.source + '\nreturn ' + step.variable + ';\n}');
   }
   // Build comment delimiters at runtime, as in replayStepHTML. PJSR's
   // preprocessing can truncate nested comment/URL text inside source strings.
   var comment = String.fromCharCode(47, 47) + ' ';
   var lines = [
      comment + 'AstroProcessAtlas workflow replay' + (image.version ? ' - version ' + image.version : ''),
      comment + 'Copyright (c) 2026 YoruHikari Astrophotography - https:' + String.fromCharCode(47, 47) + 'www.yoruhikari.gr/',
      comment + 'SPDX-License-Identifier: MIT',
      comment + 'Permission is hereby granted, free of charge, to any person obtaining a copy',
      comment + 'of this software and associated documentation files (the "Software"), to deal',
      comment + 'in the Software without restriction, including without limitation the rights',
      comment + 'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
      comment + 'copies of the Software, and to permit persons to whom the Software is',
      comment + 'furnished to do so, subject to the following conditions:',
      comment + 'The above copyright notice and this permission notice shall be included in all',
      comment + 'copies or substantial portions of the Software.',
      comment + 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
      comment + 'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
      comment + 'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
      comment + 'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
      comment + 'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
      comment + 'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
      comment + 'Input must contain the pixels BEFORE the first selected step.',
      comment + 'Never select the finished image unless it is the intended starting state.',
      '#include <pjsr/Sizer.jsh>', '#include <pjsr/UndoFlag.jsh>',
      '#include <pjsr/StdIcon.jsh>', '#include <pjsr/StdButton.jsh>', '#include <pjsr/DataType.jsh>', '#include <pjsr/CryptographicHash.jsh>',
      'var replayImage = ' + JSON.stringify(image.id) + ';',
      'var replayChainContext=null;',
      'var replayHasAdjust='+JSON.stringify(selected.some(function(step){return step.executionMode==='adjust';}))+';',
      'var replaySessionKey='+JSON.stringify('AstroProcessAtlas/resume/'+(new Date()).getTime()+'_'+Math.floor(Math.random()*1000000000))+';',
      atlasReplaySession.toString(),
      copyReplayMetadata.toString(),historyParameterKey.toString(),readHistoryMasks.toString(),preparedReplayPrefix.toString(),
      'var replayGraxpertCache=typeof atlasSharedGraxpertCache==="object"?atlasSharedGraxpertCache:{};',
      'var replayIdentifier = ' + JSON.stringify(identifier) + ';',
      'var replayOriginalInputs = ' + JSON.stringify(image.originalInputs || []) + ';',
      'var replaySteps = ' + JSON.stringify(manifest).split(String.fromCharCode(47)).join('\\u002f') + ';',
      'var replayFactories = [' + factories.join(',\n') + '];',
      pixelMathTextTokens.toString(),
      compareAtlasImages.toString(),
      previewAppearance.toString(),
      comparisonPreviewBitmap.toString(),
      comparisonIsGameMask.toString(),
      showAtlasComparisonResult.toString(),
      showAtlasComparisonDialog.toString(),
      'function remapPixelMathText(text,mapped) {',
      '   var tokens=pixelMathTextTokens(text),result="",last=0;',
      '   for(var i=0;i<tokens.length;++i){var token=tokens[i];if(!token.macro&&!token.call&&!token.local&&Object.prototype.hasOwnProperty.call(mapped,"$"+token.name)){result+=text.slice(last,token.start)+mapped["$"+token.name];last=token.end;}}',
      '   return result+text.slice(last);',
      '}',
      'function choosePixelMathInputs(output,step,cache) {',
      '   if(replayChainContext){var selected=replayChainContext.inputs(step),mapped={};for(var name in selected)if(Object.prototype.hasOwnProperty.call(selected,name)){var window=selected[name];if(!window||window.isNull)throw Error("Unavailable chain input: "+name);mapped[name]=window.mainView.id;cache[name]=window;replayChoice("PixelMath "+name.substring(1)+" -> "+window.mainView.id);}return mapped;}',
      '   var mapped={},names=step.inputs||[];if(!names.length)return mapped;',
      '   var candidates=[];for(var i=0;i<ImageWindow.windows.length;++i)if(!ImageWindow.windows[i].isNull)candidates.push(ImageWindow.windows[i]);if(output&&candidates.indexOf(output)<0)candidates.push(output);',
      '   var dialog=new Dialog;dialog.windowTitle="AstroProcessAtlas - PixelMath inputs";dialog.sizer=new VerticalSizer;dialog.sizer.margin=8;dialog.sizer.spacing=6;',
      '   var info=new Label(dialog);info.text="Step "+step.number+": select each reference image at its recorded processing state."+(output?" The current replay result is also available.":"");info.wordWrapping=true;info.setMinWidth(480);dialog.sizer.add(info);',
      '   var boxes=[];for(var n=0;n<names.length;++n){var label=new Label(dialog);label.text=names[n];dialog.sizer.add(label);var combo=new ComboBox(dialog);combo.addItem("Choose an image");combo.currentItem=0;for(var c=0;c<candidates.length;++c){combo.addItem(candidates[c].mainView.id);if(cache["$"+names[n]]===candidates[c])combo.currentItem=c+1;}if(combo.currentItem===0){for(var c=0;c<candidates.length;++c)if(output&&names[n]===replayImage?candidates[c]===output:candidates[c].mainView.id===names[n]){combo.currentItem=c+1;break;}}boxes.push(combo);dialog.sizer.add(combo);}',
      '   var run=new PushButton(dialog);run.text="Continue";run.onClick=function(){dialog.ok();};var update=function(){run.enabled=true;for(var b=0;b<boxes.length;++b)if(boxes[b].currentItem<1)run.enabled=false;};for(var b=0;b<boxes.length;++b)boxes[b].onItemSelected=update;update();',
      '   var cancel=new PushButton(dialog);cancel.text="Cancel";cancel.onClick=function(){dialog.cancel();};var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(run);buttons.add(cancel);dialog.sizer.add(buttons);dialog.adjustToContents();',
      '   if(!dialog.execute())throw Error("PixelMath input selection cancelled.");',
      '   for(var n=0;n<names.length;++n){var selected=candidates[boxes[n].currentItem-1];if(!selected||selected.isNull)throw Error("Select an available image for PixelMath input: "+names[n]);mapped["$"+names[n]]=selected.mainView.id;cache["$"+names[n]]=selected;replayChoice("Step "+step.number+": PixelMath "+names[n]+" -> "+selected.mainView.id);}',
      '   return mapped;',
      '}',
      'function chooseNativeReplayInputs(output,step){',
      '   if(replayChainContext){var selected=replayChainContext.inputs(step),mapped={};for(var name in selected)if(Object.prototype.hasOwnProperty.call(selected,name)){var window=selected[name];if(!window||window.isNull)throw Error("Unavailable chain reference: "+name);mapped[name]=window.mainView.id;}return mapped;}',
      '   var mapped={},names=step.inputs||[],views=[];if(!names.length)return mapped;for(var i=0;i<ImageWindow.windows.length;++i){var w=ImageWindow.windows[i];if(w.isNull)continue;views.push(w.mainView);if(["LRGBCombination","ChannelCombination","ImageBlend","NarrowbandHueCombination"].indexOf(step.tool)<0&&"previews" in w){var previews=w.previews;for(var p=0;p<previews.length;++p)views.push(previews[p]);}}',
      '   var dialog=new Dialog;dialog.windowTitle="AstroProcessAtlas - "+step.tool+" references";dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;var info=new Label(dialog);info.text=step.tool==="NarrowbandHueCombination"?"Choose prepared grayscale narrowband channels and the optional RGB stars reference. All dimensions must match. No extra input stretching is applied.":step.tool==="ImageBlend"?"Choose the base and blend images at the required processing state. Grayscale and RGB inputs can be mixed; dimensions must match.":["LRGBCombination","ChannelCombination"].indexOf(step.tool)>=0?"Choose grayscale source channels at the required processing state. No extra stretching is applied.":"Choose reference images at the required processing state. Calibration previews can be selected. Recorded ROI coordinates remain unchanged.";info.wordWrapping=true;info.setMinWidth(500);dialog.sizer.add(info);var boxes=[];',
      '   for(var n=0;n<names.length;++n){var label=new Label(dialog);label.text=names[n];dialog.sizer.add(label);var box=new ComboBox(dialog);box.addItem("Choose a reference");if(output)box.addItem("Current replay result");var offset=output?2:1;box.currentItem=output&&names[n]===replayImage?1:0;for(var v=0;v<views.length;++v){var id=views[v].fullId||views[v].id;box.addItem(id);if(id===names[n]&&box.currentItem===0)box.currentItem=v+offset;}boxes.push(box);dialog.sizer.add(box);}',
      '   var ok=new PushButton(dialog);ok.text="Continue";ok.onClick=function(){dialog.ok();};var cancel=new PushButton(dialog);cancel.text="Cancel";cancel.onClick=function(){dialog.cancel();};var update=function(){ok.enabled=boxes.every(function(box){return box.currentItem>0;});};for(var b=0;b<boxes.length;++b)boxes[b].onItemSelected=update;update();var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(ok);buttons.add(cancel);dialog.sizer.add(buttons);dialog.adjustToContents();if(!dialog.execute())throw Error(step.tool+" reference selection cancelled.");',
      '   for(var n=0;n<names.length;++n){var index=boxes[n].currentItem;if(index<1)throw Error("Choose reference: "+names[n]);var view=views[index-(output?2:1)];mapped["$"+names[n]]=output&&index===1?"@APA_CURRENT":view&&(view.fullId||view.id);if(!mapped["$"+names[n]])throw Error("Unavailable reference: "+names[n]);replayChoice(step.tool+" "+names[n]+" -> "+mapped["$"+names[n]]);}return mapped;',
      '}',
      'function applyNativeReplayInputs(process,output,step,mapping){',
      '   if(step.tool==="ImageBlend")return; if(!output.mainView.image.isColor)throw Error(step.tool+" requires an RGB replay target.");var parameters=step.imageParameters||[],channels=["LRGBCombination","ChannelCombination"].indexOf(step.tool)>=0?JSON.parse(JSON.stringify(process.channels)):null;',
      '   for(var n=0;n<parameters.length;++n){var parameter=parameters[n],id=mapping["$"+parameter.name];if(id==="@APA_CURRENT")id=output.mainView.id;if(!id)throw Error("Missing reference: "+parameter.name);var view=View.viewById(id);if(!view||view.isNull)throw Error("Reference is unavailable: "+id);if(channels){if(view.image.isColor||view.image.width!==output.mainView.image.width||view.image.height!==output.mainView.image.height)throw Error(step.tool+" requires grayscale channels with matching dimensions: "+id);channels[parameter.row][1]=id;}else{if(!view.image.isColor)throw Error(step.tool+" requires an RGB reference: "+id);process[parameter.parameter]=id;}}if(channels)process.channels=channels;',
      '}',
      'function runPixelMathReplay(process,output,step,cache,initialMapping) {',
      '   var mapped=initialMapping||choosePixelMathInputs(output,step,cache),keys=process.useSingleExpression===false?["expression","expression1","expression2","expression3","symbols"]:["expression","expression3","symbols"];',
      '   for(var e=0;e<keys.length;++e)if(typeof process[keys[e]]==="string")process[keys[e]]=remapPixelMathText(process[keys[e]],mapped);',
      '   var newId="",resultId=output.mainView.id;if(process.createNewImage){newId=resultId+"_APA_pixelmath";var suffix=1;while(!View.viewById(newId).isNull)newId=resultId+"_APA_pixelmath_"+(suffix++);process.newImageId=newId;process.showNewImage=false;}',
      '   try{if(!process||typeof process.executeOn!=="function"||process.executeOn(output.mainView)===false)throw Error("PixelMath process failed.");}finally{output.removeMask();}',
      '   if(!newId)return output;',
      '   var replacement=null;for(var i=0;i<ImageWindow.windows.length;++i)if(!ImageWindow.windows[i].isNull&&ImageWindow.windows[i].mainView.id===newId){replacement=ImageWindow.windows[i];break;}',
      '   if(!replacement)throw Error("PixelMath did not create its expected output image.");',
      '   try{if(replayChainContext&&output.mainView.hasProperty&&output.mainView.hasProperty("AstroProcessAtlas:ChainOrigin"))replacement.mainView.setPropertyValue("AstroProcessAtlas:ChainOrigin",output.mainView.propertyValue("AstroProcessAtlas:ChainOrigin"));}catch(e){}',
      '   output.forceClose();replacement.mainView.id=resultId;replacement.show();return replacement;',
      '}',
      'function suggestPaletteInput(name,candidates) {',
      '   function base(id){return id.toLowerCase().replace(/(?:_(?:final|processed|clone|linear|starless|nbn|replay)(?:_[0-9]+)?)+$/g,"");}',
      '   var wanted=name.toLowerCase(),root=base(name),best=0,score=-1,tied=false;',
      '   for(var i=0;i<candidates.length;++i){if(candidates[i].mainView.image.isColor)continue;var id=candidates[i].mainView.id.toLowerCase(),original=false;for(var j=0;j<replayOriginalInputs.length;++j)if(replayOriginalInputs[j].toLowerCase()===id)original=true;',
      '      var value=original&&base(id)===root?400:id===root?300:id===wanted?200:base(id)===root?100:-1;if(value>score){score=value;best=i;tied=false;}else if(value===score&&value>=0)tied=true;',
      '   }return score<0||tied?0:best;',
      '}',
      'function applyReplayMask(output,request,cache,step,selected) {',
      '   if(selected){validateReplayMask(selected.window,output.mainView.image,request.name);output.removeMask();output.setMask(selected.window,selected.colorInvert);output.maskEnabled=true;output.maskInverted=selected.colorInvert;output.maskVisible=false;return;}',
      '   output.removeMask();if(!request)return;',
      '   var inverted=request.inverted;',
      '   if(typeof inverted!=="boolean"){inverted=false;Console.writeln("WARNING: Historical mask value inversion is not recorded for "+request.name+"; using the user-selected Color invert setting.");}',
      '   var key="$"+request.name,entry=cache[key];',
      '   {',
      '      var candidates=[];for(var i=0;i<ImageWindow.windows.length;++i){var w=ImageWindow.windows[i];if(!w.isNull&&w!==output&&w.mainView.image.width===output.mainView.image.width&&w.mainView.image.height===output.mainView.image.height&&(!w.mainView.image.isColor||output.mainView.image.isColor))candidates.push(w);}',
      '      if(!candidates.length)throw Error("Open a mask with matching dimensions for "+request.name);',
      '      var dialog=new Dialog;dialog.windowTitle="AstroProcessAtlas - Select mask";',
      '      var label=new Label(dialog);label.text="Step "+step.number+" - "+step.title+": mask "+request.name+(step.time?"\\nRecorded step time: "+step.time:"");label.wordWrapping=true;label.setMinWidth(480);',
      '      var note=new Label(dialog);note.text="Choose the mask version and Color invert for this step. Previous choices are preselected, but the same mask name may refer to different historical pixels. Timestamps alone do not prove a mask version.";note.wordWrapping=true;note.setMinWidth(480);',
      '      var combo=new ComboBox(dialog);for(var i=0;i<candidates.length;++i)combo.addItem(candidates[i].mainView.id);combo.currentItem=-1;for(var i=0;i<candidates.length;++i)if(candidates[i].mainView.id===request.name)combo.currentItem=i;',
      '      if(entry&&!entry.window.isNull){for(var i=0;i<candidates.length;++i)if(candidates[i]===entry.window)combo.currentItem=i;inverted=typeof request.inverted==="boolean"?entry.colorInvert!==(entry.historicalInvert!==inverted):entry.colorInvert;}',
      '      var colorInvert=new CheckBox(dialog);colorInvert.text="Color invert (black/white mask values)";colorInvert.checked=inverted;colorInvert.toolTip="Checked: use 1-mask. Unchecked: use the selected image values. No geometry or image pixels are changed.";',
      '      var ok=new PushButton(dialog);ok.text="Continue";ok.enabled=combo.currentItem>=0;combo.onItemSelected=function(index){ok.enabled=index>=0;};ok.onClick=function(){dialog.ok();};',
      '      var cancel=new PushButton(dialog);cancel.text="Stop replay";cancel.onClick=function(){dialog.cancel();};',
      '      var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(ok);buttons.add(cancel);dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;dialog.sizer.add(label);dialog.sizer.add(note);dialog.sizer.add(combo);dialog.sizer.add(colorInvert);dialog.sizer.add(buttons);dialog.adjustToContents();',
      '      if(!dialog.execute())throw Error("Mask selection cancelled: "+request.name);',
      '      if(combo.currentItem<0)throw Error("Select an available mask for "+request.name);',
      '      entry={window:candidates[combo.currentItem],colorInvert:colorInvert.checked,historicalInvert:request.inverted===true};if(!entry.window||entry.window.isNull)throw Error("Selected mask is unavailable: "+request.name);cache[key]=entry;',
      '   }',
      '   if(entry.window.isNull)throw Error("Previously selected mask is unavailable: "+request.name);',
      '   replayChoice("Step "+step.number+": mask "+request.name+" -> "+entry.window.mainView.id+"; Color invert: "+(entry.colorInvert?"ON":"OFF"));',
      '   inverted=entry.colorInvert;',
      '   output.setMask(entry.window,inverted);output.maskEnabled=true;output.maskInverted=inverted;output.maskVisible=false;',
      '   Console.writeln("Mask: "+request.name+" -> "+entry.window.mainView.id+"; Mask > Invert Mask: "+(inverted?"ON (1-mask)":"OFF"));',
      '}',
      "var replayAudit={stage:\"Preflight\",current:-1,completed:[],preflightFailures:[],choices:[],started:(new Date()).getTime()};",
      "function replayChoice(text){replayAudit.choices.push(text);if(replayChainContext&&replayChainContext.note)replayChainContext.note(text);}",
      "var replayProgress=null,replayStopRequested=false;",
      "function updateReplayProgress(index,status){",
      '   if(replayChainContext&&replayChainContext.onProgress)replayChainContext.onProgress(index,status);',
      "   if(!replayProgress)return;",
      "   if(index>=0&&replayProgress.rows[index]){",
      "      var row=replayProgress.rows[index],color=status===\"Completed\"?0xff69d184:status===\"Failed / cancelled\"?0xffff8080:status===\"Running\"?0xfff5b96e:0xffaab4c8;",
      "      row.setText(1,status);if(replayProgress.tree&&typeof replayProgress.tree.adjustColumnWidthToContents===\"function\")replayProgress.tree.adjustColumnWidthToContents(1);if(typeof row.setTextColor===\"function\"){row.setTextColor(0,color);row.setTextColor(1,color);}",
      "   }",
      "   replayProgress.label.text=replayAudit.stage+\" - \"+replayAudit.completed.length+\" / \"+replaySteps.length+\" steps completed\"+(index>=0?\" | \"+replaySteps[index].title+\": \"+status:\"\");",
      "   if(typeof processEvents===\"function\")processEvents();",
      "}",
      "function openReplayProgress(){",
      '   if(replayChainContext)return;',
      "   if(typeof TreeBox!==\"function\"||typeof TreeBoxNode!==\"function\")return;",
      "   var dialog=new Dialog;dialog.windowTitle=\"AstroProcessAtlas - Replay progress\";dialog.onClose=function(){return false;};",
      "   var label=new Label(dialog);label.wordWrapping=true;label.text=\"Preparing inputs and masks...\";",
      "   var tree=new TreeBox(dialog);tree.numberOfColumns=2;tree.headerVisible=true;tree.setHeaderText(0,\"Step\");tree.setHeaderText(1,\"Status\");tree.setMinSize(600,Math.min(420,Math.max(180,replaySteps.length*25+40)));",
      "   var rows=[];for(var i=0;i<replaySteps.length;++i){var row=new TreeBoxNode(tree);row.setText(0,replaySteps[i].number+\" - \"+replaySteps[i].title);row.setText(1,\"Waiting\");rows.push(row);}",
      "   if(typeof tree.adjustColumnWidthToContents===\"function\")tree.adjustColumnWidthToContents(0);",
      "   var stop=new PushButton(dialog);stop.text=\"Stop after current step\";stop.onClick=function(){replayStopRequested=true;stop.enabled=false;stop.text=\"Stopping after current step...\";};",
      "   dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;dialog.sizer.add(label);dialog.sizer.add(tree);dialog.sizer.add(stop);dialog.adjustToContents();",
      "   replayProgress={dialog:dialog,label:label,rows:rows,tree:tree};dialog.show();updateReplayProgress(-1,\"\");",
      "}",
      "function finishReplayStep(index){replayAudit.completed.push(index);updateReplayProgress(index,\"Completed\");}",
      "function closeReplayProgress(error){",
      "   if(!replayProgress)return;",
      "   if(error&&replayAudit.current>=0)updateReplayProgress(replayAudit.current,\"Failed / cancelled\");",
      "   replayProgress.dialog.hide();replayProgress=null;",
      "}",
      "function replaySummary(output,error){",
      '   closeReplayProgress(error);',
      '   if(replayChainContext){replayChainContext.result=output;if(error)throw Error(replayImage+": "+error);return;}',
      "   var text=(error?\"Replay stopped: \"+error:\"Replay complete: \"+output.mainView.id)+\"\\n\\nPhase: \"+replayAudit.stage+\"\\nElapsed: \"+(((new Date()).getTime()-replayAudit.started)/1000).toFixed(1)+\" seconds\\nCompleted: \"+replayAudit.completed.length+\" / \"+replaySteps.length;",
      "   if(error&&output&&!output.isNull)text+=\"\\nPartial result retained as \"+output.mainView.id;",
      "   text+=\"\\n\\nSelected steps:\";",
      "   for(var i=0;i<replaySteps.length;++i)text+=\"\\n\"+replaySteps[i].number+\" - \"+replaySteps[i].title+\": \"+(replayAudit.completed.indexOf(i)>=0?\"Completed\":(i===replayAudit.current||replayAudit.preflightFailures.indexOf(i)>=0)?(replayAudit.stage===\"Execution\"?\"Failed / cancelled\":\"Preflight failed / cancelled\"):\"Not executed\");",
      "   text+=\"\\n\\nInputs and masks:\"+(replayAudit.choices.length?\"\\n\"+replayAudit.choices.join(\"\\n\"):\" none selected.\");",
      "   Console.writeln(text);",
      "   if(typeof TextBox!==\"function\"){new MessageBox(text,\"AstroProcessAtlas - Replay report\",error?StdIcon_Error:StdIcon_Information,StdButton_Ok).execute();return;}",
      "   var dialog=new Dialog;dialog.windowTitle=\"AstroProcessAtlas - Replay report\";dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;",
      "   var box=new TextBox(dialog);box.readOnly=true;box.useRichText=false;box.text=text;box.setMinSize(680,400);dialog.sizer.add(box);",
      "   var save=new PushButton(dialog);save.text=\"Save report...\";save.onClick=function(){try{var picker=new SaveFileDialog;picker.caption=\"Save replay report\";picker.filters=[[\"Text files (*.txt)\",\"*.txt\"]];picker.initialPath=\"AstroProcessAtlas_replay_report.txt\";if(!picker.execute())return;var file=new File;try{file.createForWriting(picker.fileName);file.write(ByteArray.stringToUTF8(text));}finally{file.close();}}catch(e){new MessageBox(\"Unable to save report: \"+e.message,\"AstroProcessAtlas\",StdIcon_Error,StdButton_Ok).execute();}};",
      '   var compare=new PushButton(dialog);compare.text="Compare with original...";compare.enabled=!!(output&&!output.isNull);compare.onClick=function(){try{showAtlasComparisonDialog(output,replayImage,error?"Replay stopped: the partial result may contain changes from the failed step. Select checkpoints deliberately.":"Original must match the state after step "+replaySteps[replaySteps.length-1].number+" - "+replaySteps[replaySteps.length-1].title+". A later final image is a different checkpoint.");}catch(e){new MessageBox(e.message,"AstroProcessAtlas - Comparison",StdIcon_Error,StdButton_Ok).execute();}};',
      "   var close=new PushButton(dialog);close.text=\"Close\";close.onClick=function(){dialog.ok();};var buttons=new HorizontalSizer;buttons.add(save);buttons.add(compare);buttons.addStretch();buttons.add(close);dialog.sizer.add(buttons);dialog.adjustToContents();dialog.execute();",
      "}",
      "function prepareReplayProcesses(){",
      "   var processes=[],errors=[];",
      "   for(var i=0;i<replaySteps.length;++i){var step=replaySteps[i];replayAudit.current=i;",
      "      try{",
      "         if(step.reason)throw Error(\"Stopped before step \"+step.number+\": \"+step.reason);",
      "         if(step.starRequired&&typeof StarXTerminator!==\"function\")throw Error(\"SelectiveColorCorrection requires StarXTerminator for its star mask.\");",
      "         if(step.action===\"skip\"||step.action===\"identifier\"||step.action===\"game\"||step.action===\"external\"){processes.push(null);continue;}",
      "         var process=replayFactories[i]();",
      "         if(!process)throw Error(\"Required process is unavailable: \"+step.title);",
      '         if(step.executionMode==="adjust"&&typeof process.launch!=="function")throw Error("Interactive adjustment is unavailable for "+step.title);',
      "         if(step.action===\"selective\"||step.action===\"dark\"){",
      "            var digest=(new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(process.filePath)).toHex();",
      "            if(digest.toLowerCase()!==process.sourceDigest.toLowerCase())throw Error(step.title+\" source changed since report generation. Generate a new report and export.\");",
      "         }else if(step.action===\"huecombination\"){if(typeof ChannelCombination!==\"function\"||typeof PixelMath!==\"function\"||typeof SCNR!==\"function\")throw Error(\"NarrowbandHueCombination requires ChannelCombination, PixelMath and SCNR.\");}else if(step.action===\"imageblend\"){for(var f=0;f<process.files.length;++f){var file=process.files[f],hash=(new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(file.path)).toHex();if(hash.toLowerCase()!==file.digest.toLowerCase())throw Error(\"ImageBlend source changed. Generate a new report.\");}}else if(step.action===\"graxpert\"){prepareGraxpertReplay(process,replayGraxpertCache);}else if(typeof process.executeOn!==\"function\")throw Error(\"Required process is unavailable: \"+step.title);",
      "         processes.push(process);",
      "      }catch(error){replayAudit.preflightFailures.push(i);errors.push(\"Step \"+step.number+\" - \"+step.title+\": \"+error.message);processes.push(null);}",
      "   }",
      "   if(errors.length)throw Error(\"Preflight failed. No processing was started.\\n\"+errors.join(\"\\n\"));",
      "   replayAudit.current=-1;return processes;",
      "}",
      "function validateReplayMask(window,image,name){",
      "   if(!window||window.isNull)throw Error(\"Selected mask is unavailable: \"+name);",
      "   var mask=window.mainView.image;",
      "   if(mask.width!==image.width||mask.height!==image.height)throw Error(\"Mask dimensions do not match the replay image: \"+name);",
      "   if(mask.isColor&&!image.isColor)throw Error(\"A color mask cannot be used on a grayscale replay image: \"+name);",
      "}",
      "function prepareReplayResources(input,processes,palette,pixelMathCache,maskCache,firstMapping){",
      '   if(replayChainContext){var masks=[],mappings=[];for(var i=0;i<replaySteps.length;++i){masks[i]=null;mappings[i]={};if((replaySteps[i].imageParameters||[]).length)mappings[i]=chooseNativeReplayInputs(input,replaySteps[i]);else if(replaySteps[i].action==="pixelmath")mappings[i]=choosePixelMathInputs(input,replaySteps[i],pixelMathCache);if(replaySteps[i].mask){masks[i]=replayChainContext.mask(replaySteps[i].mask);if(!masks[i])throw Error("Missing chain mask.");replayChoice("Mask "+replaySteps[i].mask.name+" -> "+masks[i].window.mainView.id+"; Color invert: "+masks[i].colorInvert);}}return {masks:masks,mappings:mappings};}',
      "   var image=input.mainView.image,geometry={width:image.width,height:image.height,isColor:palette||replaySteps[0].action===\"huecombination\"||([\"LRGBCombination\",\"ChannelCombination\"].indexOf(replaySteps[0].tool)>=0&&replaySteps[0].createsImage)?true:image.isColor},masks=[],mappings=[],geometryChanged=false;",
      "   var proxy={isNull:false,mainView:{id:replayImage+\"_APA_current_result\",image:geometry},removeMask:function(){},setMask:function(){}};",
      "   for(var i=0;i<replaySteps.length;++i){masks[i]=null;mappings[i]={};var step=replaySteps[i],process=processes[i];replayAudit.current=i;updateReplayProgress(i,\"Loading inputs / masks\");if(replayStopRequested)throw Error(\"Replay cancelled before processing.\");",
      '      if((step.imageParameters||[]).length)mappings[i]=i===0&&firstMapping?firstMapping:chooseNativeReplayInputs(proxy,step);',
      "      if(step.action===\"pixelmath\"){",
      "         var mapping=i===0&&firstMapping?firstMapping:choosePixelMathInputs(proxy,step,pixelMathCache);",
      "         var names=step.inputs||[];",
      "         for(var n=0;n<names.length;++n){var window=pixelMathCache[\"$\"+names[n]];if(window!==proxy&&(!window||window.isNull))throw Error(\"Selected PixelMath input is unavailable: \"+names[n]);if(window===proxy)mapping[\"$\"+names[n]]=\"@APA_CURRENT\";}",
      "         mappings[i]=mapping;",
      "      }",
      "      if(step.mask&&!geometryChanged){applyReplayMask(proxy,step.mask,maskCache,step);var entry=maskCache[\"$\"+step.mask.name];validateReplayMask(entry.window,geometry,step.mask.name);masks[i]=entry;}",
      '      updateReplayProgress(i,"Ready");',
      "      if(process&&step.action===\"pixelmath\"&&process.createNewImage){",
      "         if(process.newImageWidth>0)geometry.width=process.newImageWidth;",
      "         if(process.newImageHeight>0)geometry.height=process.newImageHeight;",
      "         if(typeof process.Gray===\"number\"&&process.newImageColorSpace===process.Gray)geometry.isColor=false;else if(typeof process.RGB===\"number\"&&process.newImageColorSpace===process.RGB)geometry.isColor=true;",
      "      }",
      '      if(step.tool==="DynamicCrop"||step.tool==="FastRotation"||step.action==="imageblend"||step.action==="huecombination"||step.executionMode==="adjust")geometryChanged=true;',
      "   }",
      '   replayAudit.current=-1;return {masks:masks,mappings:mappings};',
      "}",
      "function resolveReplayMapping(mapping,output){var result={};for(var key in mapping)if(Object.prototype.hasOwnProperty.call(mapping,key))result[key]=mapping[key]===\"@APA_CURRENT\"?output.mainView.id:mapping[key];return result;}",
      'function runAtlasReplay() {',
      '   if(!replayChainContext&&replayHasAdjust){var session=atlasReplaySession(replaySessionKey),saved=session.read();if(saved){var decision=session.choose(saved);if(decision==="cancel")return;if(decision==="discard"){session.discard(saved);return;}var state=session.decode(saved.data,saved.pending);replayAudit=state.audit;replayAudit.current=state.index;if(decision==="applied")replayChoice(session.changes(saved));replayChoice("Manual adjustment "+decision+" on "+state.output.mainView.id+"; recorded step not applied again.");state.output.removeMask();finishReplayStep(state.index);openReplayProgress();try{continueAtlasReplay(state.output,prepareReplayProcesses(),state.resources,state.pixelMathCache,state.maskCache,{},state.index+1);}finally{closeReplayProgress(null);}return;}}',
      '   var candidates = [],game=replaySteps[0].action==="game";',
      '   var hueStart=replaySteps[0].action==="huecombination",blendStart=replaySteps[0].action==="imageblend",lrgbStart=["LRGBCombination","ChannelCombination"].indexOf(replaySteps[0].tool)>=0&&replaySteps[0].createsImage,pixelOutput=(replaySteps[0].action==="pixelmath"||lrgbStart||blendStart||hueStart)&&replaySteps[0].createsImage,pixelStart=pixelOutput&&!replaySteps[0].requiresTarget&&!replaySteps[0].mask&&replaySteps[0].inputs.length>0;',
      '   for(var i=0;i<ImageWindow.windows.length;++i) if(!ImageWindow.windows[i].isNull&&(!game||!ImageWindow.windows[i].mainView.image.isColor))candidates.push(ImageWindow.windows[i]);',
      '   if(!candidates.length)throw Error(game?"Open the completed original grayscale GAME mask before replay.":pixelStart?"Open the PixelMath reference images before replay.":"Open an image in the state BEFORE the first selected step.");',
      '   var processes=prepareReplayProcesses();',
      '   var count=replaySteps.length;',
      '   if(!count)throw Error("Replay cannot start: "+replaySteps[0].reason);',
      '   var dialog=new Dialog;dialog.windowTitle="AstroProcessAtlas - Replay";',
      '   var label=new Label(dialog);label.text="Input for "+replayImage+" - before step "+replaySteps[0].number;',
      '   var combo=new ComboBox(dialog);for(var j=0;j<candidates.length;++j)combo.addItem(candidates[j].mainView.id);',
      '   combo.currentItem=0;',
      '   if(game){label.text="GAME: select its completed original mask, before subsequent processing.";for(var g=0;g<candidates.length;++g)if(candidates[g].mainView.id.toLowerCase()===replayImage.toLowerCase()){combo.currentItem=g;break;}}',
      '   var palette=replaySteps[0].action==="palette",bindings=[],inputNames=palette?replaySteps[0].inputs:[];',
      '   if(palette)label.text="PerfectPalettePicker: select each input and its preparation state.";',
      '   for(var b=0;b<inputNames.length;++b){var bl=new Label(dialog);bl.text=inputNames[b];var bc=new ComboBox(dialog);for(var c=0;c<candidates.length;++c)bc.addItem(candidates[c].mainView.id);bc.currentItem=suggestPaletteInput(inputNames[b],candidates);var state=new ComboBox(dialog);state.addItem("Choose input state");state.addItem("Already prepared - combine without stretching");state.addItem("Linear - apply PPP stretch (median 0.25) on a copy");state.currentItem=0;bindings.push({name:inputNames[b],label:bl,combo:bc,state:state});}',
      '   var naming=new Label(dialog);naming.text="Copy name: "+(replayIdentifier||candidates[combo.currentItem].mainView.id)+"_APA_replay";',
      '   naming.toolTip="A numeric suffix is added if this name already exists.";',
      '   var outputName=new Edit(dialog);outputName.visible=pixelOutput;outputName.text=(replayIdentifier||replaySteps[0].outputId||replayImage)+"_APA_replay";',
      '   combo.onItemSelected=function(index){if(!pixelOutput&&index>=0&&index<candidates.length)naming.text="Copy name: "+(replayIdentifier||candidates[index].mainView.id)+"_APA_replay";};',
      '   var info=new Label(dialog);info.text="Will apply "+count+" of "+replaySteps.length+" selected processes to "+(palette?"a new RGB result.":"a new copy.");',
      '   for(var si=0;si<count;++si)if(replaySteps[si].action==="selective"){info.text+=" SelectiveColorCorrection uses the installed source included in this replay file.";info.wordWrapping=true;info.setMinWidth(480);break;}',
      '   var stop=new Label(dialog);stop.text=count<replaySteps.length?"Stops before step "+replaySteps[count].number+": "+replaySteps[count].reason:"All selected processes are supported.";',
      '   stop.wordWrapping=true;stop.setMinWidth(480);',
      '   var confirm=new CheckBox(dialog);confirm.text="I confirm the input is in the state BEFORE the first selected step.";',
      '   if(game){confirm.text="I confirm this is the completed original GAME mask before the following steps.";info.text="GAME mask creation is not repeated. Subsequent steps will run on a copy of the selected mask.";info.wordWrapping=true;info.setMinWidth(480);}',
      '   var run=new PushButton(dialog);run.text="Run on copy";run.enabled=false;run.onClick=function(){dialog.ok();};',
      '   var updateRun=function(){var valid=confirm.checked&&(!pixelOutput||/^[A-Za-z_][A-Za-z0-9_]*$/.test(outputName.text));for(var b=0;b<bindings.length;++b)if(bindings[b].state.currentItem<1)valid=false;run.enabled=valid;};confirm.onCheck=updateRun;outputName.onTextUpdated=updateRun;for(var b=0;b<bindings.length;++b)bindings[b].state.onItemSelected=updateRun;',
      '   var cancel=new PushButton(dialog);cancel.text="Cancel";cancel.onClick=function(){dialog.cancel();};',
      '   var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(run);buttons.add(cancel);',
      '   dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;',
      '   dialog.sizer.add(label);dialog.sizer.add(combo);for(var b=0;b<bindings.length;++b){dialog.sizer.add(bindings[b].label);dialog.sizer.add(bindings[b].combo);dialog.sizer.add(bindings[b].state);}dialog.sizer.add(naming);dialog.sizer.add(outputName);dialog.sizer.add(info);dialog.sizer.add(stop);dialog.sizer.add(confirm);dialog.sizer.add(buttons);dialog.adjustToContents();',
      '   if(palette){combo.visible=false;naming.text="Output name: "+(replayIdentifier||replayImage)+"_APA_replay";confirm.text="I confirm the selected input states match the original palette preparation.";dialog.adjustToContents();}',
      '   if(replaySteps[0].action==="external"){confirm.text="I confirm this input already contains the completed external processing at this step.";info.text="Select the image immediately AFTER the external result, before subsequent steps. Earlier processing is not repeated.";}',
      '   if(pixelOutput){naming.text="Output name:";if(pixelStart){combo.visible=false;label.text=replaySteps[0].tool+": set the output name. Reference images will be selected next.";confirm.text="I will select reference images at their original processing state.";info.text="Create a new combination result and continue subsequent steps on it.";run.text="Create result";}dialog.adjustToContents();}',
      '   if(lrgbStart){label.text=replaySteps[0].tool+": choose output name; source channels are selected next.";confirm.text="I will select grayscale source channels at their required processing state.";info.text="Create a new RGB result from the recorded channel combination.";}',
      '   if(!replayChainContext&&!palette&&!game&&!pixelOutput){var inputInfo=info.text,inputChanged=combo.onItemSelected;combo.onItemSelected=function(index){if(inputChanged)inputChanged(index);var selected=candidates[combo.currentItem],matched=selected?preparedReplayPrefix(selected,replaySteps).count:0;info.text=inputInfo+" Prepared automatic steps verified: "+matched+". These steps will be reused, not executed again.";info.wordWrapping=true;};combo.onItemSelected(combo.currentItem);confirm.text="I confirm the selected input is at the workflow start or after the verified matching steps.";}',
      '   if(replayChainContext){confirm.checked=true;var wanted=replayChainContext.input;if(wanted){var idx=-1;for(var ci=0;ci<candidates.length;++ci)if(!wanted.isNull&&candidates[ci].mainView.id===wanted.mainView.id){idx=ci;break;}if(idx<0)throw Error("Chain target is unavailable: "+(wanted.isNull?"closed window":wanted.mainView.id)+"; eligible images: "+candidates.map(function(window){return window.mainView.id;}).join(", "));combo.currentItem=idx;}outputName.text=replayChainContext.baseId;for(var b=0;b<bindings.length;++b){var selected=replayChainContext.palette(bindings[b].name);var pi=-1;for(var ci=0;ci<candidates.length;++ci)if(selected.window&&!selected.window.isNull&&candidates[ci].mainView.id===selected.window.mainView.id){pi=ci;break;}if(pi<0)throw Error("Chain palette input is unavailable: "+bindings[b].name);bindings[b].combo.currentItem=pi;bindings[b].state.currentItem=selected.state;}}',
      '   if(!replayChainContext&&(!dialog.execute()||!confirm.checked))return;',
      '   if(pixelOutput&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(outputName.text))throw Error("Enter a valid output image identifier (letters, digits and underscores; no initial digit).");',
      '   var input=candidates[combo.currentItem];if(!pixelStart&&(!input||input.isNull))throw Error("Selected input is unavailable.");',
      '   var reusedPrefix=!replayChainContext&&!palette&&!game&&!pixelOutput?preparedReplayPrefix(input,replaySteps):{count:0};',
      '   var mapped={},temporary=[],prepared={},maskCache={},pixelMathCache={},firstPixelMapping=null,output=null;',
      '   try {',
      '   openReplayProgress();',
      '   if(pixelStart){replayAudit.current=0;if(lrgbStart||blendStart||hueStart){firstPixelMapping=chooseNativeReplayInputs(null,replaySteps[0]);input=View.viewById(firstPixelMapping["$"+replaySteps[0].inputs[0]]).window;}else{firstPixelMapping=choosePixelMathInputs(null,replaySteps[0],pixelMathCache);input=pixelMathCache["$"+replaySteps[0].inputs[0]];}}',
      '   if(palette){for(var b=0;b<bindings.length;++b){var channel=candidates[bindings[b].combo.currentItem];if(!channel||channel.isNull||channel.mainView.image.isColor)throw Error("Select an available grayscale channel for "+bindings[b].name);if(bindings[b].state.currentItem!==1&&bindings[b].state.currentItem!==2)throw Error("Choose the preparation state for "+bindings[b].name);if(b===0)input=channel;else if(channel.mainView.image.width!==input.mainView.image.width||channel.mainView.image.height!==input.mainView.image.height)throw Error("Palette inputs must have matching dimensions.");}}',
      "   replayChoice(\"Starting image: \"+input.mainView.id);",
      "   if(palette)for(var b=0;b<bindings.length;++b)replayChoice(\"Palette \"+bindings[b].name+\" -> \"+candidates[bindings[b].combo.currentItem].mainView.id+\"; state: \"+(bindings[b].state.currentItem===2?\"Linear - stretch on copy\":\"Already prepared\"));",
      "   var resources=prepareReplayResources(input,processes,palette,pixelMathCache,maskCache,firstPixelMapping);",
      "   replayAudit.stage=\"Execution\";replayAudit.current=0;",
      '   if(palette)updateReplayProgress(0,"Loading palette preparation");',
      '   if(palette){for(var b=0;b<bindings.length;++b){var channel=candidates[bindings[b].combo.currentItem],view=channel.mainView;if(bindings[b].state.currentItem===2){var key="$"+view.id;if(prepared[key])view=prepared[key];else{var tid=view.id+"_APA_ppp_input",ti=1;while(!View.viewById(tid).isNull)tid=view.id+"_APA_ppp_input_"+(ti++);var ci=view.image,copy=new ImageWindow(ci.width,ci.height,ci.numberOfChannels,ci.bitsPerSample,ci.isReal,false,tid);temporary.push(copy);if(replayChainContext&&replayChainContext.rememberDerived)replayChainContext.rememberDerived(copy,channel,"palette preparation");copy.mainView.beginProcess(UndoFlag_NoSwapFile);try{copy.mainView.image.assign(ci);}finally{copy.mainView.endProcess();}view=copy.mainView;var expressions=["($T-max(min($T),med($T)-2.7*sdev($T)))/(1-max(min($T),med($T)-2.7*sdev($T)))","mtf(mtf(0.25,med($T)),$T)"];for(var p=0;p<expressions.length;++p){var stretch=new PixelMath;stretch.expression=expressions[p];stretch.useSingleExpression=true;stretch.symbols="";stretch.generateOutput=true;stretch.clearImageCacheAndExit=false;stretch.cacheGeneratedImages=false;stretch.use64BitWorkingImage=true;stretch.rescale=false;stretch.truncate=true;stretch.truncateLower=0;stretch.truncateUpper=1;stretch.createNewImage=false;stretch.showNewImage=false;if(stretch.executeOn(view)===false)throw Error("PPP input stretch failed: "+channel.mainView.id);processEvents();}prepared[key]=view;}}mapped["$"+bindings[b].name]=view.id;}}',
      '   updateReplayProgress(0,"Loading replay copy");',
      '   var baseId=(replayIdentifier||input.mainView.id)+"_APA_replay",id=baseId,suffix=1;',
      '   if(palette){baseId=(replayIdentifier||replayImage)+"_APA_replay";id=baseId;}',
      '   if(pixelOutput){baseId=outputName.text;id=baseId;}',
      '   if(replayChainContext){baseId=replayChainContext.baseId;id=baseId;}',
      '   while(!View.viewById(id).isNull)id=baseId+"_"+(suffix++);',
      '   var img=input.mainView.image,combinationBits=img.bitsPerSample,combinationReal=img.isReal;if(lrgbStart)for(var channelId in firstPixelMapping)if(Object.prototype.hasOwnProperty.call(firstPixelMapping,channelId)){var channelView=View.viewById(firstPixelMapping[channelId]);if(!channelView||channelView.isNull)throw Error("Combination source is unavailable.");combinationBits=Math.max(combinationBits,channelView.image.bitsPerSample);combinationReal=combinationReal||channelView.image.isReal;}if(lrgbStart&&combinationReal)combinationBits=Math.max(combinationBits,32);',
      '   if(replayChainContext&&replayChainContext.inPlace){output=input;}else{',
      '   output=new ImageWindow(palette||lrgbStart?img.width:1,palette||lrgbStart?img.height:1,palette||lrgbStart?3:img.numberOfChannels,lrgbStart?combinationBits:img.bitsPerSample,lrgbStart?combinationReal:img.isReal,palette||lrgbStart?true:img.isColor,id);',
      '   output.mainView.beginProcess(UndoFlag_NoSwapFile);',
      '   try{if(palette||lrgbStart)output.mainView.image.fill(0);else output.mainView.image.assign(img);}finally{output.mainView.endProcess();}',
      '   if(!palette){copyReplayMetadata(input,output);output.rgbWorkingSpace=input.rgbWorkingSpace;output.mainView.stf=input.mainView.stf;}',
      '   output.show();',
      '   }',
      '   for(var rp=0;rp<reusedPrefix.count;++rp){replayChoice("Reused prepared step "+replaySteps[rp].number+" - "+replaySteps[rp].title+" from "+input.mainView.id);finishReplayStep(rp);updateReplayProgress(rp,"Reused - matching history");}output=continueAtlasReplay(output,processes,resources,pixelMathCache,maskCache,mapped,reusedPrefix.count);',
      '   }catch(error){if(error.atlasPause)throw error;replaySummary(output,error.message);}',
      '   finally{closeReplayProgress(null);for(var t=0;t<temporary.length;++t)if(!temporary[t].isNull&&!(replayChainContext&&replayChainContext.keepTemporary))temporary[t].forceClose();}',
      '}',
      'function continueAtlasReplay(output,processes,resources,pixelMathCache,maskCache,mapped,start){',
      '   var pausing=false;try{',
      '      for(var k=start;k<replaySteps.length;++k){',
      '         replayAudit.current=k;if(replayStopRequested)throw Error("Replay cancelled after the completed steps.");updateReplayProgress(k,"Running");if(replayStopRequested)throw Error("Replay cancelled before this step.");',
      '         if(replaySteps[k].reason)throw Error("Stopped before step "+replaySteps[k].number+": "+replaySteps[k].reason);',
      '         if(replaySteps[k].action==="external"){if(k!==0)throw Error("Start at the external prepared result.");replayChoice("External prepared input: "+output.mainView.id);finishReplayStep(k);continue;}',
      '         if(replaySteps[k].action==="skip"){replayChoice(replaySteps[k].manualDerivedOrigin?"Manual connection: stars origin supplied by its source process.":"Skipped by user: "+replaySteps[k].title+"; pixels unchanged. Original external processing was not reproduced.");finishReplayStep(k);continue;}',
      '         if(replaySteps[k].action==="identifier"){Console.writeln("ImageIdentifier handled at creation: "+output.mainView.id);finishReplayStep(k);continue;}',
      '         if(replaySteps[k].action==="game"){if(k!==0)throw Error("Start the selected range at GAME and select its completed original mask.");Console.writeln("GAME: resumed from the user-supplied completed mask "+output.mainView.id+"; mask creation was not repeated.");finishReplayStep(k);continue;}',
      '         Console.writeln("Replay "+(k+1)+"/"+replaySteps.length+": "+replaySteps[k].title);',
      '         if(replaySteps[k].starRequired&&typeof StarXTerminator!=="function")throw Error("SelectiveColorCorrection requires StarXTerminator for its star mask.");',
      '         var process=processes[k];if((replaySteps[k].tool==="DynamicCrop"||replaySteps[k].tool==="FastRotation")&&process&&"noGUIMessages" in process)process.noGUIMessages=true;',
      '         if(["ColorCalibration","BackgroundNeutralization","LRGBCombination","ChannelCombination"].indexOf(replaySteps[k].tool)>=0)applyNativeReplayInputs(process,output,replaySteps[k],resources.mappings[k]);',
      '         applyReplayMask(output,replaySteps[k].mask,maskCache,replaySteps[k],resources.masks[k]);',
      '         if(replaySteps[k].executionMode==="adjust"){updateReplayProgress(k,"Waiting for adjustment");try{runInteractiveReplayStep(process,output,replaySteps[k],replayChoice);}catch(error){if(error.atlasPause)pausing=true;throw error;}finally{if(!pausing&&output&&!output.isNull)output.removeMask();}finishReplayStep(k);continue;}',
      '         if(replaySteps[k].action==="graxpert"){runGraxpertReplay(process,output,replayChoice);finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="pixelmath"){try{output=runPixelMathReplay(process,output,replaySteps[k],pixelMathCache,resolveReplayMapping(resources.mappings[k],output));}finally{if(output&&!output.isNull)output.removeMask();}finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="selective"){Parameters.set("apaSelectiveStep",k);if(replayChainContext)Parameters.set("apaChainNode",replayChainContext.taskIndex);try{runSelectiveReplay(process,output.mainView);}finally{Parameters.set("apaSelectiveStep",-1);if(replayChainContext)Parameters.set("apaChainNode",-1);}finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="huecombination"){output=runNarrowbandHueReplay(process,output,resolveReplayMapping(resources.mappings[k],output));finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="imageblend"){try{runImageBlendReplay(process,output,resolveReplayMapping(resources.mappings[k],output));}finally{output.removeMask();}finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="dark"){runDarkStructureReplay(process,output.mainView);finishReplayStep(k);processEvents();continue;}',
      '         if(replaySteps[k].action==="palette"){var keys=["expression","expression1","expression2"];for(var e=0;e<keys.length;++e)process[keys[e]]=process[keys[e]].replace(/(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)(?:[eE][+-]?[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*/g,function(token){return Object.prototype.hasOwnProperty.call(mapped,"$"+token)?mapped["$"+token]:token;});}',
      '         if(!process||typeof process.executeOn!=="function")throw Error("Required process is unavailable: "+replaySteps[k].title);',
      '         try{if(process.executeOn(output.mainView)===false)throw Error("Process failed: "+replaySteps[k].title);}finally{output.removeMask();}',
      '         finishReplayStep(k);processEvents();',
      '      }',
      '      replayAudit.stage="Completed";replayAudit.current=-1;replaySummary(output,null);',
      '   }catch(error){if(error.atlasPause){if(replayChainContext){replayChainContext.result=output;replayChainContext.pause=error.atlasPause;replayChainContext.keepTemporary=true;throw error;}var session=atlasReplaySession(replaySessionKey);for(var pc in pixelMathCache)if(Object.prototype.hasOwnProperty.call(pixelMathCache,pc)&&pixelMathCache[pc]&&pixelMathCache[pc].mainView.id===replayImage+"_APA_current_result")pixelMathCache[pc]=output;try{session.write({pending:error.atlasPause,output:output,index:replayAudit.current,audit:replayAudit,resources:resources,pixelMathCache:pixelMathCache,maskCache:maskCache});}catch(saveError){output.removeMask();session.clear();throw saveError;}session.announce(error.atlasPause);return output;}if(!replayChainContext&&replayHasAdjust)atlasReplaySession(replaySessionKey).clear();replaySummary(output,error.message);}',
      '   if(!replayChainContext&&replayHasAdjust)atlasReplaySession(replaySessionKey).clear();return output;',
      '}',
      'function runAtlasHistoryStep() {',
      '   if(!Parameters.has("apaSelectiveStep"))throw Error("This older replay history entry has no recorded step identifier. Generate a new report and replay; the full workflow will not run on this view.");',
      '   var index=Parameters.getInteger("apaSelectiveStep"),target=Parameters.targetView;',
      '   if(index<0||index>=replaySteps.length||index!==Math.floor(index)||replaySteps[index].action!=="selective"||replaySteps[index].reason)throw Error("This history entry does not identify a supported SelectiveColorCorrection step.");',
      '   if(!target||target.isNull)throw Error("Select a valid target view for this history step.");',
      '   if(replaySteps[index].starRequired&&typeof StarXTerminator!=="function")throw Error("SelectiveColorCorrection requires StarXTerminator for its star mask.");',
      '   runSelectiveReplay(replayFactories[index](),target);',
      '}',
      'try{if(Parameters.isViewTarget)runAtlasHistoryStep();else runAtlasReplay();}catch(error){if(Parameters.isViewTarget)new MessageBox(error.message,"AstroProcessAtlas - Replay stopped",StdIcon_Error,StdButton_Ok).execute();else replaySummary(null,error.message);}'
   ];
   var darkLibrary = '';
   for (var di = 0; di < selected.length; ++di) if (selected[di].action === 'dark' && !selected[di].reason) {
      if (!selected[di].library || (darkLibrary && darkLibrary !== selected[di].library)) throw Error('DarkStructureEnhance source is unavailable or inconsistent.');
      darkLibrary = selected[di].library;
   }
   if (darkLibrary) {
      var darkBridge = ['function runDarkStructureReplay(template,target) {',
         '   var digest=(new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(template.filePath)).toHex();',
         '   if(digest.toLowerCase()!==template.sourceDigest.toLowerCase())throw Error("DarkStructureEnhance source changed. Generate a new report and export.");',
         darkLibrary,
         '   updateReplayProgress(replayAudit.current,"Loading settings");var replayDialog=new DarkMaskLayersDialog();',
         '   if(!replayDialog.execute())throw Error("DarkStructureEnhance settings cancelled.");',
         '   replayChoice("DarkStructureEnhance: manual settings confirmed in PixInsight.");updateReplayProgress(replayAudit.current,"Running");',
         '   if(!data.targetView||data.targetView.isNull||(data.targetView.fullId||data.targetView.id)!==(target.fullId||target.id))throw Error("DarkStructureEnhance must target the replay copy. Select it in the settings dialog.");data.targetView=target;',
         '   var makeDarkMask=typeof doMask==="function"?doMask:null,ownedMasks=[];',
         '   if(makeDarkMask)doMask=function(settings){var mask=makeDarkMask(settings);ownedMasks.push(mask);return mask;};',
         '   try{doDark(data);}finally{target.window.removeMask();for(var m=0;m<ownedMasks.length;++m)if(!ownedMasks[m].isNull&&!data.viewMask){ownedMasks[m].removeMaskReferences();ownedMasks[m].forceClose();}}', '}'];
      lines.splice.apply(lines, [lines.indexOf('function runAtlasReplay() {'), 0].concat(darkBridge));
      for (var li = 0; li < lines.length; ++li) if (lines[li] === comment + 'SPDX-License-Identifier: MIT') lines[li] = comment + 'SPDX-License-Identifier: GPL-3.0-only';
      lines.unshift(comment + 'Includes DarkStructureEnhance by Carlos Sonnenstein and Oriol Lehmkuhl (GPL-3.0-only). This combined replay is distributed under GPL-3.0-only; AstroProcessAtlas portions retain their MIT notice.',
         '/*\n' + DARK_STRUCTURE_GPL_LICENSE + '\n*/');
   }
   var includePath = '';
   for (var si = 0; si < selected.length; ++si) if (selected[si].action === 'selective' && !selected[si].reason) {
      // This descriptor was constructed from validated saved parameters, not evaluated.
      var descriptor = /^var P = (.*);$/.exec(selected[si].source);
      var config = descriptor ? JSON.parse(descriptor[1]) : null;
      if (!config || !config.filePath || /["\r\n]/.test(config.filePath) || (includePath && includePath !== config.filePath))
         throw Error('SelectiveColorCorrection source path is unavailable or inconsistent.');
      includePath = config.filePath;
   }
   if (includePath) {
      var bridge = [
         'function runSelectiveReplay(template,target) {',
         '   var digest=(new CryptographicHash(CryptographicHash_SHA256)).hash(File.readFile(template.filePath)).toHex();',
         '   if(digest.toLowerCase()!==template.sourceDigest.toLowerCase())throw Error("SelectiveColorCorrection source changed since report generation. Generate a new report and export.");',
         '   var saved={};for(var p=0;p<template.parameters.length;++p)saved["$"+template.parameters[p][0]]=template.parameters[p][1];',
         '   var Parameters={isViewTarget:true,isGlobalTarget:false,targetView:target,has:function(key){return Object.prototype.hasOwnProperty.call(saved,"$"+key);},getReal:function(key){return Number(saved["$"+key]);},getInteger:function(key){return Number(saved["$"+key]);},getBoolean:function(key){return saved["$"+key]==="true";},getString:function(key){return saved["$"+key];},set:function(){throw Error("Unexpected SelectiveColorCorrection parameter write.");}};',
         '#include ' + JSON.stringify(includePath),
         '}'
      ];
      lines.splice.apply(lines, [lines.indexOf('function runAtlasReplay() {'), 0].concat(bridge));
   }
   for(var hi=0;hi<selected.length;++hi)if(selected[hi].action==='huecombination'){lines.splice(lines.indexOf('function runAtlasReplay() {'),0,runNarrowbandHueReplay.toString());break;}
   var blendFiles=null;
   for(var bi=0;bi<selected.length;++bi)if(selected[bi].action==='imageblend'&&!selected[bi].reason){var match=/^var P = (.*);$/.exec(selected[bi].source),config=match?JSON.parse(match[1]):null;if(!config||!config.files||config.files.length!==2)throw Error('ImageBlend installed source is unavailable.');for(var fi=0;fi<2;++fi)if(typeof config.files[fi].path!=='string'||/["\r\n]/.test(config.files[fi].path))throw Error('Invalid ImageBlend source path.');if(blendFiles&&JSON.stringify(blendFiles)!==JSON.stringify(config.files))throw Error('Inconsistent ImageBlend source files.');blendFiles=config.files;}
   if(blendFiles){
      var blendBridge=['function runImageBlendReplay(template,output,mapping){',
         '#include '+JSON.stringify(blendFiles[0].path),'#include '+JSON.stringify(blendFiles[1].path),
         '   var linked=false,settings=template.settings,a=View.viewById(mapping["$"+settings.imageAId]),b=View.viewById(mapping["$"+settings.imageBId]);if(!a||a.isNull||!b||b.isNull)throw Error("ImageBlend input is unavailable.");if(a.image.width!==b.image.width||a.image.height!==b.image.height)throw Error("ImageBlend requires matching input dimensions.");',
         '   var before={},existing=ImageWindow.windows,engine=null;for(var wi=0;wi<existing.length;++wi)before["$"+existing[wi].mainView.id]=true;try{if(a!==output.mainView){output.mainView.beginProcess(UndoFlag_NoSwapFile);try{output.mainView.image.assign(a.image);}finally{output.mainView.endProcess();}copyReplayMetadata(a.window,output);}engine=new ImageBlendEngine;for(var key in settings)if(["imageAId","imageBId","newViewId","createNewImage"].indexOf(key)<0)engine[key]=settings[key];engine.imageAView=output.mainView;engine.imageBView=b;engine.createNewImage=false;engine.saveParameters=function(){};var result=engine.blendViews(output.mainView,b,false,output.mainView.id);if(!result||result.isNull)throw Error("ImageBlend returned no result.");}finally{var windows=ImageWindow.windows;for(var i=0;i<windows.length;++i)if(windows[i].mainView.id!==output.mainView.id&&!before["$"+windows[i].mainView.id]&&!windows[i].isNull)windows[i].forceClose();}',
         '}'];
      lines.splice.apply(lines,[lines.indexOf('function runAtlasReplay() {'),0].concat(blendBridge));
      lines.unshift('#include <pjsr/ImageOp.jsh>','#include <pjsr/ColorSpace.jsh>','#include <pjsr/Color.jsh>',comment+'Uses ImageBlend by Mike Cranfield (GPL-3.0-only), from the installed CosmicPhotons source.');
      for(var li=0;li<lines.length;++li)if(lines[li]===comment+'SPDX-License-Identifier: MIT')lines[li]=comment+'SPDX-License-Identifier: GPL-3.0-only';
      lines.unshift('/*\n'+DARK_STRUCTURE_GPL_LICENSE+'\n*/');
   }
   for(var g=0;g<selected.length;++g)if(selected[g].action==='graxpert'){lines.splice(lines.indexOf('function runAtlasReplay() {'),0,prepareGraxpertReplay.toString(),runGraxpertReplay.toString());break;}
   for(var interactiveIndex=0;interactiveIndex<selected.length;++interactiveIndex)if(selected[interactiveIndex].executionMode==='adjust'){lines.splice(lines.indexOf('function runAtlasReplay() {'),0,runInteractiveReplayStep.toString());break;}
   return lines.join('\n') + '\n';
}


function ambiguousImageCopy(step){return step.action==='pixelmath'&&(step.inputs||[]).length===1&&step.inputs[0]==='image'&&/[.]expression\s*=\s*"image"\s*;/.test(step.source);}
function chainSlotKey(id,index,role,name){return id+'#'+index+'#'+role+'#'+name;}
function applyManualReplayConnections(workflow,bindings,annotations){
   var data=JSON.parse(JSON.stringify(workflow)),mapped=JSON.parse(JSON.stringify(bindings)),errors=[],warnings=[],errorTargets=[],warningTargets=[],currentTarget='',assignments={},edges=annotations&&annotations.edges||[];
   function problem(text){errorTargets[errors.length]=currentTarget;errors.push(text);}
   function warning(text){warningTargets[warnings.length]=currentTarget;warnings.push(text);}
   function locate(anchor){for(var i=0;i<data.length;++i){if(data[i].anchor===anchor)return {image:i,index:-1};for(var j=0;j<data[i].steps.length;++j)if(data[i].steps[j].anchor===anchor||(data[i].steps[j].memberAnchors||[]).indexOf(anchor)>=0)return {image:i,index:j};}return null;}
   function assign(key,origin){var value=origin.source+'@'+origin.stage;if(assignments[key]&&assignments[key]!==value){problem('Manual connection conflict: '+key);return;}assignments[key]=value;var previous=mapped[key]||{preparation:1,inverted:false};mapped[key]={source:origin.source,stage:origin.stage,preparation:previous.preparation,inverted:previous.inverted,manual:true};}
   for(var e=0;e<edges.length;++e){var edge=edges[e],from=locate(edge.from),to=locate(edge.to);currentTarget=to?data[to.image].id:'';if(!from||!to){problem('Manual connection: an endpoint is no longer available.');continue;}var source=data[from.image],target=data[to.image],producer=from.index>=0?source.steps[from.index]:null,origin={source:source.id,sourceAnchor:edge.from,stage:from.index>=0?from.index+1:source.steps.length,manual:true};
      if(to.index>=0&&target.steps[to.index].action==='skip'&&!target.steps[to.index].manualDerivedOrigin){warning('Manual connection: '+target.id+' / '+target.steps[to.index].number+' skipped; incoming dependency not required.');continue;}
      if(source.id===target.id){problem('Manual connection within '+source.id+': choose cross-image dependencies; history order is already recorded.');continue;}
      if(to.index<0&&from.index<0&&target.id===source.id+'_stars'){var producers=[];for(var ps=0;ps<source.steps.length;++ps)if(source.steps[ps].tool==='StarXTerminator')producers.push(ps);if(producers.length!==1){problem('Manual connection: '+source.id+' -> '+target.id+': connect from the exact StarXTerminator step.');continue;}from.index=producers[0];producer=source.steps[from.index];origin.stage=from.index+1;origin.sourceAnchor=producer.anchor;}
      var description='Manual connection: '+source.id+' checkpoint '+origin.stage+' -> '+target.id;
      if(to.index<0&&producer&&producer.tool==='StarXTerminator'&&(/_stars(?:_\d+)?$/i.test(target.id)||target.steps.length&&target.steps[0].tool==='StarXTerminator')){
         if((producer.source.match(/\.stars\s*=\s*(?:true|false)\s*;/g)||[]).length!==1){problem(description+': cannot enable Generate Star Image safely.');continue;}
         if(target.clone||target.stars&&(target.stars.source!==source.id||target.stars.stage!==origin.stage)){problem(description+': conflicts with another image origin.');continue;}
         producer.source=producer.source.replace(/(\.stars\s*=\s*)(true|false)(\s*;)/,'$1true$3');producer.warning='Manual connection: Generate Star Image enabled for '+target.id+'.';target.stars=origin;
         if(target.steps.length&&target.steps[0].tool==='StarXTerminator'){var initial=target.steps[0];initial.action='skip';initial.manualDerivedOrigin=true;initial.source='';initial.variable='';initial.inputs=[];initial.mask=null;initial.reason='';initial.title='StarXTerminator origin — supplied by manual connection';}
         warning(description+'; generated stars output.');continue;
      }
      var slots=chainReferenceSlots([target]),candidates=[];for(var s=0;s<slots.length;++s)if(to.index<0?slots[s].index===0:slots[s].index===to.index)candidates.push(slots[s]);
      var exact=candidates.filter(function(slot){return slot.name===source.id||mapped[slot.key]&&mapped[slot.key].source===source.id;}),unresolved=candidates.filter(function(slot){return !mapped[slot.key]||!mapped[slot.key].source;});
      var chosen=exact.length===1?exact[0]:unresolved.length===1?unresolved[0]:candidates.length===1?candidates[0]:null;
      if(chosen){assign(chosen.key,origin);warning(description+'; '+chosen.role+': '+chosen.name);continue;}
      if(to.index<0&&!candidates.length){if(target.stars||target.clone&&(target.clone.source!==origin.source||target.clone.stage!==origin.stage)){problem(description+': conflicts with another image origin.');continue;}target.clone=origin;warning(description+'; branch starts from this checkpoint.');continue;}
      problem(description+': cannot determine the input/mask role. Connect to the exact process and resolve ambiguous references.');
   }
   return {data:data,bindings:mapped,errors:errors,warnings:warnings,errorTargets:errorTargets,warningTargets:warningTargets};
}
function chainReferenceSlots(data){
   var slots=[];for(var i=0;i<data.length;++i)for(var j=0;j<data[i].steps.length;++j){var step=data[i].steps[j];for(var k=0;k<(step.inputs||[]).length;++k)slots.push({key:chainSlotKey(data[i].id,j,'input',step.inputs[k]),image:data[i].id,index:j,role:'input',name:step.inputs[k],palette:step.action==='palette'});if(step.mask)slots.push({key:chainSlotKey(data[i].id,j,'mask',step.mask.name),image:data[i].id,index:j,role:'mask',name:step.mask.name,inverted:step.mask.inverted});}return slots;
}
function suggestChainBindings(data){
   var result={},slots=chainReferenceSlots(data);
   function base(value){return value.toLowerCase().replace(/(?:_(?:final|processed|linear|starless|nbn|replay)(?:_[0-9]+)?)+$/g,'');}
   for(var i=0;i<slots.length;++i){var slot=slots[i],matches=[];
      for(var j=0;j<data.length;++j)if(data[j].id===slot.name){matches=[data[j]];break;}
      if(!matches.length)for(var j=0;j<data.length;++j)if(imageIdentityAliases(data[j]).indexOf(slot.name)>=0)matches.push(data[j]);
      if(!matches.length)for(var j=0;j<data.length;++j)if(data[j].id.toLowerCase()===slot.name.toLowerCase())matches.push(data[j]);
      if(!matches.length)for(var j=0;j<data.length;++j){var renamed=false;for(var r=0;r<data[j].steps.length;++r)if(data[j].steps[r].action==='identifier'&&data[j].steps[r].identifier&&base(data[j].steps[r].identifier)===base(slot.name))renamed=true;if(base(data[j].id)===base(slot.name)||renamed)matches.push(data[j]);}
      var source=matches.length===1?matches[0]:null,stage=source?source.steps.length:0;
      if(source&&source.id===slot.image)stage=slot.index;
      var owner=null;for(var q=0;q<data.length;++q)if(data[q].id===slot.image)owner=data[q];if(!source&&slot.name.toLowerCase()==='image'&&!(owner&&ambiguousImageCopy(owner.steps[slot.index]))){for(var j=0;j<data.length;++j)if(data[j].id===slot.image){source=data[j];stage=slot.index;}}
      result[slot.key]={source:source?source.id:'',stage:stage,preparation:slot.palette?0:1,inverted:slot.inverted===true};
   }return result;
}
function buildWorkspaceChainPlan(data,target,bindings){
   var byId={},tasks=[],errors=[],errorSlots={},warnings=[],state={},required={},snapshots={},roots=[],reachable={},targetImage=data[target];
   if(!targetImage)throw Error('Select a target image.');
   for(var i=0;i<data.length;++i){if(byId['$'+data[i].id]!==undefined)throw Error('Duplicate image ID.');byId['$'+data[i].id]=i;}
   function key(id,stage){return '$'+id+'@'+stage;}
   function referenceError(text,slot){errorSlots[errors.length]=slot.key;errors.push(text);}
   function edge(binding,slot,owner){
      if(!binding||byId['$'+binding.source]===undefined||binding.stage!==Math.floor(binding.stage)||binding.stage<0||binding.stage>data[byId['$'+binding.source]].steps.length){referenceError(owner+': choose a source checkpoint for '+slot.name,slot);return;}
      var source=data[byId['$'+binding.source]],first=source.steps[0];if(binding.stage===0&&!source.clone&&!source.stars&&first&&(first.action==='palette'||((first.action==='pixelmath'||first.action==='imageblend'||first.action==='huecombination'||(first.tool==='LRGBCombination'||first.tool==='ChannelCombination'))&&first.createsImage&&!first.requiresTarget&&!first.mask&&(first.inputs||[]).length>0&&(first.inputs||[]).indexOf(source.id)<0))){referenceError(owner+': no pixel checkpoint exists before the combination in '+source.id,slot);return;}
      if(slot.palette&&binding.preparation!==1&&binding.preparation!==2)referenceError(owner+': choose prepared or linear input state for '+slot.name,slot);
      snapshots[key(binding.source,binding.stage)]=true;visit(binding.source,binding.stage);
   }
   function visit(id,stage){
      var k=key(id,stage);if(state[k]===2)return;if(state[k]===1){errors.push('Dependency cycle at '+id+' checkpoint '+stage);return;}state[k]=1;
      var index=byId['$'+id],image=data[index],task={key:k,image:index,id:id,stage:stage,stepIndex:stage-1,kind:'step'};reachable['$'+id]=true;required['$'+id]=Math.max(required['$'+id]||0,stage);
      if(stage===0){
         var origin=image.clone||image.stars;
         if(origin){task.kind=image.clone?'clone':'stars';task.origin=origin;if(typeof origin.stage!=='number'||origin.stage!==Math.floor(origin.stage)||origin.stage<0||byId['$'+origin.source]===undefined||origin.stage>data[byId['$'+origin.source]].steps.length)errors.push(id+': origin checkpoint is unavailable; generate a new report.');else{snapshots[key(origin.source,origin.stage)]=true;visit(origin.source,origin.stage);}}
         else{var first=image.steps[0];task.kind=first&&(first.action==='palette'||((first.action==='pixelmath'||first.action==='imageblend'||first.action==='huecombination'||(first.tool==='LRGBCombination'||first.tool==='ChannelCombination'))&&first.createsImage&&!first.requiresTarget&&!first.mask&&(first.inputs||[]).length>0&&(first.inputs||[]).indexOf(id)<0))?'virtual':'input';if(task.kind==='input')roots.push({image:index,id:id,game:!!(first&&first.action==='game')});}
      }else if(image.steps[stage-1].action==='external'){task.kind='external-input';roots.push({image:index,id:id+'@'+stage,branch:id,stage:stage,external:true,game:false});
      }else{
         visit(id,stage-1);var step=image.steps[stage-1];if(step.warning&&step.warning.indexOf('User-confirmed stars output:')===0)warnings.push(id+' / '+step.number+': '+step.warning);if(step.action==='skip'&&!step.manualDerivedOrigin)warnings.push(id+' / '+step.number+': skipped by user; original external processing is not reproduced.');if(step.reason)errors.push(id+' / '+step.number+' '+step.title+': '+step.reason);
         if((step.action==='palette'||step.action==='game')&&stage!==1)errors.push(id+': palette/GAME must begin its branch.');
         var slots=chainReferenceSlots([image]);for(var r=0;r<slots.length;++r)if(slots[r].index===stage-1){edge(bindings[slots[r].key],slots[r],id+' / '+step.number);if(slots[r].role==='mask'&&typeof slots[r].inverted!=='boolean')warnings.push(id+' / '+step.number+': historical mask inversion is unknown; verify Color invert.');}
      }
      state[k]=2;tasks.push(task);
   }
   visit(targetImage.id,targetImage.steps.length);
   for(var i=0;i<tasks.length;++i)if(tasks[i].kind==='stars'){var parent=data[byId['$'+tasks[i].origin.source]],step=parent.steps[tasks[i].origin.stage-1];if(!step||step.tool!=='StarXTerminator'||step.action==='skip')errors.push(tasks[i].id+': stars producer checkpoint is invalid.');}
   var replayIds={};for(var i=0;i<data.length;++i)if(reachable['$'+data[i].id]){var name=data[i].id;for(var j=0;j<(required['$'+data[i].id]||0);++j)if(data[i].steps[j].action==='identifier'&&!data[i].steps[j].reason&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(data[i].steps[j].identifier))name=data[i].steps[j].identifier;replayIds['$'+data[i].id]=name+'_APA_replay';}
   return {replayIds:replayIds,startingInputs:{},target:target,targetId:targetImage.id,tasks:tasks,roots:roots,required:required,snapshots:snapshots,reachable:reachable,bindings:bindings,errors:errors,errorSlots:errorSlots,warnings:warnings};
}

function runWorkspaceChain(plan,modules){
   var session=plan.resumeKey?atlasReplaySession(plan.resumeKey):null,saved=session?session.read():null,paused=false,resumeIndex=0,preparedInputs={},reusedTasks=[];
   var outputs={},current={},cache={},seeds={},stars={},created=[],completed=[],choices=[],active=-1,stopRequested=false,progress=null,started=(new Date()).getTime(),diagnostics=[],failureStack="",phase="Preparing starting inputs";
   var tracePath='',traceText='';if(typeof File!=='undefined'&&typeof File.writeTextFile==='function'&&File.systemTempDirectory)tracePath=File.systemTempDirectory+'/AstroProcessAtlas_chain_trace_'+started+'_'+Math.floor(Math.random()*1000000000)+'.txt';
   function trace(message){var line=(new Date()).toISOString()+' | '+message;Console.writeln(line);if(typeof Console.flush==='function')Console.flush();if(tracePath)try{traceText+=line+'\n';File.writeTextFile(tracePath,traceText);}catch(error){Console.writeln('Unable to save chain trace: '+error.message);tracePath='';}}
   trace('Chain started: target='+plan.targetId+'; tasks='+plan.tasks.length+(tracePath?'; diagnostic file='+tracePath:''));for(var mw=0;mw<(plan.warnings||[]).length;++mw)if(plan.warnings[mw].indexOf('Manual connection:')===0){choices.push(plan.warnings[mw]);trace(plan.warnings[mw]);}
   function describe(window){if(!window||window.isNull)return "none / closed";var image=window.mainView.image;return window.mainView.id+" ["+image.width+"x"+image.height+", "+image.numberOfChannels+" channels, "+image.bitsPerSample+" bit, "+(image.isColor?"RGB":"grayscale")+"]";}
   function stateKey(id,stage){return '$'+id+'@'+stage;}
   function find(id){for(var i=0;i<ImageWindow.windows.length;++i)if(!ImageWindow.windows[i].isNull&&ImageWindow.windows[i].mainView.id===id)return ImageWindow.windows[i];return null;}
   var preparedCandidates={};
   function preparedSelection(root,window){var key=root.id+'|'+window.mainView.id+'|'+window.mainView.historyIndex;if(!preparedCandidates[key])preparedCandidates[key]=preparedReplayPrefix(window,modules[root.image].steps);return preparedCandidates[key];}
   function preparedHint(root,box,label,windows){if(root.game||root.external||!modules[root.image])return;var base=label.text;box.onItemSelected=function(){var input=windows[box.currentItem];label.text=base+(input?' - '+preparedSelection(root,input).count+' matching automatic steps ready to reuse':'');};box.onItemSelected();}
   function replayId(id){return plan.replayIds&&plan.replayIds['$'+id]||id+'_APA_replay';}
   function unique(base){var id=base,n=1;while(!View.viewById(id).isNull)id=base+'_'+n++;return id;}
   function origin(window,parent,kind,stage){var game=kind==='GAME mask input';try{if(typeof parent.mainView.propertyValue==='function'&&(!parent.mainView.hasProperty||parent.mainView.hasProperty('AstroProcessAtlas:ChainOrigin')))game=game||JSON.parse(String(parent.mainView.propertyValue('AstroProcessAtlas:ChainOrigin'))).game===true;}catch(e){}if(typeof window.mainView.setPropertyValue==='function')window.mainView.setPropertyValue('AstroProcessAtlas:ChainOrigin',JSON.stringify({parent:parent.mainView.id,kind:kind,stage:stage,game:game}));}
   function copy(window,id,kind,stage){var image=window.mainView.image,result=new ImageWindow(image.width,image.height,image.numberOfChannels,image.bitsPerSample,image.isReal,image.isColor,unique(id));created.push(result);try{result.mainView.beginProcess(UndoFlag_NoSwapFile);try{result.mainView.image.assign(image);}finally{result.mainView.endProcess();}copyReplayMetadata(window,result);result.rgbWorkingSpace=window.rgbWorkingSpace;result.mainView.stf=window.mainView.stf;origin(result,window,kind,stage);return result;}catch(e){result.forceClose();throw e;}}
   var temporaryCheckpoints=[],lastUse={},ownedImages={};
   function rememberOwned(window){try{if(window&&!window.isNull)ownedImages['$'+window.mainView.id]=true;}catch(error){diagnostics.push('Unable to inspect released image: '+error.message);}}
   function cleanOwned(all){var keep={};function preserve(map){for(var k in map)if(Object.prototype.hasOwnProperty.call(map,k)&&map[k]&&!map[k].isNull)keep['$'+map[k].mainView.id]=true;}preserve(outputs);preserve(stars);if(!all)preserve(cache);for(var k in ownedImages)if(Object.prototype.hasOwnProperty.call(ownedImages,k)&&!keep[k]){var window=find(k.substring(1));try{if(window){if(typeof window.removeMaskReferences==='function')window.removeMaskReferences();window.forceClose();diagnostics.push('Closed temporary image: '+k.substring(1));}delete ownedImages[k];}catch(error){diagnostics.push('Temporary image cleanup failed: '+k.substring(1)+'; '+error.message);}}}
   function need(id,stage,index){var key=stateKey(id,stage);lastUse[key]=Math.max(lastUse[key]===undefined?-1:lastUse[key],index);}
   for(var index=0;index<plan.tasks.length;++index){var pending=plan.tasks[index];if(pending.stage>0){need(pending.id,pending.stage-1,index);for(var name in plan.bindings)if(Object.prototype.hasOwnProperty.call(plan.bindings,name)&&name.indexOf(pending.id+'#'+pending.stepIndex+'#')===0){var binding=plan.bindings[name];need(binding.source,binding.stage,index);}}else if(pending.origin)need(pending.origin.source,pending.origin.stage,index);}
   function cleanCheckpoints(index,all){for(var c=temporaryCheckpoints.length-1;c>=0;--c){var entry=temporaryCheckpoints[c];if(all||lastUse[entry.key]===undefined||lastUse[entry.key]<=index){try{if(!entry.window.isNull){if(typeof entry.window.removeMaskReferences==='function')entry.window.removeMaskReferences();entry.window.forceClose();}delete cache[entry.key];temporaryCheckpoints.splice(c,1);}catch(error){Console.writeln('Temporary checkpoint cleanup failed: '+error.message);}}}}
   function get(id,stage){var k=stateKey(id,stage),window=cache[k];if(!window||window.isNull)throw Error('Unavailable checkpoint: '+id+' / '+stage);return window;}
   function update(index,status){if(!progress)return;var row=progress.rows[index];row.setText(1,status);if(typeof row.setTextColor==='function'){var color=status==='Completed'||status.indexOf('Reused')===0?0xff69d184:status==='Failed / cancelled'?0xffff8080:0xfff5b96e;row.setTextColor(0,color);row.setTextColor(1,color);}progress.label.text='Chain replay: '+completed.length+' / '+plan.tasks.length+' tasks | '+plan.tasks[index].id+' - '+status;if(typeof processEvents==='function')processEvents();}
   function openProgress(){if(typeof TreeBox!=='function')return;var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Chain replay';dialog.onClose=function(){return false;};var label=new Label(dialog);var tree=new TreeBox(dialog);tree.numberOfColumns=2;tree.headerVisible=true;tree.setHeaderText(0,'Image / step');tree.setHeaderText(1,'Status');tree.setMinSize(640,400);var rows=[];for(var i=0;i<plan.tasks.length;++i){var task=plan.tasks[i],row=new TreeBoxNode(tree);row.setText(0,task.id+' - '+(task.kind==='external-input'?'Prepared external result':task.stage?modules[task.image].titles[task.stepIndex]:task.kind));row.setText(1,'Waiting');rows.push(row);}if(typeof tree.adjustColumnWidthToContents==='function')tree.adjustColumnWidthToContents(0);var stop=new PushButton(dialog);stop.text='Stop after current step';stop.onClick=function(){stopRequested=true;stop.enabled=false;};dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;dialog.sizer.add(label);dialog.sizer.add(tree);dialog.sizer.add(stop);dialog.adjustToContents();progress={dialog:dialog,label:label,rows:rows};dialog.show();}
   // Validate every required branch before asking for starting images or making copies.
   for(var m=0;m<modules.length;++m)if(modules[m]){trace('Preflight module '+m);try{modules[m].check();}catch(error){trace('Preflight failed: '+error.message);throw error;}}
   if(saved){
      var decision=session.choose(saved);if(decision==='cancel')return;if(decision==='discard'){session.discard(saved);return;}
      var restored=session.decode(saved.data,saved.pending);outputs=restored.outputs;current=restored.current;cache=restored.cache;seeds=restored.seeds;stars=restored.stars;created=restored.created;completed=restored.completed;choices=restored.choices;diagnostics=restored.diagnostics;temporaryCheckpoints=restored.temporaryCheckpoints;ownedImages=restored.ownedImages;started=restored.started;preparedInputs=restored.preparedInputs||{};reusedTasks=restored.reusedTasks||[];
      var resumedTask=plan.tasks[restored.active],resumedValue=session.windowById(saved.pending.target);resumedValue.removeMask();if(!restored.inPlace)origin(resumedValue,get(resumedTask.id,resumedTask.stage-1),'branch input',resumedTask.stage-1);outputs['$'+resumedTask.id]=resumedValue;current['$'+resumedTask.id]=resumedTask.stage;
      if(modules[resumedTask.image].steps[resumedTask.stepIndex].tool==='StarXTerminator'){var resumedStars=[];for(var sw=0;sw<ImageWindow.windows.length;++sw){var candidate=ImageWindow.windows[sw];if(!candidate.isNull&&restored.before.indexOf(candidate.mainView.id)<0&&candidate.mainView.id.indexOf(resumedValue.mainView.id+'_stars')===0)resumedStars.push(candidate);}if(resumedStars.length===1){origin(resumedStars[0],resumedValue,'stars',resumedTask.stage);stars[resumedTask.key]=resumedStars[0];created.push(resumedStars[0]);rememberOwned(resumedStars[0]);}}
      if(plan.snapshots[resumedTask.key]&&resumedTask.stage<plan.required['$'+resumedTask.id]){cache[resumedTask.key]=copy(resumedValue,'APA_checkpoint_'+resumedTask.id+'_'+resumedTask.stage,'checkpoint',resumedTask.stage);temporaryCheckpoints.push({key:resumedTask.key,window:cache[resumedTask.key]});}else cache[resumedTask.key]=resumedValue;
      if(decision==='applied')choices.push(session.changes(saved));completed.push(restored.active);resumeIndex=restored.active+1;choices.push('Manual adjustment '+decision+' on '+saved.pending.target+'; recorded process not applied again.');trace('RESUME '+resumedTask.id+' / '+resumedTask.stage+'; '+decision);cleanCheckpoints(restored.active,false);cleanOwned(false);
   }else{
   var windows=[];for(var i=0;i<ImageWindow.windows.length;++i)if(!ImageWindow.windows[i].isNull)windows.push(ImageWindow.windows[i]);
   if(plan.roots.length&&!windows.length)throw Error('Open the original starting images and required prepared GAME masks.');
   var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Chain starting inputs';dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;var note=new Label(dialog);note.text='Select original inputs or prepared copies whose latest applied steps exactly match the automatic workflow prefix. Verified steps are reused. External inputs are prepared AFTER the indicated checkpoint; GAME inputs are completed original masks. All work runs on private copies; prepared GAME geometry cannot be reconstructed.';note.wordWrapping=true;note.setMinWidth(560);dialog.sizer.add(note);var boxes=[];
   for(var i=0;i<plan.roots.length;++i){var root=plan.roots[i],label=new Label(dialog);label.text=root.id+' -> '+replayId(root.branch||root.id)+(root.external?' - prepared image AFTER external processing':root.game?' - completed grayscale GAME mask':' - before its first process');dialog.sizer.add(label);var box=new ComboBox(dialog);for(var j=0;j<windows.length;++j)box.addItem(windows[j].mainView.id);var explicit=plan.startingInputs&&plan.startingInputs['$'+root.id];box.currentItem=explicit||root.external?-1:0;var preferred=explicit||root.id;for(var j=0;j<windows.length;++j)if(windows[j].mainView.id.toLowerCase()===preferred.toLowerCase())box.currentItem=j;boxes.push(box);dialog.sizer.add(box);preparedHint(root,box,label,windows);}
   var confirm=new CheckBox(dialog);confirm.text='I confirm the starting pixels, selected checkpoints, input preparation and mask inversion match the original workflow.';confirm.checked=false;dialog.sizer.add(confirm);var run=new PushButton(dialog);run.text='Rebuild chain on copies';run.enabled=false;confirm.onCheck=function(checked){run.enabled=checked;};run.onClick=function(){dialog.ok();};var cancel=new PushButton(dialog);cancel.text='Cancel';cancel.onClick=function(){dialog.cancel();};var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(run);buttons.add(cancel);dialog.sizer.add(buttons);dialog.adjustToContents();if(!dialog.execute()||!confirm.checked)return;
   for(var i=0;i<plan.roots.length;++i){var window=windows[boxes[i].currentItem];if(!window||window.isNull)throw Error('Select an available starting input for '+plan.roots[i].id);if(plan.roots[i].game&&window.mainView.image.isColor)throw Error('GAME needs a completed grayscale mask: '+plan.roots[i].id);seeds['$'+plan.roots[i].id]=window;choices.push(plan.roots[i].id+' starting input -> '+window.mainView.id);if(!plan.roots[i].game&&!plan.roots[i].external&&modules[plan.roots[i].image]){var prepared=preparedSelection(plan.roots[i],window);for(var ps=0;ps<prepared.count;++ps)if(plan.snapshots[stateKey(plan.roots[i].id,ps)]&&prepared.positions[ps]===null)throw Error('Cannot reuse prepared '+plan.roots[i].id+': required checkpoint '+ps+' is inside read-only initial history. Select an earlier input image.');preparedInputs['$'+plan.roots[i].id]=prepared;choices.push(plan.roots[i].id+': '+prepared.count+' matching automatic steps can be reused.'+(prepared.reason?' '+prepared.reason:''));}}
   }
   var failure='';
   try{
      openProgress();for(var done=0;done<completed.length;++done)update(completed[done],reusedTasks.indexOf(completed[done])>=0?'Reused - matching history':'Completed');
      for(var t=resumeIndex;t<plan.tasks.length;++t){active=t;var task=plan.tasks[t];if(stopRequested)throw Error('Chain replay cancelled before '+task.id+' / '+task.stage);phase='Task '+(t+1)+' / '+plan.tasks.length+' | '+task.id+' checkpoint '+task.stage;trace('BEGIN '+phase);update(t,'Running');var value=null;diagnostics.push(phase);
         if(task.kind==='external-input'){value=copy(seeds['$'+task.id+'@'+task.stage],replayId(task.id),'external prepared input',task.stage);outputs['$'+task.id]=value;current['$'+task.id]=task.stage;if(plan.snapshots[task.key]&&task.stage<plan.required['$'+task.id]){cache[task.key]=copy(value,'APA_checkpoint_'+task.id+'_'+task.stage,'checkpoint',task.stage);temporaryCheckpoints.push({key:task.key,window:cache[task.key]});}else cache[task.key]=value;}else if(task.stage===0){
            if(task.kind==='input'){
               value=seeds['$'+task.id];var prepared=preparedInputs['$'+task.id];
               if(prepared&&prepared.count){var input=value,originalPosition=input.mainView.historyIndex;value=copy(input,replayId(task.id),'prepared input',prepared.count);outputs['$'+task.id]=value;current['$'+task.id]=prepared.count;
                  try{for(var ps=0;ps<prepared.count;++ps)if(plan.snapshots[stateKey(task.id,ps)]){input.mainView.historyIndex=prepared.positions[ps];if(input.mainView.historyIndex!==prepared.positions[ps])throw Error('Cannot access prepared checkpoint '+task.id+' / '+ps);var checkpoint=copy(input,'APA_checkpoint_'+task.id+'_'+ps,'prepared checkpoint',ps),checkpointKey=stateKey(task.id,ps);cache[checkpointKey]=checkpoint;temporaryCheckpoints.push({key:checkpointKey,window:checkpoint});}}
                  finally{if(input.mainView.historyIndex!==originalPosition)input.mainView.historyIndex=originalPosition;if(input.mainView.historyIndex!==originalPosition)throw Error('Unable to restore selected input history: '+task.id);}
               }
            }
            else if(task.kind==='clone')value=copy(get(task.origin.source,task.origin.stage),replayId(task.id),'clone',task.origin.stage);
            else if(task.kind==='stars'){value=stars[stateKey(task.origin.source,task.origin.stage)];if(!value||value.isNull)throw Error('StarXTerminator did not provide its expected stars image: '+task.id);}
            if(!cache[task.key])cache[task.key]=value;if(task.kind==='clone'||task.kind==='stars'){outputs['$'+task.id]=value;current['$'+task.id]=0;}
         }else if(preparedInputs['$'+task.id]&&task.stage<=preparedInputs['$'+task.id].count){
            value=outputs['$'+task.id];if(!cache[task.key]){if(plan.snapshots[task.key]&&task.stage===preparedInputs['$'+task.id].count&&task.stage<plan.required['$'+task.id]){cache[task.key]=copy(value,'APA_checkpoint_'+task.id+'_'+task.stage,'prepared checkpoint',task.stage);temporaryCheckpoints.push({key:task.key,window:cache[task.key]});}else cache[task.key]=value;}reusedTasks.push(t);choices.push(task.id+' / '+task.stage+': Reused - identical automatic process and parameters in selected input history.');
         }else{
            var module=modules[task.image],step=module.steps[task.stepIndex],previous=task.stage===1?cache[stateKey(task.id,0)]:get(task.id,task.stage-1);
            var inPlace=outputs['$'+task.id]&&current['$'+task.id]===task.stage-1,target=inPlace?outputs['$'+task.id]:previous;
            var before=[];for(var w=0;w<ImageWindow.windows.length;++w)before.push(ImageWindow.windows[w].mainView.id);
            var context={input:target,inPlace:!!inPlace,baseId:replayId(task.id),taskIndex:t,result:null,keepTemporary:false};
            context.onProgress=function(index,status){phase=task.id+' / '+step.number+' '+step.title+' | '+status;update(active,status);};context.note=function(text){choices.push(task.id+' / '+task.stage+': '+text);};
            context.rememberDerived=function(window,parent,kind){created.push(window);rememberOwned(window);origin(window,parent,kind,task.stage-1);};
            var executionDetails='Tool: '+step.tool+'; action: '+step.action+'; step: '+step.number+' '+step.title+'; input: '+describe(target)+'; in-place: '+!!inPlace+'; planned output: '+context.baseId;diagnostics.push(executionDetails);trace('EXECUTE '+executionDetails);
            context.inputs=function(request){var mapped={};for(var n=0;n<(request.inputs||[]).length;++n){var name=request.inputs[n],binding=plan.bindings[chainSlotKey(task.id,task.stepIndex,'input',name)];mapped['$'+name]=get(binding.source,binding.stage);diagnostics.push('PixelMath '+name+' <- '+binding.source+' checkpoint '+binding.stage+' -> '+describe(mapped['$'+name]));}return mapped;};
            context.palette=function(name){var binding=plan.bindings[chainSlotKey(task.id,task.stepIndex,'input',name)];var window=get(binding.source,binding.stage);diagnostics.push('Palette '+name+' <- '+binding.source+' checkpoint '+binding.stage+' -> '+describe(window)+'; preparation: '+binding.preparation);return {window:window,state:binding.preparation};};
            context.mask=function(request){if(!request)return null;var binding=plan.bindings[chainSlotKey(task.id,task.stepIndex,'mask',request.name)];var window=get(binding.source,binding.stage);diagnostics.push('Mask '+request.name+' <- '+binding.source+' checkpoint '+binding.stage+' -> '+describe(window)+'; Color invert: '+(binding.inverted===true));return {window:window,colorInvert:binding.inverted===true};};
            try{value=module.run(context,task.stepIndex);}catch(error){if(context.result&&!context.result.isNull){outputs['$'+task.id]=context.result;if(created.indexOf(context.result)<0)created.push(context.result);}throw error;}finally{var taskWindows=ImageWindow.windows;for(var tw=0;tw<taskWindows.length;++tw)if(!taskWindows[tw].isNull&&before.indexOf(taskWindows[tw].mainView.id)<0)rememberOwned(taskWindows[tw]);}if(!value||value.isNull)throw Error('Branch produced no result: '+task.id);
            if(!inPlace&&previous){origin(value,previous,step.action==='game'?'GAME mask input':'branch input',task.stage-1);created.push(value);}outputs['$'+task.id]=value;current['$'+task.id]=task.stage;
            if(step.tool==='StarXTerminator'){var found=[];for(var w=0;w<ImageWindow.windows.length;++w){var candidate=ImageWindow.windows[w];if(!candidate.isNull&&before.indexOf(candidate.mainView.id)<0&&candidate.mainView.id.indexOf(value.mainView.id+'_stars')===0)found.push(candidate);}if(found.length===1){stars[task.key]=found[0];origin(found[0],value,'stars',task.stage);}}
            if(plan.snapshots[task.key]&&task.stage<plan.required['$'+task.id]){cache[task.key]=copy(value,'APA_checkpoint_'+task.id+'_'+task.stage,'checkpoint',task.stage);temporaryCheckpoints.push({key:task.key,window:cache[task.key]});}else cache[task.key]=value;
         }
         completed.push(t);update(t,reusedTasks.indexOf(t)>=0?'Reused - matching history':'Completed');trace('PROCESS DONE '+phase+'; cleanup starting');cleanCheckpoints(t,false);for(var ci=0;ci<created.length;++ci)rememberOwned(created[ci]);cleanOwned(false);trace('END task '+(t+1)+' / '+plan.tasks.length+'; completed='+completed.length);
      }
      var final=outputs['$'+plan.targetId]||copy(get(plan.targetId,0),replayId(plan.targetId),'starting input',0);final.show();
   }catch(error){if(error.atlasPause&&session){for(var st=0;st<plan.tasks.length;++st)if(plan.tasks[st].kind==='stars'&&plan.tasks[st].origin.source===task.id&&plan.tasks[st].origin.stage===task.stage)error.atlasPause.skipAllowed=false;for(var pi=0;pi<created.length;++pi)rememberOwned(created[pi]);try{session.write({pending:error.atlasPause,active:active,before:before,inPlace:inPlace,outputs:outputs,current:current,cache:cache,seeds:seeds,stars:stars,created:created,completed:completed,choices:choices,diagnostics:diagnostics,temporaryCheckpoints:temporaryCheckpoints,ownedImages:ownedImages,started:started,preparedInputs:preparedInputs,reusedTasks:reusedTasks});}catch(saveError){if(context&&context.result&&!context.result.isNull)context.result.removeMask();throw saveError;}paused=true;trace('PAUSED '+phase+'; resume by running the same script again.');}else{failure=error.message;failureStack=error.stack?String(error.stack):'No stack supplied by PixInsight.';trace('FAILED '+phase+'; '+failure+'\n'+failureStack);if(active>=0)update(active,'Failed / cancelled');}}
   finally{trace(paused?'Paused: checkpoints retained':'Final cleanup starting');try{if(!paused){cleanCheckpoints(plan.tasks.length,true);for(var cleanupIndex=0;cleanupIndex<created.length;++cleanupIndex)rememberOwned(created[cleanupIndex]);cleanOwned(true);if(session)session.clear();}}catch(error){diagnostics.push('Final cleanup failed: '+error.message);trace('Final cleanup failed: '+error.message);}if(progress)progress.dialog.hide();trace((paused?'Pause state saved; completed=':'Final cleanup finished; completed=')+completed.length+' / '+plan.tasks.length);}
   if(paused){session.announce(errorPausePending());return;}
   function errorPausePending(){return {target:outputs['$'+plan.tasks[active].id].mainView.id,title:modules[plan.tasks[active].image].steps[plan.tasks[active].stepIndex].title};}
   var text=(failure?'Chain stopped: '+failure:'Chain complete: '+(outputs['$'+plan.targetId]?outputs['$'+plan.targetId].mainView.id:final.mainView.id))+'\nCompleted: '+completed.length+' / '+plan.tasks.length+' tasks\n\nRetained branch images:';
   for(var id in outputs)if(Object.prototype.hasOwnProperty.call(outputs,id)&&outputs[id]&&!outputs[id].isNull){outputs[id].show();text+='\n'+id.substring(1)+' -> '+outputs[id].mainView.id;}
   text+='\n\nDiagnostics:\nTarget: '+plan.targetId+'\nElapsed: '+(((new Date()).getTime()-started)/1000).toFixed(3)+' s\nLast phase: '+phase;
   if(tracePath)text+='\nPersistent execution trace: '+tracePath;trace((failure?'Chain stopped: '+failure:'Chain complete')+'; completed='+completed.length+' / '+plan.tasks.length);
   if(active>=0){var failed=plan.tasks[active];text+='\nActive task: '+(active+1)+' / '+plan.tasks.length+' | '+failed.id+' checkpoint '+failed.stage;if(failed.stage>0)text+='\nStep metadata: '+JSON.stringify(modules[failed.image].steps[failed.stepIndex]);}
   text+='\n\nExecution trace:\n'+diagnostics.join('\n');if(failure)text+='\n\nError stack:\n'+failureStack;
   text+='\n\nOpen images at completion:';var open=ImageWindow.windows;for(var w=0;w<open.length;++w)if(!open[w].isNull)text+='\n'+describe(open[w]);
   text+='\n\nTask results:';for(var i=0;i<plan.tasks.length;++i){var task=plan.tasks[i];text+='\n'+task.id+' / '+task.stage+': '+(completed.indexOf(i)>=0?(reusedTasks.indexOf(i)>=0?'Reused - matching history':'Completed'):i===active&&failure?'Failed / cancelled':'Not executed');}text+='\n\nSelected inputs and masks:\n'+choices.join('\n');
   Console.writeln(text);
   if(typeof TextBox==='function'){
      var report=new Dialog;report.windowTitle='AstroProcessAtlas - Chain replay report';report.sizer=new VerticalSizer;report.sizer.margin=12;report.sizer.spacing=8;var box=new TextBox(report);box.readOnly=true;box.useRichText=false;box.text=text;box.setMinSize(700,420);report.sizer.add(box);
      var save=new PushButton(report);save.text='Save report...';save.onClick=function(){try{var picker=new SaveFileDialog;picker.caption='Save chain replay report';picker.filters=[['Text files (*.txt)','*.txt']];picker.initialPath='AstroProcessAtlas_chain_report.txt';if(!picker.execute())return;var file=new File;try{file.createForWriting(picker.fileName);file.write(ByteArray.stringToUTF8(text));}finally{file.close();}}catch(e){new MessageBox(e.message,'AstroProcessAtlas',StdIcon_Error,StdButton_Ok).execute();}};var close=new PushButton(report);close.text='Close';close.onClick=function(){report.ok();};var buttons=new HorizontalSizer;buttons.add(save);buttons.addStretch();buttons.add(close);report.sizer.add(buttons);report.adjustToContents();report.execute();
   }else new MessageBox(text,'AstroProcessAtlas - Chain replay report',failure?StdIcon_Error:StdIcon_Information,StdButton_Ok).execute();
}

function buildWorkspaceChainScript(data,plan){
   if(!plan||plan.errors.length)throw Error('Resolve all chain blockers before export.');
   plan=JSON.parse(JSON.stringify(plan));for(var ai=0;ai<plan.tasks.length;++ai){var at=plan.tasks[ai];if(at.kind==='step'&&at.stage>0&&data[at.image].steps[at.stepIndex].executionMode==='adjust'){plan.resumeKey='AstroProcessAtlas/chain/'+(new Date()).getTime()+'_'+Math.floor(Math.random()*1000000000);break;}}
   var comment=String.fromCharCode(47,47)+' ',code=[comment+'AstroProcessAtlas dependency chain replay',comment+'SPDX-License-Identifier: MIT',comment+'Copyright (c) 2026 YoruHikari Astrophotography - https:'+String.fromCharCode(47,47)+'www.yoruhikari.gr/','#include <pjsr/Sizer.jsh>','#include <pjsr/UndoFlag.jsh>','#include <pjsr/StdIcon.jsh>','#include <pjsr/StdButton.jsh>','#include <pjsr/CryptographicHash.jsh>','#include <pjsr/DataType.jsh>',atlasReplaySession.toString(),copyReplayMetadata.toString(),historyParameterKey.toString(),readHistoryMasks.toString(),preparedReplayPrefix.toString(),chainSlotKey.toString(),runWorkspaceChain.toString(),'var chainPlan='+JSON.stringify(plan)+';','var chainModules=[];','var atlasSharedGraxpertCache={};'];
   for(var i=0;i<data.length;++i){var through=plan.required['$'+data[i].id]||0;if(!through)continue;
      var engine=JSON.parse(JSON.stringify(data[i]));for(var k=0;k<through;++k){var needed=false;for(var t=0;t<plan.tasks.length;++t)if(plan.tasks[t].image===i&&plan.tasks[t].stepIndex===k&&plan.tasks[t].kind==='step')needed=true;if(!needed)engine.steps[k]={title:'Skipped before prepared checkpoint',tool:'ImageIdentifier',number:data[i].steps[k].number,action:'identifier',identifier:data[i].id,reason:'',source:'',variable:''};}var body=buildWorkspaceReplayScript(engine,0,through-1).replace(/^#include <pjsr\/[^>]+>[ \t]*$/gm,function(dependency){if(code.indexOf(dependency)<0)code.splice(3,0,dependency);return '';}).replace(/^try\{if\(Parameters\.isViewTarget\)runAtlasHistoryStep\(\);else runAtlasReplay\(\);\}catch\(error\)\{[^\n]*\}\s*$/m,'');
      code.push('chainModules['+i+']=(function(){'+body+'\nvar allSteps=replaySteps,allFactories=replayFactories;return {steps:allSteps,titles:allSteps.map(function(step){return step.number+" - "+step.title;}),check:function(){replaySteps=allSteps;replayFactories=allFactories;prepareReplayProcesses();},run:function(context,index){replaySteps=[allSteps[index]];replayFactories=[allFactories[index]];replayChainContext=context;replayAudit={stage:"Preflight",current:-1,completed:[],preflightFailures:[],choices:[],started:(new Date()).getTime()};replayStopRequested=false;runAtlasReplay();return context.result;},history:function(index){replaySteps=[allSteps[index]];replayFactories=[allFactories[index]];runAtlasHistoryStep();}};})();');
   }
   for(var t=0;t<plan.tasks.length;++t){var task=plan.tasks[t];if(task.kind==='step'&&task.stage>0&&['dark','imageblend'].indexOf(data[task.image].steps[task.stepIndex].action)>=0)code[1]=comment+'SPDX-License-Identifier: GPL-3.0-only';}
   code.push('try{if(Parameters.isViewTarget){if(!Parameters.has("apaChainNode"))throw Error("This chain history entry has no supported step identifier.");var index=Parameters.getInteger("apaChainNode"),task=chainPlan.tasks[index];if(!task||task.stage<1||!chainModules[task.image]||chainModules[task.image].steps[task.stepIndex].action!=="selective")throw Error("Unsupported chain history step.");chainModules[task.image].history(task.stepIndex);}else runWorkspaceChain(chainPlan,chainModules);}catch(error){new MessageBox(error.message,"AstroProcessAtlas - Chain stopped",StdIcon_Error,StdButton_Ok).execute();}');
   return code.join('\n')+'\n';
}


function remapWorkflowExpression(text,mapped){var tokens=pixelMathTextTokens(text),result='',last=0;for(var i=0;i<tokens.length;++i){var token=tokens[i];if(!token.macro&&!token.call&&!token.local&&Object.prototype.hasOwnProperty.call(mapped,'$'+token.name)){result+=text.slice(last,token.start)+mapped['$'+token.name];last=token.end;}}return result+text.slice(last);}
function editedWorkspaceGraph(original,workflow,baseline,bindings,operations){
   var graph={nodes:[],edges:[]},old={},replay={},hidden={},live={};for(var i=0;i<original.nodes.length;++i)old['$'+original.nodes[i].id]=original.nodes[i];
   for(var i=0;i<baseline.length;++i)for(var j=0;j<baseline[i].steps.length;++j)replay['$'+baseline[i].steps[j].anchor]=true;
   for(var i=0;i<operations.length;++i)if(operations[i].type==='remove-node')hidden['$'+operations[i].node]=true;
   function add(node){graph.nodes.push(node);live['$'+node.id]=node;}
   for(var i=0;i<workflow.length;++i){var image=workflow[i],header=null,extra=[];for(var n=0;n<original.nodes.length;++n)if(original.nodes[n].image===image.id){if(original.nodes[n].header)header=JSON.parse(JSON.stringify(original.nodes[n]));else if(!replay['$'+original.nodes[n].id]&&!hidden['$'+original.nodes[n].id])extra.push(JSON.parse(JSON.stringify(original.nodes[n])));}
      if(!header)continue;add(header);var row=0,previous=header.id;
      var append=function(node){node.x=header.x;node.y=160+row++*105;add(node);graph.edges.push({from:previous,to:node.id,kind:'sequence',provenance:node.edited?'manual':'recorded',detail:node.edited?'Edited workflow sequence':'History sequence',redo:!!node.redo});previous=node.id;};
      for(var n=0;n<extra.length;++n)if(!extra[n].redo){extra[n].label='Origin — '+extra[n].tool;append(extra[n]);}
      for(var j=0;j<image.steps.length;++j){var step=image.steps[j],node=old['$'+step.anchor]?JSON.parse(JSON.stringify(old['$'+step.anchor])):{id:step.anchor,image:image.id,memberIds:[],header:false,phase:'edited',redo:false};node.id=step.anchor;node.image=image.id;node.workflowIndex=j;node.executionMode=step.executionMode||'auto';node.label=(j+1)+'. '+step.title+(step.executionMode==='adjust'?' [adjust]':step.executionMode==='skip'?' [skip]':'');node.tool=step.tool||step.title;node.parameterChanges=(step.executionOriginalStep||step).parameterChanges||[];node.edited=!!step.edited||!!node.parameterChanges.length;node.hasMask=!!step.mask;node.search=(image.id+' '+step.title+' '+step.source).toLowerCase();append(node);}
      for(var n=0;n<extra.length;++n)if(extra[n].redo)append(extra[n]);
   }
   function link(edge){if(live['$'+edge.from]&&live['$'+edge.to]){for(var e=0;e<graph.edges.length;++e)if(graph.edges[e].from===edge.from&&graph.edges[e].to===edge.to&&graph.edges[e].kind===edge.kind)return;graph.edges.push(edge);}}
   for(var e=0;e<original.edges.length;++e)if(original.edges[e].kind!=='sequence'&&!replay['$'+original.edges[e].to])link(JSON.parse(JSON.stringify(original.edges[e])));
   function checkpoint(id,stage){for(var i=0;i<workflow.length;++i)if(workflow[i].id===id)return stage>0&&workflow[i].steps[stage-1]?workflow[i].steps[stage-1].anchor:workflow[i].anchor;return null;}
   var slots=chainReferenceSlots(workflow);for(var i=0;i<slots.length;++i){var slot=slots[i],binding=bindings[slot.key];if(binding&&binding.source&&!(slot.role==='input'&&binding.source===slot.image&&binding.stage===slot.index))link({from:checkpoint(binding.source,binding.stage),to:checkpoint(slot.image,slot.index+1),kind:slot.role==='mask'?'mask':'input',provenance:'manual',uncertain:true,detail:'Edited workflow reference: '+slot.name+' at checkpoint '+binding.stage});}
   for(var i=0;i<workflow.length;++i){var origin=workflow[i].clone||workflow[i].stars;if(origin&&typeof origin.stage==='number')link({from:checkpoint(origin.source,origin.stage),to:workflow[i].anchor,kind:workflow[i].stars?'output':'input',provenance:'manual',uncertain:true,detail:'Edited workflow derived branch'});}
   return graph;
}
function resolveAtlasReportSource(model,key){
   if(!model.sources||!Object.prototype.hasOwnProperty.call(model.sources,key))throw Error('Missing report source: '+key);
   var source=model.sources[key];if(typeof source==='string')return source;
   if(source&&source.image===Math.floor(source.image)&&source.step===Math.floor(source.step)&&source.image>=0&&source.step>=0){var image=model.workspace.images[source.image],step=image&&image.steps[source.step];if(step&&typeof step.source==='string')return step.source;}
   throw Error('Invalid report source: '+key);
}

function hydrateAtlasReportSource(element,model){
   if(!element||typeof element.getAttribute!=='function')return false;var key=element.getAttribute('data-apa-source');if(!key)return false;var text=resolveAtlasReportSource(model,key);if(element.value!==text)element.value=text;return true;
}

function createAtlasReportData(records,graph,options){
   options=options||{};var history=[],images=workspaceReplayData(records),sources={},buckets={},sourceCount=0;
   var sourceModel={sources:sources,workspace:{images:images}};
   function sourceKey(text,reference){text=typeof text==='string'?text:'';var hash='$'+workflowFingerprint(text),bucket=buckets[hash]||[];for(var b=0;b<bucket.length;++b)if(resolveAtlasReportSource(sourceModel,bucket[b])===text)return bucket[b];var key='s'+sourceCount++;sources[key]=reference||text;bucket.push(key);buckets[hash]=bucket;return key;}
   for(var ri=0;ri<images.length;++ri)for(var si=0;si<images[ri].steps.length;++si)if(images[ri].steps[si].source)sourceKey(images[ri].steps[si].source,{image:ri,step:si});
   function optional(object,key,fallback){return key in object?object[key]:fallback;}
   for(var r=0;r<records.length;++r){var record=records[r],steps=[];
      for(var i=0;i<record.steps.length;++i){var step=record.steps[i];steps.push({anchor:step.anchor,title:step.title,tool:getProcessName(step.proc),statistics:optional(step,'statistics',null),origin:isImageOriginStep(step,i),source:sourceKey(step.source),number:optional(step,'displayNumber',i+1),groupAnchor:optional(step,'groupAnchor',step.anchor),phase:optional(step,'phase',''),redo:optional(step,'redo',false),time:optional(step,'time',''),mask:step.mask,references:optional(step,'references',[]),preview:{current:optional(step,'thumb',''),before:optional(step,'beforeThumb',''),after:optional(step,'afterThumb',''),appearance:optional(step,'appearance',null),mask:optional(step,'maskThumb',null)}});}
      var containers=[],raw=optional(record,'historySources',[]);for(var hi=0;hi<raw.length;++hi)containers.push({phase:raw[hi].phase,source:sourceKey(raw[hi].source)});
      history.push({containers:containers,id:record.id,anchor:record.anchor,isColor:record.isColor,originalInput:!!optional(record,'isOriginalInput',false),historyIndex:record.historyIndex,currentPreview:record.currentThumb,statistics:optional(record,'currentStatistics',null),appearance:optional(record,'appearance',null),steps:steps});
   }
   return {format:'AstroProcessAtlasReport',schemaVersion:1,generator:{name:'AstroProcessAtlas',version:ASTROPROCESS_ATLAS_VERSION},createdAt:(new Date()).toISOString(),options:{embeddedPreviews:!!options.embeddedPreviews,reportSize:options.reportSize||'normal'},workspace:{images:images,graph:graph},sources:sources,history:history,project:null};
}

function validateAtlasReportData(model){
   if(!model||model.format!=='AstroProcessAtlasReport')throw Error('This is not an AstroProcessAtlas report data document.');
   if(model.schemaVersion!==1)throw Error('Unsupported AstroProcessAtlas report schema: '+String(model.schemaVersion)+'. Open this report with the version that created it.');
   if(!model.generator||typeof model.generator.version!=='string'||!model.workspace||!Array.isArray(model.workspace.images)||!model.workspace.graph||!Array.isArray(model.workspace.graph.nodes)||!Array.isArray(model.workspace.graph.edges)||!model.sources||typeof model.sources!=='object'||Array.isArray(model.sources)||!Array.isArray(model.history))throw Error('Incomplete AstroProcessAtlas report data.');
   var ids={};for(var i=0;i<model.workspace.images.length;++i){var image=model.workspace.images[i];if(!image||typeof image.id!=='string'||!image.id||Object.prototype.hasOwnProperty.call(ids,'$'+image.id)||!Array.isArray(image.steps))throw Error('Invalid or duplicate image in report data.');ids['$'+image.id]=true;
      for(var j=0;j<image.steps.length;++j){var step=image.steps[j];if(!step||typeof step.title!=='string'||typeof step.tool!=='string'||typeof step.action!=='string'||typeof step.source!=='string'||!Array.isArray(step.inputs))throw Error('Invalid replay step in report data: '+image.id);for(var k=0;k<step.inputs.length;++k)if(typeof step.inputs[k]!=='string')throw Error('Invalid replay input in report data: '+image.id);}
   }
   for(var key in model.sources)if(Object.prototype.hasOwnProperty.call(model.sources,key))resolveAtlasReportSource(model,key);
   for(var h=0;h<model.history.length;++h){var history=model.history[h];if(!history||!Array.isArray(history.steps)||!Array.isArray(history.containers))throw Error('Invalid captured report history.');var entries=history.steps.concat(history.containers);for(var e=0;e<entries.length;++e)if(typeof entries[e].source!=='string'||!Object.prototype.hasOwnProperty.call(model.sources,entries[e].source))throw Error('Missing captured history source.');}
   var nodes={};for(var i=0;i<model.workspace.graph.nodes.length;++i){var node=model.workspace.graph.nodes[i];if(!node||typeof node.id!=='string'||Object.prototype.hasOwnProperty.call(nodes,'$'+node.id))throw Error('Invalid or duplicate graph node.');nodes['$'+node.id]=true;}
   for(var i=0;i<model.workspace.graph.edges.length;++i){var edge=model.workspace.graph.edges[i];if(!edge||typeof edge.from!=='string'||typeof edge.to!=='string'||!nodes['$'+edge.from]||!nodes['$'+edge.to])throw Error('Invalid report graph connection.');}
   return model;
}

function atlasReportDataJSON(model){return workflowStateJSON(model);}

function atlasReportWithProject(model,state){
   validateAtlasReportData(model);
   return {format:model.format,schemaVersion:model.schemaVersion,generator:model.generator,createdAt:model.createdAt,options:model.options,workspace:model.workspace,sources:model.sources,history:model.history,project:state};
}

function atlasReportSavedState(document,model){
   if(model&&'project' in model&&model.project)return model.project;
   var legacy=document.getElementById('apa_workflow_state');return legacy?JSON.parse(legacy.textContent):null;
}

function readAtlasReportDocument(document,legacy){
   var node=document.getElementById('apa_report_data'),model;
   if(node)model=validateAtlasReportData(JSON.parse(node.textContent));
   else{if(!legacy||!Array.isArray(legacy.images)||!legacy.graph)throw Error('AstroProcessAtlas report data is missing.');model=validateAtlasReportData({format:'AstroProcessAtlasReport',schemaVersion:1,generator:{name:'AstroProcessAtlas',version:'legacy'},createdAt:null,options:{},workspace:{images:legacy.images,graph:legacy.graph},sources:{},history:[],project:atlasReportSavedState(document,null)});}
   var assetsNode=document.getElementById('apa_report_assets'),assets=assetsNode?JSON.parse(assetsNode.textContent):legacy&&legacy.assets||{};
   if(!assets||typeof assets!=='object'||Array.isArray(assets))throw Error('Invalid report preview assets.');
   for(var key in assets)if(Object.prototype.hasOwnProperty.call(assets,key)&&(!/^#apa_asset_[0-9]+$/.test(key)||typeof assets[key]!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,/.test(assets[key])))throw Error('Invalid report preview asset: '+key);
   return {model:model,assets:assets};
}

function loadAtlasReportDocument(document,legacy){
   try{return readAtlasReportDocument(document,legacy);}catch(error){var notice=document.createElement('div');notice.setAttribute('role','alert');notice.style.cssText='margin:20px;padding:20px;border:2px solid #f38ba8;color:#f38ba8;background:#181825';notice.textContent='AstroProcessAtlas: '+error.message;document.body.insertBefore(notice,document.body.firstChild);throw error;}
}

function atlasPrintSelection(model,snapshot,scope){
   validateAtlasReportData(model);snapshot=snapshot||{};var data=snapshot.workflow||model.workspace.images,selected=[];
   if(scope==='chain'){
      if(!snapshot.plan||!Array.isArray(snapshot.plan.tasks)||!snapshot.plan.tasks.length)throw Error('Choose a final image in Replay linked dependency chain first.');
      for(var i=0;i<data.length;++i){var indices=[],boundary=false;for(var t=0;t<snapshot.plan.tasks.length;++t){var task=snapshot.plan.tasks[t];if(task.image!==i)continue;boundary=true;if(task.stage>0&&typeof task.stepIndex==='number'&&indices.indexOf(task.stepIndex)<0)indices.push(task.stepIndex);}if(boundary)selected.push({image:data[i],index:i,steps:indices.sort(function(a,b){return a-b;}).map(function(index){return data[i].steps[index];})});}
   }else for(var i=0;i<data.length;++i)selected.push({image:data[i],index:i,steps:data[i].steps.slice()});
   return selected;
}

function collectAtlasPrintDetails(document,step,options){
   var source=document.getElementById(step.anchor);if(!source&&step.memberAnchors)for(var m=0;m<step.memberAnchors.length&&!source;++m)source=document.getElementById(step.memberAnchors[m]);if(!source||!source.cloneNode)return '';
   var clone=source.cloneNode(true),componentTitles=Array.prototype.map.call(clone.querySelectorAll('.step-title'),function(title){return title.textContent;}),remove=clone.querySelectorAll('script,style,button,input,select,textarea,.copy-block,.thumb-box,.comparison,.step-num,.step-title');for(var i=remove.length-1;i>=0;--i)if(remove[i].parentNode)remove[i].parentNode.removeChild(remove[i]);
   var details=clone.querySelectorAll('details');for(var i=details.length-1;i>=0;--i){var summary=details[i].querySelector('summary'),text=summary?summary.textContent:'';if(/Full process code|Full history code|Copy step|PixelMath|Πλήρης κώδικας|Αντιγραφή βήματος/i.test(text)){if(details[i].parentNode)details[i].parentNode.removeChild(details[i]);}else details[i].setAttribute('open','');}
   var all=clone.querySelectorAll('*');for(var i=0;i<all.length;++i){all[i].removeAttribute('hidden');all[i].classList.remove('is-filtered','is-tree-hidden','is-unrelated');var attrs=Array.prototype.slice.call(all[i].attributes||[]);for(var a=0;a<attrs.length;++a)if(/^on/i.test(attrs[a].name))all[i].removeAttribute(attrs[a].name);if(all[i].tagName&&all[i].tagName.toLowerCase()!=='img')all[i].removeAttribute('style');}
   if(!options.previews){var images=clone.querySelectorAll('img');for(var i=images.length-1;i>=0;--i)images[i].parentNode.removeChild(images[i]);}
   if(!options.parameters){var tables=clone.querySelectorAll('table,svg,.parameter-details');for(var i=tables.length-1;i>=0;--i)if(tables[i].parentNode)tables[i].parentNode.removeChild(tables[i]);}
   else if(!options.allRows){var tables=clone.querySelectorAll('table');for(var i=0;i<tables.length;++i){var rows=tables[i].querySelectorAll('tbody tr');if(rows.length>8){for(var r=rows.length-1;r>=8;--r)rows[r].parentNode.removeChild(rows[r]);var caption=document.createElement('caption');caption.textContent=options.language==='el'?'Εμφανίζονται 8 από '+rows.length+' γραμμές. Οι υπόλοιπες υπάρχουν στο HTML.':'8 of '+rows.length+' rows shown. Remaining rows are in the HTML report.';tables[i].appendChild(caption);}var cells=tables[i].querySelectorAll('td');for(var c=0;c<cells.length;++c)if(cells[c].textContent.length>1200)cells[c].textContent=cells[c].textContent.slice(0,1200)+' …';}}
   var printedTables=clone.querySelectorAll('table');for(var ti=0;ti<printedTables.length;++ti)if(printedTables[ti].querySelectorAll('tbody tr').length>12)printedTables[ti].classList.add('apa-long-table');
   var bodies=clone.querySelectorAll('.details-box');if(bodies.length>1){var fragments=[];for(var i=0;i<bodies.length;++i)fragments.push('<section class="print-component"><h4>'+escapeHTML(componentTitles[i]||('Component '+(i+1)))+'</h4>'+bodies[i].innerHTML+'</section>');return fragments.join('');}var body=clone.querySelector('.details-box');return body?body.innerHTML:clone.innerHTML;
}

function buildAtlasPrintDocument(model,snapshot,options,details){
   snapshot=snapshot||{};options=options||{};details=details||{};var scope=options.scope==='chain'?'chain':'all',greek=options.language==='el',selected=atlasPrintSelection(model,snapshot,scope),history={},stepCount=0;
   function tr(en,el){return greek?el:en;}function esc(value){return escapeHTML(value===undefined||value===null?'':String(value));}
   for(var i=0;i<model.history.length;++i)history['$'+model.history[i].id]=model.history[i];
   function preview(src){if(!src)return '';var assets=options.assets||{},value=Object.prototype.hasOwnProperty.call(assets,src)?assets[src]:src;if(/^#apa_asset_/.test(value))return '';if(options.baseURI&&typeof URL==='function')try{value=(new URL(value,options.baseURI)).href;}catch(error){}return value;}
   function picture(src,label){var uri=preview(src);return uri?'<figure><img src="'+esc(uri)+'" alt="'+esc(label)+'"><figcaption>'+esc(label)+'</figcaption></figure>':'';}
   function sourceText(step,captured){if(step.memberAnchors&&step.memberAnchors.length>1){var parts=[];for(var hi=0;hi<model.history.length;++hi)for(var hs=0;hs<model.history[hi].steps.length;++hs)if(step.memberAnchors.indexOf(model.history[hi].steps[hs].anchor)>=0)parts.push(resolveAtlasReportSource(model,model.history[hi].steps[hs].source));if(parts.length)return parts.join('\n\n');}if((step.executionOriginalStep||step).parameterChanges)return (step.executionOriginalStep||step).source;if(captured&&captured.source)return resolveAtlasReportSource(model,captured.source);return step.recordedSource||step.source||'';}
   function row(a,b){return '<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>';}
   var title=scope==='chain'?tr('Linked processing chain','Συνδεδεμένη αλυσίδα επεξεργασίας'):tr('Processing history','Καταγραφή επεξεργασίας');if(scope==='chain')title+=' · '+(snapshot.plan.targetId||'');
   for(var i=0;i<selected.length;++i)stepCount+=selected[i].steps.length;
   var html='<!DOCTYPE html><html lang="'+(greek?'el':'en')+'"><head><meta charset="utf-8"><title>AstroProcessAtlas - '+esc(title)+'</title><style>'+
      '@page{size:A4;margin:16mm 14mm 18mm;@bottom-right{content:"AstroProcessAtlas · " counter(page);font-family:Arial;font-size:8pt;color:#61717a}}*{box-sizing:border-box}body{margin:0;color:#21313a;background:white;font:10pt/1.5 Arial,Helvetica,sans-serif}h1{font-size:26pt;line-height:1.15;margin:8px 0 14px;color:#123e4b}h2{font-size:19pt;color:#123e4b;margin:0 0 12px}h3{font-size:12pt;color:#123e4b;margin:0}h1,h2,h3,summary{break-after:avoid}p{margin:7px 0}.kicker{font-size:9pt;letter-spacing:1px;color:#54747f}.muted,.thumb-note,.meta-line{color:#5d6f78;font-size:8.5pt}.cover{border-top:5px solid #1c7688;padding-top:20px}.stats{display:flex;gap:12px;margin:18px 0}.stat{flex:1;border:1px solid #dce5e8;border-radius:8px;padding:12px;background:#f4f8f9}.stat b{display:block;font-size:22pt;color:#145769}.note{border-left:3px solid #c89942;background:#fff9ed;padding:10px 14px;margin:15px 0;overflow-wrap:anywhere}.toc{columns:2;column-gap:25px;padding-left:18px}.toc li{break-inside:avoid;padding:3px}.image-section{break-before:page;padding-top:5px}.image-intro{padding:14px;background:#f3f7f8;border:1px solid #dce5e8;border-radius:8px;margin-bottom:18px}.step{margin:18px 0 25px;border-top:2px solid #c9dce2;padding-top:10px;break-inside:auto}.step-head{display:flex;align-items:start;gap:10px;break-after:avoid}.step-number{min-width:28px;padding:3px 6px;background:#e8f2f5;color:#145769;border:1px solid #b7d2da;text-align:center;border-radius:4px}.badge{display:inline-block;border:1px solid #bccdd2;border-radius:4px;padding:1px 7px;font-size:8pt;margin:5px 5px 3px 0}.auto{color:#24623d;background:#eff8f1}.adjust,.warning{color:#845619;background:#fff6e5}.skip{color:#626b72;background:#f0f2f3}.previews{display:flex;gap:12px;align-items:start;margin:12px 0;break-inside:avoid}.previews figure{margin:0;flex:1;text-align:center}.previews img{width:100%;max-height:48mm;object-fit:contain;background:#f3f5f6}.previews figcaption{font-size:8pt;color:#5d6f78}table{border-collapse:collapse;width:100%;font-size:8.5pt;margin:10px 0;table-layout:fixed;break-inside:avoid}table.apa-long-table{break-inside:auto}th,td{border:1px solid #dce3e6;padding:6px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}th{background:#edf3f5;font-weight:600}thead{display:table-header-group}tr{break-inside:avoid}caption{text-align:left;font-size:8pt;color:#80601d;padding:5px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:7.5pt/1.45 Consolas,monospace;padding:10px;background:#f5f7f8;border:1px solid #dce3e6}.recorded{margin-top:12px}.recorded img{max-width:42mm;max-height:30mm;object-fit:contain}.recorded svg{max-width:65mm;max-height:65mm;background:white}.recorded .curve-graph{stroke:#226a85}.recorded .curve-graph rect{fill:#f4f8fa;stroke:#a2b9c1}.recorded .curve-graph text{fill:#314f5c}.recorded .curve-graph path{stroke:#26718c}.recorded .table-scroll{overflow:visible}.recorded details{margin:7px 0}.recorded summary{font-weight:600;color:#28566a}.recorded .completeness{font-size:8.5pt}.recorded h3{margin:8px 0}.recorded [hidden]{display:block!important}.footer{margin-top:25px;padding-top:10px;border-top:1px solid #ccd9dd;color:#5d6f78;font-size:8pt}a{color:#185e75;text-decoration:none}.print-tools{position:sticky;top:0;background:#eaf2f5;padding:14px;margin-bottom:15px;display:flex;gap:12px;align-items:center}button{border:0;border-radius:5px;background:#145769;color:white;padding:10px 16px;cursor:pointer}button:disabled{opacity:.5}@media screen{body{max-width:850px;margin:0 auto;padding:25px;box-shadow:0 0 15px #0001}.image-section{margin-top:40px}}@media print{.print-tools{display:none}body{padding:0}a{color:inherit}}'+
      '</style></head><body><nav class="print-tools"><button id="apa_print_start" disabled>'+tr('Loading previews…','Φόρτωση προεπισκοπήσεων…')+'</button><span id="apa_print_status" role="status">'+tr('Choose Save as PDF in the print dialog.','Επίλεξε Αποθήκευση ως PDF στον διάλογο εκτύπωσης.')+'</span></nav><header class="cover"><div class="kicker">ASTROPROCESSATLAS · '+esc(model.generator.version)+'</div><h1>'+esc(title)+'</h1><p>'+tr('Created by YoruHikari · Processing documentation','Δημιουργός YoruHikari · Τεκμηρίωση επεξεργασίας')+'</p><p class="muted">'+tr('Report captured: ','Δημιουργία report: ')+esc(model.createdAt||'—')+'<br>'+tr('Print prepared: ','Προετοιμασία εκτύπωσης: ')+esc(options.printedAt||(new Date()).toISOString())+'</p></header><div class="stats"><div class="stat"><b>'+selected.length+'</b>'+tr('Images','Εικόνες')+'</div><div class="stat"><b>'+stepCount+'</b>'+tr('Workflow steps','Βήματα ροής')+'</div><div class="stat"><b>'+((snapshot.state&&snapshot.state.operations||[]).length)+'</b>'+tr('Workflow edits','Αλλαγές ροής')+'</div></div><p class="note">'+tr('This documents the captured history and current workflow choices, not a successful replay run. Image references do not prove the exact historical source or mask pixels.','Η εκτύπωση τεκμηριώνει το ιστορικό και τις τρέχουσες επιλογές ροής, όχι επιτυχημένη εκτέλεση replay. Οι αναφορές δεν αποδεικνύουν τα ακριβή ιστορικά pixels εισόδων ή μασκών.')+'</p>';
   if(!options.allRows)html+='<p class="muted">'+tr('Long parameter tables are abbreviated. Enable all table rows for a detailed print.','Οι μεγάλοι πίνακες παραμέτρων συνοψίζονται. Ενεργοποίησε όλες τις γραμμές για αναλυτική εκτύπωση.')+'</p>';
   if(scope==='chain'&&snapshot.plan.errors&&snapshot.plan.errors.length)html+='<aside class="note"><b>'+tr('Plan needs attention','Το πλάνο χρειάζεται έλεγχο')+'</b><ul>'+snapshot.plan.errors.map(function(error){return '<li>'+esc(error)+'</li>';}).join('')+'</ul></aside>';
   var annotations=snapshot.state&&snapshot.state.annotations,manual=annotations&&annotations.edges||[],graph=snapshot.graph||model.workspace.graph,nodeById={},included={};for(var ni=0;ni<graph.nodes.length;++ni)nodeById[graph.nodes[ni].id]=graph.nodes[ni];for(var ii=0;ii<selected.length;++ii)included['$'+selected[ii].image.id]=true;function selectedNode(node){if(scope==='all'||node.header)return true;for(var i=0;i<selected.length;++i)for(var j=0;j<selected[i].steps.length;++j){var step=selected[i].steps[j];if(step.anchor===node.id||(step.memberAnchors||[]).indexOf(node.id)>=0)return true;}return false;}var manualRows='';for(var mi=0;mi<manual.length;++mi){var from=nodeById[manual[mi].from],to=nodeById[manual[mi].to];if(from&&to&&included['$'+from.image]&&included['$'+to.image]&&selectedNode(from)&&selectedNode(to))manualRows+='<tr><td>'+esc(from.image+' · '+from.label)+'</td><td>'+esc(to.image+' · '+to.label)+'</td><td>'+esc(manual[mi].detail||tr('User connection','Σύνδεση χρήστη'))+'</td></tr>';}if(manualRows)html+='<h3>'+tr('Manual connections','Χειροκίνητες συνδέσεις')+'</h3><table><thead><tr><th>'+tr('From','Από')+'</th><th>'+tr('To','Προς')+'</th><th>'+tr('Note','Σημείωση')+'</th></tr></thead><tbody>'+manualRows+'</tbody></table>';
   html+='<h3>'+tr('Contents','Περιεχόμενα')+'</h3><ol class="toc">';for(var i=0;i<selected.length;++i)html+='<li><a href="#print_image_'+i+'">'+esc(selected[i].image.id)+' · '+selected[i].steps.length+'</a></li>';html+='</ol>';
   for(var i=0;i<selected.length;++i){var item=selected[i],image=item.image,captured=history['$'+image.id],steps=item.steps.slice(),capturedSteps=captured?captured.steps:[],origins=image.clone||image.stars;
      html+='<section class="image-section" id="print_image_'+i+'"><h2>'+esc(image.id)+'</h2><div class="image-intro">'+tr('Workflow steps: ','Βήματα ροής: ')+steps.length+(captured?' · '+(captured.isColor?tr('Color','Έγχρωμη'):tr('Grayscale','Ασπρόμαυρη')):'')+(origins?'<p>'+esc((image.clone?tr('Clone from ','Κλώνος από '):tr('Stars from ','Stars από '))+origins.source+' · '+origins.stage)+'</p>':'')+'</div>';if(options.previews&&captured&&!captured.steps.length&&captured.currentPreview)html+='<div class="previews">'+picture(captured.currentPreview,tr('Available image · historical pixels may differ','Διαθέσιμη εικόνα · τα ιστορικά pixels μπορεί να διαφέρουν'))+'</div>';
      var slots=chainReferenceSlots(snapshot.workflow||model.workspace.images),connections='';for(var si=0;si<slots.length;++si){var slot=slots[si];if(slot.image!==image.id||!steps.some(function(step){return image.steps[slot.index]===step;}))continue;var binding=(snapshot.bindings||{})[slot.key],value=binding&&binding.source?binding.source+' · '+tr('checkpoint ','στάδιο ')+binding.stage:tr('Not selected','Δεν επιλέχθηκε');connections+=row(image.steps[slot.index].number+' · '+slot.role+' · '+slot.name,value+(binding&&binding.role?' · '+binding.role:''));}if(connections)html+='<h3>'+tr('Inputs and masks','Είσοδοι και μάσκες')+'</h3><table>'+connections+'</table>';
      if(scope==='all'){var initial=[],redo=[];for(var h=0;h<capturedSteps.length;++h)if(capturedSteps[h].redo||('origin' in capturedSteps[h]?capturedSteps[h].origin:h===0&&/^(?:ImageIntegration|FastIntegration)$/.test(capturedSteps[h].tool)&&capturedSteps[h].phase==='initial')){var extra={title:capturedSteps[h].title,tool:capturedSteps[h].tool,number:capturedSteps[h].number,anchor:capturedSteps[h].anchor,printCaptured:capturedSteps[h],printRedo:capturedSteps[h].redo,printOrigin:!capturedSteps[h].redo};if(extra.printRedo)redo.push(extra);else initial.push(extra);}steps=initial.concat(steps,redo);}
      for(var st=0;st<steps.length;++st){var step=steps[st],recorded=step.printCaptured||null;for(var h=0;!recorded&&h<capturedSteps.length;++h)if(capturedSteps[h].anchor===step.anchor||step.memberAnchors&&step.memberAnchors.indexOf(capturedSteps[h].anchor)>=0)recorded=capturedSteps[h];var mode=step.executionMode||'auto',label=step.printRedo?tr('Redo · not applied','Redo · δεν εφαρμόστηκε'):step.printOrigin?tr('Image origin metadata','Στοιχεία προέλευσης εικόνας'):mode==='adjust'?tr('Adjust in PixInsight','Προσαρμογή στο PixInsight'):mode==='skip'?tr('Skip','Παράλειψη'):tr('Auto','Αυτόματο');html+='<article class="step"><header class="step-head"><span class="step-number">'+esc(step.number||st+1)+'</span><div><h3>'+esc(step.title)+'</h3><span class="badge '+esc(step.printRedo?'skip':mode)+'">'+esc(label)+'</span>'+(step.copiedFrom?'<span class="badge">'+esc(tr('Copied from ','Αντιγραφή από ')+step.copiedFrom.image)+'</span>':'')+'</div></header>';
         var changes=(step.executionOriginalStep||step).parameterChanges||[];if(changes.length)html+='<p>'+esc(tr('Modified parameters: ','Τροποποιημένες παράμετροι: ')+changes.map(function(change){return change.name+': '+change.original+' → '+change.value;}).join(', '))+'</p>';
         if(step.reason||step.warning)html+='<p class="note">'+esc(step.reason||step.warning)+'</p>';if(step.mask)html+='<p class="meta-line">'+esc(tr('Mask: ','Μάσκα: ')+step.mask.name+' · '+(typeof step.mask.inverted==='boolean'?(step.mask.inverted?tr('inverted','αντεστραμμένη'):tr('not inverted','χωρίς αντιστροφή')):tr('historical inversion unknown','άγνωστη ιστορική αντιστροφή')))+'</p>';
         var available=recorded&&recorded.preview;if(step.memberAnchors&&step.memberAnchors.length>1){var first=null,last=null;for(var h=0;h<capturedSteps.length;++h)if(step.memberAnchors.indexOf(capturedSteps[h].anchor)>=0){if(!first)first=capturedSteps[h];last=capturedSteps[h];}if(first&&last)available={before:first.preview.before,after:last.preview.after,current:last.preview.current,appearance:last.preview.appearance};}if(options.previews&&available&&!step.copiedFrom)html+='<div class="previews">'+(available.before&&available.after?picture(available.before,tr('Before (recorded)','Πριν (καταγεγραμμένο)'))+picture(available.after,tr('After (recorded)','Μετά (καταγεγραμμένο)')):picture(available.current,tr('Available preview','Διαθέσιμη προεπισκόπηση')))+'</div>';
         if(options.previews&&available&&available.appearance&&available.appearance.auto)html+='<p class="meta-line">'+tr('Auto-stretched preview only; image data are unchanged.','Προεπισκόπηση με προσωρινό auto stretch· τα δεδομένα της εικόνας παραμένουν ίδια.')+'</p>';
         var fragment=details[step.anchor];if(fragment)html+='<div class="recorded">'+fragment+'</div>';else if(options.parameters){var text=sourceText(step,recorded);if(text)html+='<p class="muted">'+tr('Serialized recorded parameters','Καταγεγραμμένες σειριοποιημένες παράμετροι')+'</p><pre>'+esc(text)+'</pre>';}
         if(options.code&&fragment)html+='<h3>'+tr('Recorded process code','Καταγεγραμμένος κώδικας')+'</h3><pre>'+esc(sourceText(step,recorded))+'</pre>';
         html+='</article>';
      }
      if(options.code&&scope==='all'&&captured)for(var ci=0;ci<captured.containers.length;++ci)html+='<h3>'+esc(tr('Full recorded history · ','Πλήρες καταγεγραμμένο ιστορικό · ')+captured.containers[ci].phase)+'</h3><pre>'+esc(resolveAtlasReportSource(model,captured.containers[ci].source))+'</pre>';
      html+='</section>';
   }
   var audit=snapshot.state&&snapshot.state.audit||[];if(audit.length){html+='<section class="image-section"><h2>'+tr('Workflow change history','Ιστορικό αλλαγών ροής')+'</h2><table><thead><tr><th>'+tr('Time','Χρόνος')+'</th><th>'+tr('Change','Αλλαγή')+'</th></tr></thead><tbody>';for(var a=0;a<audit.length;++a)html+='<tr><td>'+esc(audit[a].time)+'</td><td>'+esc(audit[a].title)+'</td></tr>';html+='</tbody></table></section>';}
   return html+'<footer class="footer">© 2026 YoruHikari Astrophotography · www.yoruhikari.gr · AstroProcessAtlas '+esc(model.generator.version)+'</footer></body></html>';
}

function installAtlasPrinting(){
   if(typeof atlasReportData==='undefined')return;
   window.printAtlasReport=function(scope,options){var popup=null;try{options=options||{};options.scope=scope;options.language=document.documentElement.lang;options.assets=typeof reportEmbeddedAssets!=='undefined'?reportEmbeddedAssets:{};options.baseURI=document.baseURI;var snapshot=typeof window.atlasPrintSnapshot==='function'?window.atlasPrintSnapshot():{},selection=atlasPrintSelection(atlasReportData,snapshot,scope),details={};
      popup=window.open('','_blank');if(!popup)throw Error(options.language==='el'?'Επίτρεψε το νέο παράθυρο για την προεπισκόπηση εκτύπωσης.':'Allow a new window for the print preview.');for(var i=0;i<selection.length;++i)for(var j=0;j<selection[i].steps.length;++j){var step=selection[i].steps[j];details[step.anchor]=collectAtlasPrintDetails(document,step,options);}if(scope!=='chain')for(var i=0;i<atlasReportData.history.length;++i)for(var j=0;j<atlasReportData.history[i].steps.length;++j){var captured=atlasReportData.history[i].steps[j];if(!details[captured.anchor])details[captured.anchor]=collectAtlasPrintDetails(document,captured,options);}
      popup.document.open();popup.document.write(buildAtlasPrintDocument(atlasReportData,snapshot,options,details));popup.document.close();var button=popup.document.getElementById('apa_print_start'),images=Array.prototype.slice.call(popup.document.images),remaining=images.length,finished=false;
      var ready=function(){if(finished)return;finished=true;var missing=images.filter(function(image){return !image.complete||image.naturalWidth===0;}).length;if(missing)popup.document.getElementById('apa_print_status').textContent=(options.language==='el'?'Μη διαθέσιμες προεπισκοπήσεις: ':'Unavailable previews: ')+missing;button.disabled=false;button.textContent=options.language==='el'?'Εκτύπωση / Αποθήκευση PDF':'Print / Save PDF';button.onclick=function(){popup.focus();popup.print();};};
      if(!remaining)ready();else{for(var i=0;i<images.length;++i){if(images[i].complete){--remaining;continue;}images[i].onload=images[i].onerror=function(){if(--remaining===0)ready();};}if(!remaining)ready();setTimeout(ready,15000);}
   }catch(error){if(popup)popup.close();window.alert(error.message);}};
   window.openAtlasPrintOptions=function(scope){var greek=document.documentElement.lang==='el',old=document.getElementById('apa_print_options');if(old)old.parentNode.removeChild(old);var dialog=document.createElement('dialog');dialog.id='apa_print_options';dialog.className='delete-step-dialog execution-mode-dialog';var title=document.createElement('h2');title.id='apa_print_title';title.textContent=greek?'Εκτύπωση / Αποθήκευση PDF':'Print / Save PDF';dialog.setAttribute('aria-labelledby',title.id);dialog.appendChild(title);var hint=document.createElement('p');hint.textContent=scope==='chain'?(greek?'Εκτύπωση της αλυσίδας του επιλεγμένου στόχου, με τα απαιτούμενα κανάλια και τις μάσκες.':'Print the selected target chain, including required channels and masks.'):(greek?'Εκτύπωση όλης της καταγραφής, ανεξάρτητα από τα φίλτρα προβολής.':'Print the complete recording, regardless of display filters.');dialog.appendChild(hint);var boxes={};function check(id,en,el,value){var label=document.createElement('label');label.style.cssText='display:block;margin:12px 0';var input=document.createElement('input');input.type='checkbox';input.checked=value;label.appendChild(input);label.appendChild(document.createTextNode(' '+(greek?el:en)));dialog.appendChild(label);boxes[id]=input;}
      check('previews','Include previews','Με προεπισκοπήσεις',true);check('parameters','Include readable parameters','Με αναγνώσιμες παραμέτρους',true);check('allRows','Include every table row (may create many pages)','Όλες οι γραμμές πινάκων (μπορεί να δημιουργήσει πολλές σελίδες)',false);check('code','Include recorded process code','Με τον καταγεγραμμένο κώδικα',false);var buttons=document.createElement('div');buttons.className='delete-step-actions';var cancel=document.createElement('button');cancel.textContent=greek?'Ακύρωση':'Cancel';cancel.onclick=function(){dialog.close();};var create=document.createElement('button');create.textContent=greek?'Προεπισκόπηση εκτύπωσης':'Open print preview';create.onclick=function(){var options={};for(var key in boxes)options[key]=boxes[key].checked;dialog.close();window.printAtlasReport(scope,options);};buttons.appendChild(cancel);buttons.appendChild(create);dialog.appendChild(buttons);document.body.appendChild(dialog);dialog.showModal();};
}

function atlasHistogramLearning() {
   var metrics=['mean','median','p01','p10','p90','p99','mad','blackFraction','whiteFraction'];
   function clone(value){return JSON.parse(JSON.stringify(value));}
   function hash(value){var text=JSON.stringify(value),h=2166136261;for(var i=0;i<text.length;++i){h^=text.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return (h>>>0).toString(16);}
   function matrix(H){if(!Array.isArray(H)||H.length!==5)throw Error('Histogram needs five channel rows.');for(var r=0;r<5;++r){if(!Array.isArray(H[r])||H[r].length!==5)throw Error('Invalid histogram row.');for(var c=0;c<5;++c)if(typeof H[r][c]!=='number'||!isFinite(H[r][c])||(c<3&&(H[r][c]<0||H[r][c]>1)))throw Error('Invalid histogram value.');if(H[r][0]>=H[r][2]||H[r][3]>=H[r][4])throw Error('Invalid histogram ordering.');}return clone(H);}
   function stats(value){if(!value||value.available!==true||value.rawPixels!==true||!Array.isArray(value.channels)||(value.channels.length!==1&&value.channels.length!==3)||typeof value.isColor!=='boolean'||value.channels.length!==(value.isColor?3:1)||!NumberSafe(value.width)||!NumberSafe(value.height))throw Error('Usable raw image statistics are required.');var result={version:1,available:true,rawPixels:true,isColor:value.isColor,width:value.width,height:value.height,channels:[]};
      for(var c=0;c<value.channels.length;++c){var input=value.channels[c],row={channel:value.isColor?['R','G','B'][c]:'K',samples:input.samples};if(input.channel!==row.channel||!NumberSafe(input.samples)||('invalidSamples' in input&&input.invalidSamples!==0))throw Error('Invalid statistics channel.');for(var m=0;m<metrics.length;++m){var key=metrics[m],n=input[key];if(typeof n!=='number'||!isFinite(n))throw Error('Invalid statistics: '+key);row[key]=n;}if(row.mad<0||row.blackFraction<0||row.blackFraction>1||row.whiteFraction<0||row.whiteFraction>1||row.p01>row.p10||row.p10>row.median||row.median>row.p90||row.p90>row.p99)throw Error('Invalid distribution.');result.channels.push(row);}return result;
   }
   function NumberSafe(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n&&n>0&&n<=2147483647;}
   function features(value){var s=stats(value),x=[];for(var c=0;c<s.channels.length;++c){var row=s.channels[c];x.push(Math.log(Math.max(0.000001,row.median))/Math.LN10);for(var m=0;m<metrics.length;++m)x.push(row[metrics[m]]);}return x;}
   function empty(){return {format:'AstroProcessAtlasHistogramLibrary',version:1,examples:[],evaluations:[]};}
   function example(value){if(!value||['history','preference'].indexOf(value.origin)<0)throw Error('Invalid training example.');var before=stats(value.before),after=stats(value.after);if(before.isColor!==after.isColor||before.width!==after.width||before.height!==after.height)throw Error('Histogram training requires matching geometry.');var H=matrix(value.H),id=String(value.id||hash([before,H,after])).slice(0,160);return {id:id,origin:value.origin,before:before,after:after,H:H,weight:value.origin==='preference'?(typeof value.weight==='number'&&value.weight>=5/3&&value.weight<=5?value.weight:5):0.25};}
   function validate(library){if(!library||library.format!=='AstroProcessAtlasHistogramLibrary'||library.version!==1||!Array.isArray(library.examples)||library.examples.length>2000||!Array.isArray(library.evaluations)||library.evaluations.length>500)throw Error('Unsupported or oversized histogram library.');var clean=empty(),ids={};for(var i=0;i<library.examples.length;++i){var item=example(library.examples[i]);if(ids['$'+item.id]&&ids['$'+item.id]!==JSON.stringify(item))throw Error('Conflicting training example ID.');if(!ids['$'+item.id]){ids['$'+item.id]=JSON.stringify(item);clean.examples.push(item);}}for(var i=0;i<library.evaluations.length;++i){var review=feedback(library.evaluations[i]);clean.evaluations.push(review);}return clean;}
   function feedback(value){if(!value||value.format!=='AstroProcessAtlasHistogramFeedback'||value.version!==1||typeof value.id!=='string'||!value.id.length||value.id.length>160||!Array.isArray(value.accepted)||value.accepted.length>3||!Array.isArray(value.candidates)||value.candidates.length!==3)throw Error('Invalid histogram evaluation.');var before=stats(value.before),names=['recorded','suggested','user'],candidates=[];
      for(var i=0;i<3;++i){var candidate=value.candidates[i];if(!candidate||candidate.name!==names[i])throw Error('Invalid candidate order.');var after=stats(candidate.after);if(after.width!==before.width||after.height!==before.height||after.isColor!==before.isColor)throw Error('Candidate geometry changed.');candidates.push({name:names[i],H:matrix(candidate.H),after:after});}
      var proposal=null;if(value.proposal){if(typeof value.proposal.learned!=='boolean'||!Array.isArray(value.proposal.neighbours)||value.proposal.neighbours.length>4)throw Error('Invalid proposal provenance.');proposal={learned:value.proposal.learned,reason:String(value.proposal.reason||'').slice(0,512),neighbours:[]};for(var n=0;n<value.proposal.neighbours.length;++n){var neighbour=value.proposal.neighbours[n];if(typeof neighbour.id!=='string'||typeof neighbour.distance!=='number'||!isFinite(neighbour.distance)||neighbour.distance<0)throw Error('Invalid proposal neighbour.');proposal.neighbours.push({id:neighbour.id.slice(0,160),distance:neighbour.distance});}}var seen={};for(var i=0;i<value.accepted.length;++i){var name=value.accepted[i];if(names.indexOf(name)<0||seen['$'+name])throw Error('Invalid preference.');seen['$'+name]=true;}return {format:value.format,version:1,id:value.id,before:before,input:String(value.input||'').slice(0,256),proposal:proposal,accepted:value.accepted.slice(),context:value.context&&typeof value.context.image==='string'&&typeof value.context.anchor==='string'?{image:value.context.image.slice(0,256),anchor:value.context.anchor.slice(0,256),sourceHash:String(value.context.sourceHash||'').slice(0,160)}:null,modelId:String(value.modelId||'').slice(0,160),reason:String(value.reason||'').slice(0,1000),candidates:candidates};
   }
   function merge(library,items,reviews){var clean=validate(library),ids={},reviewIds={};for(var i=0;i<clean.examples.length;++i)ids['$'+clean.examples[i].id]=JSON.stringify(clean.examples[i]);for(var i=0;i<clean.evaluations.length;++i)reviewIds['$'+clean.evaluations[i].id]=JSON.stringify(clean.evaluations[i]);
      for(var i=0;i<(items||[]).length;++i){var item=example(items[i]);if(ids['$'+item.id]&&ids['$'+item.id]!==JSON.stringify(item))throw Error('Conflicting training example ID.');if(!ids['$'+item.id]){if(clean.examples.length>=2000)throw Error('Training library limit: 2000 examples.');ids['$'+item.id]=JSON.stringify(item);clean.examples.push(item);}}
      for(var i=0;i<(reviews||[]).length;++i){var review=feedback(reviews[i]);if(reviewIds['$'+review.id]){if(reviewIds['$'+review.id]!==JSON.stringify(review))throw Error('Conflicting evaluation ID. Run a new trial for a new decision.');continue;}if(clean.evaluations.length>=500)throw Error('Evaluation library limit: 500 trials.');reviewIds['$'+review.id]=JSON.stringify(review);clean.evaluations.push(review);for(var c=0;c<review.candidates.length;++c)if(review.accepted.indexOf(review.candidates[c].name)>=0){var candidate=review.candidates[c],learned=example({id:review.id+':'+candidate.name,origin:'preference',before:review.before,after:candidate.after,H:candidate.H});if(!ids['$'+learned.id]){if(clean.examples.length>=2000)throw Error('Training library limit reached.');learned.weight=5/review.accepted.length;ids['$'+learned.id]=JSON.stringify(learned);clean.examples.push(learned);}}}
      return clean;
   }
   function train(library){var clean=validate(library),model={format:'AstroProcessAtlasHistogramModel',version:1,algorithm:'weighted-nearest-neighbours',examples:[],groups:{},evaluations:clean.evaluations.length};
      for(var i=0;i<clean.examples.length;++i){var e=clean.examples[i];model.examples.push({id:e.id,color:e.before.isColor,x:features(e.before),H:e.H,weight:e.weight});}
      for(var g=0;g<2;++g){var rows=model.examples.filter(function(e){return e.color===!!g;});if(!rows.length)continue;var means=[],scales=[];for(var d=0;d<rows[0].x.length;++d){var mean=0;for(var r=0;r<rows.length;++r)mean+=rows[r].x[d]/rows.length;var variance=0;for(var r=0;r<rows.length;++r)variance+=(rows[r].x[d]-mean)*(rows[r].x[d]-mean)/rows.length;means.push(mean);scales.push(Math.max(0.02,Math.sqrt(variance)));}model.groups[g?'rgb':'gray']={mean:means,scale:scales};}
      return model;
   }
   function predict(model,before,fallback){var H=matrix(fallback),s=stats(before),x=features(s),key=s.isColor?'rgb':'gray';if(!model||model.format!=='AstroProcessAtlasHistogramModel'||model.version!==1||!model.groups||!Object.prototype.hasOwnProperty.call(model.groups,key))return {H:H,learned:false,reason:'No matching training examples; suggestion equals recorded values.',neighbours:[]};var group=model.groups[key],ranked=[];
      for(var i=0;i<model.examples.length;++i){var e=model.examples[i];if(e.color!==s.isColor)continue;var distance=0;for(var d=0;d<x.length;++d)distance+=Math.pow((x[d]-e.x[d])/group.scale[d],2)/x.length;ranked.push({distance:Math.sqrt(distance),example:e});}ranked.sort(function(a,b){return a.distance-b.distance||b.example.weight-a.example.weight;});if(!ranked.length||ranked[0].distance>4)return {H:H,learned:false,reason:'Input is outside the learned distribution; suggestion equals recorded values.',neighbours:[]};
      var neighbours=ranked.slice(0,Math.min(4,ranked.length)),total=0,result=[];for(var r=0;r<5;++r)result.push([0,0,0,0,0]);for(var i=0;i<neighbours.length;++i){var weight=neighbours[i].example.weight/(0.05+neighbours[i].distance*neighbours[i].distance);total+=weight;for(var r=0;r<4;++r)for(var c=0;c<5;++c)result[r][c]+=weight*neighbours[i].example.H[r][c];}for(var r=0;r<4;++r)for(var c=0;c<5;++c)result[r][c]/=total;result[4]=H[4].slice();matrix(result);
      return {H:result,learned:true,reason:'Local learned proposal from '+neighbours.length+' similar examples. No quality guarantee.',neighbours:neighbours.map(function(n){return {id:n.example.id,distance:n.distance};})};
   }
   function history(model,resolve){if(!model||model.format!=='AstroProcessAtlasReport'||model.schemaVersion!==1||!Array.isArray(model.history))throw Error('A schema-1 report with recorded statistics is required.');var examples=[],skipped=0;
      for(var r=0;r<model.history.length;++r)for(var i=0;i<model.history[r].steps.length;++i){var step=model.history[r].steps[i];if(step.tool!=='HistogramTransformation')continue;try{if(!step.mask||step.mask.status!=='unrecorded'||step.redo||!step.statistics)throw Error('Masked, unknown or missing state.');var text=resolve(model,step.source),match=/\b[A-Za-z_][A-Za-z0-9_]*\.H\s*=\s*(\[[\s\S]*?\])\s*;/.exec(text);if(!match)throw Error('Missing H matrix.');var H=matrix(JSON.parse(match[1].replace(new RegExp('\\x2f\\x2a[\\s\\S]*?\\x2a\\x2f','g'),'').replace(new RegExp('\\x2f\\x2f[^\\r\\n]*','g'),'')));var e=example({origin:'history',before:step.statistics.before,after:step.statistics.after,H:H});e.id='history:'+hash([e.before,e.H,e.after]);examples.push(e);}catch(error){skipped++;}}
      return {examples:examples,skipped:skipped};
   }
   function readMatrix(source){var matches=String(source).match(/\b[A-Za-z_][A-Za-z0-9_]*\.H\s*=\s*\[[\s\S]*?\]\s*;/g);if(!matches||matches.length!==1)throw Error('Exactly one recorded Histogram matrix is required.');var text=matches[0].slice(matches[0].indexOf('['),matches[0].lastIndexOf(']')+1);return matrix(JSON.parse(text.replace(new RegExp('\\x2f\\x2a[\\s\\S]*?\\x2a\\x2f','g'),'').replace(new RegExp('\\x2f\\x2f[^\\r\\n]*','g'),'')));}
   return {readMatrix:readMatrix,empty:empty,validate:validate,stats:stats,matrix:matrix,features:features,feedback:feedback,merge:merge,train:train,predict:predict,history:history,hash:hash};
}

function runAtlasHistogramExperiment(config) {
   var learning=atlasHistogramLearning(),key='AstroProcessAtlas/histogram-trial/'+config.id,owner='AstroProcessAtlas:HistogramTrial',created=[];
   function encode(value){var text=JSON.stringify(value),out='APA-HIST-HEX1:';for(var i=0;i<text.length;++i)out+=('0000'+text.charCodeAt(i).toString(16)).slice(-4);return out;}
   function decode(text){text=String(text);if(text.indexOf('APA-HIST-HEX1:')!==0||!/^([0-9a-f]{4})*$/.test(text.slice(14)))throw Error('Invalid histogram trial state.');var raw='';for(var i=14;i<text.length;i+=4)raw+=String.fromCharCode(parseInt(text.substr(i,4),16));return JSON.parse(raw);}
   function notify(text){new MessageBox(text,'AstroProcessAtlas - Local Histogram advisor',StdIcon_Information,StdButton_Ok).execute();}
   function neutral(window){window.mainView.stf=[[0.5,0,1,0,1],[0.5,0,1,0,1],[0.5,0,1,0,1],[0.5,0,1,0,1]];}
   var legacyRecovery=[];
   function tag(view){if(typeof view.setPropertyValue!=='function'||typeof view.propertyValue!=='function')throw Error('Trial ownership metadata API is unavailable.');view.setPropertyValue(owner,config.id,PropertyType_IsoString,PropertyAttribute_Permanent|PropertyAttribute_Storable);if(String(view.propertyValue(owner))!==config.id)throw Error('Unable to retain trial ownership metadata.');}
   function owned(id){var view=View.viewById(id);if(view.isNull)throw Error('Trial image is not open: '+id);if(typeof view.propertyValue!=='function')throw Error('Trial ownership metadata API is unavailable: '+id);var marker=null;if(typeof view.hasProperty!=='function'||view.hasProperty(owner))marker=view.propertyValue(owner);if(marker!==null&&marker!==undefined&&String(marker)===config.id)return view.window;if(marker!==null&&marker!==undefined)throw Error('Trial image belongs to a different trial or was replaced: '+id);if(!('ownershipVersion' in pending)){legacyRecovery.push(view);return view.window;}throw Error('Trial ownership marker is missing: '+id);}

   function make(input,label){var id='APA_HT_'+label+'_'+config.id.replace(/[^A-Za-z0-9_]/g,'_'),suffix=1,base=id;while(!View.viewById(id).isNull)id=base+'_'+suffix++;var image=input.mainView.image,window=new ImageWindow(image.width,image.height,image.numberOfChannels,image.bitsPerSample,image.isReal,image.isColor,id);created.push(window);window.mainView.beginProcess(UndoFlag_NoSwapFile);try{window.mainView.image.assign(image);}finally{window.mainView.endProcess();}copyReplayMetadata(input,window);window.rgbWorkingSpace=input.rgbWorkingSpace;window.removeMask();tag(window.mainView);neutral(window);return window;}
   function apply(window,H){var process=new HistogramTransformation;process.H=learning.matrix(H);if(!process.executeOn(window.mainView))throw Error('HistogramTransformation failed.');tag(window.mainView);neutral(window);}
   function signature(window){var source=[],view=window.mainView;for(var i=0;i<view.historyIndex;++i)source.push(view.processing.at(i).toSource());return learning.hash(source);}
   function userMatrix(window,baseIndex){var view=window.mainView,count=view.historyIndex-baseIndex;if(count===0)return [[0,0.5,1,0,1],[0,0.5,1,0,1],[0,0.5,1,0,1],[0,0.5,1,0,1],[0,0.5,1,0,1]];if(count!==1)throw Error('The User image must have one HistogramTransformation only. Undo extra applied processes, then run this script again.');var masks=readHistoryMasks(view.processing,view.historyIndex);if(!masks.steps[baseIndex]||masks.steps[baseIndex].status!=='unrecorded')throw Error('The User Histogram must have known unmasked history.');var text=view.processing.at(baseIndex).toSource();if(!/\bnew\s+HistogramTransformation\b/.test(text))throw Error('Only HistogramTransformation can be learned in this trial.');return learning.readMatrix(text);}
   var stored=Settings.read(key,DataType_String);
   if(!stored){
      var windows=ImageWindow.windows.filter(function(window){return !window.isNull;});if(!windows.length)throw Error('Open an image BEFORE the selected HistogramTransformation.');
      var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Histogram trial input';dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=10;var note=new Label(dialog);note.text='Choose the NEW image before this HistogramTransformation. Three private copies will be created: Recorded, Suggested and User. No external service is used. The script will finish so you can adjust the User copy normally.';note.wordWrapping=true;note.setMinWidth(550);dialog.sizer.add(note);var combo=new ComboBox(dialog);for(var i=0;i<windows.length;++i)combo.addItem(windows[i].mainView.id);combo.currentItem=-1;for(var i=0;i<windows.length;++i)if(windows[i].mainView.id===config.image)combo.currentItem=i;dialog.sizer.add(combo);
      var confirm=new CheckBox(dialog);confirm.text='The selected pixels are BEFORE this step.';dialog.sizer.add(confirm);var run=new PushButton(dialog);run.text='Create three versions';run.onClick=function(){dialog.ok();};var cancel=new PushButton(dialog);cancel.text='Cancel';cancel.onClick=function(){dialog.cancel();};var buttons=new HorizontalSizer;buttons.add(run);buttons.add(cancel);dialog.sizer.add(buttons);dialog.adjustToContents();if(!dialog.execute())return;if(!confirm.checked||combo.currentItem<0)throw Error('Select and confirm an input before the step.');
      var input=windows[combo.currentItem];if(!!input.mainView.image.isColor!==config.isColor)throw Error('Use the same grayscale/RGB type as the recorded step.');var before=learning.stats(captureAtlasImageStatistics(input.mainView.image)),proposal=learning.predict(config.model,before,config.recordedH),pending=null;
      try{var recorded=make(input,'Recorded'),suggested=make(input,'Suggested'),user=make(input,'User');apply(recorded,config.recordedH);apply(suggested,proposal.H);
         pending={version:1,ownershipVersion:2,id:config.id,trialId:config.id+'_run_'+(new Date()).getTime()+'_'+Math.floor(Math.random()*1000000000),context:config.context,before:before,input:input.mainView.id,ids:[recorded.mainView.id,suggested.mainView.id,user.mainView.id],baseUserIndex:user.mainView.historyIndex,signatures:[signature(recorded),signature(suggested)],recordedH:learning.matrix(config.recordedH),suggestedH:proposal.H,proposal:proposal,modelId:config.modelId};
         var process=new HistogramTransformation;process.H=learning.matrix(config.userH);user.show();if(process.launch()===false)throw Error('Unable to open HistogramTransformation.');var encoded=encode(pending);Settings.write(key,DataType_String,encoded);if(Settings.read(key,DataType_String)!==encoded)throw Error('Unable to save complete trial state.');recorded.show();suggested.show();user.show();
      }catch(error){try{Settings.remove(key);}catch(ignored){}for(var i=0;i<created.length;++i)if(!created[i].isNull)created[i].forceClose();throw error;}
      notify(proposal.reason+'\n\nAdjust and APPLY HistogramTransformation once on '+pending.ids[2]+'. The Recorded and Suggested images are ready. This script now ends; run the SAME file again to compare and save your preference. Zero User applications means an unchanged image. Do not close or rename the three copies.');return;
   }
   var pending=decode(stored);if(pending.version!==1||pending.id!==config.id||!Array.isArray(pending.ids)||pending.ids.length!==3)throw Error('Invalid saved histogram trial.');var images=pending.ids.map(owned);
   for(var i=0;i<3;++i){var image=images[i].mainView.image;if(image.width!==pending.before.width||image.height!==pending.before.height||!!image.isColor!==pending.before.isColor)throw Error('Trial geometry changed.');var activeMask=images[i].mask;if(activeMask&&!activeMask.isNull&&images[i].maskEnabled)throw Error('Remove active masks from all trial images.');neutral(images[i]);}
   for(var i=0;i<2;++i)if(signature(images[i])!==pending.signatures[i])throw Error('Recorded or Suggested pixels were edited. Keep those versions unchanged.');
   var H=userMatrix(images[2],pending.baseUserIndex),candidates=[],names=['recorded','suggested','user'];for(var i=0;i<3;++i)candidates.push({name:names[i],H:i===0?pending.recordedH:i===1?pending.suggestedH:H,after:learning.stats(captureAtlasImageStatistics(images[i].mainView.image))});
   if(legacyRecovery.length){for(var i=0;i<legacyRecovery.length;++i)tag(legacyRecovery[i]);pending.ownershipVersion=2;var repaired=encode(pending);Settings.write(key,DataType_String,repaired);if(Settings.read(key,DataType_String)!==repaired)throw Error('Unable to preserve repaired trial state.');Console.writeln('Recovered legacy Histogram trial ownership after verifying saved IDs, geometry, recorded/suggested history and the User Histogram.');}
   var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Compare three Histogram versions';dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=10;var note=new Label(dialog);note.text='Compare Recorded / Suggested / User. All previews use raw pixels without STF. Select your preference, a tie or reject all. No candidate wins automatically. Full-resolution copies remain open.';note.wordWrapping=true;note.setMinWidth(860);dialog.sizer.add(note);var panels=new HorizontalSizer;panels.spacing=12;var bitmaps=[];
   for(var i=0;i<3;++i)(function(index){var column=new VerticalSizer,label=new Label(dialog);label.text=['Recorded','Suggested','User'][index];column.add(label);if(typeof Control!=='undefined'&&typeof Graphics!=='undefined'){var control=new Control(dialog),bitmap=comparisonPreviewBitmap(images[index].mainView.image,{auto:false},1);bitmaps.push(bitmap);control.setFixedSize(280,180);control.onPaint=function(){var g=new Graphics(this);g.fillRect(0,0,this.width,this.height,new Brush(0xff11111b));g.drawBitmap(Math.floor((280-bitmap.width)/2),Math.floor((180-bitmap.height)/2),bitmap);g.end();};column.add(control);}var summary=new Label(dialog);summary.text=candidates[index].after.channels.map(function(channel){return channel.channel+' median: '+channel.median.toPrecision(5);}).join('\n');column.add(summary);panels.add(column);})(i);dialog.sizer.add(panels);
   var choice=new ComboBox(dialog),options=[[],['recorded'],['suggested'],['user'],['recorded','suggested'],['recorded','user'],['suggested','user'],['recorded','suggested','user'],[]];['Choose preference...','Recorded','Suggested','User','Tie: Recorded + Suggested','Tie: Recorded + User','Tie: Suggested + User','All equal','Reject all'].forEach(function(label){choice.addItem(label);});choice.currentItem=0;dialog.sizer.add(choice);var reason=new Edit(dialog);reason.toolTip='Optional: why is this version preferable?';dialog.sizer.add(reason);var save=new PushButton(dialog);save.text='Save evaluation JSON...';save.enabled=false;choice.onItemSelected=function(index){save.enabled=index>0;};save.onClick=function(){if(choice.currentItem<1)throw Error('Choose a preference first.');dialog.ok();};var cancel=new PushButton(dialog);cancel.text='Decide later';cancel.onClick=function(){dialog.cancel();};var buttons=new HorizontalSizer;var discard=new PushButton(dialog);discard.text='Discard trial session';discard.onClick=function(){Settings.remove(key);dialog.cancel();};buttons.add(save);buttons.add(cancel);buttons.add(discard);dialog.sizer.add(buttons);dialog.adjustToContents();if(!dialog.execute())return;if(choice.currentItem<1)throw Error('Choose a preference first.');
   var review=learning.feedback({format:'AstroProcessAtlasHistogramFeedback',version:1,id:pending.trialId,context:pending.context,modelId:pending.modelId,input:pending.input,proposal:pending.proposal,before:pending.before,candidates:candidates,accepted:options[choice.currentItem],reason:reason.text});var picker=new SaveFileDialog;picker.caption='Save local Histogram evaluation';picker.filters=[['JSON files','*.json']];picker.initialPath='AstroProcessAtlas_histogram_evaluation_'+pending.trialId+'.json';if(!picker.execute())return;var file=new File;try{file.createForWriting(picker.fileName);file.write(ByteArray.stringToUTF8(JSON.stringify(review,null,2)));}finally{file.close();}Settings.remove(key);notify('Evaluation saved. Import this JSON in the report Local Histogram advisor, then save the edited HTML to retain the learned examples. Trial images remain open.');
}
function buildAtlasHistogramExperiment(config){
   var comment=String.fromCharCode(47,47)+' ',code=[comment+'AstroProcessAtlas local Histogram comparison and learning',comment+'Copyright (c) 2026 YoruHikari Astrophotography',comment+'SPDX-License-Identifier: MIT','#include <pjsr/Sizer.jsh>','#include <pjsr/UndoFlag.jsh>','#include <pjsr/StdIcon.jsh>','#include <pjsr/StdButton.jsh>','#include <pjsr/DataType.jsh>','#include <pjsr/PropertyType.jsh>','#include <pjsr/PropertyAttribute.jsh>',atlasHistogramLearning.toString(),captureAtlasImageStatistics.toString(),readHistoryMasks.toString(),copyReplayMetadata.toString(),comparisonPreviewBitmap.toString(),runAtlasHistogramExperiment.toString()];
   code.push('var atlasHistogramConfig='+JSON.stringify(config).split(String.fromCharCode(47)).join('\\u002f')+';');code.push('try{runAtlasHistogramExperiment(atlasHistogramConfig);}catch(error){new MessageBox(error.message,"AstroProcessAtlas - Local Histogram advisor",StdIcon_Error,StdButton_Ok).execute();}');return code.join('\n');
}

function workflowFingerprint(data){var text=JSON.stringify(data),hash=2166136261;for(var i=0;i<text.length;++i){hash^=text.charCodeAt(i);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}return (hash>>>0).toString(16);}
function updateAtlasParameterColumns(card,changes,document){
   var old=card.querySelectorAll('[data-replay-parameter]');for(var i=0;i<old.length;++i)old[i].parentNode.removeChild(old[i]);
   var added=card.querySelectorAll('[data-replay-added-row]');for(var i=0;i<added.length;++i)added[i].parentNode.removeChild(added[i]);
   var matrices=card.querySelectorAll('[data-matrix-parameter]');for(var m=0;m<matrices.length;++m){var key=matrices[m].getAttribute('data-matrix-parameter'),change=null;for(var c=0;c<changes.length;++c)if(changes[c].name===key)change=changes[c];if(!change)continue;var tables=matrices[m].querySelectorAll('table'),offset=0;for(var t=0;t<tables.length;++t){var header=tables[t].querySelector('thead > tr'),body=tables[t].querySelector('tbody');if(!header||!body)continue;var rows=Array.prototype.slice.call(body.children),column=document.createElement('th');column.textContent='Replay changes';column.setAttribute('data-replay-parameter','');column.setAttribute('data-no-i18n','');header.appendChild(column);for(var r=0;r<rows.length;++r){var cell=document.createElement('td'),index=offset++;cell.setAttribute('data-replay-parameter','');cell.setAttribute('data-no-i18n','');cell.style.color='#fab387';cell.textContent=JSON.stringify(change.original[index])===JSON.stringify(change.value[index])?'':index<change.value.length?JSON.stringify(change.value[index]):'Removed';rows[r].appendChild(cell);}if(t===tables.length-1)for(var r=offset;r<change.value.length;++r){var row=document.createElement('tr');row.setAttribute('data-replay-added-row','');for(var col=0;col<header.children.length;++col){var cell=document.createElement('td');cell.textContent=col===header.children.length-1?JSON.stringify(change.value[r]):'—';cell.setAttribute('data-no-i18n','');row.appendChild(cell);}body.appendChild(row);}}}
   var methods=changes.filter(function(change){return /^[RGBAKLabcHS]t$/.test(change.name);});if(methods.length){var table=document.createElement('table');table.setAttribute('data-replay-parameter','');table.setAttribute('data-no-i18n','');var header=document.createElement('tr');for(var h=0;h<3;++h){var th=document.createElement('th');th.textContent=['Parameter','Value','Replay changes'][h];header.appendChild(th);}table.appendChild(header);for(var r=0;r<methods.length;++r){var row=document.createElement('tr');for(var c=0;c<3;++c){var cell=document.createElement('td');cell.textContent=String(c===0?methods[r].name:c===1?methods[r].original:methods[r].value);row.appendChild(cell);}table.appendChild(row);}var box=card.querySelector('.details-box')||card;box.appendChild(table);}
   if(!changes.length)return;var tables=card.querySelectorAll('table.integration-parameters');
   for(var t=0;t<tables.length;++t){var rows=tables[t].querySelectorAll('tbody > tr'),header=tables[t].querySelector('thead > tr');if(!header)continue;var column=document.createElement('th');column.textContent='Replay changes';column.setAttribute('data-no-i18n','');column.setAttribute('data-replay-parameter','');header.appendChild(column);
      for(var r=0;r<rows.length;++r){var name=rows[r].cells[0].textContent.trim(),cell=document.createElement('td');cell.setAttribute('data-replay-parameter','');cell.setAttribute('data-no-i18n','');for(var c=0;c<changes.length;++c)if(changes[c].name===name){cell.textContent=String(changes[c].value);cell.style.color='#fab387';cell.style.fontWeight='bold';break;}rows[r].appendChild(cell);}
   }
}
function atlasParameterLiteral(field,value){
   if(field.kind==='matrix'){
      if(!Array.isArray(value)||value.length<(field.curve?2:5)||value.length>(field.curve?512:5))throw Error('Invalid rows for '+field.name);
      for(var r=0;r<value.length;++r){if(!Array.isArray(value[r])||value[r].length!==(field.curve?2:5))throw Error('Invalid columns for '+field.name);for(var c=0;c<value[r].length;++c)if(typeof value[r][c]!=='number'||!isFinite(value[r][c])||((field.curve||c<3)&&(value[r][c]<0||value[r][c]>1)))throw Error('Invalid value for '+field.name);if(field.curve?(r>0&&value[r][0]<=value[r-1][0]):value[r][0]>=value[r][2]||value[r][3]>=value[r][4])throw Error('Invalid ordered values for '+field.name);}
      if(field.curve&&(value[0][0]!==0||value[value.length-1][0]!==1))throw Error('Curve endpoints must have X = 0 and X = 1.');return JSON.stringify(value);
   }
   if(field.kind==='choice'){if(field.choices.indexOf(value)<0)throw Error('Invalid interpolation');return 'CurvesTransformation.prototype.'+value;}
   if(field.range.length?typeof value!=='number'||!isFinite(value)||value<field.range[0]||value>field.range[1]:typeof value!=='boolean')throw Error('Invalid value for '+field.name);return String(value);
}
function atlasStructuredParameterFields(base){
   var fields=[],variable=base.variable||'P',original=base.parameterOriginalSource||base.source,names=base.tool==='HistogramTransformation'?['H']:['R','G','B','K','A','L','a','b','c','H','S'];if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable))return fields;
   for(var i=0;i<names.length;++i){var name=names[i],pattern=new RegExp('\\b'+variable+'\\.'+name+'\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;','g'),matches=base.source.match(pattern),recorded=pattern.exec(original);pattern.lastIndex=0;var current=pattern.exec(base.source);if(matches&&matches.length===1&&recorded&&current)try{var field={name:name,kind:'matrix',curve:base.tool==='CurvesTransformation',value:JSON.parse(current[1].replace(new RegExp('\\x2f\\x2a[\\s\\S]*?\\x2a\\x2f','g'),'').replace(new RegExp('\\x2f\\x2f[^\\r\\n]*','g'),'')),original:JSON.parse(recorded[1].replace(new RegExp('\\x2f\\x2a[\\s\\S]*?\\x2a\\x2f','g'),'').replace(new RegExp('\\x2f\\x2f[^\\r\\n]*','g'),'')),range:[]};atlasParameterLiteral(field,field.value);atlasParameterLiteral(field,field.original);fields.push(field);}catch(error){}
      if(base.tool==='CurvesTransformation'){var method=new RegExp('\\b'+variable+'\\.'+name+'t\\s*=\\s*CurvesTransformation\\.prototype\\.(Linear|CubicSpline|AkimaSubsplines)\\s*;','g'),all=base.source.match(method),before=method.exec(original);method.lastIndex=0;var now=method.exec(base.source);if(all&&all.length===1&&before&&now)fields.push({name:name+'t',kind:'choice',value:now[1],original:before[1],choices:['Linear','CubicSpline','AkimaSubsplines'],range:[]});}
   }return fields;
}
function atlasParameterFields(step){
   var base=step.executionOriginalStep||step,definitions={UnsharpMask:{sigma:[0.1,250],amount:[0,1],useLuminance:[]},NoiseXTerminator:{denoise:[0,1],detail:[0,1]},BlurXTerminator:{sharpen_stars:[0,1],sharpen_nonstellar:[0,1],adjust_halos:[-1,1],psf_diameter:[0,100],correct_only:[],nonstellar_then_stellar:[],lum_only:[],automatic_psf:[]}},fields=[],schema=definitions[base.tool];
   if(base.action!=='process'||base.reason||base.createsImage)return fields;if(base.tool==='HistogramTransformation'||base.tool==='CurvesTransformation')return atlasStructuredParameterFields(base);if(!schema)return fields;
   var original=base.parameterOriginalSource||base.source,variable=base.variable||'P';if(!/^[A-Za-z_$][\w$]*$/.test(variable))return fields;
   for(var name in schema)if(Object.prototype.hasOwnProperty.call(schema,name)){var pattern=new RegExp('\\b'+variable+'\\.'+name+'\\s*=\\s*(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?|true|false)\\s*;','g'),matches=base.source.match(pattern),recorded=pattern.exec(original);pattern.lastIndex=0;var current=pattern.exec(base.source);if(matches&&matches.length===1&&current&&recorded)fields.push({name:name,value:current[1]==='true'?true:current[1]==='false'?false:Number(current[1]),original:recorded[1]==='true'?true:recorded[1]==='false'?false:Number(recorded[1]),range:schema[name]});}
   return fields;
}
function editReplayWorkflow(data,bindings,operation){
   function index(id){for(var i=0;i<data.length;++i)if(data[i].id===id)return i;throw Error('Unknown workflow image: '+id);}
   if(operation.type==='remove-node'){index(operation.image);if(typeof operation.node!=='string'||!/^[-A-Za-z0-9_]+$/.test(operation.node))throw Error('Invalid tree node.');return {data:JSON.parse(JSON.stringify(data)),bindings:JSON.parse(JSON.stringify(bindings))};}
   var source=index(operation.image),at=operation.index;if(at!==Math.floor(at)||at<0||at>=data[source].steps.length)throw Error('Select a valid source step.');
   if(operation.type==='parameters'||operation.type==='reset-parameters'){
      var parameterData=JSON.parse(JSON.stringify(data)),parameterCurrent=parameterData[source].steps[at],parameterBase=parameterCurrent.executionOriginalStep||parameterCurrent,fields=atlasParameterFields(parameterBase);if(!fields.length)throw Error('No supported editable parameters were recorded for this step.');
      var originalSource=parameterBase.parameterOriginalSource||parameterBase.source,newSource=originalSource,values=operation.values||{};
      for(var supplied in values)if(Object.prototype.hasOwnProperty.call(values,supplied)&&!fields.some(function(field){return field.name===supplied;}))throw Error('Unknown parameter: '+supplied);
      var parameterChanges=[];for(var fi=0;fi<fields.length;++fi){var field=fields[fi],value=operation.type==='reset-parameters'?field.original:Object.prototype.hasOwnProperty.call(values,field.name)?values[field.name]:field.value,literal=atlasParameterLiteral(field,value),expression=field.kind==='matrix'?'\\[[\\s\\S]*?\\]':field.kind==='choice'?'CurvesTransformation\\.prototype\\.(?:Linear|CubicSpline|AkimaSubsplines)':'-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?|true|false',pattern=new RegExp('(\\b'+(parameterBase.variable||'P')+'\\.'+field.name+'\\s*=\\s*)('+expression+')(\\s*;)');newSource=newSource.replace(pattern,function(all,prefix,old,suffix){return prefix+literal+suffix;});if(JSON.stringify(value)!==JSON.stringify(field.original))parameterChanges.push({name:field.name,original:field.original,value:value});}
      parameterBase.source=newSource;parameterBase.parameterChanges=parameterChanges;
      if(parameterBase.parameterChanges.length)parameterBase.parameterOriginalSource=originalSource;else{parameterBase.source=originalSource;delete parameterBase.parameterOriginalSource;delete parameterBase.parameterChanges;}
      parameterCurrent.parameterChanges=parameterBase.parameterChanges;parameterData[source].edited=true;return {data:parameterData,bindings:JSON.parse(JSON.stringify(bindings))};
   }
   if(operation.type==='execution-mode'){
      if(['auto','adjust','skip'].indexOf(operation.mode)<0)throw Error('Select a valid execution mode.');var modeData=JSON.parse(JSON.stringify(data)),modeCurrent=modeData[source].steps[at],modeBase=JSON.parse(JSON.stringify(modeCurrent.executionOriginalStep||modeCurrent));
      if(operation.mode==='adjust'&&(modeBase.action!=='process'||modeBase.reason||modeBase.tool==='ProcessContainer'||modeBase.createsImage))throw Error('Interactive adjustment is currently available for supported native processes only.');
      if(operation.mode==='skip'&&(modeBase.createsImage||['palette','game','external','identifier'].indexOf(modeBase.action)>=0))throw Error('This step creates or selects a branch input and cannot be skipped.');
      modeBase.executionMode=operation.mode;modeBase.edited=!!(modeCurrent.executionOriginalStep||modeCurrent).edited;modeBase.number=modeCurrent.number;modeBase.anchor=modeCurrent.anchor;if(operation.mode!=='auto')modeBase.executionOriginalStep=JSON.parse(JSON.stringify(modeCurrent.executionOriginalStep||modeCurrent));
      if(operation.mode==='skip'){modeBase.action='skip';modeBase.reason='';modeBase.source='';modeBase.variable='';modeBase.inputs=[];modeBase.imageParameters=[];modeBase.mask=null;modeBase.starRequired=false;modeBase.warning='Skipped in this workflow variant; pixels remain unchanged.';}else if(operation.mode==='adjust')modeBase.warning='Adjust this native process on the replay image, apply it, then continue. Recorded parameters are not applied a second time.';
      modeData[source].steps[at]=modeBase;modeData[source].edited=true;var modeBindings=suggestChainBindings(modeData);for(var modeKey in bindings)if(Object.prototype.hasOwnProperty.call(modeBindings,modeKey))modeBindings[modeKey]=JSON.parse(JSON.stringify(bindings[modeKey]));return {data:modeData,bindings:modeBindings};
   }
   if(operation.type==='stars-origin'){
      var outputIndex=index(operation.to);if(outputIndex===source)throw Error('A stars output must be a different image.');var producer=data[source].steps[at],output=data[outputIndex];if(producer.tool!=='StarXTerminator'||producer.action!=='process'||producer.reason||(output.steps.length&&(output.steps[0].tool!=='StarXTerminator'||output.steps[0].action!=='process'))||output.clone||output.stars)throw Error('Select a StarXTerminator producer and a separate stars image with no remaining steps or an initial StarXTerminator entry.');if((producer.source.match(/\.stars\s*=\s*(?:true|false)\s*;/g)||[]).length!==1)throw Error('Unable to safely enable the recorded StarXTerminator stars output.');
      var starsData=JSON.parse(JSON.stringify(data)),changed=starsData[source].steps[at];changed.source=changed.source.replace(/(\.stars\s*=\s*)(true|false)(\s*;)/,'$1true$3');changed.edited=true;changed.warning='User-confirmed stars output: Generate Star Image enabled for replay; original historical pixels are not verified.';starsData[source].edited=true;
      var shifted=output.steps.length?editReplayWorkflow(starsData,bindings,{type:'remove',image:operation.to,index:0}):{data:starsData,bindings:JSON.parse(JSON.stringify(bindings))};shifted.data[outputIndex].stars={source:operation.image,sourceAnchor:producer.anchor||'',stage:at+1,manual:true};shifted.data[outputIndex].edited=true;return shifted;
   }
   if(operation.type==='external'){
      if(['original','prepared','graxpert','skip'].indexOf(operation.mode)<0)throw Error('Select a valid external processing mode.');var externalData=JSON.parse(JSON.stringify(data)),current=externalData[source].steps[at],base=JSON.parse(JSON.stringify(current.originalReplayStep||current.executionOriginalStep||current));base.number=current.number;base.anchor=current.anchor;base.memberAnchors=current.memberAnchors||[];if(current.copiedFrom){base.copiedFrom=current.copiedFrom;base.edited=true;}
      if(operation.mode!=='original'){
         if(operation.mode==='graxpert'&&base.mask)throw Error('Direct GraXpert requires an unmasked step. Use a prepared result for a historically masked replacement.');
         var config=operation.mode==='graxpert'?operation.settings||{}:{},correction=config.correction||'Subtraction',smoothing=Number(config.smoothing===undefined?0.5:config.smoothing),model=config.model||'',device=config.device||'gpu',executable=config.executable||'';
         if(['Subtraction','Division'].indexOf(correction)<0||!isFinite(smoothing)||smoothing<0||smoothing>1||typeof model!=='string'||model&&!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(model)||['default','cpu','gpu'].indexOf(device)<0||typeof executable!=='string'||executable.length>4096||/[\r\n]/.test(executable))throw Error('Invalid GraXpert settings.');
         var original=JSON.parse(JSON.stringify(base));base.originalReplayStep=original;delete base.executionOriginalStep;base.executionMode='auto';base.externalDeclaration=operation.mode;base.time='';base.edited=true;base.action=operation.mode==='prepared'?'external':'graxpert';base.tool=operation.mode==='prepared'?'ExternalResult':'GraXpert';base.title=operation.mode==='prepared'?'Prepared external result':'GraXpert — user settings';base.inputs=[];base.imageParameters=[];base.mask=null;base.reason='';base.createsImage=false;base.requiresTarget=true;base.starRequired=false;base.source=operation.mode==='prepared'?'':'var P = '+JSON.stringify({correction:correction,smoothing:smoothing,model:model,device:device,executable:executable})+';';base.variable=operation.mode==='prepared'?'':'P';base.warning=operation.mode==='prepared'?'Choose the completed image AFTER this external processing. Earlier branch steps are skipped.':'New GraXpert run with user settings. Original settings were not recorded.';base.graxpertSettings={correction:correction,smoothing:smoothing,model:model,device:device,executable:executable};
      }
      if(operation.mode==='skip'){if(!ambiguousImageCopy(original))throw Error('Skip is available only for ambiguous PixelMath image copies.');base.action='skip';base.tool='PixelMath';base.title='PixelMath — skipped by user';base.source='';base.variable='';base.warning='Skipped by user: pixels are unchanged at this step. Original external processing is not reproduced.';}
      externalData[source].steps[at]=base;externalData[source].edited=true;var externalBindings=suggestChainBindings(externalData);for(var key in bindings)if(Object.prototype.hasOwnProperty.call(externalBindings,key))externalBindings[key]=JSON.parse(JSON.stringify(bindings[key]));return {data:externalData,bindings:externalBindings};
   }
   var destination=operation.type==='copy'?index(operation.to):source,position=operation.type==='copy'?operation.at:at,insert=operation.type==='copy';
   if(operation.type!=='copy'&&operation.type!=='remove')throw Error('Unknown workflow edit.');if(position!==Math.floor(position)||position<0||position>data[destination].steps.length)throw Error('Select a valid insertion position.');
   var result=JSON.parse(JSON.stringify(data)),oldBindings=JSON.parse(JSON.stringify(bindings)),owner=result[destination].id,step=JSON.parse(JSON.stringify(data[source].steps[at]));
   if(insert){if(data[source].id!==owner&&(step.inputs||[]).indexOf(data[source].id)>=0){var mapping={};mapping['$'+data[source].id]=owner;step.source=step.source.replace(/(\b(?:expression[0-3]?|symbols)\s*=\s*)("(?:[^"\\]|\\.)*")/g,function(all,prefix,literal){try{return prefix+JSON.stringify(remapWorkflowExpression(JSON.parse(literal),mapping));}catch(error){return all;}});step.inputs=step.inputs.map(function(name){return name===data[source].id?owner:name;});if(step.imageParameters)for(var ip=0;ip<step.imageParameters.length;++ip)if(step.imageParameters[ip].name===data[source].id)step.imageParameters[ip].name=owner;if(step.executionOriginalStep){step.executionOriginalStep.inputs=step.inputs.slice();if(step.imageParameters)step.executionOriginalStep.imageParameters=JSON.parse(JSON.stringify(step.imageParameters));}}
      step.edited=true;step.copiedFrom={image:data[source].id,number:step.number,title:step.title};var uid='apa_edit_'+owner+'_'+position,suffix=1;var exists=function(id){for(var i=0;i<result.length;++i)for(var j=0;j<result[i].steps.length;++j)if(result[i].steps[j].anchor===id)return true;return false;};while(exists(uid))uid='apa_edit_'+owner+'_'+position+'_'+suffix++;step.anchor=uid;step.memberAnchors=[];result[destination].steps.splice(position,0,step);}else result[destination].steps.splice(position,1);
   for(var i=0;i<result[destination].steps.length;++i)result[destination].steps[i].number=i+1;
   result[destination].edited=true;
   function stage(value,followEnd){if(insert)return value>position||(followEnd&&value>0&&value===position&&position===data[destination].steps.length)?value+1:value;return value>position?value-1:value;}
   for(var i=0;i<result.length;++i){var origin=result[i].clone||result[i].stars;if(origin&&origin.source===owner&&typeof origin.stage==='number'){if(!insert&&result[i].stars&&origin.stage===position+1)origin.stage=null;else origin.stage=stage(origin.stage);}}
   var next=suggestChainBindings(result),slots=chainReferenceSlots(data);
   for(var i=0;i<slots.length;++i){var slot=slots[i],newIndex=slot.index;if(slot.image===owner){if(!insert&&slot.index===position)continue;if(insert&&slot.index>=position)newIndex++;if(!insert&&slot.index>position)newIndex--;}
      var binding=oldBindings[slot.key];if(!binding)continue;binding=JSON.parse(JSON.stringify(binding));if(binding.source===owner){binding.stage=slot.image===owner&&binding.stage===slot.index?newIndex:stage(binding.stage,true);}next[chainSlotKey(slot.image,newIndex,slot.role,slot.name)]=binding;
   }
   return {data:result,bindings:next};
}
function restoreReplayWorkflow(original,state){
   if(!state||state.version!==1||state.fingerprint!==workflowFingerprint(original)||!Array.isArray(state.operations)||state.operations.length>2000)throw Error('Saved workflow does not match this report.');
   var data=JSON.parse(JSON.stringify(original)),bindings=suggestChainBindings(data);
   for(var i=0;i<state.operations.length;++i){var edited=editReplayWorkflow(data,bindings,state.operations[i]);data=edited.data;bindings=edited.bindings;}
   if(state.bindings){var slots=chainReferenceSlots(data);for(var i=0;i<slots.length;++i){var saved=state.bindings[slots[i].key];if(saved&&typeof saved.source==='string'&&typeof saved.stage==='number'&&saved.stage===Math.floor(saved.stage)&&saved.stage>=0&&(saved.preparation===0||saved.preparation===1||saved.preparation===2)&&typeof saved.inverted==='boolean')bindings[slots[i].key]={source:saved.source,stage:saved.stage,preparation:saved.preparation,inverted:saved.inverted};}}
   var inputs={};if(state.startingInputs)for(var i=0;i<data.length;++i)for(var key in state.startingInputs){var prefix='$'+data[i].id,tail=key.slice(prefix.length),value=state.startingInputs[key];if(key.indexOf(prefix)===0&&(tail===''||/^@[0-9]+$/.test(tail))&&typeof value==='string'&&value.length<=256)inputs[key]=value;}
   var target=typeof state.target==='number'&&state.target===Math.floor(state.target)&&data[state.target]?state.target:0;
   return {data:data,bindings:bindings,startingInputs:inputs,target:target,operations:JSON.parse(JSON.stringify(state.operations))};
}
function workflowSnapshotKey(snapshot){function ordered(value){if(Array.isArray(value))return value.map(ordered);if(value&&typeof value==='object'){var keys=Object.keys(value).sort(),result={};for(var i=0;i<keys.length;++i)result[keys[i]]=ordered(value[keys[i]]);return result;}return value;}return JSON.stringify(ordered({operations:snapshot.operations||[],bindings:snapshot.bindings||{},startingInputs:snapshot.startingInputs||{},target:snapshot.target,annotations:snapshot.annotations||null,audit:snapshot.audit||[],histogramLearning:snapshot.histogramLearning||null}));}
function workflowStateJSON(state){return JSON.stringify(state).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');}

function replayLaunchHTML(){
   return '<div class="replay-launchers"><button type="button" aria-controls="replay_single_panel" aria-expanded="false" onclick="toggleAtlasReplay(\'replay_single_panel\',this)"><svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h12M5 13h8M5 19h8M5 25h12"/><path d="M20 10l8 6-8 6z"/></svg><span>Export workflow for replay</span></button><button type="button" aria-controls="chain_workflow" aria-expanded="false" onclick="toggleAtlasReplay(\'chain_workflow\',this)"><svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="9" height="7" rx="2"/><rect x="21" y="3" width="9" height="7" rx="2"/><rect x="12" y="23" width="9" height="7" rx="2"/><path d="M6 10v6h20v-6M16 16v7"/></svg><span>Replay linked dependency chain</span></button></div><style>.replay-launchers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.replay-launchers button{display:flex;align-items:center;gap:16px;padding:20px;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:10px;text-align:left;cursor:pointer;font-size:16px}.replay-launchers svg{flex-shrink:0;color:#89b4fa}.replay-launchers button:hover,.replay-launchers button[aria-expanded="true"]{border-color:#89b4fa;background:#313244}.replay-panel>summary{display:none}.replay-panel[open]{padding:16px;border:1px solid #45475a;border-radius:8px;margin-bottom:16px}.tree-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}.tree-toolbar .zoom-control{margin:0}.tree-toolbar button{max-width:100%;white-space:normal}.tree-toolbar button:disabled,[data-save-report]:disabled{opacity:.45;cursor:default}#tree_dirty{font-size:12px;color:#fab387}@media(max-width:650px){.replay-launchers{grid-template-columns:1fr}}</style>';
}

function workspaceChainHTML(data){
   var html="<style>#chain_bindings>.chain-reference-group{grid-column:1/-1;min-width:0}#chain_workflow .chain-reference-group h4{margin:8px 0 14px;color:#89b4fa;font-size:16px;overflow-wrap:anywhere}#chain_bindings .chain-reference-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:16px}#chain_bindings .chain-role-icon{display:inline-flex;width:22px;height:22px;vertical-align:middle;margin-right:7px}#chain_bindings .chain-role-icon svg{width:100%;height:100%}#chain_bindings .chain-mask-card{border-left:3px solid #f38ba8}#chain_bindings .chain-mask-card legend{color:#f38ba8}#chain_bindings .chain-input-card{border-left:3px solid #f9e2af}#chain_bindings .chain-input-card legend{color:#f9e2af}#chain_bindings .chain-reference-step{margin:0;color:#bac2de;font-size:13px}#chain_workflow{min-width:0}#chain_workflow *{box-sizing:border-box}#chain_workflow .chain-target-row,#chain_workflow .chain-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}#chain_workflow .chain-card,#chain_workflow fieldset,#chain_workflow .chain-review{min-width:0;border:1px solid #45475a;border-radius:10px;padding:16px;margin:0}#chain_workflow .chain-card h3{margin-top:0}#chain_workflow legend{max-width:100%;overflow-wrap:anywhere;padding:0 6px}#chain_workflow label{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:14px}#chain_workflow select,#chain_workflow input:not([type=checkbox]){width:100%;min-width:0;max-width:100%;min-height:40px;margin:0}#chain_workflow button{min-height:40px;max-width:100%;white-space:normal;overflow-wrap:anywhere}#chain_workflow .chain-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px;align-items:end;margin:12px 0}#chain_workflow .chain-card fieldset{margin-top:16px}#chain_workflow .chain-help{margin:14px 0}#chain_workflow summary{cursor:pointer}#chain_workflow .chain-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}#chain_workflow #workflow_steps{max-height:460px;overflow:auto;margin-top:12px}#chain_workflow #workflow_steps p{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px;background:#11111b;border-radius:6px;margin:8px 0}#chain_workflow #workflow_steps p>span{flex:1 1 180px;overflow-wrap:anywhere}#chain_bindings{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:16px;margin:16px 0}#chain_bindings>.chain-starting-inputs{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:14px}#chain_bindings>.chain-starting-inputs>p{grid-column:1/-1;margin:0}#chain_bindings .chain-field-caption{margin:12px 0 6px;color:#bac2de}#chain_bindings .chain-binding>.chain-check{margin-top:12px}#chain_workflow .chain-check{display:flex;flex-direction:row;align-items:flex-start;gap:10px}#chain_workflow input[type=checkbox]{flex:0 0 auto;width:18px;height:18px;margin:2px 0}#chain_workflow .chain-download{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #45475a}#chain_workflow .chain-download>label{flex:1 1 320px}#chain_workflow .chain-download>button{background:#89b4fa;color:#11111b;padding:12px 20px}#chain_workflow p{overflow-wrap:anywhere}#chain_workflow .chain-review{margin-top:20px}@media(max-width:850px){#chain_workflow .chain-target-row,#chain_workflow .chain-editor-grid{grid-template-columns:1fr}}@media(max-width:480px){#chain_workflow.replay-panel[open]{padding:10px}#chain_workflow .chain-card,#chain_workflow fieldset,#chain_workflow .chain-review{padding:12px}#chain_workflow .chain-actions>button,#chain_workflow .chain-download>button{width:100%}}#chain_workflow .chain-target-row{align-items:center}#chain_workflow .chain-target-row>p{margin:0}#chain_workflow #workflow_editor{margin:20px 0}#chain_workflow .chain-edit-tile{display:flex;align-items:center;gap:16px;width:100%;padding:18px 20px;border:1px solid #45475a;border-radius:10px;background:#1e1e2e;color:#cdd6f4;font-size:16px;list-style:none;transition:background .15s,border-color .15s}#chain_workflow .chain-edit-tile::-webkit-details-marker{display:none}#chain_workflow .chain-edit-tile::marker{content:\"\"}#chain_workflow .chain-edit-tile svg{width:32px;height:32px;flex:none;color:#89b4fa}#chain_workflow .chain-edit-tile span{min-width:0;overflow-wrap:anywhere}#chain_workflow .chain-edit-tile:after{content:\"+\";margin-left:auto;font-size:24px;color:#89b4fa}#chain_workflow #workflow_editor[open]>.chain-edit-tile:after{content:\"−\"}#chain_workflow .chain-edit-tile:hover,#chain_workflow #workflow_editor[open]>.chain-edit-tile{border-color:#89b4fa;background:#313244}#chain_workflow .chain-edit-tile:focus-visible{outline:2px solid #89b4fa;outline-offset:3px}#chain_workflow #chain_bindings>.chain-starting-inputs{display:block;width:100%;min-width:0}#chain_workflow .chain-starting-inputs>p{margin-bottom:16px}#chain_workflow .chain-starting-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(180px,1fr);align-items:center;gap:16px;width:100%;margin:12px 0}#chain_workflow .chain-starting-row>span{min-width:0;overflow-wrap:anywhere}#chain_workflow .chain-download>button:disabled{background:#313244;color:#a6adc8;border:1px solid #585b70;opacity:.5;cursor:not-allowed;box-shadow:none}#chain_workflow .chain-download>button:not(:disabled){border:1px solid #89b4fa;cursor:pointer}#chain_workflow .chain-download>button:not(:disabled):hover{background:#b4befe}@media(max-width:520px){#chain_workflow .chain-starting-row{grid-template-columns:minmax(0,1fr);gap:7px}#chain_workflow .chain-edit-tile{padding:14px;gap:12px}}#chain_workflow .chain-starting-inputs>summary{cursor:pointer;font-weight:bold;padding:4px 0}#chain_workflow .chain-starting-inputs:not([open])>:not(summary){display:none}#chain_workflow .chain-starting-inputs[open]>p{margin-top:14px}#chain_workflow .chain-reference-highlight{outline:3px solid #89b4fa;outline-offset:3px;box-shadow:0 0 0 7px #89b4fa25;background:#25253b}#chain_workflow .chain-reference-link{cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:4px}#chain_workflow .chain-reference-link:hover,#chain_workflow .chain-reference-link:focus-visible{color:#89b4fa!important;outline:2px solid #89b4fa;outline-offset:3px}#chain_workflow .chain-manual-stars{grid-column:1/-1;border-left:3px solid #fab387}#chain_workflow .chain-manual-stars button{margin-top:14px}#chain_workflow .chain-manual-stars button:disabled{opacity:.45;cursor:not-allowed}</style><details id=\"chain_workflow\" class=\"replay-panel\"><summary>Replay linked dependency chain</summary><h2>Replay linked dependency chain</h2><p>Choose your final image, review its inputs, then download the script to run in PixInsight.</p><div class=\"chain-target-row\"><label>1. Choose the final image<select id=\"chain_target\">";
   for(var i=0;i<data.length;++i)html+='<option value="'+i+'" data-no-i18n>'+escapeHTML(data[i].id)+'</option>';
   return html+"</select></label><p>The script rebuilds connected channels, clones, stars and masks on new image copies. Your starting images are kept.</p></div><details class=\"chain-help\"><summary>What do I need before starting?</summary><p>Open the original channel images in PixInsight. Supply completed GAME masks when requested. Check which processing stage each input represents; a connection does not guarantee the original historical pixels.</p></details><details id=\"workflow_editor\"><summary class=\"chain-edit-tile\"><svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M5 8h22M5 16h22M5 24h22\"/><circle cx=\"11\" cy=\"8\" r=\"3\" fill=\"#1e1e2e\"/><circle cx=\"22\" cy=\"16\" r=\"3\" fill=\"#1e1e2e\"/><circle cx=\"14\" cy=\"24\" r=\"3\" fill=\"#1e1e2e\"/></svg><span>Optional: edit steps or configure GraXpert</span></summary><p>Use this section only to change the recorded workflow. Otherwise, continue to the input review below.</p><div class=\"chain-editor-grid\"><section class=\"chain-card\"><h3>Steps in an image</h3><p>Choose Automatic to reuse recorded settings, Adjust to apply new settings in PixInsight, or Skip to leave this stage unchanged. Adjustment is initially available for supported native processes. Generate a new report from the resulting images to capture tuned parameters.</p><label>Workflow image<select id=\"workflow_image\"></select></label><div id=\"workflow_steps\"></div></section><section class=\"chain-card\"><h3>Choose a step to copy or configure</h3><div class=\"chain-fields\"><label>Copy from image<select id=\"workflow_copy_image\"></select></label><label>Step<select id=\"workflow_copy_step\"></select></label></div><fieldset><legend>Copy to the workflow image</legend><div class=\"chain-fields\"><label>Insert before<select id=\"workflow_position\"></select></label><button id=\"workflow_copy\" type=\"button\">Copy step</button></div></fieldset><fieldset><legend>External processing / GraXpert</legend><p>These settings apply to the source image and step selected above.</p><label>Handling<select id=\"external_mode\"><option value=\"original\">Recorded process</option><option value=\"skip\">Skip ambiguous image copy (leave pixels unchanged)</option><option value=\"prepared\">Use prepared external result</option><option value=\"graxpert\">Run GraXpert again</option></select></label><div class=\"chain-fields\"><label>Correction<select id=\"graxpert_correction\"><option value=\"Subtraction\">Subtraction</option><option value=\"Division\">Division</option></select></label><label>Smoothing<input id=\"graxpert_smoothing\" type=\"number\" min=\"0\" max=\"1\" step=\"0.05\" value=\"0.5\"></label><label>Device<select id=\"graxpert_device\"><option value=\"default\">Application default</option><option value=\"cpu\">CPU</option><option value=\"gpu\" selected>GPU</option></select></label></div><details class=\"chain-help\"><summary>Advanced GraXpert settings (optional)</summary><div class=\"chain-fields\"><label>AI model version (optional)<input id=\"graxpert_model\" placeholder=\"Latest available (automatic)\"></label><label>Executable path (optional)<input id=\"graxpert_executable\" placeholder=\"Auto-detect if empty\"></label></div></details><button id=\"external_apply\" type=\"button\">Apply external handling</button><p>Prepared results skip earlier branch processing. A new GraXpert run uses your declared settings, not recovered historical settings. Unpinned AI models may change results.</p></fieldset></section></div><div class=\"chain-actions\"><button id=\"workflow_undo\" type=\"button\">Undo last edit</button><button id=\"workflow_save\" data-save-report disabled type=\"button\">Save edited report (HTML)</button></div><p id=\"workflow_status\" aria-live=\"polite\"></p><details><summary>Change history</summary><ol id=\"workflow_history\"></ol></details></details><h3>2. Review the input images and masks</h3><p>For each connection, choose the source image and the stage to use. Palette inputs also need their preparation state.</p><div id=\"chain_bindings\"></div><section class=\"chain-review\"><h3>3. Review the plan and download</h3><div id=\"chain_plan\" aria-live=\"polite\"></div><div class=\"chain-download\"><label class=\"chain-check\"><input id=\"chain_confirm\" type=\"checkbox\">I have reviewed source checkpoints, palette preparation and mask inversion.</label><button id=\"chain_export\" type=\"button\" disabled>Download chain replay script</button><button id=\"chain_print\" type=\"button\" onclick=\"openAtlasPrintOptions('chain')\">Print linked chain / PDF</button></div></section></details>";
}

function chainBrowserController(){
   var target=document.getElementById('chain_target'),pane=document.getElementById('chain_bindings'),summary=document.getElementById('chain_plan'),confirm=document.getElementById('chain_confirm'),button=document.getElementById('chain_export');
   if(!target||typeof workspaceReplayData==='undefined')return;
   var preferred=document.getElementById('final_image');if(preferred)for(var i=0;i<workspaceReplayData.length;++i)if(workspaceReplayData[i].anchor===preferred.value)target.value=String(i);
   var original=typeof atlasReportData!=='undefined'?atlasReportData.workspace.images:JSON.parse(JSON.stringify(workspaceReplayData)),workflow=JSON.parse(JSON.stringify(original)),fingerprint=workflowFingerprint(original),bindings=suggestChainBindings(workflow),slots=chainReferenceSlots(workflow),plan=null,startingInputs={},operations=[],audit=[],replayWorkflow=null,replayBindings=null,baseGraph=typeof workspaceGraphData==='undefined'?null:JSON.parse(JSON.stringify(workspaceGraphData)),projectedGraph=null;
   var editorImage=document.getElementById('workflow_image'),editorSteps=document.getElementById('workflow_steps'),copyImage=document.getElementById('workflow_copy_image'),copyStep=document.getElementById('workflow_copy_step'),position=document.getElementById('workflow_position'),editStatus=document.getElementById('workflow_status');
   function message(text){if(editStatus)editStatus.textContent=text;}
   var noticeBox=null,noticeTimer=null,notificationsReady=false,lastNoticeState='';
   function notify(text){if(!noticeBox){noticeBox=document.createElement('div');noticeBox.id='atlas_notification';noticeBox.className='atlas-notification';noticeBox.setAttribute('role','status');noticeBox.setAttribute('aria-live','polite');noticeBox.setAttribute('aria-atomic','true');noticeBox.setAttribute('data-no-i18n','');document.body.appendChild(noticeBox);}while(noticeBox.firstChild)noticeBox.removeChild(noticeBox.firstChild);var content=document.createElement('span');content.textContent=text;noticeBox.appendChild(content);var dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label',document.documentElement&&document.documentElement.lang==='el'?'Κλείσιμο ειδοποίησης':'Dismiss notification');dismiss.onclick=function(){noticeBox.hidden=true;};noticeBox.appendChild(dismiss);noticeBox.hidden=false;if(noticeTimer&&typeof clearTimeout==='function')clearTimeout(noticeTimer);if(typeof setTimeout==='function')noticeTimer=setTimeout(function(){noticeBox.hidden=true;},5500);}

   var histogramLearning=atlasHistogramLearning().empty();
   function state(){var annotations=typeof window.atlasManualAnnotations==='function'?window.atlasManualAnnotations():null;return {version:1,fingerprint:fingerprint,operations:operations,bindings:bindings,startingInputs:startingInputs,target:Number(target.value),annotations:annotations,audit:audit,histogramLearning:histogramLearning};}
   window.atlasPrintSnapshot=function(){return {workflow:replayWorkflow||workflow,graph:projectedGraph||baseGraph,bindings:replayBindings||bindings,plan:plan,state:state()};};
   var startingInputsExpanded=false;var baselineSnapshot=JSON.parse(JSON.stringify(state())),fileBaseline=false;if(baselineSnapshot.annotations)baselineSnapshot.annotations.edges=[];
   function isDirty(){return workflowSnapshotKey(state())!==workflowSnapshotKey(baselineSnapshot);}
   function updateDirty(){var dirty=isDirty(),buttons=document.querySelectorAll?document.querySelectorAll('[data-save-report]'):[];for(var i=0;i<buttons.length;++i)buttons[i].disabled=!dirty;var save=document.getElementById('workflow_save');if(save)save.disabled=!dirty;var reset=document.getElementById('tree_reset');if(reset)reset.disabled=!dirty;var label=document.getElementById('tree_dirty');if(label)label.textContent=dirty?'Unsaved changes':'No unsaved changes';}
   function persist(){var nextNoticeState=workflowSnapshotKey(state());if(notificationsReady&&nextNoticeState!==lastNoticeState)notify(document.documentElement&&document.documentElement.lang==='el'?'Οι αλλαγές εφαρμόστηκαν. Αποθήκευσε το HTML για να τις κρατήσεις.':'Changes applied. Save the HTML to keep them.');lastNoticeState=nextNoticeState;updateDirty();message(isDirty()?'Unsaved workflow changes. Save report (HTML) to keep them.':'No unsaved changes');if(typeof window.setReportLanguage==='function')window.setReportLanguage(document.documentElement.lang);}

   try{var embedded=document.getElementById('apa_workflow_state'),saved=typeof atlasReportData!=='undefined'&&atlasReportData.project?workflowStateJSON(atlasReportData.project):embedded?embedded.textContent:null;if(saved){var savedState=JSON.parse(saved);if(savedState.histogramLearning)histogramLearning=atlasHistogramLearning().validate(savedState.histogramLearning);fileBaseline=true;var restored=restoreReplayWorkflow(original,savedState);workflow=restored.data;bindings=restored.bindings;startingInputs=restored.startingInputs;operations=restored.operations;audit=Array.isArray(JSON.parse(saved).audit)?JSON.parse(saved).audit.filter(function(entry){return entry&&typeof entry.type==='string'&&typeof entry.title==='string';}).slice(-2000):[];target.value=String(restored.target);slots=chainReferenceSlots(workflow);}}catch(error){message('Restore: '+error.message);}
   function option(select,value,text){var node=document.createElement('option');node.value=String(value);node.textContent=text;if(select.getAttribute&&select.getAttribute('data-image-options')==='true')node.setAttribute('data-no-i18n','');select.appendChild(node);}
   function draw(){
      var annotations=window.atlasPendingAnnotations||(typeof window.atlasManualAnnotations==='function'?window.atlasManualAnnotations():null),manualReplay=applyManualReplayConnections(workflow,bindings,annotations);replayWorkflow=manualReplay.data;replayBindings=manualReplay.bindings;workspaceReplayData=replayWorkflow;if(typeof window.updateReplayRange==='function')window.updateReplayRange(false);confirm.checked=false;plan=buildWorkspaceChainPlan(replayWorkflow,Number(target.value),replayBindings);plan.errors=plan.errors.concat(manualReplay.errors.filter(function(error,index){return !manualReplay.errorTargets[index]||plan.reachable['$'+manualReplay.errorTargets[index]];}));plan.warnings=plan.warnings.concat(manualReplay.warnings.filter(function(warning,index){return plan.reachable['$'+manualReplay.warningTargets[index]];}));plan.startingInputs=startingInputs;var scroll=pane.scrollTop;
      while(pane.firstChild)pane.removeChild(pane.firstChild);while(summary.firstChild)summary.removeChild(summary.firstChild);
      var roots=document.createElement('details');roots.className='chain-starting-inputs';roots.open=startingInputsExpanded;roots.ontoggle=function(){startingInputsExpanded=roots.open;};var heading=document.createElement('summary');heading.textContent='Original starting inputs (optional name suggestions)';roots.appendChild(heading);
      var explanation=document.createElement('p');explanation.textContent='Select the actual starting images when the script runs in PixInsight. Their original names may differ. Optional IDs below suggest that selection; channel steps use the generated replay copies.';roots.appendChild(explanation);
      for(var r=0;r<plan.roots.length;++r)(function(root){var row=document.createElement('label');row.className='chain-starting-row';var name=document.createElement('span');name.textContent=root.id+(root.external?' (prepared AFTER external processing)':'')+' → '+plan.replayIds['$'+(root.branch||root.id)]+' ';name.setAttribute('data-no-i18n','');row.appendChild(name);var input=document.createElement('input');input.type='text';input.placeholder='Starting image ID in PixInsight (optional)';input.value=startingInputs['$'+root.id]||'';input.setAttribute('aria-label','Starting image for '+root.id);input.oninput=function(){startingInputs['$'+root.id]=input.value.replace(/^\s+|\s+$/g,'');confirm.checked=false;button.disabled=true;persist();};row.appendChild(input);roots.appendChild(row);})(plan.roots[r]);pane.appendChild(roots);var referenceGroups={},referenceCards={};
      for(var i=0;i<slots.length;++i){var slot=slots[i];if(!plan.reachable['$'+slot.image]||slot.index>=(plan.required['$'+slot.image]||0))continue;
         (function(slot){var binding=replayBindings[slot.key],field=document.createElement('fieldset');field.className='chain-binding';field.setAttribute('tabindex','-1');referenceCards[slot.key]=field;var legend=document.createElement('legend');legend.textContent=slot.image+' / '+workflow.filter(function(image){return image.id===slot.image;})[0].steps[slot.index].number+' — '+slot.role+': '+slot.name;var roleIcon=document.createElement('span');roleIcon.className='chain-role-icon';roleIcon.setAttribute('aria-hidden','true');roleIcon.innerHTML=slot.role==='mask'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 12h10m-4-4 4 4-4 4"/></svg>';legend.textContent='';legend.appendChild(roleIcon);var roleName=document.createElement('span');roleName.textContent=slot.role==='mask'?'Mask':'Input';legend.appendChild(roleName);var referenceName=document.createElement('span');referenceName.textContent=' · '+slot.name;referenceName.setAttribute('data-no-i18n','');legend.appendChild(referenceName);field.className+=' '+(slot.role==='mask'?'chain-mask-card':'chain-input-card');field.appendChild(legend);var stepLabel=document.createElement('p');stepLabel.className='chain-reference-step';stepLabel.textContent=workflow.filter(function(image){return image.id===slot.image;})[0].steps[slot.index].number+' — '+workflow.filter(function(image){return image.id===slot.image;})[0].steps[slot.index].title;stepLabel.setAttribute('data-no-i18n','');field.appendChild(stepLabel);
            var recordedStep=workflow.filter(function(image){return image.id===slot.image;})[0].steps[slot.index];if(slot.role==='input'&&slot.name==='image'&&ambiguousImageCopy(recordedStep)){var explanation=document.createElement('p');explanation.textContent='This history entry only copies an image named image. The original external tool and settings are unknown. Choose its actual source below, skip this step, or replace it with GraXpert/a prepared result.';field.appendChild(explanation);var handlingLabel=document.createElement('label');handlingLabel.textContent='How should this step be handled?';var handling=document.createElement('select');option(handling,'source','Use a source image (select below)');option(handling,'skip','Skip ambiguous image copy (leave pixels unchanged)');option(handling,'graxpert','Replace with GraXpert');option(handling,'prepared','Use prepared external result');handling.value='source';handlingLabel.appendChild(handling);field.appendChild(handlingLabel);handling.onchange=function(){if(handling.value==='skip'||handling.value==='prepared'){edit({type:'external',image:slot.image,index:slot.index,mode:handling.value});}else if(handling.value==='graxpert'){var editor=document.getElementById('workflow_editor');if(editor)editor.open=true;for(var wi=0;wi<workflow.length;++wi)if(workflow[wi].id===slot.image){editorImage.value=copyImage.value=String(wi);renderEditor();copyStep.value=String(slot.index);showExternal();document.getElementById('external_mode').value='graxpert';toggleExternalFields();var apply=document.getElementById('external_apply');if(apply&&typeof apply.focus==='function'){apply.focus();if(typeof apply.scrollIntoView==='function')apply.scrollIntoView({block:'center',behavior:'smooth'});}break;}handling.value='source';}};}
            var source=document.createElement('select');source.id='chain_source_'+i;var sourceLabel=document.createElement('label');sourceLabel.className='chain-field-caption';sourceLabel.setAttribute('for',source.id);sourceLabel.textContent='Source image';field.appendChild(sourceLabel);source.setAttribute('aria-label','Source image');source.setAttribute('data-image-options','true');option(source,'','Choose source image');for(var j=0;j<workflow.length;++j)option(source,workflow[j].id,workflow[j].id);source.value=binding.source;source.disabled=!!binding.manual;field.appendChild(source);if(binding.manual){var provenance=document.createElement('p');provenance.textContent='Manual connection — source and stage follow the tree link.';field.appendChild(provenance);}
            var checkpoint=document.createElement('select');checkpoint.id='chain_stage_'+i;var stageLabel=document.createElement('label');stageLabel.className='chain-field-caption';stageLabel.setAttribute('for',checkpoint.id);stageLabel.textContent='Which processing stage?';field.appendChild(stageLabel);checkpoint.setAttribute('aria-label','Checkpoint');var image=null;for(var j=0;j<workflow.length;++j)if(workflow[j].id===binding.source)image=workflow[j];
            if(image){option(checkpoint,0,image.clone?'Clone at recorded parent checkpoint':image.stars?'Generated stars image':'Before first process / supplied starting state');for(var j=0;j<image.steps.length;++j)option(checkpoint,j+1,'After '+image.steps[j].number+' — '+image.steps[j].title);checkpoint.value=String(binding.stage);}checkpoint.disabled=!!binding.manual;field.appendChild(checkpoint);
            source.onchange=function(){if(binding.manual)return;binding=bindings[slot.key];binding.source=source.value;for(var j=0;j<workflow.length;++j)if(workflow[j].id===source.value)binding.stage=source.value===slot.image?slot.index:workflow[j].steps.length;draw();};checkpoint.onchange=function(){if(binding.manual)return;bindings[slot.key].stage=Number(checkpoint.value);draw();};
            if(slot.palette){var preparation=document.createElement('select');preparation.id='chain_preparation_'+i;var preparationLabel=document.createElement('label');preparationLabel.className='chain-field-caption';preparationLabel.setAttribute('for',preparation.id);preparationLabel.textContent='Are the palette inputs already stretched?';field.appendChild(preparationLabel);preparation.setAttribute('aria-label','Input preparation');option(preparation,0,'Choose input state');option(preparation,1,'Already prepared');option(preparation,2,'Linear — stretch on a copy');preparation.value=String(binding.preparation);preparation.onchange=function(){bindings[slot.key].preparation=Number(preparation.value);draw();};field.appendChild(preparation);}
            if(slot.role==='mask'){var label=document.createElement('label');label.className='chain-check';var invert=document.createElement('input');invert.type='checkbox';invert.checked=binding.inverted;invert.onchange=function(){bindings[slot.key].inverted=invert.checked;draw();};label.appendChild(invert);label.appendChild(document.createTextNode('Color invert (mask values)'));field.appendChild(label);if(typeof slot.inverted!=='boolean'){var note=document.createElement('p');note.textContent='Historical mask inversion is unknown; verify Color invert.';field.appendChild(note);}}
            var group=referenceGroups['$'+slot.image];if(!group){var section=document.createElement('section');section.className='chain-reference-group';section.setAttribute('data-reference-image',slot.image);var groupTitle=document.createElement('h4'),caption=document.createElement('span'),imageName=document.createElement('span');caption.textContent='References for';imageName.textContent=' '+slot.image;imageName.setAttribute('data-no-i18n','');groupTitle.appendChild(caption);groupTitle.appendChild(imageName);section.appendChild(groupTitle);group=document.createElement('div');group.className='chain-reference-cards';section.appendChild(group);referenceGroups['$'+slot.image]=group;pane.appendChild(section);}group.appendChild(field);
         })(slot);
      }
      function linkCards(row,keys){var cards=[];for(var c=0;c<keys.length;++c)if(referenceCards[keys[c]])cards.push(referenceCards[keys[c]]);if(!cards.length)return;row.className='chain-reference-link';row.setAttribute('tabindex','0');row.setAttribute('role','button');row.setAttribute('title',document.documentElement&&document.documentElement.lang==='el'?'Κλικ για μετάβαση στην επιλογή':'Click to go to this setting');function highlight(on){for(var c=0;c<cards.length;++c)cards[c].className=cards[c].className.replace(/ chain-reference-highlight/g,'')+(on?' chain-reference-highlight':'');}row.onmouseenter=row.onfocus=function(){highlight(true);};row.onmouseleave=function(){if(document.activeElement!==row)highlight(false);};row.onblur=function(){highlight(false);};row.onclick=function(){highlight(true);if(typeof cards[0].scrollIntoView==='function')cards[0].scrollIntoView({block:'center',behavior:'smooth'});if(typeof cards[0].focus==='function')cards[0].focus({preventScroll:true});};row.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();row.onclick();}};}
      var intro=document.createElement('p');intro.textContent='Starting inputs: '+plan.roots.map(function(root){return root.id+(root.game?' (prepared GAME mask)':'');}).join(', ')+'. Tasks: '+plan.tasks.length;intro.setAttribute('data-no-i18n','');summary.appendChild(intro);
      var ordered=document.createElement('ol');ordered.className='chain-task-list';for(var i=0;i<plan.tasks.length;++i){var task=plan.tasks[i],item=document.createElement('li');item.textContent=task.id+' — '+(task.kind==='external-input'?'Prepared external input at checkpoint '+task.stage:task.stage?replayWorkflow[task.image].steps[task.stepIndex].title+(replayWorkflow[task.image].steps[task.stepIndex].executionMode==='adjust'?' — adjust in PixInsight':replayWorkflow[task.image].steps[task.stepIndex].executionMode==='skip'?' — skipped':''):task.kind==='clone'?'Clone from '+task.origin.source+' checkpoint '+task.origin.stage:task.kind==='stars'?'Stars from '+task.origin.source:task.kind==='virtual'?'Channel combination':'Starting image');if(task.stage&&task.kind==='step'){var parameterChanges=(replayWorkflow[task.image].steps[task.stepIndex].executionOriginalStep||replayWorkflow[task.image].steps[task.stepIndex]).parameterChanges||[];if(parameterChanges.length)item.textContent+=' — '+parameterChanges.map(function(change){return change.name+': '+change.original+' → '+change.value;}).join(', ');}item.setAttribute('data-no-i18n','');var taskKeys=[];for(var tk=0;tk<slots.length;++tk)if(slots[tk].image===task.id&&slots[tk].index===task.stepIndex)taskKeys.push(slots[tk].key);linkCards(item,taskKeys);bindPlanMode(item,task);ordered.appendChild(item);}summary.appendChild(ordered);
      for(var i=0;i<plan.errors.length;++i){var error=document.createElement('p');error.style.color='#f38ba8';error.textContent=plan.errors[i];error.setAttribute('data-no-i18n','');if(plan.errorSlots&&plan.errorSlots[i])linkCards(error,[plan.errorSlots[i]]);summary.appendChild(error);}
      for(var warningIndex=0;warningIndex<plan.warnings.length;++warningIndex){var warning=document.createElement('p');warning.style.color='#fab387';warning.textContent=plan.warnings[warningIndex];warning.setAttribute('data-no-i18n','');summary.appendChild(warning);}
      var note=document.createElement('p');note.textContent='Name-based channel suggestions and inferred clone links are proposals. Confirm the selected versions; historical mask pixels are not recovered by a graph link.';summary.appendChild(note);pane.scrollTop=scroll;button.disabled=true;renderEditor();renderChangeHistory();syncTree();if(fileBaseline){baselineSnapshot=JSON.parse(JSON.stringify(state()));fileBaseline=false;}persist();
   }
   function fillImages(select){clear(select);for(var i=0;i<workflow.length;++i)option(select,i,workflow[i].id);}
   function clear(select){while(select.firstChild)select.removeChild(select.firstChild);}
   function renderCopy(){if(!copyStep)return;clear(copyStep);var source=workflow[Number(copyImage.value)]||workflow[0];for(var i=0;i<source.steps.length;++i)option(copyStep,i,source.steps[i].number+' — '+source.steps[i].title);copyStep.value='0';var action=document.getElementById('workflow_copy');action.disabled=!source.steps.length;showExternal();}
   function toggleExternalFields(){var mode=document.getElementById('external_mode');if(!mode)return;var names=['graxpert_correction','graxpert_smoothing','graxpert_model','graxpert_device','graxpert_executable'];for(var i=0;i<names.length;++i)document.getElementById(names[i]).disabled=mode.value!=='graxpert';}
   function showExternal(){var mode=document.getElementById('external_mode');if(!mode||!copyImage||!copyStep)return;var image=workflow[Number(copyImage.value)],step=image&&image.steps[Number(copyStep.value)];if(!step)return;mode.value=step.externalDeclaration||'original';var config=step.graxpertSettings||{};document.getElementById('graxpert_correction').value=config.correction||'Subtraction';document.getElementById('graxpert_smoothing').value=String(config.smoothing===undefined?0.5:config.smoothing);document.getElementById('graxpert_model').value=config.model||'';document.getElementById('graxpert_device').value=config.device||'gpu';document.getElementById('graxpert_executable').value=config.executable||'';toggleExternalFields();}
   function renderEditor(){if(!editorImage)return;var index=Number(editorImage.value)||0,image=workflow[index];if(!image)return;clear(editorSteps);clear(position);
      for(var i=0;i<image.steps.length;++i)(function(index){var step=image.steps[index],row=document.createElement('p'),label=document.createElement('span');label.textContent=step.number+' — '+step.title+(step.copiedFrom?' [copied from '+step.copiedFrom.image+']':'');label.setAttribute('data-no-i18n','');row.appendChild(label);var remove=document.createElement('button');remove.type='button';remove.textContent='Remove step';remove.onclick=function(){edit({type:'remove',image:image.id,index:index});};row.appendChild(remove);var configure=document.createElement('button');configure.type='button';configure.textContent='External / GraXpert';configure.onclick=function(){copyImage.value=String(Number(editorImage.value));renderCopy();copyStep.value=String(index);showExternal();var handling=document.getElementById('external_mode');if(handling&&typeof handling.focus==='function'){handling.focus();if(typeof handling.scrollIntoView==='function')handling.scrollIntoView({block:'center',behavior:'smooth'});}};row.appendChild(configure);if(atlasParameterFields(step).length){var parameters=document.createElement('button');parameters.type='button';parameters.textContent='Parameters'+((step.executionOriginalStep||step).parameterChanges?' · modified':'');parameters.onclick=function(){showParameterEditor(Number(editorImage.value),index);};row.appendChild(parameters);}var modeLabel=document.createElement('label');modeLabel.textContent='Execution';var execution=document.createElement('select'),originalStep=step.executionOriginalStep||step;option(execution,'auto','Automatic — recorded settings');option(execution,'adjust','Adjust in PixInsight');option(execution,'skip','Skip this step');execution.children[1].disabled=originalStep.action!=='process'||!!originalStep.reason||originalStep.tool==='ProcessContainer'||!!originalStep.createsImage;execution.children[2].disabled=!!originalStep.createsImage||['palette','game','external','identifier'].indexOf(originalStep.action)>=0;execution.value=step.executionMode||'auto';execution.setAttribute('aria-label','Execution mode for '+step.title);execution.onchange=function(){edit({type:'execution-mode',image:image.id,index:index,mode:execution.value});};modeLabel.appendChild(execution);row.appendChild(modeLabel);editorSteps.appendChild(row);option(position,index,step.number+' — '+step.title);})(i);
      option(position,image.steps.length,'End of chain');position.value=String(image.steps.length);document.getElementById('workflow_undo').disabled=!operations.length;renderCopy();
   }
   function bindPlanMode(row,task){
      if(task.kind!=='step'||task.stepIndex<0)return;
      var step=replayWorkflow[task.image].steps[task.stepIndex],mode=step.executionMode||'auto',greek=document.documentElement&&document.documentElement.lang==='el';
      row.className+=' chain-plan-step plan-mode-'+mode;
      row.textContent+=' · '+(mode==='adjust'?'Adjust in PixInsight':mode==='skip'?'Skip':'Auto');
      row.setAttribute('role','button');row.setAttribute('tabindex','0');row.setAttribute('aria-haspopup','dialog');row.setAttribute('title',greek?'Αλλαγή τρόπου εκτέλεσης':'Change execution mode');
      row.onclick=function(){showExecutionMode(task);};row.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();row.onclick();}};
   }
   function showExecutionMode(task){
      var image=workflow[task.image],step=image.steps[task.stepIndex],base=step.executionOriginalStep||step,effective=replayWorkflow[task.image].steps[task.stepIndex],greek=document.documentElement&&document.documentElement.lang==='el',previous=document.activeElement,selected=step.executionMode||'auto',current=selected,locked=!!effective.manualDerivedOrigin;
      var dialog=document.createElement('dialog');dialog.id='execution_mode_dialog';dialog.className='delete-step-dialog execution-mode-dialog';dialog.setAttribute('aria-labelledby','execution_mode_title');dialog.setAttribute('data-no-i18n','');
      var title=document.createElement('h2');title.id='execution_mode_title';title.textContent=greek?'Τρόπος εκτέλεσης':'Execution mode';dialog.appendChild(title);
      var description=document.createElement('p');description.textContent=image.id+' — '+step.number+' — '+step.title;dialog.appendChild(description);
      if(locked){var notice=document.createElement('p');notice.textContent=greek?'Η προέλευση αυτού του βήματος καλύπτεται από συνδεδεμένη διεργασία.':'This origin step is already supplied by a connected process.';dialog.appendChild(notice);}
      if(!locked&&atlasParameterFields(step).length){var parameters=document.createElement('button');parameters.type='button';parameters.textContent=greek?'Προσαρμογή παραμέτρων':'Customize parameters';parameters.onclick=function(){close(false);showParameterEditor(task.image,task.stepIndex);};dialog.appendChild(parameters);}
      var choices=[],modes=['auto','adjust','skip'],labels=greek?['Αυτόματα','Αλλαγές στο PixInsight','Παράλειψη']:['Auto','Adjust in PixInsight','Skip'],texts=greek?['Εκτέλεση με τις καταγεγραμμένες ρυθμίσεις.','Παύση του script, εφαρμογή αλλαγών στο PixInsight και επανεκτέλεση για συνέχεια.','Συνέχεια χωρίς εφαρμογή αυτού του βήματος.']:['Run with the recorded settings.','Finish the script, apply changes in PixInsight, then run the same script to resume.','Continue without applying this step.'];
      for(var m=0;m<modes.length;++m)(function(index){var button=document.createElement('button');button.type='button';button.className='execution-mode-choice plan-mode-'+modes[index];button.setAttribute('data-execution-mode',modes[index]);button.setAttribute('aria-pressed',selected===modes[index]?'true':'false');var disabled=locked||(index===1&&(base.action!=='process'||!!base.reason||base.tool==='ProcessContainer'||!!base.createsImage))||(index===2&&(!!base.createsImage||['palette','game','external','identifier'].indexOf(base.action)>=0));button.disabled=disabled;button.textContent=labels[index]+' — '+texts[index]+(disabled?(greek?' Μη διαθέσιμο για αυτόν τον τύπο βήματος.':' Unavailable for this type of step.'):'');button.onclick=function(){selected=modes[index];for(var c=0;c<choices.length;++c)choices[c].setAttribute('aria-pressed',selected===modes[c]?'true':'false');apply.disabled=selected===current;};choices.push(button);dialog.appendChild(button);})(m);
      var actions=document.createElement('div');actions.className='delete-step-actions';var cancel=document.createElement('button'),apply=document.createElement('button');cancel.type=apply.type='button';cancel.textContent=greek?'Ακύρωση':'Cancel';apply.textContent=greek?'Εφαρμογή':'Apply';apply.id='execution_mode_apply';apply.disabled=true;actions.appendChild(cancel);actions.appendChild(apply);dialog.appendChild(actions);
      function close(accepted){if(typeof dialog.close==='function')dialog.close();if(dialog.parentNode)dialog.parentNode.removeChild(dialog);if(previous&&typeof previous.focus==='function')previous.focus();if(accepted)edit({type:'execution-mode',image:image.id,index:task.stepIndex,mode:selected});}
      cancel.onclick=function(){close(false);};apply.onclick=function(){if(!apply.disabled)close(true);};dialog.oncancel=function(event){event.preventDefault();close(false);};dialog.onkeydown=function(event){if(event.key==='Escape'){event.preventDefault();close(false);}};
      document.body.appendChild(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');if(typeof cancel.focus==='function')cancel.focus();
   }
   function showHistogramAdvisor(imageIndex,stepIndex){
      var learning=atlasHistogramLearning(),image=workflow[imageIndex],step=image.steps[stepIndex],base=step.executionOriginalStep||step,record=null,captured=null,greek=document.documentElement.lang==='el',lastReview=null;
      if(typeof atlasReportData!=='undefined')for(var r=0;r<atlasReportData.history.length;++r)if(atlasReportData.history[r].id===image.id){record=atlasReportData.history[r];for(var s=0;s<record.steps.length;++s)if(record.steps[s].anchor===step.anchor)captured=record.steps[s];}
      var supported=!!(captured&&captured.mask&&captured.mask.status==='unrecorded'&&!captured.redo&&!base.mask),originalH=null;try{if(supported)originalH=learning.readMatrix(resolveAtlasReportSource(atlasReportData,captured.source));}catch(error){supported=false;}
      var dialog=document.createElement('dialog');dialog.id='histogram_advisor_dialog';dialog.className='delete-step-dialog';dialog.style.width='min(800px,94vw)';dialog.setAttribute('data-no-i18n','');var title=document.createElement('h2');title.textContent=greek?'Τοπικός βοηθός Histogram':'Local Histogram advisor';dialog.appendChild(title);
      var intro=document.createElement('p');intro.textContent=greek?'1. Κατέβασε τη δοκιμή και τρέξε τη στο PixInsight με τη νέα εικόνα πριν από αυτό το βήμα. 2. Ρύθμισε το αντίγραφο User και τρέξε το ίδιο script ξανά για σύγκριση. 3. Εισήγαγε την αξιολόγηση JSON εδώ και αποθήκευσε το HTML.':'1. Download the trial and run it in PixInsight with the new image before this step. 2. Adjust the User copy and run the SAME script again to compare. 3. Import its evaluation JSON here and save this HTML.';dialog.appendChild(intro);
      var privacy=document.createElement('p');privacy.textContent=greek?'Όλα γίνονται τοπικά. Η μάθηση χρησιμοποιεί στατιστικά και παραμέτρους, όχι αρχεία εικόνων. Οι παλιές επεξεργασίες είναι αρχικά παραδείγματα· οι αξιολογήσεις σου έχουν μεγαλύτερο βάρος. Δεν υπάρχει εγγύηση ότι η πρόταση είναι καλύτερη. Χωρίς παρόμοια παραδείγματα, η πρόταση χρησιμοποιεί τις καταγεγραμμένες τιμές.':'Everything runs locally. Learning uses statistics and parameters, not image files. Old processing trees seed the learner; your evaluations carry more weight. A proposal is not guaranteed to be better. With no similar examples, Suggested uses the recorded values.';dialog.appendChild(privacy);
      var status=document.createElement('p');status.setAttribute('role','status');dialog.appendChild(status);var info=document.createElement('p');dialog.appendChild(info);
      var feedbackLabel=document.createElement('label');feedbackLabel.textContent=greek?'Εισαγωγή αξιολόγησης από το PixInsight (JSON)':'Import PixInsight evaluation (JSON)';var feedbackInput=document.createElement('input');feedbackInput.type='file';feedbackInput.accept='.json';feedbackInput.style.display='block';feedbackInput.style.maxWidth='100%';feedbackLabel.appendChild(feedbackInput);dialog.appendChild(feedbackLabel);
      var advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent=greek?'Τοπικά δεδομένα εκπαίδευσης':'Local training data';advanced.appendChild(summary);dialog.appendChild(advanced);var inputLabel=document.createElement('label');inputLabel.textContent=greek?'Εισαγωγή παλιών HTML, βιβλιοθήκης ή αξιολόγησης JSON':'Import historical HTML reports, library or evaluation JSON';var input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.html,.json';input.style.display='block';input.style.maxWidth='100%';inputLabel.appendChild(input);advanced.appendChild(inputLabel);var exportLibrary=document.createElement('button');exportLibrary.type='button';exportLibrary.textContent=greek?'Εξαγωγή βιβλιοθήκης JSON':'Export learning library JSON';advanced.appendChild(exportLibrary);
      var outcome=document.createElement('select'),apply=document.createElement('button');outcome.setAttribute('aria-label','Accepted Histogram result');apply.type='button';apply.textContent=greek?'Χρήση επιλεγμένου αποτελέσματος σε αυτό το βήμα':'Use accepted result in this step';apply.disabled=true;outcome.hidden=true;dialog.appendChild(outcome);dialog.appendChild(apply);
      var download=document.createElement('button');download.type='button';download.textContent=greek?'Λήψη δοκιμής 3 εκδοχών για PixInsight':'Download three-version PixInsight trial';download.disabled=!supported;var closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent=greek?'Κλείσιμο':'Close';var actions=document.createElement('div');actions.className='delete-step-actions';actions.appendChild(download);actions.appendChild(closeButton);dialog.appendChild(actions);
      function refresh(text){info.textContent=(greek?'Παραδείγματα: ':'Training examples: ')+histogramLearning.examples.length+' · '+(greek?'Αξιολογήσεις: ':'Evaluations: ')+histogramLearning.evaluations.length;if(text)status.textContent=text;else status.textContent=supported?(greek?'Υποστηρίζεται αυτό το καταγεγραμμένο βήμα χωρίς μάσκα.':'This recorded unmasked step is supported.'):(greek?'Η πρώτη έκδοση υποστηρίζει μόνο καταγεγραμμένα HistogramTransformation χωρίς μάσκα και με γνωστή κατάσταση μάσκας.':'This first version supports recorded HistogramTransformation steps with known unmasked state only.');}
      function commit(library,title){histogramLearning=learning.validate(library);window.recordAtlasChange('histogram-learning',title);refresh(title);}
      function saveFile(text,name,type){var blob=new Blob([text],{type:type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url);},1000);}
      function close(){if(typeof dialog.close==='function')dialog.close();if(dialog.parentNode)dialog.parentNode.removeChild(dialog);}
      function selectReview(review){lastReview=review;clear(outcome);for(var i=0;i<review.accepted.length;++i)option(outcome,review.accepted[i],review.accepted[i]);outcome.hidden=!review.accepted.length;apply.disabled=!(supported&&review.accepted.length&&review.context&&review.context.image===image.id&&review.context.anchor===step.anchor&&review.context.sourceHash===learning.hash(originalH));}
      function receive(text){var parsed;if(text.trim().charAt(0)==='<'){var match=new RegExp('<script\\b[^>]*\\bid=["\\x27]apa_report_data["\\x27][^>]*>([\\s\\S]*?)'+String.fromCharCode(60,47)+'script\\s*>','i').exec(text);if(!match)throw Error('This report has no versioned capture data. Create a new report with image statistics.');parsed=JSON.parse(match[1]);}else parsed=JSON.parse(text);
         if(parsed.format==='AstroProcessAtlasReport'){var imported=learning.history(parsed,resolveAtlasReportSource);commit(learning.merge(histogramLearning,imported.examples,[]),'Imported '+imported.examples.length+' historical examples; skipped '+imported.skipped+' masked/missing states.');}
         else if(parsed.format==='AstroProcessAtlasHistogramLibrary'){var library=learning.validate(parsed);commit(learning.merge(histogramLearning,library.examples,library.evaluations),'Imported local learning library.');}
         else if(parsed.format==='AstroProcessAtlasHistogramFeedback'){lastReview=learning.feedback(parsed);commit(learning.merge(histogramLearning,[],[lastReview]),'Imported evaluation; learner updated locally.');selectReview(lastReview);}
         else throw Error('Unsupported local learning file.');
      }
      input.onchange=feedbackInput.onchange=function(){var files=Array.prototype.slice.call(this.files),index=0;function next(){if(index>=files.length)return;var file=files[index++];if(file.size>150*1024*1024){refresh('File exceeds the 150 MB import limit.');return;}var reader=new FileReader;reader.onload=function(){try{receive(String(reader.result));next();}catch(error){refresh(error.message);}};reader.onerror=function(){refresh('Unable to read local file.');};reader.readAsText(file);}next();};
      exportLibrary.onclick=function(){saveFile(JSON.stringify(learning.validate(histogramLearning),null,2),'AstroProcessAtlas_histogram_library.json','application/json');};
      download.onclick=function(){try{var seed=learning.history(atlasReportData,resolveAtlasReportSource),library=learning.merge(histogramLearning,seed.examples,[]);commit(library,'Prepared local Histogram training examples.');var model=learning.train(library),id='trial_'+Date.now()+'_'+Math.floor(Math.random()*1000000000),config={id:id,image:image.id,isColor:record.isColor,context:{image:image.id,anchor:step.anchor,sourceHash:learning.hash(originalH)},recordedH:originalH,userH:learning.readMatrix(base.source),model:model,modelId:learning.hash(model)};saveFile(buildAtlasHistogramExperiment(config),'AstroProcessAtlas_histogram_trial_'+id+'.js','text/javascript');refresh('Trial downloaded. Run it in PixInsight; edit User, then run the SAME file again. Save this HTML to retain the learning library.');}catch(error){refresh(error.message);}};
      apply.onclick=function(){if(apply.disabled||!lastReview)return;for(var i=0;i<lastReview.candidates.length;++i)if(lastReview.candidates[i].name===outcome.value){var H=lastReview.candidates[i].H;close();edit({type:'parameters',image:image.id,index:stepIndex,values:{H:H}});return;}};
      closeButton.onclick=close;dialog.oncancel=function(event){event.preventDefault();close();};document.body.appendChild(dialog);refresh();if(supported)for(var i=histogramLearning.evaluations.length-1;i>=0;--i){var review=histogramLearning.evaluations[i];if(review.context&&review.context.image===image.id&&review.context.anchor===step.anchor&&review.context.sourceHash===learning.hash(originalH)){selectReview(review);break;}}if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
   }

   function showParameterEditor(imageIndex,stepIndex){
      var image=workflow[imageIndex],step=image.steps[stepIndex],fields=atlasParameterFields(step),greek=document.documentElement.lang==='el',dialog=document.createElement('dialog'),inputs={},previous=document.activeElement;dialog.className='delete-step-dialog';dialog.setAttribute('data-no-i18n','');var title=document.createElement('h2');title.textContent=image.id+' — '+step.number+' — '+step.title;dialog.appendChild(title);var note=document.createElement('p');note.textContent=greek?'Οι αλλαγές ισχύουν για το replay. Η αρχική καταγραφή διατηρείται.':'Changes apply to replay. The original recording is retained.';dialog.appendChild(note);
      for(var i=0;i<fields.length;++i){var field=fields[i];if(field.kind){addStructuredField(field);continue;}var label=document.createElement('label'),input=document.createElement('input');label.style.display='block';label.style.margin='12px 0';var names={sigma:['Radius (sigma)','Ακτίνα (sigma)'],amount:['Amount','Ένταση'],useLuminance:['Luminance only','Μόνο φωτεινότητα'],denoise:['Denoise','Αφαίρεση θορύβου'],detail:['Detail','Λεπτομέρεια'],sharpen_stars:['Star sharpening','Όξυνση αστεριών'],sharpen_nonstellar:['Nonstellar sharpening','Όξυνση χωρίς αστέρια'],adjust_halos:['Halo adjustment','Ρύθμιση άλω'],psf_diameter:['PSF diameter','Διάμετρος PSF'],correct_only:['Correct only','Μόνο διόρθωση'],nonstellar_then_stellar:['Nonstellar then stellar','Πρώτα χωρίς αστέρια'],lum_only:['Luminance only','Μόνο φωτεινότητα'],automatic_psf:['Automatic PSF','Αυτόματο PSF']};label.textContent=(names[field.name]?names[field.name][greek?1:0]:field.name)+' ('+(greek?'Αρχική: ':'Recorded: ')+field.original+') ';input.type=field.range.length?'number':'checkbox';if(field.range.length){input.min=field.range[0];input.max=field.range[1];input.step='any';input.value=String(field.value);}else input.checked=field.value;input.setAttribute('aria-label',field.name);inputs[field.name]=input;label.appendChild(input);dialog.appendChild(label);}
      function addStructuredField(field){
         dialog.style.width='min(900px, 94vw)';dialog.style.maxWidth='94vw';var section=document.createElement('details');section.open=field.name==='H'||field.name==='K';var heading=document.createElement('summary');heading.textContent=(field.curve?'Curve ':'')+field.name;section.appendChild(heading);dialog.appendChild(section);
         if(field.kind==='choice'){var select=document.createElement('select');for(var i=0;i<field.choices.length;++i)option(select,field.choices[i],field.choices[i]);select.value=field.value;section.appendChild(select);inputs[field.name]={read:function(){return select.value;}};return;}
         var rows=JSON.parse(JSON.stringify(field.value)),table=document.createElement('table'),error=document.createElement('p'),chart=document.createElement('div'),scroll=document.createElement('div');error.setAttribute('role','alert');section.appendChild(chart);scroll.style.overflowX='auto';scroll.appendChild(table);section.appendChild(scroll);section.appendChild(error);table.style.width='100%';var headers=field.curve?['Input X','Output Y']:['Shadows','Midtones','Highlights','Range low','Range high'];
         function paint(){while(table.firstChild)table.removeChild(table.firstChild);var header=document.createElement('tr');if(!field.curve){var channel=document.createElement('th');channel.textContent='Channel';header.appendChild(channel);}for(var i=0;i<headers.length;++i){var th=document.createElement('th');th.textContent=headers[i];header.appendChild(th);}if(field.curve){var empty=document.createElement('th');empty.textContent='';header.appendChild(empty);}table.appendChild(header);
            for(var r=0;r<rows.length;++r)(function(index){var row=document.createElement('tr');if(!field.curve){var label=document.createElement('th');label.textContent=['R','G','B','RGB/K','Alpha'][index];row.appendChild(label);}for(var c=0;c<headers.length;++c)(function(column){var cell=document.createElement('td'),input=document.createElement('input');input.type='number';input.step='any';input.value=String(rows[index][column]);input.style.width='100%';input.style.minWidth='65px';input.style.boxSizing='border-box';input.setAttribute('aria-label',field.name+' '+index+' '+headers[column]);if(field.curve||column<3){input.min='0';input.max='1';}if(field.curve&&column===0&&(index===0||index===rows.length-1))input.disabled=true;input.oninput=function(){rows[index][column]=input.value.trim()===''?null:Number(input.value);preview();};cell.appendChild(input);row.appendChild(cell);})(c);if(field.curve&&index>0&&index<rows.length-1){var cell=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.textContent='−';remove.setAttribute('aria-label','Remove point '+index);remove.onclick=function(){rows.splice(index,1);paint();};cell.appendChild(remove);row.appendChild(cell);}else if(field.curve)row.appendChild(document.createElement('td'));table.appendChild(row);})(r);preview();
         }
         function preview(){try{atlasParameterLiteral(field,rows);error.textContent='';if(field.curve){var points=rows.map(function(point){return (point[0]*240)+','+(240-point[1]*240);}).join(' ');chart.innerHTML='<svg viewBox="0 0 240 240" style="width:240px;max-width:100%;background:#11111b" aria-label="Control point outline"><path d="M0 240L240 0" stroke="#6c7086"/><polyline points="'+points+'" fill="none" stroke="#89b4fa" stroke-width="2"/></svg>';}}catch(problem){error.textContent=problem.message;chart.innerHTML='';}}
         if(field.curve){var help=document.createElement('p');help.textContent=greek?'Τα X πρέπει να αυξάνονται. Το διάγραμμα ενώνει τα σημεία, δεν προσομοιώνει την παρεμβολή ή την εικόνα.':'Use increasing X coordinates. The outline joins control points; it does not preview interpolation or image pixels.';section.appendChild(help);var add=document.createElement('button');add.type='button';add.textContent=greek?'Προσθήκη σημείου':'Add point';add.onclick=function(){if(rows.length>=512)return;var gap=0;for(var i=1;i<rows.length-1;++i)if(rows[i+1][0]-rows[i][0]>rows[gap+1][0]-rows[gap][0])gap=i;rows.splice(gap+1,0,[(rows[gap][0]+rows[gap+1][0])/2,(rows[gap][1]+rows[gap+1][1])/2]);paint();};section.appendChild(add);}inputs[field.name]={read:function(){atlasParameterLiteral(field,rows);return rows;}};paint();
      }
      if((step.executionOriginalStep||step).tool==='HistogramTransformation'){var advisor=document.createElement('button');advisor.type='button';advisor.textContent=greek?'Σύγκριση 3 εκδοχών και τοπική μάθηση':'Compare three versions and learn locally';advisor.onclick=function(){close();showHistogramAdvisor(imageIndex,stepIndex);};dialog.appendChild(advisor);}
      var actions=document.createElement('div');actions.className='delete-step-actions';var cancel=document.createElement('button'),reset=document.createElement('button'),apply=document.createElement('button');cancel.textContent=greek?'Ακύρωση':'Cancel';reset.textContent=greek?'Επαναφορά καταγεγραμμένων τιμών':'Restore recorded values';apply.textContent=greek?'Εφαρμογή':'Apply';actions.style.position='sticky';actions.style.bottom='0';actions.style.background='#181825';actions.style.padding='8px 0';actions.style.zIndex='1';reset.disabled=!(step.executionOriginalStep||step).parameterChanges;actions.appendChild(cancel);actions.appendChild(reset);actions.appendChild(apply);dialog.appendChild(actions);
      function close(){if(typeof dialog.close==='function')dialog.close();dialog.parentNode.removeChild(dialog);if(previous&&previous.focus)previous.focus();}
      cancel.onclick=close;dialog.oncancel=function(event){event.preventDefault();close();};reset.onclick=function(){close();edit({type:'reset-parameters',image:image.id,index:stepIndex});};apply.onclick=function(){var values={},changed=false;for(var i=0;i<fields.length;++i){var field=fields[i],input=inputs[field.name];if(field.kind){try{values[field.name]=input.read();}catch(error){window.alert(error.message);return;}if(JSON.stringify(values[field.name])!==JSON.stringify(field.value))changed=true;continue;}if(field.range.length&&(input.value.trim()===''||!input.checkValidity())){input.reportValidity();return;}values[field.name]=field.range.length?Number(input.value):input.checked;if(values[field.name]!==field.value)changed=true;}close();if(changed)edit({type:'parameters',image:image.id,index:stepIndex,values:values});};document.body.appendChild(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
   }
   function showDeleteConfirmation(operation){
      if(document.getElementById('delete_step_dialog'))return;
      var greek=document.documentElement&&document.documentElement.lang==='el',image=null;for(var i=0;i<workflow.length;++i)if(workflow[i].id===operation.image)image=workflow[i];var step=image&&image.steps[operation.index],previous=document.activeElement;
      var dialog=document.createElement('dialog');dialog.id='delete_step_dialog';dialog.className='delete-step-dialog';dialog.setAttribute('aria-labelledby','delete_step_title');dialog.setAttribute('aria-describedby','delete_step_description');dialog.setAttribute('data-no-i18n','');
      var heading=document.createElement('h2');heading.id='delete_step_title';heading.textContent=greek?'Διαγραφή βήματος;':'Delete step?';dialog.appendChild(heading);
      var explanation=document.createElement('p');explanation.id='delete_step_description';explanation.textContent=greek?'Το βήμα θα αφαιρεθεί από το δέντρο, τις λεπτομέρειες και το replay. Μπορείς να αναιρέσεις την αλλαγή πριν αποθηκεύσεις.':'This step will be removed from the tree, details and replay. You can undo the change before saving.';dialog.appendChild(explanation);
      var list=document.createElement('dl');dialog.appendChild(list);function field(label,value){var name=document.createElement('dt'),text=document.createElement('dd');name.textContent=label;text.textContent=String(value||'—');list.appendChild(name);list.appendChild(text);}
      field(greek?'Εικόνα':'Image',operation.image);field(greek?'Βήμα':'Step',step?step.number+' — '+step.title:operation.title||operation.node);if(step){field(greek?'Εργαλείο':'Tool',step.tool);if(step.time)field(greek?'Χρόνος':'Time',step.time);field(greek?'Μάσκα':'Mask',step.mask?step.mask.name+(typeof step.mask.inverted==='boolean'?(step.mask.inverted?' (inverted)':' (normal)'):''):greek?'Δεν έχει καταγραφεί':'Not recorded');if(step.inputs&&step.inputs.length)field(greek?'Είσοδοι':'Inputs',step.inputs.join(', '));if(step.copiedFrom)field(greek?'Αντιγραφή από':'Copied from',step.copiedFrom.image);if(step.source){var details=document.createElement('details'),summary=document.createElement('summary'),code=document.createElement('pre');summary.textContent=greek?'Παράμετροι / κώδικας':'Parameters / code';code.textContent=step.source;details.appendChild(summary);details.appendChild(code);dialog.appendChild(details);}}
      var actions=document.createElement('div');actions.className='delete-step-actions';var cancel=document.createElement('button'),remove=document.createElement('button');cancel.type=remove.type='button';cancel.textContent=greek?'Ακύρωση':'Cancel';remove.textContent=greek?'Διαγραφή βήματος':'Delete step';cancel.id='delete_step_cancel';remove.id='delete_step_confirm';remove.className='delete-step-confirm';actions.appendChild(cancel);actions.appendChild(remove);dialog.appendChild(actions);
      function close(accepted){if(typeof dialog.close==='function')dialog.close();if(dialog.parentNode)dialog.parentNode.removeChild(dialog);if(previous&&typeof previous.focus==='function')previous.focus();if(accepted)edit(operation,true);}
      cancel.onclick=function(){close(false);};remove.onclick=function(){close(true);};dialog.oncancel=function(event){event.preventDefault();close(false);};dialog.onclick=function(event){if(event.target===dialog&&event.clientX!==undefined&&typeof dialog.getBoundingClientRect==='function'){var rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close(false);}};
      dialog.onkeydown=function(event){if(event.key==='Escape'){event.preventDefault();close(false);}else if(event.key==='Tab'){var items=dialog.querySelectorAll('button,summary'),first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.body.appendChild(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');if(typeof cancel.focus==='function')cancel.focus();
   }
   function edit(operation,confirmed){try{if(operation.index!==undefined&&workflow.filter(function(image){return image.id===operation.image;})[0].steps[operation.index])operation.title=workflow.filter(function(image){return image.id===operation.image;})[0].steps[operation.index].title;if((operation.type==='remove'||operation.type==='remove-node')&&!confirmed){showDeleteConfirmation(operation);return;}operation.time=(new Date()).toISOString();var next=editReplayWorkflow(workflow,bindings,operation);workflow=next.data;bindings=next.bindings;operations.push(operation);slots=chainReferenceSlots(workflow);audit.push({time:(new Date()).toISOString(),type:operation.type,image:operation.image,to:operation.to||operation.image,position:operation.at===undefined?operation.index:operation.at,title:operation.title||operation.node||operation.index});draw();var greek=document.documentElement&&document.documentElement.lang==='el';notify(operation.type==='copy'?(greek?'Αντιγράφηκε: ':'Copied: ')+operation.title+' · '+operation.image+' → '+operation.to:operation.type==='remove'||operation.type==='remove-node'?(greek?'Διαγράφηκε: ':'Deleted: ')+operation.title:(greek?'Ενημερώθηκε: ':'Updated: ')+operation.title);}catch(error){message(error.message);notify(error.message);}}
   if(editorImage){fillImages(editorImage);fillImages(copyImage);editorImage.value=String(Number(target.value)||0);copyImage.value=editorImage.value;editorImage.onchange=function(){copyImage.value=editorImage.value;renderCopy();renderEditor();};copyImage.onchange=renderCopy;copyStep.onchange=showExternal;var applyExternal=document.getElementById('external_apply');if(applyExternal)document.getElementById('external_mode').onchange=toggleExternalFields;if(applyExternal)applyExternal.onclick=function(){edit({type:'external',image:workflow[Number(copyImage.value)].id,index:Number(copyStep.value),mode:document.getElementById('external_mode').value,settings:{correction:document.getElementById('graxpert_correction').value,smoothing:Number(document.getElementById('graxpert_smoothing').value),model:document.getElementById('graxpert_model').value.trim(),device:document.getElementById('graxpert_device').value,executable:document.getElementById('graxpert_executable').value.trim()}});};
      document.getElementById('workflow_copy').onclick=function(){edit({type:'copy',image:workflow[Number(copyImage.value)].id,index:Number(copyStep.value),to:workflow[Number(editorImage.value)].id,at:Number(position.value)});};
      document.getElementById('workflow_undo').onclick=function(){if(!operations.length)return;var saved=state();saved.operations=saved.operations.slice(0,-1);delete saved.bindings;var restored=restoreReplayWorkflow(original,saved);workflow=restored.data;bindings=restored.bindings;operations=restored.operations;slots=chainReferenceSlots(workflow);audit.push({time:(new Date()).toISOString(),type:'undo',title:'Undo last edit'});draw();};
      window.saveAtlasReport=document.getElementById('workflow_save').onclick=function(){if(!isDirty())return;try{audit.push({time:(new Date()).toISOString(),type:'save',title:'Save report (HTML)'});renderChangeHistory();var language=document.documentElement.lang;if(typeof window.setReportLanguage==='function')window.setReportLanguage('en');var root=document.documentElement.cloneNode(true);if(typeof window.setReportLanguage==='function')window.setReportLanguage(language);var transientNotice=root.querySelector('#atlas_notification');if(transientNotice&&transientNotice.parentNode)transientNotice.parentNode.removeChild(transientNotice);var transientAdvisor=root.querySelector('#histogram_advisor_dialog');if(transientAdvisor&&transientAdvisor.parentNode)transientAdvisor.parentNode.removeChild(transientAdvisor);var transientPrint=root.querySelector('#apa_print_options');if(transientPrint&&transientPrint.parentNode)transientPrint.parentNode.removeChild(transientPrint);var body=root.querySelector('body'),old=root.querySelector('#apa_workflow_state');if(old)old.parentNode.removeChild(old);var payload=root.querySelector('#apa_report_data');if(payload&&typeof atlasReportData!=='undefined'){payload.textContent=atlasReportDataJSON(atlasReportWithProject(atlasReportData,state()));}else{var saved=document.createElement('script');saved.id='apa_workflow_state';saved.type='application/json';saved.textContent=workflowStateJSON(state());var firstScript=root.querySelector('script');if(firstScript&&firstScript.parentNode)firstScript.parentNode.insertBefore(saved,firstScript);else body.appendChild(saved);}if(typeof reportEmbeddedAssets!=='undefined'&&root.querySelectorAll){var compact={};for(var key in reportEmbeddedAssets)if(Object.prototype.hasOwnProperty.call(reportEmbeddedAssets,key))compact[reportEmbeddedAssets[key]]=key;var assets=root.querySelectorAll('[src],[href],[data-before],[data-after]'),attributes=['src','href','data-before','data-after'];for(var ai=0;ai<assets.length;++ai)for(var aj=0;aj<attributes.length;++aj){var value=assets[ai].getAttribute(attributes[aj]);if(value&&compact[value])assets[ai].setAttribute(attributes[aj],compact[value]);}}var dynamic=['chain_bindings','chain_plan','workflow_steps','workflow_history','comparison_content'];for(var i=0;i<dynamic.length;++i){var pane=root.querySelector('#'+dynamic[i]);if(pane)while(pane.firstChild)pane.removeChild(pane.firstChild);}var checked=root.querySelector('#chain_confirm');if(checked)checked.removeAttribute('checked');var blob=new Blob(['<!DOCTYPE html>\n'+root.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='AstroProcessAtlas_edited.html';document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url);},1000);baselineSnapshot=JSON.parse(JSON.stringify(state()));persist();message('Edited report downloaded. Open that HTML to restore the workflow and connections.');notify(document.documentElement&&document.documentElement.lang==='el'?'Το ενημερωμένο HTML αποθηκεύτηκε στις λήψεις.':'Updated HTML saved to downloads.');}catch(error){message('Save: '+error.message);}};
   }
   function renderChangeHistory(){var history=document.getElementById('workflow_history');if(!history)return;clear(history);for(var i=0;i<audit.length;++i){var item=document.createElement('li'),entry=audit[i];item.textContent=(entry.time||'')+' — '+entry.type+' — '+(entry.image||'')+(entry.to&&entry.to!==entry.image?' → '+entry.to:'')+' — '+(entry.title||'')+(typeof entry.position==='number'?' @ '+(entry.position+1):'');item.setAttribute('data-no-i18n','');history.appendChild(item);}}
   window.recordAtlasChange=function(type,title){audit.push({time:(new Date()).toISOString(),type:type,title:String(title).slice(0,512)});if(type==='connection-add'||type==='connections-clear')draw();else{renderChangeHistory();persist();}};
   window.editAtlasTreeNode=function(id){var mode=document.getElementById('tree_edit_mode');if(!mode||!mode.checked||!baseGraph)return;for(var i=0;i<workflow.length;++i)for(var j=0;j<workflow[i].steps.length;++j)if(workflow[i].steps[j].anchor===id){edit({type:'remove',image:workflow[i].id,index:j});return;}for(var n=0;n<baseGraph.nodes.length;++n)if(baseGraph.nodes[n].id===id&&!baseGraph.nodes[n].header){edit({type:'remove-node',image:baseGraph.nodes[n].image,node:id,title:baseGraph.nodes[n].label});return;}};
   function syncTree(){var svg=document.getElementById('workspace_graph');if(!baseGraph||!svg||!svg.querySelectorAll)return;projectedGraph=editedWorkspaceGraph(baseGraph,workflow,original,bindings,operations);var badges={},groups=svg.querySelectorAll('a[data-node]');for(var n=0;n<groups.length;++n){var badge=groups[n].querySelector('circle');if(badge)badges['$'+groups[n].getAttribute('data-node')]=badge.cloneNode(true);}for(var i=0;i<groups.length;++i){var id=groups[i].getAttribute('data-node'),header=false;for(var n=0;n<baseGraph.nodes.length;++n)if(baseGraph.nodes[n].id===id)header=baseGraph.nodes[n].header;if(!header)groups[i].parentNode.removeChild(groups[i]);}
      var edgeGroup=document.getElementById('graph_edges');if(edgeGroup)clear(edgeGroup);var ns='http:\u002f\u002fwww.w3.org/2000/svg';function node(tag,attrs,parent){var item=document.createElementNS(ns,tag);for(var key in attrs)item.setAttribute(key,attrs[key]);if(parent)parent.appendChild(item);return item;}var lookup={},height=170;
      for(var i=0;i<projectedGraph.nodes.length;++i){var entry=projectedGraph.nodes[i];lookup['$'+entry.id]=entry;height=Math.max(height,entry.y+110);if(entry.header)continue;(function(entry){var link=node('a',{'data-node':entry.id,href:'#'+entry.id},svg),group=node('g',{'data-node':entry.id,class:'graph-node'+(entry.redo?' redo-node':'')},link);link.onpointerdown=function(event){if(event.target.closest&&event.target.closest('.tree-delete'))return;window.beginComparisonDrag(event,entry.id);};link.onclick=function(event){window.selectGraphNode(entry.id,event);};group.onmouseenter=function(){window.focusGraphImage(entry.id);};group.onmouseleave=window.clearGraphFocus;node('rect',{x:entry.x,y:entry.y,width:250,height:72,rx:8},group);var text=node('text',{x:entry.x+10,y:entry.y+26,'data-no-i18n':''},group);text.textContent=entry.label.length>28?entry.label.slice(0,25)+'…':entry.label;var small=node('text',{x:entry.x+10,y:entry.y+50,class:'graph-small'},group);small.textContent=entry.executionMode==='adjust'?'Adjust in PixInsight':entry.executionMode==='skip'?'Skip this step':entry.parameterChanges&&entry.parameterChanges.length?'Modified parameters':entry.edited?'Copied / edited step':entry.redo?'Redo — not applied':entry.phase==='initial'?'Inherited / initial history':'Processing step';if(badges['$'+entry.id]){var badge=badges['$'+entry.id];badge.setAttribute('cx',entry.x+235);badge.setAttribute('cy',entry.y+54);group.appendChild(badge);}var remove=node('g',{class:'tree-delete',role:'button',tabindex:0,'aria-label':'Remove step'},group);node('rect',{x:entry.x+225,y:entry.y+6,width:20,height:20,rx:4,style:'fill:#f38ba822;stroke:#f38ba8'},remove);var mark=node('text',{x:entry.x+235,y:entry.y+16,'text-anchor':'middle','dominant-baseline':'central',style:'fill:#f38ba8;font-size:18px;pointer-events:none'},remove);mark.textContent='×';remove.onpointerdown=function(event){event.stopPropagation();};remove.onclick=function(event){event.preventDefault();event.stopPropagation();window.editAtlasTreeNode(entry.id);};remove.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();window.editAtlasTreeNode(entry.id);}};})(entry);}
      for(var e=0;e<projectedGraph.edges.length;++e){var edge=projectedGraph.edges[e],a=lookup['$'+edge.from],b=lookup['$'+edge.to];if(!a||!b||!edgeGroup)continue;var ax=a.x+125,ay=a.y+72,bx=b.x+125,by=b.y;var d='M'+ax+','+ay+' C'+ax+','+(ay+25)+' '+bx+','+(by-25)+' '+bx+','+by;if(edge.kind!=='sequence'){ax=a.x+250;ay=a.y+36;bx=b.x;by=b.y+36;var direction=1;if(a.x>b.x){ax=a.x;bx=b.x+250;direction=-1;}if(a.x===b.x)bx=b.x+250;var bend=Math.max(45,Math.abs(bx-ax)/2);d='M'+ax+','+ay+' C'+(ax+direction*bend)+','+ay+' '+(bx+(a.x===b.x?bend:-direction*bend))+','+by+' '+bx+','+by;}var path=node('path',{'data-from':edge.from,'data-to':edge.to,'data-provenance':edge.provenance,class:'edge edge-'+edge.kind,d:d,'marker-end':'url(#arrow)'},edgeGroup);(function(index,path){path.onclick=function(event){window.showConnection(event,'history',index);};})(e,path);}
      var box=svg.getAttribute('viewBox').split(/\s+/);svg.setAttribute('viewBox','0 0 '+box[2]+' '+height);
      var copies=document.querySelectorAll('[data-workflow-copy]');for(var c=0;c<copies.length;++c)copies[c].parentNode.removeChild(copies[c]);
      var oldParameterNotes=document.querySelectorAll('[data-parameter-note]');for(var pn=0;pn<oldParameterNotes.length;++pn)oldParameterNotes[pn].parentNode.removeChild(oldParameterNotes[pn]);
      for(var i=0;i<workflow.length;++i)for(var j=0;j<workflow[i].steps.length;++j){var step=workflow[i].steps[j],card=document.getElementById(step.anchor);if(step.edited){var section=document.getElementById(workflow[i].anchor);if(!section)continue;card=document.createElement('div');card.id=step.anchor;card.className='step-group';card.setAttribute('data-workflow-copy','');var title=document.createElement('h3');title.textContent=(j+1)+'. '+step.title+(step.copiedFrom?' — copied from '+step.copiedFrom.image:' — user-declared external processing');title.setAttribute('data-no-i18n','');card.appendChild(title);var note=document.createElement('p');note.textContent='User-added step. No historical preview is available for this new position.';card.appendChild(note);var code=document.createElement('textarea');code.readOnly=true;code.value=step.source||(step.action==='external'?'Choose the completed external image at this checkpoint. Earlier branch steps are not repeated.':'');code.textContent=code.value;code.style.width='100%';code.rows=8;card.appendChild(code);section.appendChild(card);}else if(card){var stepNumberLabel=card.querySelector('.step-num');if(stepNumberLabel)stepNumberLabel.textContent='Step '+(j+1)+' of '+workflow[i].steps.length;}if(card){var changes=(step.executionOriginalStep||step).parameterChanges||[];updateAtlasParameterColumns(card,changes,document);var destination=document.getElementById(workflow[i].anchor);if(destination)destination.appendChild(card);}}
      for(var n=0;n<projectedGraph.nodes.length;++n){var entry=projectedGraph.nodes[n];if(entry.header)continue;var card=document.getElementById(entry.id),section=null;for(var r=0;r<workflow.length;++r)if(workflow[r].id===entry.image)section=document.getElementById(workflow[r].anchor);if(card&&section)section.appendChild(card);}
      if(document.querySelectorAll){var rows=document.querySelectorAll('.processing-summary table tbody tr'),inputs={},masks={},tools={},combinations=[];for(var r=0;r<workflow.length;++r)for(var j=0;j<workflow[r].steps.length;++j){var step=workflow[r].steps[j];for(var k=0;k<(step.inputs||[]).length;++k){var binding=bindings[chainSlotKey(workflow[r].id,j,'input',step.inputs[k])];if(binding&&binding.source&&binding.source!==workflow[r].id)inputs['$'+binding.source]=binding.source;}if(step.mask){var binding=bindings[chainSlotKey(workflow[r].id,j,'mask',step.mask.name)];masks['$'+(binding&&binding.source||step.mask.name)]=binding&&binding.source||step.mask.name;}if(step.action==='palette'||step.action==='pixelmath'||/Combination$/.test(step.tool))combinations.push(workflow[r].id+' — '+step.title);}for(var n=0;n<projectedGraph.nodes.length;++n){var entry=projectedGraph.nodes[n];if(!entry.header&&!entry.redo)tools['$'+entry.tool]=(tools['$'+entry.tool]||0)+1;}var values=function(map){var result=[];for(var key in map)result.push(map[key]);return result.sort();};var names=[];for(var key in tools)names.push(key.slice(1)+' × '+tools[key]);var replacements={2:values(inputs).join(', '),3:combinations.join('\n'),4:values(masks).join(', '),5:names.sort().join(', ')};for(var index in replacements)if(rows[index]){var cells=rows[index].querySelectorAll('td');if(cells[1])cells[1].textContent=replacements[index]||'—';}}
      var notice=document.getElementById('tree_edit_notice');if(notice)notice.hidden=!operations.length;function updateProcessCount(id,value){var box=document.getElementById(id);if(!box)return;clear(box);var label=document.createElement('b');label.textContent='Total Process Steps:';box.appendChild(label);box.appendChild(document.createTextNode(' '+value));}updateProcessCount('report_process_count',projectedGraph.nodes.filter(function(node){return !node.header;}).length);for(var i=0;i<workflow.length;++i)updateProcessCount(workflow[i].anchor+'_process_count',projectedGraph.nodes.filter(function(node){return !node.header&&node.image===workflow[i].id;}).length);if(typeof window.replaceAtlasGraph==='function')window.replaceAtlasGraph(projectedGraph);
   }
   var insertion=null,line=null;
   function clearInsertion(){if(line&&line.parentNode)line.parentNode.removeChild(line);line=null;insertion=null;}
   window.previewTreeInsertion=function(event,id){var mode=document.getElementById('tree_edit_mode');if(!mode||!mode.checked)return false;clearInsertion();var svg=document.getElementById('workspace_graph');if(!svg||!projectedGraph)return true;if(document.elementFromPoint){var hit=document.elementFromPoint(event.clientX,event.clientY);if(!hit||!hit.closest||!hit.closest('#workspace_graph'))return true;}if(hit){var tile=hit.closest('[data-node]');if(tile){var targetId=tile.getAttribute('data-node'),targetNode=null,sourceNode=null;for(var ni=0;ni<projectedGraph.nodes.length;++ni){if(projectedGraph.nodes[ni].id===targetId)targetNode=projectedGraph.nodes[ni];if(projectedGraph.nodes[ni].id===id)sourceNode=projectedGraph.nodes[ni];}if(targetNode&&sourceNode){if(targetId===id)return true;insertion={type:'connection',from:id,to:targetId};line=document.createElementNS('http:\u002f\u002fwww.w3.org/2000/svg','rect');line.setAttribute('class','tree-connection-target');line.setAttribute('x',targetNode.x-3);line.setAttribute('y',targetNode.y-3);line.setAttribute('width',256);line.setAttribute('height',78);line.setAttribute('rx',10);line.setAttribute('style','fill:none;stroke:#cba6f7;stroke-width:4;stroke-dasharray:5 3;pointer-events:none');svg.appendChild(line);return true;}}}var source=null;for(var i=0;i<workflow.length;++i)for(var j=0;j<workflow[i].steps.length;++j)if(workflow[i].steps[j].anchor===id)source={image:workflow[i].id,index:j};if(!source)return true;var point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;point=point.matrixTransform(svg.getScreenCTM().inverse());if(point.y<0||point.y>Number(svg.getAttribute('viewBox').split(/\s+/)[3]))return true;var destination=null;for(var i=0;i<projectedGraph.nodes.length;++i){var header=projectedGraph.nodes[i];if(header.header&&point.x>=header.x-12&&point.x<=header.x+262)destination=header;}if(!destination)return true;var image=null;for(var i=0;i<workflow.length;++i)if(workflow[i].id===destination.image)image=workflow[i];if(!image)return true;var at=image.steps.length,y=destination.y+100;for(var i=0;i<projectedGraph.nodes.length;++i){var entry=projectedGraph.nodes[i];if(entry.image!==destination.image||entry.header)continue;if(typeof entry.workflowIndex==='number'&&point.y<entry.y+36){at=entry.workflowIndex;y=entry.y-16;break;}y=entry.y+88;}insertion={type:'copy',image:source.image,index:source.index,to:destination.image,at:at};line=document.createElementNS('http:\u002f\u002fwww.w3.org/2000/svg','line');line.setAttribute('class','tree-insertion-line');line.setAttribute('x1',destination.x);line.setAttribute('x2',destination.x+250);line.setAttribute('y1',y);line.setAttribute('y2',y);line.setAttribute('style','stroke:#fab387;stroke-width:5;pointer-events:none');svg.appendChild(line);return true;};
   window.finishTreeInsertion=function(event,id){var mode=document.getElementById('tree_edit_mode');if(!mode||!mode.checked)return false;window.previewTreeInsertion(event,id);var operation=insertion;clearInsertion();if(operation){if(operation.type==='connection'){if(typeof window.addManualConnection==='function'&&window.addManualConnection(operation.from,operation.to)){notify(document.documentElement&&document.documentElement.lang==='el'?'Προστέθηκε χειροκίνητη σύνδεση.':'Manual connection added.');}}else edit(operation);}return true;};window.clearTreeInsertion=clearInsertion;
   window.resetAtlasChanges=function(){if(!isDirty())return;var greek=document.documentElement&&document.documentElement.lang==='el';if(typeof window.confirm!=='function'||!window.confirm(greek?'Να απορριφθούν οι μη αποθηκευμένες αλλαγές;':'Discard changes since the last saved report?'))return;try{var restored=restoreReplayWorkflow(original,baselineSnapshot);workflow=restored.data;bindings=restored.bindings;operations=restored.operations;startingInputs=restored.startingInputs;histogramLearning=baselineSnapshot.histogramLearning?atlasHistogramLearning().validate(baselineSnapshot.histogramLearning):atlasHistogramLearning().empty();target.value=String(restored.target);audit=JSON.parse(JSON.stringify(baselineSnapshot.audit||[]));slots=chainReferenceSlots(workflow);if(typeof window.restoreAtlasAnnotations==='function')window.restoreAtlasAnnotations(baselineSnapshot.annotations);draw();message('Restored the last saved report state.');}catch(error){message('Reset: '+error.message);}};
   function syncTreeEditMode(){var mode=document.getElementById('tree_edit_mode'),frame=document.getElementById('graph_scroll'),help=document.getElementById('tree_edit_help'),enabled=!!(mode&&mode.checked);if(frame)frame.className=frame.className.replace(/ tree-editing/g,'')+(enabled?' tree-editing':'');if(help)help.hidden=!enabled;if(!enabled)clearInsertion();}
   var editMode=document.getElementById('tree_edit_mode');if(editMode)editMode.onchange=syncTreeEditMode;syncTreeEditMode();
   target.onchange=draw;confirm.onchange=function(){button.disabled=!confirm.checked||!plan||plan.errors.length>0;};
   button.onclick=function(){if(!confirm.checked||!plan||plan.errors.length)return;var code=buildWorkspaceChainScript(replayWorkflow,plan),blob=new Blob([code],{type:'text/javascript;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='AstroProcessAtlas_chain_'+plan.targetId.replace(/[^A-Za-z0-9_-]/g,'_')+'.js';document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url);},1000);};draw();notificationsReady=true;
}

function workspaceReplayHTML(records) {
   var html = '<style>#replay_readiness li{padding:8px 12px;margin:6px 0;border-left:4px solid;border-radius:4px;overflow-wrap:anywhere}#replay_readiness .replay-supported{color:#a6e3a1;background:#a6e3a112;border-color:#a6e3a1}#replay_readiness .replay-warning{color:#fab387;background:#fab38712;border-color:#fab387}#replay_readiness .replay-unsupported{color:#f38ba8;background:#f38ba812;border-color:#f38ba8}#replay_export:disabled{opacity:.45;cursor:not-allowed}</style><details id="replay_single_panel" class="replay-workflow replay-panel"><summary>Export workflow for replay</summary><h2>Export workflow for replay</h2>' +
      '<p>Select an image and a consecutive range of applied processes. Run the downloaded .js in PixInsight with an input in the state BEFORE the first selected step. Replay checks all selected tools and asks for reference images and masks before processing a new copy. A final replay report can be saved as text; historical reference images are not restored.</p>' +
      '<p>Copy naming: the last ImageIdentifier in the selected range, or the selected input name, followed by _APA_replay. Existing names receive a numeric suffix.</p>' +
      '<p>Preflight checks availability and dimensions. Licenses, AI models and manual script settings may still require checks during execution.</p>' +
      '<p>GAME: start the range at this step and select the completed original grayscale mask. Replay copies that mask and applies subsequent steps; it does not recreate the GAME drawing.</p>' +
      '<p>PixelMath: select reference images when prompted in PixInsight. Use their original processing state. The recorded expressions and settings are preserved; a new-image result becomes the target for following steps.</p>' +
      '<p>SelectiveColorCorrection includes the installed Toolbox source in the replay file and supplies the recorded parameters directly. Keep that installed source available at the exported include path.</p>' +
      '<p>PerfectPalettePicker: start the range at this step, select grayscale inputs and explicitly choose their state: already prepared, or linear with input stretch to median 0.25. Replays the recorded combination into a new RGB image. Other unrecorded channel preparation is not reconstructed.</p>' +
      '<label>Replay image <select id="replay_image" onchange="updateReplayRange(true)">';
   for (var i = 0; i < records.length; ++i)
      html += '<option value="' + i + '" data-no-i18n>' + escapeHTML(records[i].id) + '</option>';
   return html + '</select></label> <label>First process <select id="replay_start" onchange="updateReplayRange(false)"></select></label> ' +
      '<label>Last process <select id="replay_end" onchange="updateReplayRange(false)"></select></label>' +
      '<p id="replay_status" data-no-i18n aria-live="polite"></p><ol id="replay_readiness" data-no-i18n style="list-style:none;padding-left:0"></ol>' +
      '<button id="replay_export" type="button" disabled onclick="exportReplayScript()">Download PixInsight replay script</button></details>';
}

function replayStepHTML(record, step) {
   if (step.componentOf) return '<p class="thumb-note">Grouped component; excluded from workflow replay. <span data-no-i18n>' + escapeHTML(step.componentOf) + '</span></p>';
   if (isImageOriginStep(step, record.steps.indexOf(step)))
      return '<p class="thumb-note">Image origin metadata. Replay starts with the already integrated image; this entry is not exported as a replay process.</p>';
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
      if(/^(ChannelCombination|LRGBCombination|PixelMath)$/.test(name)||getProcessTitle(step.proc)==='NarrowbandHueCombination'||getProcessTitle(step.proc)==='ImageBlend')combinations.push(records[r].id+' — '+step.title);
      if(step.mask.status==='recorded')maskNames['$'+step.mask.name]=step.mask.name;
      var refs=step.references||[];
      for(var j=0;j<refs.length;++j)if(refs[j].kind==='input'||refs[j].kind==='reference'){
         var resolved='resolvedImage' in refs[j]?refs[j].resolvedImage:refs[j].name;inputNames['$'+resolved]=resolved;
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

function embedReportThumbnails(records, directory, generatedFiles, emitAsset, progress) {
   var cache={},files=[],digests={};
   var embed=function(src){
      // Shared mask thumbnail objects may already have been embedded by an earlier step.
      if(!src||src.indexOf('data:')===0||/^#apa_asset_[0-9]+$/.test(src))return src;
      if(cache['$'+src])return cache['$'+src];
      var filename=src.slice(src.lastIndexOf('/')+1),path=directory+'/'+filename;
      files.push(path);
      var bytes = File.readFile(path), digest = '';
      if (typeof CryptographicHash !== 'undefined')
         digest = (new CryptographicHash(CryptographicHash_SHA256)).hash(bytes).toHex();
      if (digest && digests['$'+digest]) return cache['$'+src] = digests['$'+digest];
      var data = 'data:image/png;base64,'+bytes.toBase64();
      if (emitAsset) {
         var key = '#apa_asset_' + files.length;
         emitAsset(key, data);
         if (digest) digests['$'+digest] = key;
         return cache['$'+src] = key;
      }
      return cache['$'+src] = data;
   };
   try {
      for(var r=0;r<records.length;++r){var record=records[r];
         if(progress)progress(70+20*r/records.length,'Embedding previews: '+record.id);
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

function compareAtlasImages(original, replay, label) {
   if(!original||!replay||original.isNull||replay.isNull)throw Error('Select two available images.');
   var a = original.mainView.image, b = replay.mainView.image;
   if (original === replay) throw Error(label + ': select two different images.');
   if (a.width !== b.width || a.height !== b.height || a.isColor !== b.isColor)
      throw Error(label + ': image dimensions and color mode must match.');
   var base = 'APA_difference_' + label.toLowerCase(), id = base, suffix = 1;
   while (!View.viewById(id).isNull) id = base + '_' + suffix++;
   var difference = new ImageWindow(a.width, a.height, a.isColor ? 3 : 1, 64, true, a.isColor, id);
   try {
      var p = new PixelMath;
      p.expression = 'abs(' + original.mainView.id + '-' + replay.mainView.id + ')';
      p.useSingleExpression = true;
      p.symbols = '';
      p.generateOutput = true;
      p.clearImageCacheAndExit = false;
      p.cacheGeneratedImages = false;
      p.use64BitWorkingImage = true;
      p.rescale = false;
      p.truncate = false;
      p.createNewImage = false;
      if (p.executeOn(difference.mainView) === false) throw Error(label + ': PixelMath failed.');
      Console.writeln('\n' + label + ': ' + original.mainView.id + ' versus ' + replay.mainView.id);
      Console.writeln('Input formats: ' + a.bitsPerSample + ' bit / ' + b.bitsPerSample + ' bit');
      var image = difference.mainView.image, max = 0, rows=[];
      for (var c = 0; c < (a.isColor ? 3 : 1); ++c) {
         image.selectedChannel = c;
         var peak = image.maximum(), mean = image.mean();
         if (!isFinite(peak) || !isFinite(mean)) throw Error(label + ': non-finite difference statistics.');
         max = Math.max(max, peak);
         rows.push({channel:a.isColor?["R","G","B"][c]:"Gray",max:peak,mean:mean});
         Console.writeln((a.isColor ? ['R', 'G', 'B'][c] : 'Gray') + ': max abs = ' + peak.toExponential(12) + ', mean abs = ' + mean.toExponential(12));
      }
      image.resetSelections();
      difference.show();
      return {max:max,rows:rows,difference:difference};
   } catch (error) {
      difference.forceClose();
      throw error;
   }
}

function comparisonPreviewBitmap(image,appearance,gain) {
   var preview=null;
   try{
      var scale=Math.min(1,280/image.width,180/image.height),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale)),channels=image.isColor?3:1;
      preview=new Image(width,height,channels,image.colorSpace,32,1);
      var xs=[],ys=[];for(var x=0;x<width;++x)xs.push(Math.min(image.width-1,Math.floor((x+0.5)*image.width/width)));for(var y=0;y<height;++y)ys.push(Math.min(image.height-1,Math.floor((y+0.5)*image.height/height)));
      var bulk=typeof image.getSamples==='function'&&image.width<=1048576,row=bulk?new Float32Array(image.width):null;
      for(var c=0;c<channels;++c){var values=new Float32Array(width*height);
         for(var y=0;y<height;++y){if(bulk)image.getSamples(row,new Rect(0,ys[y],image.width,ys[y]+1),c);
            for(var x=0;x<width;++x){var value=bulk?row[xs[x]]:image.sample(xs[x],ys[y],c);value*=gain;
               if(appearance&&appearance.auto){value=(value-appearance.black)/(1-appearance.black);value=Math.max(0,Math.min(1,value));var m=appearance.midtones;value=value===0?0:value===1?1:(m-1)*value/((2*m-1)*value-m);}
               values[y*width+x]=isFinite(value)?Math.max(0,Math.min(1,value)):0;
            }
         }
         preview.setSamples(values,new Rect(0,0,width,height),c);
      }
      return preview.render();
   }finally{if(preview)preview.free();}
}

function comparisonIsGameMask(window) {
   try{
      var view=window.mainView,groups=[];try{groups.push({container:view.initialProcessing,limit:Infinity});}catch(e){}try{groups.push({container:view.processing,limit:view.historyIndex});}catch(e){}
      for(var g=0;g<groups.length;++g){var container=groups[g].container;if(!container||typeof container.at!=='function')continue;var count=Math.min(container.length,groups[g].limit);for(var i=0;i<count;++i){var process=container.at(i);if(process&&/(?:^|[\\/])GAME[.]js$/i.test(process.filePath||''))return true;}}
   }catch(e){}
   return false;
}

function showAtlasComparisonResult(original,replay,result,stageHint) {
   var identical=result.max===0,headline=identical?'Identical nominal-channel pixels':'Differences detected';
   var text=original.mainView.id+' versus '+replay.mainView.id+'\n'+headline;
   for(var c=0;c<result.rows.length;++c)text+='\n'+result.rows[c].channel+': max abs = '+result.rows[c].max.toExponential(12)+'; mean abs = '+result.rows[c].mean.toExponential(12);
   if(typeof TreeBox!=='function'||typeof TreeBoxNode!=='function'){new MessageBox(text,'AstroProcessAtlas - Comparison result',StdIcon_Information,StdButton_Ok).execute();return;}
   var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Comparison result';dialog.sizer=new VerticalSizer;dialog.sizer.margin=16;dialog.sizer.spacing=10;
   var title=new Label(dialog);title.text=headline;title.styleSheet='font-size:18px;font-weight:bold;color:'+(identical?'#43a047':'#df9c36');dialog.sizer.add(title);
   var average=0;for(var c=0;c<result.rows.length;++c)average+=result.rows[c].mean/result.rows.length;var summary=new Label(dialog);summary.text='Average absolute deviation: '+(average*100).toPrecision(5)+' % full scale | Peak: '+(result.max*100).toPrecision(5)+' % full scale';dialog.sizer.add(summary);
   if(stageHint){var hint=new Label(dialog);hint.text=stageHint;hint.wordWrapping=true;dialog.sizer.add(hint);}
   var names=new Label(dialog);names.text='Original: '+original.mainView.id+' | Replay: '+replay.mainView.id;names.wordWrapping=true;dialog.sizer.add(names);
   var format=new Label(dialog);format.text=original.mainView.image.width+' x '+original.mainView.image.height+' pixels | '+original.mainView.image.bitsPerSample+' bit / '+replay.mainView.image.bitsPerSample+' bit';dialog.sizer.add(format);
   if(typeof Control==='function'&&typeof Graphics==='function'&&typeof Image==='function'){
      var gameMask=comparisonIsGameMask(original)||comparisonIsGameMask(replay),appearance=gameMask?{auto:false}:previewAppearance(original.mainView.image);if(!gameMask&&!appearance.auto)appearance=previewAppearance(replay.mainView.image);
      var cards=new HorizontalSizer;cards.spacing=12;var images=[original.mainView.image,replay.mainView.image,result.difference.mainView.image],gain=result.max>0?1/result.max:1;
      for(var i=0;i<images.length;++i){var column=new VerticalSizer;column.spacing=6;var caption=new Label(dialog);caption.text=i===0?'Original':i===1?'Replay':'Absolute difference (display x'+gain.toPrecision(4)+')';column.add(caption);var control=new Control(dialog);control.setFixedSize(280,180);control.bitmap=null;
         try{control.bitmap=comparisonPreviewBitmap(images[i],i<2?appearance:null,i===2?gain:1);}catch(e){Console.writeln('Comparison preview unavailable: '+e.message);}
         control.onPaint=function(){var g=new Graphics(this);g.fillRect(0,0,this.width,this.height,new Brush(0xff11111b));if(this.bitmap&&!this.bitmap.isNull)g.drawBitmap(Math.floor((this.width-this.bitmap.width)/2),Math.floor((this.height-this.bitmap.height)/2),this.bitmap);g.end();};column.add(control);cards.add(column);
      }
      dialog.sizer.add(cards);var display=new Label(dialog);display.text='Original and replay share the same display transform. Difference brightness is amplified for visibility; measurements and image pixels are unchanged.';display.wordWrapping=true;dialog.sizer.add(display);
   }
   var table=new TreeBox(dialog);table.numberOfColumns=5;table.headerVisible=true;var headings=['Channel','Average deviation (% full scale)','Peak deviation (% full scale)','Mean absolute (exact)','Max absolute (exact)'];for(var i=0;i<headings.length;++i)table.setHeaderText(i,headings[i]);table.setMinSize(870,130);
   for(var c=0;c<result.rows.length;++c){var values=result.rows[c],row=new TreeBoxNode(table);row.setText(0,values.channel);row.setText(1,(values.mean*100).toPrecision(5)+' %');row.setText(2,(values.max*100).toPrecision(5)+' %');row.setText(3,values.mean.toExponential(12));row.setText(4,values.max.toExponential(12));if(typeof row.setTextColor==='function')row.setTextColor(0,values.max===0?0xff43a047:0xffdf9c36);}
   if(typeof table.adjustColumnWidthToContents==='function')for(var c=0;c<5;++c)table.adjustColumnWidthToContents(c);dialog.sizer.add(table);
   var note=new Label(dialog);note.text='Percentages refer to the normalized unit range (0-1), not a similarity score. Compare the same processing stage with matching inputs and masks. Difference image: '+result.difference.mainView.id;note.wordWrapping=true;dialog.sizer.add(note);
   var show=new PushButton(dialog);show.text='Show difference image';show.onClick=function(){result.difference.show();};var close=new PushButton(dialog);close.text='Close';close.onClick=function(){dialog.ok();};var buttons=new HorizontalSizer;buttons.add(show);buttons.addStretch();buttons.add(close);dialog.sizer.add(buttons);dialog.adjustToContents();dialog.execute();
}

function showAtlasComparisonDialog(preferredReplay,originalId,stageHint) {
   var windows=[];for(var i=0;i<ImageWindow.windows.length;++i)if(!ImageWindow.windows[i].isNull)windows.push(ImageWindow.windows[i]);
   if(preferredReplay&&!preferredReplay.isNull&&windows.indexOf(preferredReplay)<0)windows.push(preferredReplay);
   if(windows.length<2)throw Error('Open an original image and its replay result before comparing.');
   var dialog=new Dialog;dialog.windowTitle='AstroProcessAtlas - Numerical comparison';
   var label=new Label(dialog);label.text='Compare matching original and replay stages. Creates a 64-bit absolute difference image and reports maximum and mean absolute differences per nominal channel. Input pixels and STF are unchanged.';label.wordWrapping=true;label.setMinWidth(540);if(stageHint)label.text+=' '+stageHint;
   var original=new ComboBox(dialog),replay=new ComboBox(dialog),replayIndex=1;
   for(var i=0;i<windows.length;++i){original.addItem(windows[i].mainView.id);replay.addItem(windows[i].mainView.id);if(windows[i]===preferredReplay||(!preferredReplay&&/_APA_replay(?:_[0-9]+)?$/.test(windows[i].mainView.id)))replayIndex=i;}
   original.currentItem=0;replay.currentItem=replayIndex;
   var wanted=originalId||windows[replay.currentItem].mainView.id.replace(/_APA_replay(?:_[0-9]+)?$/,'');
   for(var i=0;i<windows.length;++i)if(windows[i].mainView.id===wanted)original.currentItem=i;
   var aLabel=new Label(dialog);aLabel.text='Original';var bLabel=new Label(dialog);bLabel.text='Replay';
   var status=new Label(dialog);status.wordWrapping=true;
   var run=new PushButton(dialog);run.text='Compare';run.onClick=function(){dialog.ok();};
   var update=function(){var a=windows[original.currentItem],b=windows[replay.currentItem];run.enabled=!!(a&&b&&a!==b&&!a.isNull&&!b.isNull&&a.mainView.image.width===b.mainView.image.width&&a.mainView.image.height===b.mainView.image.height&&a.mainView.image.isColor===b.mainView.image.isColor);status.text=run.enabled?'Results show both images, an amplified difference preview and per-channel measurements. Select the same processing stage.':'Select different images with matching dimensions and color mode.';};
   original.onItemSelected=update;replay.onItemSelected=update;update();
   var cancel=new PushButton(dialog);cancel.text='Cancel';cancel.onClick=function(){dialog.cancel();};var buttons=new HorizontalSizer;buttons.addStretch();buttons.add(run);buttons.add(cancel);
   dialog.sizer=new VerticalSizer;dialog.sizer.margin=12;dialog.sizer.spacing=8;dialog.sizer.add(label);dialog.sizer.add(aLabel);dialog.sizer.add(original);dialog.sizer.add(bLabel);dialog.sizer.add(replay);dialog.sizer.add(status);dialog.sizer.add(buttons);dialog.adjustToContents();
   if(!dialog.execute())return;
   if(typeof Console.show==='function')Console.show();
   var a=windows[original.currentItem],b=windows[replay.currentItem],result=compareAtlasImages(a,b,'Replay');
   if(result.max>0){var white=Math.max(1e-12,Math.min(1,result.max));result.difference.mainView.stf=[[0.5,0,white,0,1],[0.5,0,white,0,1],[0.5,0,white,0,1],[0.5,0,1,0,1]];}
   showAtlasComparisonResult(a,b,result,stageHint);
}

function showAboutDialog() {
   var dialog = new Dialog;
   dialog.windowTitle = "About AstroProcessAtlas";
   var label = new Label(dialog);
   label.useRichText = true;
   label.text = "<b>AstroProcessAtlas</b><br>Version: " + ASTROPROCESS_ATLAS_VERSION + "<br><br>Author: YoruHikari<br>YoruHikari Astrophotography<br>https:\u002f\u002fwww.yoruhikari.gr/<br><br>Free and open source — MIT License.<br>Explore image history, compare stages and rebuild supported workflows.<br><br>Help improve AstroProcessAtlas: share feedback, test workflows or report a problem.<br>Review logs before sharing; reports may contain image names and local paths.";
   var website = new PushButton(dialog); website.text = "Visit website";
   website.onClick = function() { Dialog.openBrowser("https://www.yoruhikari.gr/"); };
   label.wordWrapping = true;label.setMinWidth(440);
   var problem=new PushButton(dialog);problem.text="Report a problem";problem.onClick=function(){Dialog.openBrowser("https://github.com/kaminarigr/AstroProcessAtlas/issues/new?template=bug_report.yml");};
   var idea=new PushButton(dialog);idea.text="Suggest an improvement";idea.onClick=function(){Dialog.openBrowser("https://github.com/kaminarigr/AstroProcessAtlas/issues/new?template=feature_request.yml");};
   var contribute=new PushButton(dialog);contribute.text="Ways to contribute";contribute.onClick=function(){Dialog.openBrowser("https://github.com/kaminarigr/AstroProcessAtlas/blob/main/CONTRIBUTING.md");};
   var feedbackButtons=new HorizontalSizer;feedbackButtons.spacing=8;feedbackButtons.add(problem);feedbackButtons.add(idea);feedbackButtons.add(contribute);
   var close = new PushButton(dialog); close.text = "Close";
   close.onClick = function() { dialog.ok(); };
   var buttons = new HorizontalSizer;
   buttons.spacing = 8; buttons.add(website); buttons.addStretch(); buttons.add(close);
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 16; dialog.sizer.spacing = 12;
   dialog.sizer.add(label);dialog.sizer.add(feedbackButtons);dialog.sizer.add(buttons);
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
   var compare = new PushButton(dialog);compare.text='Compare original / replay...';compare.enabled=windows.length>1;compare.onClick=function(){try{showAtlasComparisonDialog(null,'');}catch(e){new MessageBox(e.message,'AstroProcessAtlas - Comparison',ICON_ERROR,BUTTON_OK).execute();}};
   var buttons = new HorizontalSizer;
   buttons.spacing = 8; buttons.add(about); buttons.add(compare); buttons.add(all); buttons.add(none); buttons.addStretch(); buttons.add(ok); buttons.add(cancel);
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 12; dialog.sizer.spacing = 10;
   var embed = new CheckBox(dialog);embed.text='Single HTML file (embed thumbnails)';embed.checked=true;
   var sizeLabel=new Label(dialog);sizeLabel.text='Report size';
   var size=new ComboBox(dialog);size.addItem('Small');size.addItem('Normal');size.addItem('Detailed');size.currentItem=1;
   var sizeNote=new Label(dialog);sizeNote.wordWrapping=true;
   var sizeIds=['small','normal','detailed'];
   size.onItemSelected=function(index){var profile=reportSizeProfile(sizeIds[index]);sizeNote.text='Previews up to '+profile.stage+' px; current image '+profile.thumbnail+' px; masks '+profile.mask+' px. All steps and parameters are retained. Smaller previews reduce export time and file size.';};
   size.onItemSelected(size.currentItem);

   dialog.sizer.add(label); dialog.sizer.add(tree, 100);dialog.sizer.add(sourceLabel);dialog.sizer.add(sources);dialog.sizer.add(embed);dialog.sizer.add(sizeLabel);dialog.sizer.add(size);dialog.sizer.add(sizeNote); dialog.sizer.add(buttons);
   dialog.adjustToContents();
   if (!dialog.execute()) return [];
   var selected = [];
   for (var i = 0; i < windows.length; ++i) if (tree.child(i).checked) selected.push(windows[i]);
   selected.embedThumbnails=embed.checked;selected.reportProfileId=sizeIds[size.currentItem]||'normal';
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
   var progress = createReportProgress();
   try {
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
      progress.update(15*i/windows.length, 'Reading history: ' + windows[i].mainView.id);
      var record=collectWorkspaceRecord(windows[i], i);record.isOriginalInput=false;
      for(var j=0;j<windows.originalInputIds.length;++j)if(windows.originalInputIds[j]===record.id)record.isOriginalInput=true;
      records.push(record);
   }
   var graph = workspaceGraph(records);
   for (var i = 0; i < records.length; ++i) total += workspaceStepGroups(records[i]).length;
   records=orderWorkspaceGraph(records,graph);
   var thumbnailFiles=collectWorkspaceThumbnails(records, thumbDir, basename + "_thumbs", progress.update, windows.reportProfileId);
   var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>AstroProcessAtlas</title><style>' + reportStyles() +
      'h2{color:#89b4fa} .graph-scroll{overflow:auto;max-height:760px;border:1px solid #45475a;margin:14px 0} #workspace_graph{display:block;height:auto;background:#11111b} .edge{fill:none;stroke:#89b4fa;stroke-width:1.8} .edge-input,.edge-reference{stroke:#f9e2af;stroke-dasharray:6 4} .edge-mask{stroke:#f38ba8;stroke-dasharray:6 4} .edge-output{stroke:#a6e3a1;stroke-dasharray:6 4} .edge-manual{stroke:#cba6f7;stroke-dasharray:4 3} .edge-possible{stroke:#94e2d5;stroke-dasharray:2 7;stroke-width:2} .possible-info{color:#94e2d5} .redo-edge,.redo-node{opacity:.45} .graph-node rect{fill:#1e1e2e;stroke:#45475a} .graph-node:hover rect{stroke:#89b4fa} .graph-node text{fill:#cdd6f4;font:13px sans-serif} .graph-node .graph-small{fill:#a6adc8;font-size:10px} .image-snapshot{max-width:160px;max-height:160px;display:block;margin-bottom:10px} .image-report{scroll-margin-top:15px} select,input{max-width:100%;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;padding:6px} .step-card{scroll-margin-top:15px} </style></head><body>';
   html += '<p><label>Language / Γλώσσα <select id="report_language" onchange="setReportLanguage(this.value)"><option value="en" data-no-i18n>English</option><option value="el" data-no-i18n>Ελληνικά</option></select></label></p>';
   html += '<h1>AstroProcessAtlas</h1><div class="meta-info"><b>Images:</b> ' + records.length + ' · <span id="report_process_count"><b>Total Process Steps:</b> ' + total + '</span> · ' + escapeHTML((new Date()).toLocaleString()) +
      '<p>Includes the selected open images and their available initial/recent history. Closed images, older mask versions and unrecorded connections cannot be recovered automatically. Image references are detected in PixelMath, ChannelCombination, LRGBCombination, NarrowbandHueCombination, ImageBlend, ChannelExtraction, specific image ID parameters and masks. The same initial processing may appear in multiple images.</p></div>';
   html += processingSummaryHTML(records);
   html += replayLaunchHTML();
   html += workspaceReplayHTML(records);
   var tools = [], seenTools = {};
   for (var n = 0; n < graph.nodes.length; ++n) if (!graph.nodes[n].header && !seenTools['$'+graph.nodes[n].tool]) {
      seenTools['$'+graph.nodes[n].tool] = true; tools.push(graph.nodes[n].tool);
   }
   tools.sort();
   var filtersHTML = '<div class="report-filters"><label>Search <input id="report_search" type="search" placeholder="Image, tool, mask or parameter" oninput="applyReportFilters()"></label> <label>Tool <select id="tool_filter" onchange="applyReportFilters()"><option value="all">All tools</option>';
   for (var t=0;t<tools.length;++t) filtersHTML += '<option data-no-i18n value="' + escapeHTML(tools[t]) + '">' + escapeHTML(tools[t]) + '</option>';
   filtersHTML += '</select></label> <label><input id="mask_filter" type="checkbox" onchange="applyReportFilters()">Steps with masks</label> <label><input id="applied_filter" type="checkbox" onchange="applyReportFilters()">Applied steps only</label> <button onclick="resetReportFilters()">Reset filters</button><p id="filter_status" aria-live="polite"></p></div>';
   html += workspaceChainHTML(records.map(function(record){return {id:record.id};}));
   var reportProfile=reportSizeProfile(windows.reportProfileId);
   html+='<p><b>Report size:</b> <span>'+reportProfile.label+'</span> — <span>Maximum stage preview:</span> '+reportProfile.stage+' px</p>';
   html += '<p class="provenance-legend"><b>Connection origin:</b> Recorded in history · Detected from parameters · User annotation. Hover or focus a line for its origin and parameter. A recorded mask name does not identify its historical pixel version.</p>';
   html += workspaceOverviewHTML(records, graph, filtersHTML);
   html += '<p><label>Show image history <select id="image_filter" onchange="showImage(this.value)"><option value="all">All</option>';
   for (var i = 0; i < records.length; ++i) html += '<option value="' + records[i].anchor + '" data-no-i18n>' + escapeHTML(records[i].id) + '</option>';
   html += '</select></label></p>';
   var file = new File;
   file.createForWriting(path);
   try {
   writeReportText(file, html); html = '';
   if (windows.embedThumbnails) {
      writeReportText(file, '<script id="apa_report_assets" type="application/json">{');var assetSeparator='';
      embedReportThumbnails(records, thumbDir, thumbnailFiles, function(key, data) {
         writeReportText(file, assetSeparator+'"' + key + '":"');assetSeparator=',';
         writeReportText(file, data);
         writeReportText(file, '"');
      }, progress.update);
      writeReportText(file, '}</script>');
   }
   var reportData=createAtlasReportData(records,graph,{embeddedPreviews:!!windows.embedThumbnails,reportSize:windows.reportProfileId||'normal'});
   var emit = function(fragment) { writeReportText(file, fragment); };
   for (var i = 0; i < records.length; ++i) {
      progress.update(90+9*i/records.length, 'Writing report: ' + records[i].id);
      imageReportHTML(records[i], emit,reportData.history[i]);
   }
   html += '<footer class="report-footer"><p><strong data-no-i18n>AstroProcessAtlas '+escapeHTML(ASTROPROCESS_ATLAS_VERSION)+'</strong> · <span>Created by YoruHikari</span></p><a href="https:\u002f\u002fwww.yoruhikari.gr/" target="_blank" rel="noopener noreferrer">© 2026 YoruHikari Astrophotography</a><p>Free and open source. Help improve the project with feedback, testing or sharing.</p><nav class="project-links" aria-label="Project links"><a href="https:\u002f\u002fgithub.com/kaminarigr/AstroProcessAtlas" target="_blank" rel="noopener noreferrer">Source code</a><a href="https:\u002f\u002fgithub.com/kaminarigr/AstroProcessAtlas/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">Report a problem</a><a href="https:\u002f\u002fgithub.com/kaminarigr/AstroProcessAtlas/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">Suggest an improvement</a><a href="https:\u002f\u002fgithub.com/kaminarigr/AstroProcessAtlas/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Ways to contribute</a></nav><p class="thumb-note">Review logs before sharing: they may contain image names and local paths.</p></footer>';
   html += '<button id="back_to_top" type="button" hidden onclick="scrollToReportTop()" aria-label="Back to top">↑ Back to top</button>';
   html += '<div id="comparison_dialog" role="dialog" aria-modal="true" aria-label="Before / after" hidden onclick="if(event.target===this)closeComparison()"><div class="comparison-panel"><button id="comparison_close" type="button" onclick="closeComparison()">Close</button><p>Preview resolution follows the selected report size. Dark previews use a display-only auto stretch; image pixels are unchanged. Zoom and pan are shared by both images.</p><label class="zoom-control"><span>Zoom</span><input id="comparison_zoom" type="range" min="100" max="400" value="100" oninput="zoomComparison(this.value)" onchange="zoomComparison(this.value)"></label><div id="comparison_viewport"><div id="comparison_content"></div></div></div></div>';
   // Escape HTML delimiters in inline JSON: names/code must never close a script tag.
   html += '<style>.atlas-notification{position:fixed;right:20px;bottom:24px;z-index:20000;display:flex;align-items:center;gap:16px;width:max-content;max-width:min(520px,calc(100vw - 32px));padding:14px 16px;border:1px solid #a6e3a1;border-radius:10px;background:#1e1e2e;color:#cdd6f4;box-shadow:0 8px 30px #0008;font-size:14px}.atlas-notification span{min-width:0;overflow-wrap:anywhere}.atlas-notification button{flex:none;display:grid;place-items:center;width:28px;height:28px;padding:0;margin:0;font-size:20px}.atlas-notification[hidden]{display:none!important}@media(max-width:480px){.atlas-notification{right:16px;bottom:16px;left:16px;width:auto}}.delete-step-dialog{background:#181825;color:#cdd6f4;border:1px solid #f38ba8;border-radius:12px;width:min(540px,90vw);max-height:85vh;overflow:auto;padding:24px;box-sizing:border-box}.execution-mode-dialog{border-color:#89b4fa}.execution-mode-choice{display:block;width:100%;text-align:left;white-space:normal;margin:10px 0;padding:14px;border:1px solid #45475a;border-left:4px solid;border-radius:8px;background:#1e1e2e;color:#cdd6f4}.execution-mode-choice[aria-pressed=true]{outline:2px solid #89b4fa;outline-offset:2px}.execution-mode-choice:disabled{opacity:.45;cursor:not-allowed}.plan-mode-auto{border-left-color:#a6e3a1!important}.plan-mode-adjust{border-left-color:#fab387!important}.plan-mode-skip{border-left-color:#9399b2!important}.chain-task-list .chain-plan-step{padding:10px;border:1px solid #45475a;border-left:4px solid;border-radius:6px;cursor:pointer}.chain-plan-step.plan-mode-auto{background:#a6e3a112;color:#a6e3a1}.chain-plan-step.plan-mode-adjust{background:#fab38712;color:#fab387}.chain-plan-step.plan-mode-skip{background:#9399b212;color:#a6adc8}.chain-plan-step:hover,.chain-plan-step:focus-visible{outline:2px solid #89b4fa;outline-offset:2px}.delete-step-dialog::backdrop{background:#000a}.delete-step-dialog h2{margin-top:0}.delete-step-dialog dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 16px}.delete-step-dialog dt{font-weight:bold}.delete-step-dialog dd{margin:0;overflow-wrap:anywhere}.delete-step-dialog pre{max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.delete-step-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.delete-step-confirm{background:#f38ba8;color:#11111b}.chain-task-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:8px 30px;padding-left:26px}.chain-task-list li{min-width:0;padding-left:4px}.chain-task-list li{break-inside:avoid;padding:4px 0;overflow-wrap:anywhere}.report-filters{padding:12px;border:1px solid #45475a;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.report-filters input[type=checkbox]{width:auto}.is-filtered,[hidden]{display:none!important}.compare-stage{position:relative;line-height:0}.compare-stage img{display:block;width:100%;max-width:none!important;max-height:none!important}.compare-before{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}.compare-label{position:absolute;top:10px;background:#111b;padding:5px;line-height:1.3;pointer-events:none}.before-label{left:8px}.after-label{right:8px}.comparison input[type=range]{width:100%;padding:0}.comparison-unavailable{font-size:12px;color:#f9e2af}#comparison_dialog{width:min(1100px,94vw);max-height:94vh;background:#181825;color:#cdd6f4;border:1px solid #89b4fa}#comparison_dialog::backdrop{background:#000b}#comparison_viewport{overflow:auto;max-height:70vh}#comparison_content{width:100%}#comparison_dialog .comparison{width:100%}#comparison_dialog .comparison>button{display:none}.edge:focus{stroke-width:4;outline:none}.provenance-legend{font-size:13px;color:#bac2de}</style>';
   html += '<style>.zoom-control{display:inline-flex;align-items:center;gap:10px;margin:8px 0}.zoom-control span{white-space:nowrap}.zoom-control input[type=range]{width:220px;max-width:55vw;margin:0;vertical-align:middle}.graph-node.is-tool-match rect,.graph-node.is-tool-match:hover rect{stroke:#fab387!important;stroke-width:3px!important}.compare-divider{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 3px #000;pointer-events:none;z-index:2}.compare-divider span{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;padding:10px;background:#181825;border:2px solid #fff;line-height:1;color:#fff}.comparison .compare-stage .compare-slider{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:ew-resize;z-index:3}.compare-stage:focus-within{outline:2px solid #fab387}.compare-label{z-index:4}#comparison_dialog{position:fixed;inset:0;z-index:10000;width:auto;max-height:none;background:#000b;border:0;padding:20px;display:flex;align-items:center;justify-content:center}.comparison-panel{background:#181825;border:1px solid #89b4fa;padding:16px;width:1100px;max-width:94vw;max-height:90vh;overflow:auto}#comparison_viewport{max-height:65vh}</style>';
   writeReportText(file,'<script id="apa_report_data" type="application/json">');
   writeReportText(file,atlasReportDataJSON(reportData));
   writeReportText(file,'</script>');
   html += '<script>'+resolveAtlasReportSource.toString()+';'+hydrateAtlasReportSource.toString()+';'+validateAtlasReportData.toString()+';'+workflowStateJSON.toString()+';'+atlasReportDataJSON.toString()+';'+atlasReportWithProject.toString()+';'+atlasReportSavedState.toString()+';'+readAtlasReportDocument.toString()+';'+loadAtlasReportDocument.toString()+';var atlasReportDocument=loadAtlasReportDocument(document);var atlasReportData=atlasReportDocument.model;var reportEmbeddedAssets=atlasReportDocument.assets;var workspaceGraphData=JSON.parse(JSON.stringify(atlasReportData.workspace.graph));var workspaceReplayData=JSON.parse(JSON.stringify(atlasReportData.workspace.images))' +
      ';var DARK_STRUCTURE_GPL_LICENSE=' + JSON.stringify(DARK_STRUCTURE_GPL_LICENSE).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') +
      ';' + pixelMathTextTokens.toString() + ';' + compareAtlasImages.toString() + ';' + previewAppearance.toString() + ';' + comparisonPreviewBitmap.toString() + ';' + comparisonIsGameMask.toString() + ';' + showAtlasComparisonResult.toString() + ';' + showAtlasComparisonDialog.toString() + ';' + prepareGraxpertReplay.toString() + ';' + runGraxpertReplay.toString() + ';' + historyParameterKey.toString() + ';' + readHistoryMasks.toString() + ';' + preparedReplayPrefix.toString() + ';' + atlasReplaySession.toString() + ';' + runInteractiveReplayStep.toString() + ';' + runNarrowbandHueReplay.toString() + ';' + buildWorkspaceReplayScript.toString() + ';' + remapWorkflowExpression.toString() + ';' + editedWorkspaceGraph.toString() + ';' + atlasHistogramLearning.toString() + ';' + buildAtlasHistogramExperiment.toString() + ';' + runAtlasHistogramExperiment.toString() + ';' + captureAtlasImageStatistics.toString() + ';' + workflowFingerprint.toString() + ';' + updateAtlasParameterColumns.toString() + ';' + atlasParameterLiteral.toString() + ';' + atlasStructuredParameterFields.toString() + ';' + atlasParameterFields.toString() + ';' + editReplayWorkflow.toString() + ';' + restoreReplayWorkflow.toString() + ';' + workflowSnapshotKey.toString() + ';' + ambiguousImageCopy.toString() + ';' + chainSlotKey.toString() + ';' + applyManualReplayConnections.toString() + ';' + chainReferenceSlots.toString() + ';' + imageIdentityAliases.toString() + ';' + copyReplayMetadata.toString() + ';' + suggestChainBindings.toString() + ';' + buildWorkspaceChainPlan.toString() + ';' + runWorkspaceChain.toString() + ';' + buildWorkspaceChainScript.toString() + ';' + escapeHTML.toString() + ';' + atlasPrintSelection.toString() + ';' + collectAtlasPrintDetails.toString() + ';' + buildAtlasPrintDocument.toString() + ';' + installAtlasPrinting.toString() + ';' + reportBrowserScript() + ';' + chainBrowserController.toString() + ';chainBrowserController();installAtlasPrinting();</script></body></html>';
   writeReportText(file, html);
   } finally { file.close(); }
   progress.update(100, 'Report complete');
   } finally { progress.close(); }
   new MessageBox("AstroProcessAtlas created.\nImages: " + records.length + " · Steps: " + total + "\n\n" + path, "Success", ICON_INFO, BUTTON_OK).execute();
}

var REPORT_TRANSLATIONS = [
   ['Recorded image statistics','Καταγεγραμμένα στατιστικά εικόνας'],
   ['Historical pixel statistics unavailable for this step.','Δεν είναι διαθέσιμα ιστορικά στατιστικά pixels για αυτό το βήμα.'],
   ['Estimates from up to 4096 uniformly sampled raw pixels per channel, before any preview stretch. Alpha is excluded. MAD measures image spread, not a noise estimate. These are recorded statistics, not predictions for edited replay steps.','Εκτιμήσεις από έως 4096 ομοιόμορφα επιλεγμένα αρχικά pixels ανά κανάλι, πριν από stretch προεπισκόπησης. Το Alpha εξαιρείται. Το MAD μετρά τη διασπορά της εικόνας, δεν είναι εκτίμηση θορύβου. Τα στοιχεία αφορούν την καταγραφή, όχι το αποτέλεσμα αλλαγμένων βημάτων replay.'],
   ['Statistic','Στατιστικό'],['Delta','Διαφορά'],['Median','Διάμεσος'],['Mean','Μέση τιμή'],
   ['Sample minimum','Ελάχιστο δείγματος'],['Sample maximum','Μέγιστο δείγματος'],
   ['Standard deviation','Τυπική απόκλιση'],['Median absolute deviation','Διάμεση απόλυτη απόκλιση'],
   ['Samples at or below 0','Δείγματα στο 0 ή μικρότερα'],['Samples at or above 1','Δείγματα στο 1 ή μεγαλύτερα'],
   ['Print full report / PDF','Εκτύπωση όλης της καταγραφής / PDF'],['Print linked chain / PDF','Εκτύπωση συνδεδεμένης αλυσίδας / PDF'],
   ['Copy naming: the last ImageIdentifier in the selected range, or the selected input name, followed by _APA_replay. Existing names receive a numeric suffix.',
    'Όνομα αντιγράφου: το τελευταίο ImageIdentifier στο επιλεγμένο εύρος ή το όνομα της επιλεγμένης εισόδου, με κατάληξη _APA_replay. Αν το όνομα υπάρχει, προστίθεται αριθμός.'],
   ['The recorded ImageIdentifier value is empty or invalid.','Η καταγεγραμμένη τιμή ImageIdentifier είναι κενή ή μη έγκυρη.'],
   ['Naming handled at creation:','Το όνομα ορίζεται στη δημιουργία:'],
   ['StarXTerminator origin is shown on the source image:','Η προέλευση από το StarXTerminator εμφανίζεται στην εικόνα προέλευσης:'],
   ['The linked output origin is not repeated as a processing step here. Later steps are preserved.',
    'Η συνδεδεμένη δημιουργία εξόδου δεν επαναλαμβάνεται εδώ ως βήμα επεξεργασίας. Τα μεταγενέστερα βήματα διατηρούνται.'],
   ['No additional history steps were found for this stars output.','Δεν βρέθηκαν επιπλέον βήματα ιστορικού για αυτή την εικόνα stars.'],
   ['Image origin metadata. Replay starts with the already integrated image; this entry is not exported as a replay process.',
    'Στοιχεία προέλευσης εικόνας. Η επανάληψη ξεκινά από την ήδη ολοκληρωμένη εικόνα· αυτή η εγγραφή δεν εξάγεται ως διεργασία επανάληψης.'],
   ['Common initial history is shown on the source image:','Το κοινό αρχικό ιστορικό εμφανίζεται στην εικόνα προέλευσης:'],
   ['entries). Only subsequent clone steps are shown here. This relationship is inferred from the image name and matching parameters.',
    'εγγραφές). Εδώ εμφανίζονται μόνο τα επόμενα βήματα του κλώνου. Η σύνδεση προκύπτει από το όνομα εικόνας και τις ίδιες παραμέτρους.'],
   ['No additional history steps were found for this clone.','Δεν βρέθηκαν επιπλέον βήματα ιστορικού για αυτόν τον κλώνο.'],
   ['Export workflow for replay','Εξαγωγή ροής για επανάληψη'],
   ['Preflight checks availability and dimensions. Licenses, AI models and manual script settings may still require checks during execution.','Ο αρχικός έλεγχος εξετάζει διαθεσιμότητα και διαστάσεις. Άδειες, AI models και χειροκίνητες ρυθμίσεις scripts μπορεί να χρειάζονται έλεγχο κατά την εκτέλεση.'],
   ["Step data:", "Δεδομένα βήματος:"],
   ["Incomplete recorded data", "Ελλιπή καταγεγραμμένα δεδομένα"],
   ["Manual inputs / verification needed", "Χρειάζονται χειροκίνητες είσοδοι / επαλήθευση"],
   ["Recorded process settings", "Καταγεγραμμένες ρυθμίσεις διεργασίας"],
   ["Serialized parameters are unavailable.", "Οι καταγεγραμμένες παράμετροι δεν είναι διαθέσιμες."],
   ["Historical mask name is missing.", "Λείπει το ιστορικό όνομα της μάσκας."],
   ["The original mask pixels and their version must be supplied.", "Χρειάζονται τα αρχικά pixels και η έκδοση της μάσκας."],
   ["Historical input images must be supplied.", "Χρειάζονται οι ιστορικές εικόνες εισόδου."],
   ["Possible inputs are unconfirmed.", "Οι πιθανές είσοδοι δεν έχουν επιβεβαιωθεί."],
   ["Script settings were not recorded.", "Οι ρυθμίσεις του script δεν καταγράφηκαν."],
   ["Script parameters are recorded; internal masks or cached state may be unavailable.", "Οι παράμετροι του script καταγράφηκαν· εσωτερικές μάσκες ή αποθηκευμένη κατάσταση μπορεί να λείπουν."],
   ["Likely linear / dark (estimated)", "Πιθανώς linear / σκοτεινή (εκτίμηση)"],
   ["Likely linear / dark", "Πιθανώς linear / σκοτεινή"],
   ["Visible image — stretch state unconfirmed", "Ορατή εικόνα — το stretch δεν έχει επιβεβαιωθεί"],
   ["Visible — stretch unconfirmed", "Ορατή — stretch μη επιβεβαιωμένο"],
   ["Stretch state: unknown", "Κατάσταση stretch: άγνωστη"],
   ["Auto-stretched preview only", "Αυτόματο stretch μόνο στο preview"],
   ['Nonlinear stretch recorded in history','Καταγεγραμμένο nonlinear stretch στο ιστορικό'],
   ['Stretch recorded','Καταγεγραμμένο stretch'],
   ['GAME mask — stretched','Μάσκα GAME — stretched'],
   ['Step data indicators: green — recorded settings; orange — manual inputs or verification; pink — missing data. Recorded settings do not guarantee identical historical pixels. Stretch labels are estimates from pixel brightness.','Ενδείξεις δεδομένων: πράσινο — καταγεγραμμένες ρυθμίσεις· πορτοκαλί — χειροκίνητες είσοδοι ή επαλήθευση· ροζ — ελλιπή δεδομένα. Οι ρυθμίσεις δεν εγγυώνται ίδια ιστορικά pixels. Οι εκτιμήσεις stretch βασίζονται στη φωτεινότητα.'],
   ['Report size:','Μέγεθος report:'],['Small','Μικρό'],['Normal','Κανονικό'],['Detailed','Λεπτομερές'],['Maximum stage preview:','Μέγιστη προεπισκόπηση σταδίου:'],
   ['Replay image','Εικόνα επανάληψης'],['First process','Πρώτη διεργασία'],['Last process','Τελευταία διεργασία'],
   ["Replay linked dependency chain", "Επανάληψη συνδεδεμένης αλυσίδας"],
   ["Rebuild the selected image from its required channel branches, clones, stars and masks. Confirm each source checkpoint; a link alone does not identify historical pixels. Only connected dependencies are replayed.", "Αναδημιουργία της επιλεγμένης εικόνας από τα κανάλια, τους κλώνους, τα stars και τις μάσκες που απαιτούνται. Επιβεβαίωσε το στάδιο κάθε εισόδου· μια σύνδεση δεν προσδιορίζει τα ιστορικά pixels. Επαναλαμβάνονται μόνο οι απαιτούμενες εξαρτήσεις."],
   ["Prepared GAME masks and original starting images must be supplied. Clone masks with supported recorded steps can be rebuilt automatically. Palette preparation and unrecorded mask inversion require explicit choices.", "Απαιτούνται οι αρχικές εικόνες και οι έτοιμες μάσκες GAME. Οι κλώνοι μάσκας με υποστηριζόμενα βήματα αναδημιουργούνται αυτόματα. Επίλεξε ρητά την προετοιμασία των καναλιών και την αντιστροφή μάσκας."],
   ["Final target", "Τελική εικόνα"],
   ["I have reviewed source checkpoints, palette preparation and mask inversion.", "Έχω ελέγξει τα στάδια εισόδων, την προετοιμασία καναλιών και την αντιστροφή μάσκας."],
   ["Download chain replay script", "Λήψη script επανάληψης αλυσίδας"],
   ["Source image", "Εικόνα εισόδου"],
   ["Choose source image", "Επιλογή εικόνας εισόδου"],
   ["Checkpoint", "Στάδιο"],
   ["Input preparation", "Προετοιμασία εισόδου"],
   ["Clone at recorded parent checkpoint", "Κλώνος από το καταγεγραμμένο στάδιο προέλευσης"],
   ["Generated stars image", "Παραγόμενη εικόνα stars"],
   ["Before first process / supplied starting state", "Πριν από το πρώτο βήμα / παρεχόμενη αρχική εικόνα"],
   ["Choose input state", "Επιλογή κατάστασης εισόδου"],
   ["Already prepared", "Ήδη προετοιμασμένη"],
   ["Linear — stretch on a copy", "Linear — stretch σε αντίγραφο"],
   ["Color invert (mask values)", "Αντιστροφή χρώματος (τιμές μάσκας)"],
   ["Historical mask inversion is unknown; verify Color invert.", "Η ιστορική αντιστροφή μάσκας είναι άγνωστη· έλεγξε την αντιστροφή χρώματος."],
   ["Name-based channel suggestions and inferred clone links are proposals. Confirm the selected versions; historical mask pixels are not recovered by a graph link.", "Οι προτάσεις από ονόματα καναλιών και οι συνδέσεις κλώνων χρειάζονται έλεγχο. Επιβεβαίωσε τις εκδόσεις· η σύνδεση στο δέντρο δεν ανακτά τα ιστορικά pixels της μάσκας."],
   ["Original starting inputs", "Αρχικές είσοδοι"],
   ["Select the actual starting images when the script runs in PixInsight. Their original names may differ. Optional IDs below suggest that selection; channel steps use the generated replay copies.", "Επίλεξε τις πραγματικές αρχικές εικόνες όταν εκτελεστεί το script στο PixInsight. Τα ονόματά τους μπορεί να διαφέρουν. Τα προαιρετικά IDs προτείνουν την επιλογή· τα βήματα χρησιμοποιούν τα παραγόμενα αντίγραφα replay."],
   ["Starting image ID in PixInsight (optional)", "ID αρχικής εικόνας στο PixInsight (προαιρετικό)"],
   ["Edit replay workflow", "Επεξεργασία αλυσίδας replay"],
   ["Workflow image", "Εικόνα αλυσίδας"],
   ["Copy from image", "Αντιγραφή από εικόνα"],
   ["Insert before", "Εισαγωγή πριν από"],
   ["Copy step", "Αντιγραφή βήματος"],
   ["Remove step", "Αφαίρεση βήματος"],
   ["Undo last edit", "Αναίρεση τελευταίας αλλαγής"],
   ["Save edited report (HTML)", "Αποθήκευση τροποποιημένου report (HTML)"],
   ["End of chain", "Τέλος αλυσίδας"],
   ["Changes saved in this browser. Save edited report (HTML) for a portable copy.", "Οι αλλαγές αποθηκεύτηκαν στον browser. Αποθήκευσε το τροποποιημένο report (HTML) για μεταφορά."],
   ["Browser storage unavailable. Save edited report (HTML) to keep changes.", "Η αποθήκευση στον browser δεν είναι διαθέσιμη. Αποθήκευσε το τροποποιημένο report (HTML) για να κρατήσεις τις αλλαγές."],
   ["Edited report downloaded. Open that HTML to restore the workflow and connections.", "Το τροποποιημένο report κατέβηκε. Άνοιξε αυτό το HTML για επαναφορά της αλυσίδας και των συνδέσεων."],
   ["Edit tree: drag a process to copy it into a branch", "Επεξεργασία δέντρου: σύρε ένα βήμα για αντιγραφή σε αλυσίδα"],
   ["Save report (HTML)", "Αποθήκευση report (HTML)"],
   ["Change history", "Ιστορικό αλλαγών"],
   ["Changes update the tree, detailed history and replay. Original source records are retained for undo and the change log. Copied steps keep their parameters; review references, masks and checkpoints after editing.", "Οι αλλαγές ενημερώνουν το δέντρο, την αναλυτική προβολή και το replay. Οι αρχικές εγγραφές διατηρούνται για αναίρεση και ιστορικότητα. Τα αντιγραμμένα βήματα κρατούν τις παραμέτρους· έλεγξε τις αναφορές, μάσκες και στάδια."],
   ["Tree edits change the planned workflow. Existing previews document the original processing and are not recalculated.", "Οι αλλαγές στο δέντρο τροποποιούν την αλυσίδα. Τα υπάρχοντα previews τεκμηριώνουν την αρχική επεξεργασία και δεν υπολογίζονται ξανά."],
   ["Connections are included in Save report (HTML), together with tree edits and change history. Browser storage is also used when available.", "Οι σύνδεσμοι περιλαμβάνονται στην Αποθήκευση report (HTML), μαζί με τις αλλαγές δέντρου και το ιστορικό τους. Χρησιμοποιείται και αποθήκευση στον browser όταν είναι διαθέσιμη."],
   ["Copied / edited step", "Αντιγραμμένο / τροποποιημένο βήμα"],
   ["User-added step. No historical preview is available for this new position.", "Βήμα που πρόσθεσε ο χρήστης. Δεν υπάρχει ιστορικό preview για αυτή τη νέα θέση."],
   ["connections saved in this browser. Save report (HTML) for a portable copy.", "σύνδεσμοι αποθηκεύτηκαν στον browser. Αποθήκευσε το report (HTML) για μεταφορά."],
   ["connections. Browser storage unavailable; use Save report (HTML).", "σύνδεσμοι. Η αποθήκευση στον browser δεν είναι διαθέσιμη· αποθήκευσε το report (HTML)."],
   ["Edit mode: drop on a tile to connect; drop between steps to copy.", "Επεξεργασία: σύρε πάνω σε πλακίδιο για σύνδεση ή ανάμεσα σε βήματα για αντιγραφή."],
   ["Edit tree", "Επεξεργασία δέντρου"],
   ["Reset unsaved changes", "Επαναφορά μη αποθηκευμένων αλλαγών"],
   ["Unsaved changes", "Μη αποθηκευμένες αλλαγές"],
   ["No unsaved changes", "Δεν υπάρχουν μη αποθηκευμένες αλλαγές"],
   ["Restored the last saved report state.", "Επαναφέρθηκε η τελευταία αποθηκευμένη κατάσταση του report."],
   ["Changes cached in this browser. Save report (HTML) to keep a portable copy.", "Οι αλλαγές κρατούνται προσωρινά στον browser. Αποθήκευσε το report (HTML) για να το διατηρήσεις."],
   ["Browser storage unavailable. Save report (HTML) to keep changes.", "Η αποθήκευση στον browser δεν είναι διαθέσιμη. Αποθήκευσε το report (HTML) για να κρατήσεις τις αλλαγές."],
   ["Unsaved workflow changes. Save report (HTML) to keep them.", "Μη αποθηκευμένες αλλαγές αλυσίδας. Αποθήκευσε το report (HTML) για να τις κρατήσεις."],
   ["Choose your final image, review its inputs, then download the script to run in PixInsight.", "Επίλεξε την τελική εικόνα, έλεγξε τις εισόδους της και κατέβασε το script για εκτέλεση στο PixInsight."],
   ["1. Choose the final image", "1. Επίλεξε την τελική εικόνα"],
   ["The script rebuilds connected channels, clones, stars and masks on new image copies. Your starting images are kept.", "Το script αναδημιουργεί τα συνδεδεμένα κανάλια, τους κλώνους, τα αστέρια και τις μάσκες σε νέα αντίγραφα εικόνων. Οι αρχικές εικόνες διατηρούνται."],
   ["What do I need before starting?", "Τι χρειάζομαι πριν ξεκινήσω;"],
   ["Open the original channel images in PixInsight. Supply completed GAME masks when requested. Check which processing stage each input represents; a connection does not guarantee the original historical pixels.", "Άνοιξε τις αρχικές εικόνες καναλιών στο PixInsight. Δώσε τις έτοιμες μάσκες GAME όταν ζητηθούν. Έλεγξε σε ποιο στάδιο επεξεργασίας αντιστοιχεί κάθε είσοδος· μια σύνδεση δεν εγγυάται τα αρχικά ιστορικά pixels."],
   ["Optional: edit steps or configure GraXpert", "Προαιρετικά: επεξεργασία βημάτων ή ρύθμιση GraXpert"],
   ["Use this section only to change the recorded workflow. Otherwise, continue to the input review below.", "Χρησιμοποίησε αυτή την ενότητα μόνο για αλλαγές στην καταγεγραμμένη επεξεργασία. Διαφορετικά, συνέχισε στον έλεγχο εισόδων παρακάτω."],
   ["Steps in an image", "Βήματα μιας εικόνας"],
   ["Choose a step to copy or configure", "Επίλεξε βήμα για αντιγραφή ή ρύθμιση"],
   ["These settings apply to the source image and step selected above.", "Οι ρυθμίσεις εφαρμόζονται στην εικόνα προέλευσης και στο βήμα που επέλεξες παραπάνω."],
   ["Advanced GraXpert settings (optional)", "Προχωρημένες ρυθμίσεις GraXpert (προαιρετικά)"],
   ["2. Review the input images and masks", "2. Έλεγξε τις εικόνες εισόδου και τις μάσκες"],
   ["For each connection, choose the source image and the stage to use. Palette inputs also need their preparation state.", "Για κάθε σύνδεση, επίλεξε την εικόνα προέλευσης και το στάδιο που θα χρησιμοποιηθεί. Στις εισόδους παλέτας όρισε και την κατάσταση προετοιμασίας."],
   ["3. Review the plan and download", "3. Έλεγξε το πλάνο και κατέβασε το script"],
   ["Which processing stage?", "Ποιο στάδιο επεξεργασίας;"],
   ["Are the palette inputs already stretched?", "Είναι οι είσοδοι παλέτας ήδη stretched?"],
   ["Copy to the workflow image", "Αντιγραφή στην εικόνα της λίστας βημάτων"],
   ["Original starting inputs (optional name suggestions)", "Αρχικές είσοδοι (προαιρετικές προτάσεις ονομάτων)"],
   ["Rebuild a manually linked stars image", "Αναδημιουργία χειροκίνητα συνδεδεμένης εικόνας stars"],
   ["This line is currently an annotation. Confirm it as a replay output to enable Generate Star Image on the source step. The stars image will then be rebuilt instead of requested as an input. Historical pixels are not verified.", "Η γραμμή είναι προς το παρόν σημείωση. Επιβεβαίωσέ την ως έξοδο replay για να ενεργοποιηθεί το Generate Star Image στο βήμα προέλευσης. Η εικόνα stars θα αναδημιουργείται αντί να ζητείται ως είσοδος. Δεν επιβεβαιώνονται τα ιστορικά pixels."],
   ["I confirm this stars output and the change to Generate Star Image.", "Επιβεβαιώνω αυτή την έξοδο stars και την αλλαγή στο Generate Star Image."],
   ["Use this stars connection for replay", "Χρήση αυτής της σύνδεσης stars στο replay"],
   ["Manual connection — source and stage follow the tree link.", "Χειροκίνητη σύνδεση — η πηγή και το στάδιο ακολουθούν τη σύνδεση του δέντρου."],
   ["Execution", "Εκτέλεση"],
   ["Automatic — recorded settings", "Αυτόματα — καταγεγραμμένες ρυθμίσεις"],
   ["Adjust in PixInsight", "Προσαρμογή στο PixInsight"],
   ["Skip this step", "Παράλειψη βήματος"],
   ["Choose Automatic to reuse recorded settings, Adjust to apply new settings in PixInsight, or Skip to leave this stage unchanged. Adjustment is initially available for supported native processes. Generate a new report from the resulting images to capture tuned parameters.", "Επίλεξε Αυτόματα για τις καταγεγραμμένες ρυθμίσεις, Προσαρμογή για εφαρμογή νέων ρυθμίσεων στο PixInsight ή Παράλειψη για καμία αλλαγή σε αυτό το στάδιο. Η προσαρμογή υποστηρίζει αρχικά εγγενείς διεργασίες. Δημιούργησε νέο report από τις εικόνες αποτελέσματος για να καταγράψεις τις νέες παραμέτρους."],
   ["References for", "Αναφορές για"],
   ["Input", "Είσοδος"],
   ["Mask", "Μάσκα"],
   ["This history entry only copies an image named image. The original external tool and settings are unknown. Choose its actual source below, skip this step, or replace it with GraXpert/a prepared result.", "Αυτό το βήμα αντιγράφει μόνο μια εικόνα με όνομα image. Το αρχικό εξωτερικό εργαλείο και οι ρυθμίσεις του δεν είναι γνωστά. Επίλεξε την πραγματική πηγή παρακάτω, παράλειψε το βήμα ή αντικατάστησέ το με GraXpert/έτοιμο αποτέλεσμα."],
   ["How should this step be handled?", "Τι να γίνει με αυτό το βήμα;"],
   ["Use a source image (select below)", "Χρήση εικόνας πηγής (επιλογή παρακάτω)"],
   ["Skip ambiguous image copy (leave pixels unchanged)", "Παράλειψη ασαφούς αντιγραφής (καμία αλλαγή στην εικόνα)"],
   ["Replace with GraXpert", "Αντικατάσταση με GraXpert"],
   ["Created by YoruHikari", "Δημιουργία: YoruHikari"],
   ["Free and open source. Help improve the project with feedback, testing or sharing.", "Δωρεάν και open source. Βοήθησε την εξέλιξή του με προτάσεις, δοκιμές ή κοινοποίηση."],
   ["Source code", "Πηγαίος κώδικας"],
   ["Report a problem", "Αναφορά προβλήματος"],
   ["Suggest an improvement", "Πρόταση βελτίωσης"],
   ["Ways to contribute", "Τρόποι συνεισφοράς"],
   ["Project links", "Σύνδεσμοι του project"],
   ["Review logs before sharing: they may contain image names and local paths.", "Έλεγξε τα logs πριν τα κοινοποιήσεις: μπορεί να περιέχουν ονόματα εικόνων και τοπικές διαδρομές."],
   ["External processing / GraXpert", "Εξωτερική επεξεργασία / GraXpert"],
   ["External / GraXpert", "Εξωτερικό / GraXpert"],
   ["Use the source image and Step selectors above to choose the record to configure. A bare PixelMath image reference does not identify GraXpert.", "Επίλεξε την εικόνα προέλευσης και το βήμα παραπάνω. Μια απλή αναφορά PixelMath image δεν αποδεικνύει χρήση GraXpert."],
   ["Handling", "Χειρισμός"],
   ["Recorded process", "Καταγεγραμμένη διεργασία"],
   ["Use prepared external result", "Χρήση έτοιμου εξωτερικού αποτελέσματος"],
   ["Run GraXpert again", "Νέα εκτέλεση GraXpert"],
   ["Correction", "Διόρθωση"],
   ["Smoothing", "Εξομάλυνση"],
   ["AI model version (optional)", "Έκδοση μοντέλου AI (προαιρετικά)"],
   ["Device", "Συσκευή"],
   ["Application default", "Προεπιλογή εφαρμογής"],
   ["Executable path (optional)", "Διαδρομή εκτελέσιμου (προαιρετικά)"],
   ["Latest available (automatic)", "Νεότερο διαθέσιμο (αυτόματα)"],
   ["Auto-detect if empty", "Αυτόματος εντοπισμός αν μείνει κενό"],
   ["Apply external handling", "Εφαρμογή εξωτερικού χειρισμού"],
   ["Prepared results skip earlier branch processing. A new GraXpert run uses your declared settings, not recovered historical settings. Unpinned AI models may change results.", "Τα έτοιμα αποτελέσματα παρακάμπτουν τα προηγούμενα βήματα του κλάδου. Η νέα εκτέλεση GraXpert χρησιμοποιεί τις δικές σου ρυθμίσεις, όχι ανακτημένες ιστορικές. Μοντέλα AI χωρίς συγκεκριμένη έκδοση μπορεί να αλλάξουν το αποτέλεσμα."],
   ['Download PixInsight replay script','Λήψη script επανάληψης για το PixInsight'],
   ['Ready for replay','Έτοιμο για επανάληψη'],
   ['Choose prepared narrowband channels and optional RGB stars. Auto stretch is a preview setting; Generate produces the recorded combination without that preview stretch.','Επίλεξε προετοιμασμένα narrowband κανάλια και προαιρετικά RGB stars. Το Auto stretch αφορά το preview· το Generate δημιουργεί τον συνδυασμό χωρίς αυτό το stretch.'],
   ['NarrowbandHueCombination needs complete saved channel, hue, amount and SCNR settings. They may be missing when Generate was used without a saved instance.','Το NarrowbandHueCombination απαιτεί πλήρεις αποθηκευμένες ρυθμίσεις καναλιών, hue, amount και SCNR. Μπορεί να λείπουν αν χρησιμοποιήθηκε Generate χωρίς αποθηκευμένο instance.'],
   ['External masks on NarrowbandHueCombination cannot be restored safely; it generates a separate unmasked RGB result.','Εξωτερικές μάσκες στο NarrowbandHueCombination δεν μπορούν να ανακτηθούν με ασφάλεια· το εργαλείο δημιουργεί ξεχωριστό RGB αποτέλεσμα χωρίς μάσκα.'],
   ['Choose ImageBlend base and blend images at their recorded processing state. The installed engine applies the saved settings.','Επίλεξε τις εικόνες base και blend του ImageBlend στην καταγεγραμμένη κατάσταση επεξεργασίας τους. Η εγκατεστημένη μηχανή εφαρμόζει τις αποθηκευμένες ρυθμίσεις.'],
   ['Requires the appropriate astrometric solution, observation metadata, catalog and filters for these data.','Απαιτούνται η κατάλληλη αστρομετρική λύση, τα στοιχεία παρατήρησης, ο κατάλογος και τα φίλτρα για αυτά τα δεδομένα.'],
   ['Geometry changes are applied to the replay copy. Following masks must match the resulting dimensions.','Οι αλλαγές γεωμετρίας εφαρμόζονται στο αντίγραφο replay. Οι επόμενες μάσκες πρέπει να έχουν τις τελικές διαστάσεις.'],
   ['ImageBlend needs complete supported saved settings and its installed CosmicPhotons engine and utilities. Newer mask-painting settings are not reconstructed.','Το ImageBlend απαιτεί πλήρεις υποστηριζόμενες αποθηκευμένες ρυθμίσεις και την εγκατεστημένη μηχανή και τα utilities του CosmicPhotons. Νεότερες ρυθμίσεις ζωγραφικής μάσκας δεν ανακατασκευάζονται.'],
   ['Choose PixelMath reference images in PixInsight at their recorded processing state.','Επίλεξε τις εικόνες αναφοράς του PixelMath στο PixInsight στην καταγεγραμμένη κατάσταση επεξεργασίας τους.'],
   ['PixelMath needs valid serialized expressions without quoted strings, directives, preview/global references or cache-only execution.','Το PixelMath απαιτεί έγκυρες καταγεγραμμένες εκφράσεις χωρίς συμβολοσειρές σε εισαγωγικά, directives, αναφορές preview/καθολικού περιβάλλοντος ή εκτέλεση μόνο για cache.'],
   ['PixelMath: select reference images when prompted in PixInsight. Use their original processing state. The recorded expressions and settings are preserved; a new-image result becomes the target for following steps.','PixelMath: επίλεξε τις εικόνες αναφοράς όταν ζητηθούν στο PixInsight, στην αρχική τους κατάσταση επεξεργασίας. Διατηρούνται οι καταγεγραμμένες εκφράσεις και ρυθμίσεις· ένα αποτέλεσμα νέας εικόνας γίνεται ο στόχος των επόμενων βημάτων.'],
   ['GAME drawing settings were not recorded. Select the completed original GAME mask in PixInsight; mask creation is not repeated.','Οι ρυθμίσεις σχεδίασης του GAME δεν καταγράφηκαν. Επίλεξε την έτοιμη αρχική μάσκα GAME στο PixInsight· η δημιουργία της μάσκας δεν επαναλαμβάνεται.'],
   ['Start the selected range at GAME and select its completed original mask.','Ξεκίνα το επιλεγμένο εύρος από το GAME και επίλεξε την έτοιμη αρχική του μάσκα.'],
   ['GAME: start the range at this step and select the completed original grayscale mask. Replay copies that mask and applies subsequent steps; it does not recreate the GAME drawing.','GAME: ξεκίνα το εύρος από αυτό το βήμα και επίλεξε την έτοιμη αρχική ασπρόμαυρη μάσκα. Η επανάληψη αντιγράφει τη μάσκα και εφαρμόζει τα επόμενα βήματα· δεν αναδημιουργεί τα σχήματα του GAME.'],
   ['DarkStructureEnhance settings were not recorded. Choose them manually in PixInsight.','Οι ρυθμίσεις του DarkStructureEnhance δεν καταγράφηκαν. Επίλεξέ τες χειροκίνητα στο PixInsight.'],
   ['External masks on grouped scripts cannot be restored safely.','Οι εξωτερικές μάσκες σε ομαδοποιημένα scripts δεν μπορούν να αποκατασταθούν με ασφάλεια.'],
   ['Not reached until earlier blocker is resolved.','Δεν εκτελείται μέχρι να επιλυθεί το προηγούμενο εμπόδιο.'],
   ['No applied processes to replay.','Δεν υπάρχουν εφαρμοσμένες διεργασίες για επανάληψη.'],
   ['consecutive processes can run from the selected input state.','συνεχόμενες διεργασίες μπορούν να εκτελεστούν από την επιλεγμένη κατάσταση εισόδου.'],
   ['Historical mask state is unknown.','Η ιστορική κατάσταση μάσκας είναι άγνωστη.'],
   ['This step needs the original historical mask:','Αυτό το βήμα χρειάζεται την αρχική ιστορική μάσκα:'],
   ['This step needs historical reference images or creates another image.','Αυτό το βήμα χρειάζεται ιστορικές εικόνες αναφοράς ή δημιουργεί άλλη εικόνα.'],
   ['This process is not yet supported by the replay exporter:','Αυτή η διεργασία δεν υποστηρίζεται ακόμη από την εξαγωγή επανάληψης:'],
   ['This step uses the global RGB working space, whose historical settings are unavailable.','Αυτό το βήμα χρησιμοποιεί global RGB working space, του οποίου οι ιστορικές ρυθμίσεις δεν είναι διαθέσιμες.'],
   ['Serialized process code is not a supported constructor and parameter assignment sequence.','Ο καταγεγραμμένος κώδικας δεν έχει υποστηριζόμενη μορφή δημιουργίας διεργασίας και ανάθεσης παραμέτρων.'],
   ['Select an image and a consecutive range of applied processes. Run the downloaded .js in PixInsight with an input in the state BEFORE the first selected step. Replay checks all selected tools and asks for reference images and masks before processing a new copy. A final replay report can be saved as text; historical reference images are not restored.',
    'Επίλεξε εικόνα και συνεχόμενο εύρος εφαρμοσμένων διεργασιών. Εκτέλεσε το .js στο PixInsight με εικόνα στην κατάσταση ΠΡΙΝ από το πρώτο επιλεγμένο βήμα. Η επανάληψη ελέγχει όλα τα επιλεγμένα εργαλεία και ζητά εικόνες αναφοράς και μάσκες πριν επεξεργαστεί νέο αντίγραφο. Η τελική αναφορά επανάληψης αποθηκεύεται ως κείμενο· οι ιστορικές εικόνες αναφοράς δεν αποκαθίστανται.'],
   ['inversion not recorded; choose Color invert','η αντιστροφή δεν καταγράφηκε· επιλογή Color invert'],['Mask requested in PixInsight:','Επιλογή μάσκας στο PixInsight:'],['Mask value inversion ON (1-mask)','Αντιστροφή τιμών μάσκας ON (1-mask)'],['Mask value inversion OFF','Αντιστροφή τιμών μάσκας OFF'],
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
      "Connections are included in Save report (HTML), together with tree edits and change history. Browser storage is also used when available.",
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
      "Includes the selected open images and their available initial/recent history. Closed images, older mask versions and unrecorded connections cannot be recovered automatically. Image references are detected in PixelMath, ChannelCombination, LRGBCombination, NarrowbandHueCombination, ImageBlend, ChannelExtraction, specific image ID parameters and masks. The same initial processing may appear in multiple images.",
      "Περιλαμβάνονται οι επιλεγμένες ανοιχτές εικόνες και το διαθέσιμο αρχικό/νεότερο ιστορικό τους. Κλειστές εικόνες, παλιές εκδόσεις μάσκας και συνδέσεις που δεν καταγράφηκαν δεν μπορούν να ανακτηθούν αυτόματα. Αναφορές εικόνων εντοπίζονται σε PixelMath, ChannelCombination, LRGBCombination, NarrowbandHueCombination, ImageBlend, ChannelExtraction, συγκεκριμένες παραμέτρους image ID και μάσκες. Η ίδια αρχική επεξεργασία μπορεί να εμφανίζεται σε περισσότερες από μία εικόνες."
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
   ['SelectiveColorCorrection includes the installed Toolbox source in the replay file and supplies the recorded parameters directly. Keep that installed source available at the exported include path.','Το SelectiveColorCorrection συμπεριλαμβάνει τον εγκατεστημένο κώδικα Toolbox στο αρχείο επανάληψης και του δίνει απευθείας τις καταγεγραμμένες παραμέτρους. Ο εγκατεστημένος κώδικας πρέπει να είναι διαθέσιμος στη διαδρομή include της εξαγωγής.'],
   ['SelectiveColorCorrection requires complete saved parameters, valid serialization and its readable installed source file.','Το SelectiveColorCorrection απαιτεί πλήρεις αποθηκευμένες παραμέτρους, έγκυρο κώδικα και αναγνώσιμο εγκατεστημένο αρχείο πηγής.'],
   ['SelectiveColorCorrection requires the original image to remain open with its recorded processing history. The matching saved Script instance is reused without changing its read-only properties.','Το SelectiveColorCorrection απαιτεί να παραμένει ανοιχτή η αρχική εικόνα με το καταγεγραμμένο ιστορικό της. Χρησιμοποιείται η αντίστοιχη αποθηκευμένη κλήση Script χωρίς αλλαγή των ιδιοτήτων που είναι μόνο για ανάγνωση.'],
   ['SelectiveColorCorrection imported mask is not recorded and cannot be reconstructed.','Η εισαγόμενη μάσκα του SelectiveColorCorrection δεν έχει καταγραφεί και δεν μπορεί να ανακατασκευαστεί.'],
   ['SelectiveColorCorrection requires complete saved parameters, valid serialization and a recorded script checksum.','Το SelectiveColorCorrection απαιτεί πλήρεις αποθηκευμένες παραμέτρους, έγκυρο κώδικα και καταγεγραμμένο checksum του script.'],
   ['SelectiveColorCorrection needs an unavailable historical mask or reference image.','Το SelectiveColorCorrection χρειάζεται μη διαθέσιμη ιστορική μάσκα ή εικόνα αναφοράς.'],
   ['PerfectPalettePicker: start the range at this step, select grayscale inputs and explicitly choose their state: already prepared, or linear with input stretch to median 0.25. Replays the recorded combination into a new RGB image. Other unrecorded channel preparation is not reconstructed.','PerfectPalettePicker: ξεκίνα το εύρος σε αυτό το βήμα, διάλεξε grayscale εισόδους και όρισε την κατάστασή τους: ήδη προετοιμασμένες ή linear με stretch εισόδου σε διάμεσο 0,25. Επαναλαμβάνει τον καταγεγραμμένο συνδυασμό σε νέα RGB εικόνα. Άλλη μη καταγεγραμμένη προετοιμασία καναλιών δεν ανακατασκευάζεται.'],
   ['PerfectPalettePicker: start the range at this step and select prepared grayscale inputs in PixInsight. Replays the recorded final combination into a new RGB image; earlier channel preparation is not reconstructed.','PerfectPalettePicker: ξεκίνα το εύρος σε αυτό το βήμα και διάλεξε προετοιμασμένες grayscale εισόδους στο PixInsight. Επαναλαμβάνει τον καταγεγραμμένο τελικό συνδυασμό σε νέα RGB εικόνα· η προηγούμενη προετοιμασία καναλιών δεν ανακατασκευάζεται.'],
   ['Start the selected range at PerfectPalettePicker and choose its prepared inputs.','Ξεκίνα το επιλεγμένο εύρος στο PerfectPalettePicker και διάλεξε τις προετοιμασμένες εισόδους του.'],
   ['Choose prepared inputs in PixInsight for the recorded palette combination.','Διάλεξε προετοιμασμένες εισόδους στο PixInsight για τον καταγεγραμμένο συνδυασμό παλέτας.'],
   ['Grouped component; excluded from workflow replay.','Υποβήμα ομάδας· εξαιρείται από την επανάληψη της ακολουθίας.'],
   ['Substep','Υποβήμα'],['Original history entries:','Αρχικές εγγραφές ιστορικού:'],
   ['Grouped from consecutive history entries; original records are preserved below.','Ομαδοποίηση από διαδοχικές εγγραφές ιστορικού· οι αρχικές εγγραφές διατηρούνται παρακάτω.'],['Show recorded component steps','Προβολή επιμέρους καταγεγραμμένων βημάτων'],
   ['Possible connection','Πιθανή σύνδεση'],['Possible connection (unconfirmed)','Πιθανή σύνδεση (μη επιβεβαιωμένη)'],
   ['User-selected original input; actual use by PerfectPalettePicker is unconfirmed','Αρχική εικόνα επιλεγμένη από τον χρήστη· η πραγματική χρήση της από το PerfectPalettePicker δεν έχει επιβεβαιωθεί'],
   ['Possible inputs from user-selected originals (unconfirmed):','Πιθανές είσοδοι από τις επιλεγμένες αρχικές εικόνες (μη επιβεβαιωμένες):'],
   ['Original input (selected)','Αρχική εικόνα (επιλεγμένη)'],['Connected images appear first; images without cross-image connections appear last. Existing order is preserved within each group. Column order does not establish when files were opened or images were created.','Οι συσχετισμένες εικόνες εμφανίζονται πρώτες και οι εικόνες χωρίς συνδέσεις με άλλες εικόνες στο τέλος. Η υπάρχουσα σειρά διατηρείται μέσα σε κάθε ομάδα. Η σειρά των στηλών δεν αποδεικνύει πότε ανοίχτηκαν αρχεία ή δημιουργήθηκαν εικόνες.'],
   ['Original inputs (selected)','Αρχικές εικόνες (επιλεγμένες)'],['File-backed images (origin unconfirmed)','Εικόνες με αρχείο (μη επιβεβαιωμένη προέλευση)'],
   ['Processing summary','Σύνοψη επεξεργασίας'],['Overview of applied steps across the selected images. Input references do not establish a complete or absolute chronology. Select the final image explicitly.','Σύνοψη των εφαρμοσμένων βημάτων στις επιλεγμένες εικόνες. Οι αναφορές εισόδου δεν τεκμηριώνουν πλήρη ή απόλυτη χρονολογική σειρά. Επίλεξε την τελική εικόνα.'],
   ['Referenced inputs','Αναφορές εισόδου'],['Channel combinations / PixelMath','Συνδυασμοί καναλιών / PixelMath'],['Historical masks','Ιστορικές μάσκες'],['Processes used','Εργαλεία που χρησιμοποιήθηκαν'],['Category','Κατηγορία'],['Images / processes','Εικόνες / εργαλεία'],['Final image','Τελική εικόνα'],['Not selected','Δεν επιλέχθηκε'],
   ['Final image selection is saved in this browser. It does not rewrite the HTML file.','Η επιλογή τελικής εικόνας αποθηκεύεται σε αυτόν τον browser. Δεν αλλάζει το αρχείο HTML.'],
   ['Copy step for replay','Αντιγραφή βήματος για επανάληψη'],['Process code with requirements','Κώδικας process με προϋποθέσεις'],
   ['Replay requirements: use the image state before this step, matching reference images and the recorded mask state. Historical source and mask pixels may be unavailable. Review execution targets and output settings.','Προϋποθέσεις επανάληψης: χρησιμοποίησε την κατάσταση της εικόνας πριν από το βήμα, τις αντίστοιχες εικόνες αναφοράς και την καταγεγραμμένη κατάσταση μάσκας. Τα ιστορικά pixels εισόδου και μάσκας μπορεί να μην είναι διαθέσιμα. Έλεγξε τους στόχους εκτέλεσης και τις ρυθμίσεις εξόδου.'],
   ['Color image (current state)','Έγχρωμη εικόνα (τρέχουσα κατάσταση)'],['Grayscale image (current state)','Ασπρόμαυρη εικόνα (τρέχουσα κατάσταση)'],
   ["Compare any two stages", "Σύγκριση δύο οποιωνδήποτε σταδίων"],
   ["Compare stages", "Σύγκριση σταδίων"],
   ["Select two different available stages.", "Επίλεξε δύο διαφορετικά διαθέσιμα στάδια."],
   ["Connection already exists.", "Η σύνδεση υπάρχει ήδη."],
   ["connections saved in this browser. Save report (HTML) for a portable copy.", "συνδέσεις αποθηκεύτηκαν στον browser. Εξαγωγή JSON για φορητό αντίγραφο."],
   ["connections. Browser storage unavailable; use Save report (HTML).", "συνδέσεις. Η αποθήκευση στον browser δεν είναι διαθέσιμη· κάνε εξαγωγή JSON."],
   ["Annotation file too large.", "Το αρχείο συνδέσεων είναι πολύ μεγάλο."],
   ["Saved connections could not be restored. Import your JSON backup.", "Δεν έγινε επαναφορά των συνδέσεων. Εισήγαγε το αντίγραφο JSON."],
   ["Connections are included in Save report (HTML), together with tree edits and change history. Browser storage is also used when available.", "Οι συνδέσεις αποθηκεύονται αυτόματα στον browser όταν είναι διαθέσιμη η αποθήκευση. Κράτησε φορητό αντίγραφο με εξαγωγή JSON και επανάφερε τις συνδέσεις του ίδιου report με εισαγωγή JSON. Το HTML δεν αλλάζει."],
   ["Select two available previews, including stages from different images. A is on the left; B is on the right. Current image previews are not historical source pixels.", "Επίλεξε δύο διαθέσιμες προεπισκοπήσεις, ακόμη και από διαφορετικές εικόνες. Α αριστερά, Β δεξιά. Οι τρέχουσες προεπισκοπήσεις δεν είναι ιστορικά pixels εισόδου."],
   ["A — left", "A — αριστερά"],
   ["B — right", "B — δεξιά"],
   ["Drop a tree node here", "Σύρε εδώ έναν κόμβο του δέντρου"],
   ["No preview is available for this node.", "Δεν υπάρχει διαθέσιμη προεπισκόπηση για αυτόν τον κόμβο."],
   ["Organize tree", "Οργάνωση δέντρου"],
   ["Find node", "Αναζήτηση κόμβου"],
   ["Image or process name", "Όνομα εικόνας ή διεργασίας"],
   ["Matching tree nodes", "Κόμβοι που ταιριάζουν"],
   ["Select a node", "Επίλεξε κόμβο"],
   ["Image branch", "Κλάδος εικόνας"],
   ["All images", "Όλες οι εικόνες"],
   ["Only the path to this image", "Μόνο η διαδρομή προς αυτή την εικόνα"],
   ["Collapse / expand branch", "Σύμπτυξη / ανάπτυξη κλάδου"],
   ["Expand all branches", "Ανάπτυξη όλων των κλάδων"],
   ["Connection details", "Λεπτομέρειες σύνδεσης"],
   ["The exact historical source pixels are unknown.", "Τα ακριβή ιστορικά pixels εισόδου δεν είναι γνωστά."],
   ["Select an image branch to show its path.", "Επίλεξε κλάδο εικόνας για να προβληθεί η διαδρομή του."],
   ['Before / after','Πριν / μετά'],['Before','Πριν'],['After','Μετά'],['Enlarge comparison','Μεγέθυνση σύγκρισης'],
   ['Before/after comparison unavailable: historical pixels are missing.','Η σύγκριση πριν/μετά δεν είναι διαθέσιμη: λείπουν ιστορικά pixels.'],
   ['Before/after comparison unavailable: image dimensions changed.','Η σύγκριση πριν/μετά δεν είναι διαθέσιμη: άλλαξαν οι διαστάσεις της εικόνας.'],
   ['Preview resolution follows the selected report size. Dark previews use a display-only auto stretch; image pixels are unchanged. Zoom and pan are shared by both images.','Η ανάλυση προεπισκόπησης ακολουθεί το επιλεγμένο μέγεθος report. Τα σκοτεινά previews έχουν αυτόματο stretch μόνο για προβολή· τα pixels δεν αλλάζουν. Η μεγέθυνση και η μετακίνηση είναι κοινές για τις δύο εικόνες.'],
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
   "   window.updateReplayRange=function(reset){",
   "      var choice=document.getElementById('replay_image'),first=document.getElementById('replay_start'),last=document.getElementById('replay_end');",
   "      if(!choice||!first||!last||typeof workspaceReplayData==='undefined')return;",
   "      var image=workspaceReplayData[Number(choice.value)];if(!image)return;",
   "      if(reset){",
   "         while(first.firstChild)first.removeChild(first.firstChild);while(last.firstChild)last.removeChild(last.firstChild);",
   "         for(var i=0;i<image.steps.length;++i){",
   "            var step=image.steps[i],label=step.number+(step.substep?'.'+step.substep:'')+' — '+step.title;",
   "            var a=document.createElement('option');a.value=String(i);a.textContent=label;a.setAttribute('data-no-i18n','');first.appendChild(a);",
   "            var b=document.createElement('option');b.value=String(i);b.textContent=label;b.setAttribute('data-no-i18n','');last.appendChild(b);",
   "         }first.value='0';last.value=String(Math.max(0,image.steps.length-1));",
   "      }",
   "      if(Number(last.value)<Number(first.value))last.value=first.value;",
   "      var start=Number(first.value),end=Number(last.value),ready=0,blocked=false,list=document.getElementById('replay_readiness');",
   "      var namingId='';for(var ni=start;ni<=end&&ni<image.steps.length;++ni)if(image.steps[ni].action==='identifier'&&!image.steps[ni].reason)namingId=image.steps[ni].identifier;",
   "      if(list)while(list.firstChild)list.removeChild(list.firstChild);",
   "      for(var j=start;j<=end&&j<image.steps.length;++j){",
   "         var step=image.steps[j],reason=step.reason||(step.action==='palette'&&j>start?'Start the selected range at PerfectPalettePicker and choose its prepared inputs.':step.action==='game'&&j>start?'Start the selected range at GAME and select its completed original mask.':step.action==='external'&&j>start?'Start the selected range at the external prepared result.':'');if(reason)blocked=true;if(!blocked)++ready;",
   "         if(list){var item=document.createElement('li');item.className=reason?'replay-unsupported':step.mask||step.warning?'replay-warning':'replay-supported';item.textContent=step.number+(step.substep?'.'+step.substep:'')+' — '+step.title+': '+translated(reason?'STOP — '+reason:blocked?'Not reached until earlier blocker is resolved.':step.warning?'WARNING — '+step.warning:step.action==='palette'?'Choose prepared inputs in PixInsight for the recorded palette combination.':step.action==='identifier'?'Naming handled at creation: '+namingId+'_APA_replay':'Ready for replay');list.appendChild(item);}",
   "         if(list&&step.mask&&!reason)item.textContent+=' — WARNING — '+translated('Mask requested in PixInsight:')+' '+step.mask.name+' ('+translated(typeof step.mask.inverted!=='boolean'?'inversion not recorded; choose Color invert':step.mask.inverted?'Mask value inversion ON (1-mask)':'Mask value inversion OFF')+')';",
   "      }",
   "      var status=document.getElementById('replay_status');if(status)status.textContent=translated(image.steps.length?ready+' consecutive processes can run from the selected input state.':'No applied processes to replay.');",
   "      var button=document.getElementById('replay_export');if(button)button.disabled=!ready||blocked;",
   "   };",
   "   window.exportReplayScript=function(){",
   "      var image=workspaceReplayData[Number(document.getElementById('replay_image').value)],start=Number(document.getElementById('replay_start').value),end=Number(document.getElementById('replay_end').value);",
   "      if(!image||!image.steps[start]||!image.steps[end]||end<start)return;",
   "      for(var i=start;i<=end;++i)if(image.steps[i].reason||((image.steps[i].action==='palette'||image.steps[i].action==='game'||image.steps[i].action==='external')&&i>start))return;",
   "      var code=buildWorkspaceReplayScript(image,start,end),blob=new Blob([code],{type:'text/javascript;charset=utf-8'}),url=URL.createObjectURL(blob);",
   "      var link=document.createElement('a');link.href=url;link.download='AstroProcessAtlas_replay_'+image.id.replace(/[^A-Za-z0-9_-]/g,'_')+'.js';document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url);},1000);",
   "   };",
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
   "      window.updateReplayRange(false);",
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
   "      if(window.organizeTree)window.organizeTree();",
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
   "      if(event){event.stopPropagation();if(event.preventDefault)event.preventDefault();}",
   "      if((!node.header&&!matchesFilter(node))||(searchedImage()&&searchedImage().image!==node.image)){var search=document.getElementById('report_search'),tool=document.getElementById('tool_filter'),mask=document.getElementById('mask_filter'),applied=document.getElementById('applied_filter');if(search)search.value='';if(tool)tool.value='all';if(mask)mask.checked=false;if(applied)applied.checked=false;}searchSelectedImage=null;",
   "      for(var i=0;i<nodes.length;++i)if(nodes[i].header&&nodes[i].image===node.image){",
   "         window.showImage(nodes[i].id);selectedNode=id;paintGraphFocus(id);break;",
   "      }",
   "      var detail=document.getElementById(id);if(!detail){var members=node.memberIds||[];for(var m=0;m<members.length&&!detail;++m)detail=document.getElementById(members[m]);}if(detail){var parent=detail;while(parent){parent.hidden=false;if(String(parent.tagName||'').toLowerCase()==='details')parent.open=true;if(parent.classList&&parent.classList.contains('image-report'))break;parent=parent.parentElement||parent.parentNode;}if(typeof detail.scrollIntoView==='function')detail.scrollIntoView({block:'start',behavior:'smooth'});}",
   "   };",
   "   window.graphBackgroundClick = function(event) {",
   "      if(event.target.closest&&event.target.closest('[data-node], a, path[data-from]'))return;",
   "      window.showImage('all');",
   "   };",
   "   window.toggleAtlasReplay=function(id,button){var panel=document.getElementById(id);if(!panel)return;var open=!panel.open,names=['replay_single_panel','chain_workflow'];for(var i=0;i<names.length;++i){var other=document.getElementById(names[i]);if(other)other.open=names[i]===id&&open;}var buttons=document.querySelectorAll('.replay-launchers button');for(var i=0;i<buttons.length;++i)buttons[i].setAttribute('aria-expanded',String(buttons[i].getAttribute('aria-controls')===id&&open));};",
   "   if(document.addEventListener)document.addEventListener('toggle',function(event){if(typeof atlasReportData==='undefined'||!event.target.open||!event.target.querySelectorAll)return;var fields=event.target.querySelectorAll('textarea[data-apa-source]');for(var i=0;i<fields.length;++i)if(!fields[i].closest||fields[i].closest('details')===event.target)hydrateAtlasReportSource(fields[i],atlasReportData);},true);",
   "   if(typeof atlasReportData!=='undefined'&&document.querySelectorAll){var openSources=document.querySelectorAll('textarea[data-apa-source]');for(var i=0;i<openSources.length;++i){var owner=openSources[i].closest?openSources[i].closest('details'):null;if(owner&&owner.open)hydrateAtlasReportSource(openSources[i],atlasReportData);}}",
   "   window.copyCode = function(button) {",
   "      var t=button.parentNode.querySelector('textarea');if(typeof atlasReportData!=='undefined')hydrateAtlasReportSource(t,atlasReportData); t.focus(); t.select(); t.setSelectionRange(0,t.value.length);",
   "      function done(){button.textContent=translated('Copied');setTimeout(function(){button.textContent=translated('Copy');},1500);}",
   "      function fallback(){try{if(document.execCommand('copy')){done();return;}}catch(e){}button.textContent=translated('Selected \u2014 Ctrl+C');}",
   "      if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t.value).then(done,fallback); else fallback();",
   "   };",
   "   var manual = [], ns = 'http:\u002f\u002fwww.w3.org/2000/svg', nodes = workspaceGraphData.nodes;",
   "   function find(id){for(var i=0;i<nodes.length;++i)if(nodes[i].id===id)return nodes[i];return null;}",
   "   var stagePreviews=[];",
   "   function collectStagePreviews(){",
   "      stagePreviews=[];",
   "      for(var i=0;i<nodes.length;++i){",
   "         var n=nodes[i],card=document.getElementById(n.id);if(!card||!card.querySelector)continue;",
   "         var comparison=n.header?null:card.querySelector('.comparison'),preview=card.querySelector(n.header?'.image-snapshot':'.thumb-box > img');",
   "         var label=n.image+' \u2014 '+n.label;",
   "         if(comparison){",
   "            stagePreviews.push({id:n.id+':before',label:label+' \u2014 Before',src:comparison.getAttribute('data-before')});",
   "            stagePreviews.push({id:n.id+':after',label:label+' \u2014 After',src:comparison.getAttribute('data-after')});",
   "         }else if(preview&&(n.header||!/current image|no pixels/i.test(preview.getAttribute('alt')||'')))stagePreviews.push({id:n.id+':current',label:label+(n.header?' \u2014 Current image':''),src:preview.getAttribute('src')});",
   "      }",
   "      var a=document.getElementById('stage_compare_a'),b=document.getElementById('stage_compare_b');if(!a||!b)return;",
   "      for(var j=0;j<stagePreviews.length;++j){",
   "         var option=document.createElement('option');option.value=stagePreviews[j].id;option.textContent=stagePreviews[j].label;option.setAttribute('data-no-i18n','');a.appendChild(option);b.appendChild(option.cloneNode(true));",
   "      }",
   "      if(stagePreviews.length>1)b.value=stagePreviews[1].id;window.syncComparisonStages();",
   "   }",
   "   window.syncComparisonStages=function(){",
   "      var slots=['a','b'];",
   "      var markers=document.querySelectorAll('#workspace_graph .stage-marker');",
   "      for(var i=0;i<markers.length;++i)markers[i].parentNode.removeChild(markers[i]);",
   "      for(var i=0;i<slots.length;++i){",
   "         var select=document.getElementById('stage_compare_'+slots[i]),name=document.getElementById('stage_name_'+slots[i]);if(!select)continue;",
   "         for(var j=0;j<stagePreviews.length;++j)if(stagePreviews[j].id===select.value){",
   "            if(name)name.textContent=stagePreviews[j].label;",
   "            var id=select.value.slice(0,select.value.lastIndexOf(':')),node=find(id);",
   "            var group=document.querySelector('#workspace_graph g[data-node=\"'+id+'\"]');",
   "            if(group&&node){var marker=document.createElementNS('http:\u002f\u002fwww.w3.org/2000/svg','text');marker.setAttribute('class','stage-marker');marker.setAttribute('data-no-i18n','');marker.setAttribute('x',node.x+214+(i*14));marker.setAttribute('y',node.y+65);marker.textContent=slots[i].toUpperCase();group.appendChild(marker);}",
   "         }",
   "      }",
   "   };",
   "   var stageDragGhost=null,stageDragOrigin=null,stageDragTarget=null;",
   "   function clearStageDragVisuals(){if(window.clearTreeInsertion)window.clearTreeInsertion();",
   "      if(stageDragGhost&&stageDragGhost.parentNode)stageDragGhost.parentNode.removeChild(stageDragGhost);",
   "      if(stageDragOrigin)stageDragOrigin.classList.remove('is-drag-origin');",
   "      if(stageDragTarget){stageDragTarget.classList.remove('is-drop-target');stageDragTarget.classList.remove('drag-over');}",
   "      stageDragGhost=stageDragOrigin=stageDragTarget=null;",
   "   }",
   "   function moveStageDragVisuals(event){",
   "      if(!stageDragGhost){",
   "         var node=find(pointerStageDrag.id),source=document.querySelector('#workspace_graph g[data-node=\"'+pointerStageDrag.id+'\"]');",
   "         if(!node||!source)return;",
   "         var box=source.getBoundingClientRect();",
   "         stageDragGhost=document.createElementNS('http:\u002f\u002fwww.w3.org/2000/svg','svg');",
   "         stageDragGhost.setAttribute('class','stage-drag-ghost');stageDragGhost.setAttribute('aria-hidden','true');",
   "         stageDragGhost.setAttribute('viewBox',node.x+' '+node.y+' 250 72');",
   "         stageDragGhost.setAttribute('width',box.width);stageDragGhost.setAttribute('height',box.height);",
   "         var copy=source.cloneNode(true);copy.removeAttribute('class');stageDragGhost.appendChild(copy);",
   "         document.body.appendChild(stageDragGhost);",
   "         pointerStageDrag.offsetX=pointerStageDrag.x-box.left;pointerStageDrag.offsetY=pointerStageDrag.y-box.top;",
   "         stageDragOrigin=source;source.classList.add('is-drag-origin');",
   "      }",
   "      stageDragGhost.style.left=(event.clientX-pointerStageDrag.offsetX)+'px';",
   "      stageDragGhost.style.top=(event.clientY-pointerStageDrag.offsetY)+'px';",
   "      var hit=document.elementFromPoint(event.clientX,event.clientY),target=hit&&hit.closest?hit.closest('.stage-drop, #workspace_graph g[data-node]'):null;",
   "      if(stageDragTarget&&stageDragTarget!==target){stageDragTarget.classList.remove('is-drop-target');stageDragTarget.classList.remove('drag-over');}",
   "      stageDragTarget=target;",
   "      if(target&&target!==stageDragOrigin)target.classList.add(target.classList.contains('stage-drop')?'drag-over':'is-drop-target');",
   "   }",
   "   var collapsedBranches={};",
   "   window.showConnection=function(event,origin,index){",
   "      if(event){event.preventDefault();event.stopPropagation();}",
   "      var edge=origin==='manual'?manual[index]:workspaceGraphData.edges[index];if(!edge)return;",
   "      var a=find(edge.from),b=find(edge.to);if(!a||!b)return;",
   "      var provenance=edge.provenance||(origin==='manual'?'manual':'parameter');",
   "      var labels={recorded:'Recorded in history',parameter:'Detected from parameters',manual:'User annotation',possible:'Possible connection (unconfirmed)'};",
   "      var text=translated(labels[provenance]||labels.parameter)+'\\n'+a.image+' \u2014 '+a.label+' \u2192 '+b.image+' \u2014 '+b.label+'\\n'+edge.detail;",
   "      if(edge.uncertain)text+='\\n'+translated('The exact historical source pixels are unknown.');",
   "      if(edge.redo)text+='\\n'+translated('Redo \u2014 not applied');",
   "      document.getElementById('connection_description').textContent=text;",
   "      var panel=document.getElementById('connection_info');panel.hidden=false;if(panel.scrollIntoView)panel.scrollIntoView({block:'nearest',behavior:'smooth'});",
   "   };",
   "   window.findTreeNodes=function(){",
   "      var input=document.getElementById('tree_node_search'),select=document.getElementById('tree_node_results');if(!input||!select)return;",
   "      while(select.firstChild)select.removeChild(select.firstChild);",
   "      var placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=translated('Select a node');select.appendChild(placeholder);",
   "      var query=input.value.trim().toLowerCase();",
   "      for(var i=0;i<nodes.length;++i){",
   "         var label=nodes[i].image+' \u2014 '+nodes[i].label;",
   "         if(!query||label.toLowerCase().indexOf(query)>=0){var option=document.createElement('option');option.value=nodes[i].id;option.textContent=label;option.setAttribute('data-no-i18n','');select.appendChild(option);}",
   "      }",
   "   };",
   "   window.jumpToTreeNode=function(id){",
   "      var node=find(id);if(!node)return;",
   "      delete collapsedBranches['$'+node.image];",
   "      var select=document.getElementById('tree_image');if(select){for(var i=0;i<nodes.length;++i)if(nodes[i].header&&nodes[i].image===node.image)select.value=nodes[i].id;}",
   "      window.selectGraphNode(id);window.organizeTree();",
   "      var group=document.querySelector('#workspace_graph g[data-node=\"'+id+'\"]');if(group&&group.scrollIntoView)group.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});",
   "   };",
   "   window.organizeTree=function(){",
   "      var image=document.getElementById('tree_image'),path=document.getElementById('tree_path_only');if(!image||!path)return;",
   "      var target=find(image.value),related={};",
   "      if(path.checked&&target){",
   "         related['$'+target.image]=true;",
   "         var edges=workspaceGraphData.edges.concat(manual),changed=true;",
   "         while(changed){changed=false;for(var i=0;i<edges.length;++i){",
   "            var e=edges[i],a=find(e.from),b=find(e.to);if(e.redo||!a||!b)continue;",
   "            if(related['$'+b.image]&&!related['$'+a.image]){related['$'+a.image]=true;changed=true;}",
   "         }}",
   "      }",
   "      var groups=document.querySelectorAll('#workspace_graph .graph-node'),visible={};",
   "      for(var i=0;i<groups.length;++i){",
   "         var node=find(groups[i].getAttribute('data-node'));if(!node)continue;",
   "         var hidden=(path.checked&&target&&!related['$'+node.image])||(!node.header&&collapsedBranches['$'+node.image]);",
   "         groups[i].classList.toggle('is-tree-hidden',!!hidden);if(!hidden)visible[node.id]=true;",
   "      }",
   "      var paths=document.querySelectorAll('#workspace_graph path[data-from]');",
   "      function displayedNode(node){if(!node||node.header||!collapsedBranches['$'+node.image])return node;for(var j=0;j<nodes.length;++j)if(nodes[j].header&&nodes[j].image===node.image)return nodes[j];return node;}",
   "      for(var i=0;i<paths.length;++i){",
   "         var originalA=find(paths[i].getAttribute('data-from')),originalB=find(paths[i].getAttribute('data-to')),a=displayedNode(originalA),b=displayedNode(originalB);",
   "         var internal=originalA&&originalB&&originalA.image===originalB.image;",
   "         var hidden=!a||!b||!visible[a.id]||!visible[b.id]||(internal&&(a!==originalA||b!==originalB));",
   "         paths[i].classList.toggle('is-tree-hidden',!!hidden);",
   "         if(paths[i]._treeOriginalD===undefined)paths[i]._treeOriginalD=paths[i].getAttribute('d');",
   "         if(!hidden&&(a!==originalA||b!==originalB)){",
   "            var ax=a.x+250,ay=a.y+36,bx=b.x,by=b.y+36;if(a.x>b.x){ax=a.x;bx=b.x+250;}if(a.x===b.x)bx=b.x+250;var bend=Math.max(45,Math.abs(bx-ax)/2);",
   "            paths[i].setAttribute('d','M'+ax+','+ay+' C'+(ax+bend)+','+ay+' '+(bx-bend)+','+by+' '+bx+','+by);",
   "         }else if(paths[i]._treeOriginalD!==null)paths[i].setAttribute('d',paths[i]._treeOriginalD);",
   "      }",
   "      var status=document.getElementById('tree_organization_status');if(status)status.textContent=path.checked&&!target?translated('Select an image branch to show its path.'):'';",
   "   };",
   "   window.toggleTreeBranch=function(){",
   "      var select=document.getElementById('tree_image'),node=select&&find(select.value);if(!node)return;",
   "      collapsedBranches['$'+node.image]=!collapsedBranches['$'+node.image];window.organizeTree();",
   "   };",
   "   window.resetTreeOrganization=function(){",
   "      collapsedBranches={};var image=document.getElementById('tree_image'),path=document.getElementById('tree_path_only');if(image)image.value='';if(path)path.checked=false;window.organizeTree();",
   "   };",
   "   var pointerStageDrag=null,suppressStageClickUntil=0;",
   "   window.beginComparisonDrag=function(event,id){",
   "      if(event.button!==0)return;",
   "      clearStageDragVisuals();",
   "      pointerStageDrag={id:id,x:event.clientX,y:event.clientY,pointer:event.pointerId,moved:false};",
   "   };",
   "   window.addEventListener('pointermove',function(event){",
   "      if(!pointerStageDrag||event.pointerId!==pointerStageDrag.pointer)return;",
   "      if(Math.abs(event.clientX-pointerStageDrag.x)+Math.abs(event.clientY-pointerStageDrag.y)>8){",
   "         pointerStageDrag.moved=true;event.preventDefault();moveStageDragVisuals(event);if(window.previewTreeInsertion&&window.previewTreeInsertion(event,pointerStageDrag.id))return;",
   "         var controls=document.getElementById('stage_comparison_controls');if(controls)controls.open=true;",
   "      }",
   "   },{passive:false});",
   "   window.addEventListener('pointerup',function(event){",
   "      if(!pointerStageDrag||event.pointerId!==pointerStageDrag.pointer)return;",
   "      var drag=pointerStageDrag;pointerStageDrag=null;clearStageDragVisuals();if(!drag.moved)return;",
   "      suppressStageClickUntil=Date.now()+400;event.preventDefault();if(window.finishTreeInsertion&&window.finishTreeInsertion(event,drag.id))return;",
   "      var hit=document.elementFromPoint(event.clientX,event.clientY);if(!hit||!hit.closest)return;",
   "      var slot=hit.closest('.stage-drop'),target=hit.closest('#workspace_graph [data-node]');",
   "      var drop={currentTarget:slot||target,dataTransfer:{getData:function(){return drag.id;}},preventDefault:function(){},stopPropagation:function(){}};",
   "      if(slot)window.dropComparisonStage(drop,slot.id==='stage_drop_a'?'a':'b');",
   "      else if(target)window.dropComparedNodes(drop,target.getAttribute('data-node'));",
   "   });",
   "   window.addEventListener('pointercancel',function(){pointerStageDrag=null;clearStageDragVisuals();if(window.clearTreeInsertion)window.clearTreeInsertion();});",
   "   window.addEventListener('click',function(event){",
   "      if(Date.now()<suppressStageClickUntil&&event.target.closest&&event.target.closest('#workspace_graph')){event.preventDefault();event.stopPropagation();}",
   "   },true);",
   "   function resultStage(id){",
   "      for(var i=0;i<stagePreviews.length;++i)if(stagePreviews[i].id===id+':after'||stagePreviews[i].id===id+':current')return stagePreviews[i];",
   "      return null;",
   "   }",
   "   window.dropComparedNodes=function(event,targetId){",
   "      event.preventDefault();if(event.stopPropagation)event.stopPropagation();event.currentTarget.classList.remove('drag-over');",
   "      var sourceId=event.dataTransfer.getData('application/x-astroprocessatlas-node');",
   "      var edit=document.getElementById('tree_edit_mode');if(edit&&edit.checked){window.addManualConnection(sourceId,targetId);return;}",
   "      var a=resultStage(sourceId),b=resultStage(targetId);",
   "      var status=document.getElementById('stage_compare_status');",
   "      if(sourceId===targetId){status.textContent=translated('Select two different available stages.');return;}",
   "      if(!a||!b){status.textContent=translated('No preview is available for this node.');return;}",
   "      document.getElementById('stage_compare_a').value=a.id;document.getElementById('stage_compare_b').value=b.id;",
   "      window.syncComparisonStages();window.compareSelectedStages(document.getElementById('stage_compare_button'));",
   "   };",
   "   window.dragComparisonStage=function(event,id){",
   "      if(!event.dataTransfer)return;",
   "      event.dataTransfer.setData('application/x-astroprocessatlas-node',id);event.dataTransfer.effectAllowed='copy';",
   "      if(event.stopPropagation)event.stopPropagation();",
   "      var controls=document.getElementById('stage_comparison_controls');if(controls)controls.open=true;",
   "   };",
   "   window.stageDragOver=function(event){",
   "      if(!event.dataTransfer||Array.prototype.indexOf.call(event.dataTransfer.types,'application/x-astroprocessatlas-node')<0)return;",
   "      event.preventDefault();event.dataTransfer.dropEffect='copy';event.currentTarget.classList.add('drag-over');",
   "   };",
   "   window.dropComparisonStage=function(event,slot){",
   "      event.preventDefault();event.currentTarget.classList.remove('drag-over');",
   "      var id=event.dataTransfer.getData('application/x-astroprocessatlas-node'),node=find(id),status=document.getElementById('stage_compare_status');",
   "      if(!node)return;",
   "      var selected=null;",
   "      // A dragged process node represents its result; headers represent the current image.",
   "      selected=resultStage(id);",
   "      if(!selected){status.textContent=translated('No preview is available for this node.');return;}",
   "      document.getElementById('stage_compare_'+slot).value=selected.id;window.syncComparisonStages();status.textContent='';",
   "      var a=document.getElementById('stage_compare_a'),b=document.getElementById('stage_compare_b');",
   "      if(a.value!==b.value)window.compareSelectedStages(document.getElementById('stage_compare_button'));",
   "   };",
   "   window.compareSelectedStages=function(button){",
   "      var a=document.getElementById('stage_compare_a'),b=document.getElementById('stage_compare_b'),status=document.getElementById('stage_compare_status');",
   "      var first=null,second=null;",
   "      for(var i=0;i<stagePreviews.length;++i){if(stagePreviews[i].id===a.value)first=stagePreviews[i];if(stagePreviews[i].id===b.value)second=stagePreviews[i];}",
   "      if(!first||!second||first.id===second.id){status.textContent=translated('Select two different available stages.');return;}",
   "      var wrapper=document.createElement('div');wrapper.className='comparison';",
   "      // Constant markup only. Image URLs and stage names are assigned through DOM properties.",
   "      wrapper.innerHTML='<div class=\"compare-stage\"><img alt=\"B\"><img class=\"compare-before\" alt=\"A\"><span class=\"compare-label before-label\">A</span><span class=\"compare-label after-label\">B</span><span class=\"compare-divider\" aria-hidden=\"true\"><span>\u2194</span></span><input class=\"compare-slider\" type=\"range\" min=\"0\" max=\"100\" value=\"50\" aria-label=\"A / B\" oninput=\"moveComparison(this)\" onchange=\"moveComparison(this)\"></div>';",
   "      wrapper.querySelector('img').src=second.src;wrapper.querySelector('.compare-before').src=first.src;",
   "      var caption=document.createElement('p');caption.setAttribute('data-no-i18n','');caption.textContent='A: '+first.label+' | B: '+second.label;wrapper.appendChild(caption);",
   "      window.openComparison({closest:function(){return wrapper;},focus:function(){button.focus();}});",
   "      status.textContent='';",
   "   };",
   "   var annotationIdentities=nodes.map(function(n){return{id:n.id,image:n.image,label:n.label};});",
   "   var annotationIdentity=JSON.stringify(annotationIdentities),annotationHash=2166136261;",
   "   for(var h=0;h<annotationIdentity.length;++h){annotationHash^=annotationIdentity.charCodeAt(h);annotationHash=Math.imul(annotationHash,16777619);}",
   "   var annotationKey='AstroProcessAtlas_links_'+(annotationHash>>>0).toString(16);",
   "   function validatedAnnotations(data){",
   "      if(!data||data.version!==1||!Array.isArray(data.edges)||JSON.stringify(data.nodes)!==annotationIdentity)throw Error('These annotations belong to a different report.');",
   "      if(data.edges.length>10000)throw Error('Too many connections.');",
   "      var result=[],seen={};",
   "      for(var i=0;i<data.edges.length;++i){var e=data.edges[i];",
   "         if(!e||!find(e.from)||!find(e.to)||e.from===e.to||typeof e.detail!=='string'||e.detail.length>4000)throw Error('Invalid connection.');",
   "         var key=JSON.stringify([e.from,e.to]);if(seen[key])continue;seen[key]=true;",
   "         result.push({from:e.from,to:e.to,detail:e.detail});",
   "      }return result;",
   "   }",
   "   function annotationData(){return{version:1,nodes:annotationIdentities,edges:manual};}",
   "   function saveAnnotations(){",
   "      try{window.localStorage.setItem(annotationKey,JSON.stringify(annotationData()));return true;}catch(e){return false;}",
   "   }",
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
   "         path.setAttribute('data-provenance','manual');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',translated('Connection details'));",
   "         (function(index){path.onclick=function(event){window.showConnection(event,'manual',index);};path.onkeydown=function(event){if(event.key==='Enter'||event.key===' ')window.showConnection(event,'manual',index);};})(i);",
   "         var title=document.createElementNS(ns,'title');title.setAttribute('data-no-i18n','');title.textContent=translated('User annotation: ')+edge.detail;path.appendChild(title);group.appendChild(path);",
   "      }",
   "      status(manual.length+' '+translated(saveAnnotations()?'connections saved in this browser. Save report (HTML) for a portable copy.':'connections. Browser storage unavailable; use Save report (HTML).'));",
   "      if(activeFocus)window.focusGraphImage(activeFocus);",
   "      window.applyReportFilters();",
   "   }",
   "   window.addManualConnection=function(from,to,detail){",
   "      if(!find(from)||!find(to)){status('Select two available nodes.');return false;}",
   "      if(from===to){status('Select two different nodes.');return false;}",
   "      for(var i=0;i<manual.length;++i)if(manual[i].from===from&&manual[i].to===to){status('Connection already exists.');return false;}",
   "      manual.push({from:from,to:to,detail:String(detail||'User connection').slice(0,4000)});draw();if(window.recordAtlasChange)window.recordAtlasChange('connection-add',from+' → '+to);return true;",
   "   };",
   "   window.addManualEdge=function(){return window.addManualConnection(document.getElementById('manual_from').value,document.getElementById('manual_to').value,document.getElementById('manual_note').value);};",
   "   window.clearManualEdges=function(){manual=[];draw();if(window.recordAtlasChange)window.recordAtlasChange('connections-clear','Clear annotations');};",
   "   window.exportManualEdges=function(){",
   "      var identities=nodes.map(function(n){return{id:n.id,image:n.image,label:n.label};});",
   "      var blob=new Blob([JSON.stringify(annotationData(),null,2)],{type:'application/json'});",
   "      var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='workspace_history_links.json';link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);",
   "   };",
   "   window.importManualEdges=function(input){",
   "      if(!input.files.length)return;if(input.files[0].size>5000000){status('Annotation file too large.');return;}var reader=new FileReader();",
   "      reader.onload=function(){try{",
   "         var edges=validatedAnnotations(JSON.parse(reader.result));",
   "         manual=edges;draw();",
   "      }catch(e){status('Import: '+e.message);}};",
   "      reader.onerror=function(){status('Could not read the file.');};reader.readAsText(input.files[0]);",
   "   };",
   "   window.replaceAtlasGraph=function(graph){workspaceGraphData=graph;nodes=graph.nodes;manual=manual.filter(function(edge){return find(edge.from)&&find(edge.to);});if(window.atlasPendingAnnotations){try{manual=validatedAnnotations(window.atlasPendingAnnotations);}catch(error){status(error.message);}window.atlasPendingAnnotations=null;}var names=['manual_from','manual_to'];for(var n=0;n<names.length;++n){var select=document.getElementById(names[n]);if(!select)continue;var selected=select.value;while(select.firstChild)select.removeChild(select.firstChild);for(var i=0;i<nodes.length;++i){var option=document.createElement('option');option.value=nodes[i].id;option.textContent=nodes[i].image+' — '+nodes[i].label;option.setAttribute('data-no-i18n','');select.appendChild(option);}select.value=selected;}var tools=document.getElementById('tool_filter');if(tools){var chosen=tools.value,available={};while(tools.firstChild)tools.removeChild(tools.firstChild);var option=document.createElement('option');option.value='all';option.textContent=translated('All tools');tools.appendChild(option);for(var i=0;i<nodes.length;++i)if(!nodes[i].header&&!available[nodes[i].tool]){available[nodes[i].tool]=true;var option=document.createElement('option');option.value=nodes[i].tool;option.textContent=nodes[i].tool;option.setAttribute('data-no-i18n','');tools.appendChild(option);}tools.value=available[chosen]?chosen:'all';}collectStagePreviews();draw();window.findTreeNodes();};",
   "   window.restoreAtlasAnnotations=function(data){window.atlasPendingAnnotations=data||{version:1,nodes:annotationIdentities,edges:[]};};",
   "   window.atlasManualAnnotations=function(){return annotationData();};",
   "   collectStagePreviews();",
   "   window.updateReplayRange(true);",
   "   try{var embeddedWorkflow=document.getElementById('apa_workflow_state'),embeddedAnnotations=typeof atlasReportData!=='undefined'&&atlasReportData.project?atlasReportData.project.annotations:embeddedWorkflow?JSON.parse(embeddedWorkflow.textContent).annotations:null;if(embeddedAnnotations){window.atlasPendingAnnotations=embeddedAnnotations;}else{var savedAnnotations=window.localStorage.getItem(annotationKey);if(savedAnnotations){manual=validatedAnnotations(JSON.parse(savedAnnotations));draw();}}}catch(e){status('Saved connections could not be restored. Import your JSON backup.');}",
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
   "   window.findTreeNodes();window.organizeTree();",
   "   window.applyReportFilters();",
   "   try{var savedFinal=window.localStorage.getItem('YoruHikari_final_'+window.location.href);if(savedFinal)window.selectFinalImage(savedFinal);}catch(e){}",
   "}"
].join("\n");

generateHistoryReport();
