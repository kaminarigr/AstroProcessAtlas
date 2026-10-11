const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/diagnose_replay_difference.js', 'utf8')
  .replace(/^#.*$/gm, '').replace(/try \{ diagnoseReplayDifference\(\); \}[\s\S]*$/, '');
const inputs = {}, outputs = [], lines = [];
let fail = false;
function input(id, samples, color = false) {
  const window = {mainView:{id,image:{width:2,height:1,isColor:color,bitsPerSample:32,samples}}};
  inputs[id] = window;
  return window;
}
const api = {Console:{writeln:s=>lines.push(s)}, View:{viewById:()=>({isNull:true})},
  ImageWindow:function(w,h,n,bits,real,color,id) {
    assert.equal(bits,64);assert.equal(real,true);
    this.mainView={id,image:{selectedChannel:0,maximum(){return Math.max(...this.samples[this.selectedChannel]);},mean(){return this.samples[this.selectedChannel].reduce((a,b)=>a+b,0)/w;},resetSelections(){}}};
    this.show=()=>{this.shown=true;};this.forceClose=()=>{this.closed=true;};outputs.push(this);
  }, PixelMath:function() {
    this.executeOn=view=>{
      assert.equal(this.rescale,false);assert.equal(this.truncate,false);assert.equal(this.use64BitWorkingImage,true);
      const match=/^abs\((\w+)-(\w+)\)$/.exec(this.expression);assert.ok(match);
      const a=inputs[match[1]].mainView.image.samples,b=inputs[match[2]].mainView.image.samples;
      view.image.samples=a.map((channel,c)=>channel.map((v,i)=>Math.abs(v-b[c][i])));
      return !fail;
    };
  }};
vm.runInNewContext(source,api);
const original=input('Original',[[0.1,0.8]]), replay=input('Replay',[[0.2,0.6]]);
const snapshots=JSON.stringify([original,replay]);
assert.ok(Math.abs(api.compareReplayPair(original,replay,'After')-0.2)<1e-14);
assert.ok(Math.abs(outputs[0].mainView.image.mean()-0.15)<1e-14,'Absolute difference includes negative signed differences');
assert.equal(JSON.stringify([original,replay]),snapshots,'Inputs stay unchanged');
assert.equal(api.compareReplayPair(original,input('Identical',[[0.1,0.8]]),'Before'),0);
const rgb=input('RGB',[[0,1],[0.5,0.5],[1,0]],true), near=input('Near',[[0,1],[0.5+1e-7,0.5],[1,0]],true);
assert.ok(Math.abs(api.compareReplayPair(rgb,near,'After')-1e-7)<1e-14);
assert.ok(lines.some(line=>line.startsWith('G: max abs')));
assert.throws(()=>api.compareReplayPair(original,original,'Same'),/two different/);
near.mainView.image.width=3;assert.throws(()=>api.compareReplayPair(rgb,near,'Mismatch'),/dimensions/);
fail=true;assert.throws(()=>api.compareReplayPair(original,replay,'Failed'),/PixelMath failed/);
assert.equal(outputs.at(-1).closed,true,'Close failed diagnostic output');
console.log('Passed: absolute differences, unclipped negative errors, per-channel numerical statistics, 64-bit output, unchanged inputs and validation/failure cleanup.');
