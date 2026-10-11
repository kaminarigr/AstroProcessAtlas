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
const origin=step('ImageIntegration','P.images=[[true,"light.xisf"]];',{phase:'initial',historyEntryIndex:0});
const integrated={id:'Integrated',steps:[origin,{...ht,displayNumber:2,historyEntryIndex:1}]};
assert.equal(api.workspaceReplayData([integrated])[0].steps.length,1);
assert.equal(api.workspaceReplayData([integrated])[0].steps[0].number,2,'Keep report numbering after origin metadata');
assert.match(api.replayStepHTML(integrated,origin),/Image origin metadata/);
assert.ok(!api.replayStepHTML(integrated,origin).includes('Copy step for replay'));
assert.equal(api.workspaceReplayData([{id:'OriginOnly',steps:[origin]}])[0].steps.length,0);
assert.ok(api.workspaceReplayData([{id:'Later',steps:[{...origin,phase:'live',historyEntryIndex:5}]}])[0].steps[0].reason,
  'A later integration cannot be silently skipped as initial metadata');
assert.equal(plan.steps.length,4,'Exclude redo without omitting blockers');
assert.equal(plan.steps[0].reason,'');
assert.equal(plan.steps[1].reason,'');
assert.match(plan.steps[2].reason,/not yet supported by the replay exporter/);
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

function run(script, {cancel=false,confirm=true,missing=false,fail=false,noImages=false,gradientMissing=false,gradientFail=false,
  starMissing=false,starFail=false,inputId='Ha_input',existingIds=['Ha_input_APA_replay']}={}) {
  const calls=[], messages=[], outputs=[], gradientParameters=[], starParameters=[];let checkbox;
  const input={isNull:false,rgbWorkingSpace:{gamma:2.2},mainView:{id:inputId,stf:[[1,2]],
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
    assert.equal(view,outputs[0].mainView,'Continue on the replay copy even if diagnostic output becomes active');
    calls.push(this.H?'HT':'CT');view.image.pixels[0]+=1;return !fail;};}
  const context={ImageWindow,View:{viewById:id=>({isNull:!existingIds.includes(id)})},
    Dialog:function(){this.ok=()=>{};this.cancel=()=>{};this.adjustToContents=()=>{};
      this.execute=()=>{checkbox.checked=confirm;return !cancel;};},
    CheckBox:function(){checkbox=this;}, ComboBox:function(){this.addItem=()=>{};},
    Label:function(){this.setMinWidth=()=>{};},PushButton:function(){},HorizontalSizer:Sizer,VerticalSizer:Sizer,
    MessageBox:function(message){this.execute=()=>messages.push(message);},
    HistogramTransformation:Process,Console:{writeln(){}},processEvents(){},
    UndoFlag_NoSwapFile:0,StdIcon_Information:0,StdIcon_Error:1,StdButton_Ok:0};
  Process.prototype.AkimaSubsplines=1;
  if(!gradientMissing)context.GradientCorrection=function(){this.executeOn=view=>{
    assert.equal(view,outputs[0].mainView,'GradientCorrection applies to the replay copy');
    calls.push('GC');gradientParameters.push({...this});
    if(this.generateGradientModel||this.generateProtectionMasks||this.generateSimpleModel)
      ImageWindow.activeWindow={mainView:{id:'Diagnostic_model'},isNull:false};
    view.image.pixels[0]+=0.2;
    return !gradientFail;
  };};
  if(!missing)context.CurvesTransformation=Process;
  if(!starMissing)context.StarXTerminator=function(){this.executeOn=view=>{
    assert.equal(view,outputs[0].mainView,'Star removal targets the replay copy');
    calls.push('SXT');starParameters.push({...this});view.image.pixels[0]-=0.05;
    if(this.stars) {
      const stars={isNull:false,mainView:{id:view.id+'_stars',image:{pixels:[0.05,0]}}};
      ImageWindow.windows.push(stars);ImageWindow.activeWindow=stars;
    }
    return !starFail;
  };};
  vm.runInNewContext(script.replace(/^#.*$/gm,''),context);
  assert.deepEqual(input.mainView.image.pixels,[0.1,0.2],'Input pixels never change');
  assert.equal(input.mainView.id,inputId,'Input ID never changes');
  return {calls,messages,outputs,input,gradientParameters,starParameters,windows:ImageWindow.windows};
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
assert.equal(success.outputs[0].mainView.id,'Ha_input_APA_replay_1','Avoid existing view ID');
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

const gc=step('GradientCorrection',[
  'P.lowThreshold=0.1;', 'P.lowTolerance=0.5;', 'P.highThreshold=0.8;', 'P.highTolerance=0.5;',
  'P.scale=5;', 'P.smoothness=0.4;', 'P.automaticConvergence=true;',
  'P.generateGradientModel=true;', 'P.generateProtectionMasks=true;', 'P.generateSimpleModel=true;',
  'P.simplificationDegree=1;', 'P.protectionThreshold=0.05;', 'P.protectionAmount=0.8;'
].join('\n'),{displayNumber:2});
const gcPlan=api.workspaceReplayData([{id:'GC_test',steps:[gc,{...ht,displayNumber:3},{...ct,displayNumber:4}]}])[0];
assert.ok(gcPlan.steps.every(s=>!s.reason),'GC no longer blocks supported subsequent processes');
assert.equal(gcPlan.steps[0].source,gc.source,'Preserve the complete native parameter serialization');
const gcScript=api.buildWorkspaceReplayScript(gcPlan,0,2);
const gcRun=run(gcScript);
assert.deepEqual(gcRun.calls,['begin','copy','end','show','GC','HT','CT']);
assert.match(gcRun.messages[0],/Replay complete: Ha_input_APA_replay_1/);
assert.equal(gcRun.gradientParameters[0].scale,5);
assert.equal(gcRun.gradientParameters[0].smoothness,0.4);
assert.equal(gcRun.gradientParameters[0].automaticConvergence,true);
assert.equal(gcRun.gradientParameters[0].generateGradientModel,true);
assert.equal(gcRun.gradientParameters[0].generateProtectionMasks,true);
assert.equal(gcRun.gradientParameters[0].generateSimpleModel,true);
const gcMissing=run(gcScript,{gradientMissing:true});
assert.match(gcMissing.messages[0],/GradientCorrection/);
assert.ok(!gcMissing.calls.includes('HT'));
const gcFailed=run(gcScript,{gradientFail:true});
assert.match(gcFailed.messages[0],/Process failed: GradientCorrection/);
assert.ok(!gcFailed.calls.includes('HT'));
for(const changed of [
  {mask:{status:'recorded',name:'GC_mask'}}, {mask:{status:'unknown'}},
  {references:[{name:'GC_reference',kind:'reference'}]},
  {source:'var P = new GradientCorrection; P.executeGlobal();'}
]) {
  const unavailable=api.workspaceReplayData([{id:'GC_blocked',steps:[{...gc,...changed}]}])[0].steps[0];
  assert.ok(unavailable.reason);assert.equal(unavailable.source,'');
}
console.log('Passed: replay eligibility, redo/blocker preservation, source validation, range export, copied input, confirmation/cancel, naming, RGBWS/STF, stop/failure and missing process handling.');
console.log('Passed: GradientCorrection eligibility and parameter preservation, diagnostic outputs retain the replay target, subsequent steps, missing/failed GC and mask/reference/serialization blockers.');

const rename=step('ImageIdentifier','P.id="Ha_processed";',{displayNumber:5,mask:{status:'unknown'}});
const named=api.workspaceReplayData([{id:'ReportImage',steps:[ht,rename,ct]}])[0];
assert.equal(named.steps[1].reason,'','Naming metadata does not require historical mask pixels');
assert.equal(named.steps[1].action,'identifier');assert.equal(named.steps[1].identifier,'Ha_processed');
assert.equal(named.steps[1].source,'','Never execute the original unsuffixed rename process');
const namedRun=run(api.buildWorkspaceReplayScript(named,0,2),{existingIds:[]});
assert.equal(namedRun.outputs[0].mainView.id,'Ha_processed_APA_replay');
assert.deepEqual(namedRun.calls,['begin','copy','end','show','HT','CT'],'ImageIdentifier does not interrupt processing');
assert.match(namedRun.messages[0],/Replay complete: Ha_processed_APA_replay/);
const collision=run(api.buildWorkspaceReplayScript(named,0,2),{existingIds:['Ha_processed_APA_replay','Ha_processed_APA_replay_1','Ha_processed']});
assert.equal(collision.outputs[0].mainView.id,'Ha_processed_APA_replay_2');
const fallback=run(complete,{existingIds:[],inputId:'Sii_raw'});
assert.equal(fallback.outputs[0].mainView.id,'Sii_raw_APA_replay','Fallback uses the selected input ID, not report metadata');
const nativeRename=step('ImageIdentifier','P.id="NativeId";');nativeRename.proc.id='NativeId';
assert.equal(api.workspaceReplayData([{id:'Native',steps:[nativeRename]}])[0].steps[0].identifier,'NativeId');
const secondRename=step('ImageIdentifier','P.id="Ha_final";');
const multiple=api.workspaceReplayData([{id:'Multiple',steps:[rename,ht,secondRename,ct,{...rename,redo:true}]}])[0];
assert.equal(multiple.steps.length,4,'Redo identifiers do not affect naming');
assert.equal(run(api.buildWorkspaceReplayScript(multiple,0,3),{existingIds:[]}).outputs[0].mainView.id,'Ha_final_APA_replay');
assert.equal(run(api.buildWorkspaceReplayScript(multiple,0,1),{existingIds:[]}).outputs[0].mainView.id,'Ha_processed_APA_replay');
assert.equal(run(api.buildWorkspaceReplayScript(multiple,1,1),{existingIds:[]}).outputs[0].mainView.id,'Ha_input_APA_replay','Ignore identifiers outside the selected range');
const metaOnly=run(api.buildWorkspaceReplayScript(named,1,1),{existingIds:[]});
assert.deepEqual(metaOnly.calls,['begin','copy','end','show']);
assert.equal(metaOnly.outputs[0].mainView.id,'Ha_processed_APA_replay');
for(const value of ['', 'bad name', '1bad', 'bad;code']) {
  const bad=step('ImageIdentifier','P.id='+JSON.stringify(value)+';');
  assert.match(api.workspaceReplayData([{id:'Bad',steps:[bad]}])[0].steps[0].reason,/empty or invalid/);
}
const commented=step('ImageIdentifier','/* P.id="Wrong"; */ P.id="Actual";');
assert.equal(api.workspaceReplayData([{id:'Commented',steps:[commented]}])[0].steps[0].identifier,'Actual');
const escaped=step('ImageIdentifier','P.id="Ha_\\u0066inal";');
assert.equal(api.workspaceReplayData([{id:'Escaped',steps:[escaped]}])[0].steps[0].identifier,'Ha_final');
const executable=step('ImageIdentifier','P.id="Target"; P.executeOn(View.viewById("Original"));');
assert.match(api.workspaceReplayData([{id:'BadCode',steps:[executable]}])[0].steps[0].reason,/Serialized/);
console.log('Passed: ImageIdentifier naming at creation, native/serialized values, prefix/range/redo selection, multiple IDs, input-ID fallback, collision suffixes, continued execution and invalid-code/value rejection.');

for (const stars of [false,true]) {
  const sx=step('StarXTerminator','P.stars='+stars+'; P.unscreen=true; P.ai_file="model.pb";',
    {proc:{processId:()=> 'StarXTerminator',stars},references:stars?[{kind:'output',name:'Ha_stars'}]:[]});
  const sxPlan=api.workspaceReplayData([{id:'Ha',steps:[sx,ht,ct]}])[0];
  assert.ok(sxPlan.steps.every(s=>!s.reason));
  assert.equal(sxPlan.steps[0].source,sx.source);
  const sxScript=api.buildWorkspaceReplayScript(sxPlan,0,2), result=run(sxScript);
  assert.deepEqual(result.calls,['begin','copy','end','show','SXT','HT','CT']);
  assert.equal(result.starParameters[0].stars,stars);
  assert.equal(result.starParameters[0].unscreen,true);
  assert.equal(result.starParameters[0].ai_file,'model.pb');
  assert.equal(result.windows.length,stars?2:1,'Keep optional stars output');
  assert.match(result.messages[0],/Replay complete/);
  for(const options of [{starMissing:true},{starFail:true}]) {
    const stopped=run(sxScript,options);
    assert.match(stopped.messages[0],/StarXTerminator/);
    assert.ok(!stopped.calls.includes('HT'));
    assert.equal(stopped.outputs.length,1);
  }
  for(const extra of [
    {mask:{status:'unknown'}}, {mask:{status:'recorded',name:'Old_mask'}},
    {references:[{kind:'input',name:'Other'}]},
    {source:'var P = new StarXTerminator; P.executeGlobal();'},
    ...(!stars?[{references:[{kind:'output',name:'Unexpected'}]}]:[])
  ]) assert.ok(api.workspaceReplayData([{id:'Ha',steps:[{...sx,...extra}]}])[0].steps[0].reason);
}
console.log('Passed: StarXTerminator both stars flags, optional output references, parameter preservation, continued starless target, masks, missing module and failures.');
