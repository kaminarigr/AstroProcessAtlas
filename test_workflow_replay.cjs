const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/AstroProcessAtlas.js', 'utf8')
  .replace(/^#.*$/gm, '').replace(/generateHistoryReport\(\);\s*$/, '');
const api = {Console:{writeln(){}}};
vm.runInNewContext(source, api);
function step(tool, parameters='', extra={}) {
  return {proc:{processId:()=>tool}, title:tool, source:'var P = new '+tool+';\n'+parameters,
    mask:{status:'unrecorded'}, references:[], ...extra};
}
const ht = step('HistogramTransformation','P.H = [[0,0.4,1,0,1]];');
const ct = step('CurvesTransformation','P.K = [[0,0],[1,1]]; P.Kt = P.AkimaSubsplines;');
const blocked = step('Script', '', {title:'PerfectPalettePicker'});
const record = {id:'Ha', anchor:'image_0',steps:[ht,ct,blocked,ht,{...ht,redo:true}]};
const plan = api.workspaceReplayData([record])[0];
assert.equal(plan.steps.length,4,'Exclude redo without omitting blockers');
assert.equal(plan.steps[0].reason,'');
assert.equal(plan.steps[1].reason,'');
assert.match(plan.steps[2].reason,/not supported/);
assert.equal(plan.steps[3].reason,'');
for (const [change, pattern] of [
  [{mask:{status:'unknown'}}, /mask state is unknown/],
  [{mask:{status:'recorded',name:'Mask_old'}}, /Mask_old/],
  [{references:[{name:'Other',kind:'input'}]}, /reference images/],
  [{source:'var P = new HistogramTransformation; P.executeOn(View.viewById("Ha"));'}, /Serialized/],
  [{source:'var P = new Script;'}, /Serialized/],
]) {
  const result=api.workspaceReplayData([{id:'Test',steps:[{...ht,...change}]}])[0].steps[0];
  assert.match(result.reason,pattern);
  assert.equal(result.source,'','Do not put unsupported code in an executable factory');
}
const globalWS=step('RGBWorkingSpace','P.applyGlobalRGBWS=true;');globalWS.proc.applyGlobalRGBWS=true;
assert.match(api.workspaceReplayData([{id:'WS',steps:[globalWS]}])[0].steps[0].reason,/global RGB/);
const literals='// parameters\nvar Q = new NoiseXTerminator;\nQ.model = "C:\\\\Models\\\\a; //name.bin"; /* note */ Q.amount=-1e-3;Q.mode=NoiseXTerminator.prototype.Mode;';
assert.equal(api.replayProcessSource(literals,'NoiseXTerminator').variable,'Q');
for(const code of [
  'var P = new HistogramTransformation; alert("Oops");',
  'var P = new HistogramTransformation; P.H = load();',
  'var P = new HistogramTransformation; P.H = (function(){return 0;})();',
  'var P = new HistogramTransformation; P.executeGlobal();',
  'var P = new HistogramTransformation; var Q = new HistogramTransformation;',
  'var P = new HistogramTransformation; P.H = "unterminated',
  'var P = new HistogramTransformation; /* unterminated',
]) assert.equal(api.replayProcessSource(code,'HistogramTransformation'),null,code);
assert.throws(()=>api.buildWorkspaceReplayScript(plan,-1,2),/valid step range/);
assert.throws(()=>api.buildWorkspaceReplayScript(plan,2,1),/valid step range/);
assert.throws(()=>api.buildWorkspaceReplayScript(plan,0,99),/valid step range/);
assert.throws(()=>api.buildWorkspaceReplayScript(plan,0.5,1),/valid step range/);

function run(script, {cancel=false,confirm=true,missing=false,fail=false,noImages=false}={}) {
  const calls=[], messages=[], outputs=[];let checkbox;
  const input={isNull:false,rgbWorkingSpace:{gamma:2.2},mainView:{id:'Ha_input',stf:[[1,2]],
    image:{numberOfChannels:1,bitsPerSample:32,isReal:true,isColor:false,pixels:[0.1,0.2]}}};
  function ImageWindow(w,h,channels,bits,real,color,id){
    this.isNull=false;this.mainView={id,beginProcess(){calls.push('begin');},endProcess(){calls.push('end');},
      image:{assign(image){this.pixels=image.pixels.slice();calls.push('copy');}}};
    this.show=()=>calls.push('show');outputs.push(this);
    assert.equal(w,1);assert.equal(h,1);assert.equal(bits,32);assert.equal(real,true);
  }
  ImageWindow.windows=noImages?[]:[input];
  function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
  function Process(){this.executeOn=view=>{assert.notEqual(view,input.mainView);
    calls.push(this.H?'HT':'CT');view.image.pixels[0]+=1;return !fail;};}
  const context={ImageWindow,View:{viewById:id=>({isNull:id!=='APA_replay'})},
    Dialog:function(){this.ok=()=>{};this.cancel=()=>{};this.adjustToContents=()=>{};
      this.execute=()=>{checkbox.checked=confirm;return !cancel;};},
    CheckBox:function(){checkbox=this;}, ComboBox:function(){this.addItem=()=>{};},
    Label:function(){this.setMinWidth=()=>{};},PushButton:function(){},HorizontalSizer:Sizer,VerticalSizer:Sizer,
    MessageBox:function(message){this.execute=()=>messages.push(message);},
    HistogramTransformation:Process,Console:{writeln(){}},processEvents(){},
    UndoFlag_NoSwapFile:0,StdIcon_Information:0,StdIcon_Error:1,StdButton_Ok:0};
  Process.prototype.AkimaSubsplines=1;
  if(!missing)context.CurvesTransformation=Process;
  vm.runInNewContext(script.replace(/^#.*$/gm,''),context);
  assert.deepEqual(input.mainView.image.pixels,[0.1,0.2],'Input pixels never change');
  return {calls,messages,outputs,input};
}
const complete=api.buildWorkspaceReplayScript(plan,0,1);
const generatorSource=api.buildWorkspaceReplayScript.toString();
for(const line of generatorSource.split('\n')) {
  if (/^\s*\/\//.test(line)) continue;
  assert.ok(!line.includes('//'),'Construct comment/URL delimiters at runtime for PJSR preprocessing: '+line);
}
assert.match(complete,/\/\/ Copyright.*https:\/\/www\.yoruhikari\.gr\//);
assert.match(complete,/\/\/ SPDX-License-Identifier: MIT/);
new vm.Script(complete.replace(/^#.*$/gm,''));
const success=run(complete);
assert.deepEqual(success.calls,['begin','copy','end','show','HT','CT']);
assert.match(success.messages[0],/Replay complete/);
assert.equal(success.outputs[0].mainView.id,'APA_replay_1','Avoid existing view ID');
assert.equal(success.outputs[0].rgbWorkingSpace,success.input.rgbWorkingSpace);
assert.equal(success.outputs[0].mainView.stf,success.input.mainView.stf);
assert.equal(run(complete,{cancel:true}).outputs.length,0);
assert.equal(run(complete,{confirm:false}).outputs.length,0);
assert.match(run(complete,{noImages:true}).messages[0],/Open an image/);
const partial=run(api.buildWorkspaceReplayScript(plan,0,3));
assert.deepEqual(partial.calls,success.calls,'Never skip a blocked step and execute later processes');
assert.match(partial.messages[0],/Stopped before step 3/);
assert.match(partial.messages[0],/Partial result retained/);
assert.equal(run(api.buildWorkspaceReplayScript(plan,2,3)).outputs.length,0,'Blocked start creates no output');
const missing=run(complete,{missing:true});
assert.equal(missing.calls.filter(c=>c==='HT').length,1);
assert.match(missing.messages[0],/CurvesTransformation/);
const failed=run(complete,{fail:true});
assert.ok(!failed.calls.includes('CT'),'Failure stops subsequent processes');
assert.match(failed.messages[0],/Process failed/);
console.log('Passed: replay eligibility, redo/blocker preservation, source validation, range export, copied input, confirmation/cancel, naming, RGBWS/STF, stop/failure and missing process handling.');
