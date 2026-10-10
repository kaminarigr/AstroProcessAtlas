// Runtime-independent regression checks; run with node test_history_report.cjs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/AstroProcessAtlas.js', 'utf8')
  .replace(/^#.*$/gm, '');

function run(count, startIndex, unavailable = false, failedThumbnail = false, customSteps = null, maskSource = null, maskViews = {}) {
  let index = startIndex;
  let html = '';
  const steps = customSteps || Array.from({length: count}, (_, i) => ({
    processId: () => 'Process' + (i + 1),
    toSource: () => 'var P = new Process' + (i + 1) + ';\nP.expression = "a < b & c";\nP.table = [[1, 2], [3, 4]];\nP.parameter11 = 42;'
  }));
  const view = {
    id: 'Test',
    processing: {length: count, at: i => steps[i], toSource: () => {
      if (maskSource === null) throw Error('No history serialization');
      return maskSource;
    }},
    get historyIndex() { return index; },
    set historyIndex(value) {
      if (unavailable && value !== startIndex) throw Error('No stored pixels');
      index = value;
    },
    image: {isColor: true, render: () => ({width: 100, height: 100,
      scaledTo: () => ({save(path) {
        assert.equal(arguments.length, 1, 'Bitmap.save takes a path, without a format string');
        assert.ok(path.endsWith('.png'));
        if (failedThumbnail) throw Error('Cannot save');
      }})})}
  };
  function File() {}
  File.extractDrive = () => '';
  File.extractDirectory = () => '/reports';
  File.extractName = () => 'test';
  File.createDirectory = () => {};
  File.readFile=()=>({toBase64:()=>Buffer.from('PNG').toString('base64')});
  File.remove=()=>{};File.removeDirectory=()=>{};
  File.prototype.createForWriting = () => {};
  File.prototype.write = bytes => { html += bytes.toString('utf8'); };
  File.prototype.close = () => {};
  const context = {
    Dialog: function() {this.adjustToContents=()=>{};this.execute=()=>true;this.scaledResource=x=>x;},
    Label:function(){},PushButton:function(){},ToolButton:function(){},CheckBox:function(){},
    TreeBox:function(){this.children=[];this.setMinSize=()=>{};this.child=i=>this.children[i];},
    TreeBoxNode:function(tree){tree.children.push(this);this.setText=()=>{};},
    HorizontalSizer:function(){this.add=()=>{};this.addStretch=()=>{};},
    VerticalSizer:function(){this.add=()=>{};},
    View: {viewById: name => maskViews[name] || {isNull: true}},
    ImageWindow: {activeWindow: {mainView: view,
      mask: {mainView: {id: 'CurrentMaskOnly'}}, maskEnabled: false, maskInverted: true}}, File,
    Console: {writeln() {}},
    ByteArray: {stringToUTF8: text => Buffer.from(text, 'utf8')},
    SaveFileDialog: function() { this.execute = () => true; this.fileName = '/reports/test.html'; },
    MessageBox: function() { this.execute = () => {}; }
  };
  vm.runInNewContext(source, context);
  assert.equal(index, startIndex, 'Must restore the exact original history position');
  assert.equal((html.match(/class="step-card"/g) || []).length, count);
  if (count && !customSteps) {
    assert.ok(html.includes('P.parameter11 = 42;'), 'Parameters must not be truncated');
    assert.ok(html.includes('a &lt; b &amp; c'), 'Parameter text must be HTML escaped');
    assert.ok(html.includes('P.table = [[1, 2], [3, 4]];'));
  }
  return html;
}

run(3, 3);
assert.ok(run(3, 1).includes('[Redo /'));
assert.ok(run(3, 3, true).includes('no pixels are available'));
assert.ok(run(3, 2, false, true).includes('Thumbnail unavailable'));
assert.ok(run(0, 0).includes('No history steps'));
console.log('Passed: multiple steps, full parameters, tables, escaping, redo, missing pixels, failed thumbnails, empty history, restoration.');

const helper = {Console: {writeln() {}}};
vm.runInNewContext(source.replace(/generateHistoryReport\(\);\s*$/, ''), helper);
function evaluate(expression, x) {
  const code = expression.replace(/\$T(?:\[[012]\])?/g, 'x');
  return Function('x', 'min', 'max', 'mtf', 'iif', 'return ' + code)(x, Math.min, Math.max,
    (m, v) => v === 0 ? 0 : v === 1 ? 1 : ((m-1)*v)/((2*m-1)*v-m),
    (condition, a, b) => condition ? a : b);
}
function close(actual, expected) { assert.ok(Math.abs(actual-expected) < 1e-12, `${actual} != ${expected}`); }
const histogram = [0.1, 0.3, 0.9, -0.2, 1.3];
const histogramExpr = helper.histogramExpression(histogram, '$T');
for (const x of [0, 0.05, 0.1, 0.2, 0.4, 0.8, 0.9, 1]) {
  const clipped = Math.min(1, Math.max(0, (x-0.1)/0.8));
  const mapped = clipped === 0 ? 0 : clipped === 1 ? 1 : (-0.7*clipped)/(-0.4*clipped-0.3);
  close(evaluate(histogramExpr, x), (mapped+0.2)/1.5);
}
close(evaluate(helper.histogramExpression([0.4, 0.5, 0.4, 0, 1], '$T'), 0.6), 0.4);
const curvePoints = [[0,0], [0.5,0.8], [1,1]];
// Independent natural-spline closed form: second derivatives [0,-3.6,0].
const splineExpr = helper.curveExpression(curvePoints, 'CubicSpline', '$T');
for (const x of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
  const expected = x <= 0.5 ? 1.9*x-1.2*x*x*x :
    0.8+1.0*(x-0.5)-1.8*(x-0.5)**2+1.2*(x-0.5)**3;
  close(evaluate(splineExpr, x), expected);
}
assert.equal(helper.curveExpression(curvePoints, 'AkimaSubsplines', '$T'), splineExpr, 'Akima uses cubic spline with fewer than 5 points');
const linearExpr = helper.curveExpression(curvePoints, 'Linear', '$T');
close(evaluate(linearExpr, 0.25), 0.4);
close(evaluate(linearExpr, 0.75), 0.9);
const composedCurve = helper.curveExpression(curvePoints, 'CubicSpline', linearExpr);
for (const x of [0,0.1,0.4,0.7,1])
  close(evaluate(composedCurve, x), evaluate(splineExpr, evaluate(linearExpr, x)));
const cornerPoints = [[0,0], [0.2,0.1], [0.4,0.2], [0.6,0.6], [0.8,0.8], [1,1]];
const akimaExpr = helper.curveExpression(cornerPoints, 'AkimaSubsplines', '$T');
for (const point of cornerPoints) close(evaluate(akimaExpr, point[0]), point[1]);
// Straight sections on either side of an Akima corner retain their chord slopes.
close(evaluate(akimaExpr, 0.1), 0.05);
close(evaluate(akimaExpr, 0.9), 0.9);
assert.throws(() => helper.curveSegments([[0,0],[0,0.4],[1,1]], 'Linear'));

const curveProc = {processId: () => 'CurvesTransformation', Linear: 2, CubicSpline: 1, AkimaSubsplines: 0};
for (const key of ['R','G','B','K','A','L','a','b','c','H','S']) {
  curveProc[key] = [[0,0],[1,1]];
  curveProc[key+'t'] = 0;
}
curveProc.K = curvePoints;
curveProc.toSource = () => 'var P = new CurvesTransformation;\nP.K = [[0,0],[0.5,0.8],[1,1]];';
const histProc = {processId: () => 'HistogramTransformation',
  H: [[0,0.5,1,0,1],[0,0.5,1,0,1],[0,0.5,1,0,1],histogram,[0,0.5,1,0,1]],
  toSource: () => 'var P = new HistogramTransformation;\nP.H = ' + JSON.stringify(histogram) + ';'};
const sample = run(2, 2, false, false, [histProc, curveProc]);
assert.ok(sample.includes('<svg class="curve-graph"'));
assert.ok(sample.includes('Shadows'));
assert.ok(sample.includes('Input (X)'));
assert.equal((sample.match(/<b>[RGB]<\/b>/g) || []).length, 6);
assert.ok(sample.includes('data:image/png;base64,'));
assert.ok(sample.includes('copyCode(this)'));
const browserScript = Array.from(sample.matchAll(/<script>([\s\S]*?)<\/script>/g)).find(match=>match[1].includes('workspaceGraphData'))[1];
new vm.Script(browserScript);
curveProc.S = [[0,0],[0.5,0.7],[1,1]];
const unsupported = helper.pixelMathSection(curveProc, curveProc.toSource(), true);
assert.ok(unsupported.includes('Saturation'));
assert.ok(!unsupported.includes('<textarea'), 'Must not export incomplete RGB expressions as a full color transformation');
console.log('Passed: histogram clipping/MTF/range, cubic spline, Akima corners/fallback, linear curves, generated expressions, unsupported color curves, report HTML and copy script.');

const masksSource = 'var HistoryReportContainer = new ProcessContainer;\n' +
  'HistoryReportContainer.setMask(0, "StarMask", true);\n' +
  'HistoryReportContainer.setMask(2, "LuminanceMask", false);\n' +
  'var Child = new ProcessContainer;\nChild.setMask(1, "NestedMask", true);';
const masks = helper.readHistoryMasks({toSource: () => masksSource}, 3);
assert.equal(masks.steps[0].name, 'StarMask');
assert.equal(masks.steps[0].inverted, true);
assert.equal(masks.steps[1].status, 'unrecorded', 'A nested mask must not be attributed to the outer history');
assert.equal(masks.steps[2].name, 'LuminanceMask');
assert.equal(masks.steps[2].inverted, false);
assert.equal(helper.readHistoryMasks({toSource() { throw Error('Unavailable'); }}, 1).steps[0].status, 'unknown');
assert.equal(helper.readHistoryMasks({toSource: () => 'var P = new ProcessContainer; P.setMask(0, unknownMask, true);'}, 1).steps[0].status, 'unknown');
assert.equal(helper.readHistoryMasks({toSource: () => 'var P = new ProcessContainer; P.setMask(0, "mask");'}, 1).steps[0].inverted, null);
assert.ok(helper.historyMaskHTML({status:'recorded', name:'Mask<&>', inverted:false}).includes('Mask&lt;&amp;&gt;'));
const maskReport = run(3, 2, false, false, null, masksSource);
assert.ok(maskReport.includes('Historical mask: <span data-no-i18n>StarMask'));
assert.ok(maskReport.includes('Historical mask: <span data-no-i18n>LuminanceMask'));
assert.ok(!maskReport.includes('Historical mask: <span data-no-i18n>CurrentMaskOnly'));
assert.ok(maskReport.includes('CurrentMaskOnly</span> — disabled — inverted'));
assert.ok(maskReport.includes('History ProcessContainer'));
console.log('Passed: historical masks and inversion, no recorded mask, unavailable metadata, nested containers, current-mask separation and HTML escaping.');

let maskSaves = 0;
const availableMask = {id: 'StarMask', image: {render: () => ({width: 400, height: 200,
  scaledTo: (width, height) => {
    assert.equal(width, 220);
    assert.equal(height, 110);
    return {save: path => { assert.ok(path.endsWith('/mask_1.png')); ++maskSaves; }};
  }})}};
helper.View = {viewById: name => name === 'StarMask' ? availableMask : {isNull: true}};
const thumbnailCache = [];
const starThumb = helper.exportMaskThumbnail('StarMask', '/thumbs', 'report_thumbs', thumbnailCache);
assert.equal(starThumb.src, 'report_thumbs/mask_1.png');
assert.equal(helper.exportMaskThumbnail('StarMask', '/thumbs', 'report_thumbs', thumbnailCache), starThumb);
assert.equal(maskSaves, 1, 'Reuse the mask PNG across steps');
const invertedMaskHTML = helper.historyMaskHTML({status:'recorded', name:'StarMask', inverted:true}, starThumb);
assert.ok(invertedMaskHTML.includes('class="mask-inverted"'));
assert.ok(invertedMaskHTML.includes('Current mask contents'));
assert.ok(!helper.maskThumbnailHTML(starThumb, false).includes('class="mask-inverted"'));
assert.ok(helper.maskThumbnailHTML(starThumb, null).includes('Historical inversion is unknown'));
const closedThumb = helper.exportMaskThumbnail('ClosedMask', '/thumbs', 'report_thumbs', thumbnailCache);
assert.equal(closedThumb.src, '');
assert.ok(helper.maskThumbnailHTML(closedThumb, false).includes('is closed'));
const brokenThumb = helper.exportMaskThumbnail('BrokenMask', '/thumbs', 'report_thumbs', thumbnailCache,
  {image: {render() { throw Error('Bitmap unavailable'); }}});
assert.ok(brokenThumb.reason.includes('thumbnail creation failed'));
assert.equal(maskSaves, 1);
// Full report: render an available historical mask and keep missing-mask text for another.
const maskPreviewReport = run(3, 2, false, false, null, masksSource, {StarMask: availableMask});
assert.ok(maskPreviewReport.includes('src="#apa_asset_'));
assert.ok(maskPreviewReport.includes('data:image/png;base64,'));
assert.ok(maskPreviewReport.includes('class="mask-inverted"'));
assert.ok(maskPreviewReport.includes('The mask image is closed'));
console.log('Passed: mask thumbnails, aspect ratio, shared PNG cache, inversion display, missing/failed mask images and full report integration.');

const scriptProcess = {processId: () => 'Script', filePath: '$PXI_SRCDIR/scripts/Toolbox/SelectiveColorCorrection.js',
  toSource: () => 'var P = new Script; P.filePath = "$PXI_SRCDIR/scripts/Toolbox/SelectiveColorCorrection.js";'};
assert.equal(helper.getProcessTitle(scriptProcess), 'SelectiveColorCorrection');
assert.equal(helper.getProcessName(scriptProcess), 'Script', 'Keep the native process ID for parameter dispatch');
assert.equal(helper.getProcessTitle({processId: () => 'Script',
  toSource: () => 'var P = new Script; P.filePath = "C:\\\\scripts\\\\MyScript.JS";'}), 'MyScript');
assert.equal(helper.getProcessTitle({processId: () => 'Script', toSource() { throw Error('Unavailable'); }}), 'Script');
assert.equal(helper.getProcessTitle(histProc), 'HistogramTransformation');
assert.equal(helper.getProcessTitle({processId: () => 'Script', filePath: '/scripts/'}), 'Script');
assert.ok(run(1, 1, false, false, [scriptProcess]).includes('<div class="step-title" data-no-i18n>SelectiveColorCorrection</div>'));
console.log('Passed: script filename titles, serialization fallback, Windows paths, missing paths, native process IDs and report integration.');

const integrationSource = 'var P = new ImageIntegration;\nP.images = [ // enabled, path\n' +
  '[true,"first,frame.xisf"],\n[true,"second.xisf"],\n[true,"third<&>.xisf"],\n[true,"fourth.xisf"],\n[true,"fifth.xisf"],\n[true,"sixth.xisf"],\n[true,"seventh.xisf"]\n];\nP.rejection = 3;';
const integrationHTML = helper.readableParameters({processId:()=> 'ImageIntegration'}, integrationSource);
const integrationPreview = integrationHTML.split('<details class="parameter-details">')[0];
assert.ok(integrationPreview.includes('first,frame.xisf'));
assert.ok(!integrationPreview.includes('second.xisf'));
assert.ok(!integrationPreview.includes('fifth'));
assert.ok(!integrationPreview.includes('sixth'));
assert.ok(integrationHTML.includes('Details — remaining 6 entries'));
assert.ok(integrationHTML.includes('third&lt;&amp;&gt;.xisf'));
assert.ok(!integrationHTML.includes('parameter-details" open'), 'Keep large values collapsed initially');
assert.equal(helper.serializedArrayEntries('[[1,2], [3,4], /* comment , ] */ [5,6]]').length,3);
assert.equal(helper.serializedArrayEntries('["escaped \\\" comma ,", "second", "third"]')[0], '"escaped \\\" comma ,"');
assert.ok(helper.compactParameterValue('[[1,2],[3,4]]').includes('<details'));
assert.ok(helper.compactParameterValue('[\n[1,2],\n[3,4]\n]').includes('<details'), 'Only the first array entry is initially visible');
assert.ok(helper.readableParameters({processId:()=> 'OtherProcess'}, integrationSource).includes('[true,&quot;fourth.xisf&quot;]'));
for (const tool of ['FastIntegration','OtherProcess']) {
  const result=helper.readableParameters({processId:()=>tool},integrationSource.replace('P.images','P.targets')+'\nP.outputData = [[1],[2],[3],[4],[5],[6]];');
  assert.equal((result.match(/<details class="parameter-details">/g)||[]).length,2);
  assert.ok(result.includes('Details — remaining 5 entries'));
  assert.ok(result.includes('sixth.xisf'));
}
assert.ok(!helper.compactParameterValue('[[1]]').includes('<details'));
const sixLines=helper.compactParameterValue('one\ntwo\nthree\nfour\nfive\nsix');
assert.ok(!sixLines.split('<details')[0].includes('six'));
assert.ok(sixLines.includes('Details — remaining 5 lines'));
assert.ok(helper.parameterTable(['Input (X)','Output (Y)'],[[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]],1).includes('Details — remaining 5 entries'));
assert.ok(helper.compactParameterValue('[\n[\n1,\n2,\n3,\n4\n]\n]').includes('<details'));
console.log('Passed: one-entry parameter previews, full retained values, nested arrays, escaping and multiline boundaries.');
