const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/AstroProcessAtlas.js','utf8').replace(/^#.*$/gm,'').replace(/generateHistoryReport\(\);\s*$/,'');
const inputs={},outputs=[],messages=[],controls=[];let fail=false,dialogCancel=false;
function input(id,pixels,color=false){const w={isNull:false,mainView:{id,image:{width:2,height:1,isColor:color,bitsPerSample:32,pixels}}};inputs[id]=w;return w;}
function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
const api={Console:{writeln(){},show(){}},View:{viewById:id=>({isNull:id!=='APA_difference_replay'})},
 ImageWindow:function(w,h,n,bits,real,color,id){assert.equal(bits,64);assert.equal(real,true);this.isNull=false;this.mainView={id,image:{selectedChannel:0,maximum(){return Math.max(...this.pixels[this.selectedChannel]);},mean(){return this.pixels[this.selectedChannel].reduce((a,b)=>a+b,0)/(w*h);},resetSelections(){}}};this.show=()=>{this.shown=true;};this.forceClose=()=>{this.isNull=true;};outputs.push(this);},
 PixelMath:function(){this.executeOn=view=>{assert.equal(this.rescale,false);assert.equal(this.truncate,false);assert.equal(this.use64BitWorkingImage,true);const ids=/^abs\((\w+)-(\w+)\)$/.exec(this.expression);const a=inputs[ids[1]].mainView.image.pixels,b=inputs[ids[2]].mainView.image.pixels;view.image.pixels=a.map((channel,c)=>channel.map((v,i)=>Math.abs(v-b[c][i])));return !fail;};},
 Dialog:function(){this.ok=()=>{};this.cancel=()=>{};this.adjustToContents=()=>{};this.execute=()=>!dialogCancel;},
 ComboBox:function(){controls.push(this);this.items=[];this.addItem=x=>this.items.push(x);},Label:function(){this.setMinWidth=()=>{};},PushButton:function(){controls.push(this);},HorizontalSizer:Sizer,VerticalSizer:Sizer,
 MessageBox:function(text){this.execute=()=>messages.push(text);},StdIcon_Information:0,StdButton_Ok:0};
vm.runInNewContext(source,api);
const original=input('Original',[[0.1,0.8]]),replay=input('Original_APA_replay',[[0.2,0.6]]),before=JSON.stringify([original,replay]);
const result=api.compareAtlasImages(original,replay,'Replay');assert.ok(Math.abs(result.rows[0].max-0.2)<1e-14);assert.ok(Math.abs(result.rows[0].mean-0.15)<1e-14);assert.equal(result.difference.mainView.id,'APA_difference_replay_1');assert.equal(result.difference.shown,true);assert.equal(JSON.stringify([original,replay]),before);
const rgb=input('RGB',[[0,1],[0.5,0.5],[1,0]],true),near=input('RGB_APA_replay',[[0,1],[0.5+1e-7,0.5],[1,0]],true);
const channels=api.compareAtlasImages(rgb,near,'Color').rows;assert.equal(channels.length,3);assert.equal(channels[0].max,0);assert.ok(channels[1].max>0);assert.equal(channels[2].max,0);
assert.throws(()=>api.compareAtlasImages(original,original,'Same'),/two different/);
assert.throws(()=>api.compareAtlasImages(original,rgb,'Color mismatch'),/dimensions/);
fail=true;assert.throws(()=>api.compareAtlasImages(original,replay,'Failure'),/PixelMath failed/);assert.equal(outputs.at(-1).isNull,true);fail=false;
api.ImageWindow.windows=[original,replay];api.showAtlasComparisonDialog(replay,'Original');assert.match(messages.at(-1),/max abs/);assert.match(messages.at(-1),/mean abs/);assert.equal(controls[1].currentItem,1);
const length=outputs.length;dialogCancel=true;api.showAtlasComparisonDialog(replay,'Original');assert.equal(outputs.length,length);
console.log('Passed: integrated numeric comparison, 64-bit absolute statistics, RGB/grayscale, unchanged inputs, collision names, validation, failure cleanup and dialog cancellation.');
