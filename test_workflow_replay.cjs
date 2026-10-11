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
  starMissing=false,starFail=false,paletteMissing=false,paletteFail=false,nbMissing=false,nbFail=false,channels=[],choices=[],states=[],prepFail=false,
  inputId='Ha_input',existingIds=['Ha_input_APA_replay']}={}) {
  const calls=[], messages=[], outputs=[], gradientParameters=[], starParameters=[],paletteParameters=[],nbParameters=[],combos=[];let checkbox;
  const input={isNull:false,rgbWorkingSpace:{gamma:2.2},mainView:{id:inputId,stf:[[1,2]],
    image:{width:2,height:1,numberOfChannels:1,bitsPerSample:32,isReal:true,isColor:false,pixels:[0.1,0.2]}}};
  function ImageWindow(w,h,channelCount,bits,real,color,id){
    this.isNull=false;this.mainView={id,beginProcess(){calls.push('begin');},endProcess(){calls.push('end');},
      image:{width:w,height:h,isColor:color,assign(image){this.pixels=image.pixels.slice();calls.push('copy');},fill(value){this.pixels=[value,value];calls.push('fill');}}};
    this.show=()=>calls.push('show');outputs.push(this);
    this.forceClose=()=>{this.isNull=true;};
    assert.equal(w,channels.length?2:1);assert.equal(h,1);assert.ok(bits===32||bits===64);assert.equal(real,true);
    if(channels.length&&color)assert.equal(channelCount,3);
  }
  ImageWindow.windows=noImages?[]:[input,...channels];
  function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
  function Process(){this.executeOn=view=>{assert.notEqual(view,input.mainView);
    assert.equal(view,outputs[outputs.length-1].mainView,'Continue on the replay copy even if diagnostic output becomes active');
    calls.push(this.H?'HT':'CT');view.image.pixels[0]+=1;return !fail;};}
  const context={ImageWindow,View:{viewById:id=>({isNull:!existingIds.includes(id)})},
    Dialog:function(){this.ok=()=>{};this.cancel=()=>{};this.adjustToContents=()=>{};
      this.execute=()=>{checkbox.checked=confirm;const inputs=combos.filter(c=>c.items[0]!=='Choose input state');const stateBoxes=combos.filter(c=>c.items[0]==='Choose input state');for(let i=0;i<choices.length;i++)inputs[i+1].currentItem=choices[i];stateBoxes.forEach((c,i)=>c.currentItem=states[i]===undefined?1:states[i]);return !cancel;};},
    CheckBox:function(){checkbox=this;}, ComboBox:function(){this.items=[];this.addItem=v=>this.items.push(v);combos.push(this);},
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
  if(!nbMissing) {
    context.NarrowbandNormalization=function(){this.executeOn=view=>{
      assert.equal(view,outputs[0].mainView,'NBN always targets the current replay result');
      assert.notEqual(view,input.mainView);calls.push('NBN');nbParameters.push({...this});
      view.image.pixels[0]+=0.1;return !nbFail;
    };};
    context.NarrowbandNormalization.prototype.Palette_SHO=5;
    context.NarrowbandNormalization.prototype.Lightness_Preserve=1;
  }
  if(!paletteMissing)context.PixelMath=function(){this.executeOn=view=>{
    if(this.useSingleExpression){
      assert.notEqual(view,input.mainView);calls.push('stretch');paletteParameters.push({...this});
      const values=view.image.pixels,median=values.reduce((a,b)=>a+b,0)/values.length;
      if(this.expression.includes('sdev')) {
        const sigma=Math.sqrt(values.reduce((a,b)=>a+(b-median)**2,0)/values.length);
        const black=Math.max(Math.min(...values),median-2.7*sigma);
        view.image.pixels=values.map(v=>Math.max(0,Math.min(1,(v-black)/(1-black))));
      }else {
        const mtf=(m,x)=>x===0?0:x===1?1:(m-1)*x/((2*m-1)*x-m);
        const m=mtf(0.25,median);view.image.pixels=values.map(v=>mtf(m,v));
      }
      return !prepFail;
    }
    assert.equal(view,outputs[outputs.length-1].mainView);calls.push('PM');paletteParameters.push({...this});
    view.image.pixels[0]=0.5;return !paletteFail;
  };};
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
  return {calls,messages,outputs,input,gradientParameters,starParameters,paletteParameters,nbParameters,windows:ImageWindow.windows};
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

{
 const scripts=[step('Script','',{proc:{processId:()=> 'Script',filePath:'PerfectPalettePicker.js'},title:'PerfectPalettePicker'}),
 step('Script','',{proc:{processId:()=> 'Script',filePath:'PerfectPalettePicker.js'},title:'PerfectPalettePicker'})];
 const params={expression:'oldHa',expression1:'(oldHa + oldO)*1e-3',expression2:'oldO ^ ~oldO',
 expression3:'',symbols:'',useSingleExpression:false,createNewImage:false,generateOutput:true,
 clearImageCacheAndExit:false,rescale:false,truncate:true,truncateLower:0,truncateUpper:1};
 const pm=step('PixelMath',Object.entries(params).map(([k,v])=>'P.'+k+'='+JSON.stringify(v)+';').join('\n'),
 {proc:{processId:()=> 'PixelMath',...params}});
 const palette=api.workspaceReplayData([{id:'Palette',steps:[...scripts,pm,ht]}])[0];
 assert.equal(palette.steps.length,2);assert.equal(palette.steps[0].action,'palette');
 assert.deepEqual(Array.from(palette.steps[0].inputs),['oldHa','oldO']);
 const channel={isNull:false,mainView:{id:'O_prepared',image:{width:2,height:1,isColor:false,pixels:[0.3,0.4]}}};
 const code=api.buildWorkspaceReplayScript(palette,0,1);
 const result=run(code,{channels:[channel],choices:[0,1]});
 assert.deepEqual(result.calls,['begin','fill','end','show','PM','HT']);
 assert.equal(result.outputs[0].mainView.id,'Palette_APA_replay');
 assert.equal(result.paletteParameters[0].expression,'Ha_input');
 assert.equal(result.paletteParameters[0].expression1,'(Ha_input + O_prepared)*1e-3');
 assert.equal(result.paletteParameters[0].expression2,'O_prepared ^ ~O_prepared');
 assert.equal(result.paletteParameters[0].rescale,false);
 assert.deepEqual(channel.mainView.image.pixels,[0.3,0.4]);
 assert.match(result.messages[0],/Replay complete/);
 for(const options of [{paletteMissing:true},{paletteFail:true}]) {
   const failed=run(code,{channels:[channel],choices:[0,1],...options});
   assert.ok(!failed.calls.includes('HT'));assert.match(failed.messages[0],/PerfectPalettePicker|PixelMath/);
 }
 assert.equal(run(code,{channels:[channel],cancel:true}).outputs.length,0);
 const mismatch={...channel,mainView:{...channel.mainView,image:{...channel.mainView.image,width:5}}};
 assert.equal(run(code,{channels:[mismatch],choices:[0,1]}).outputs.length,0);
 const color={...channel,mainView:{...channel.mainView,image:{...channel.mainView.image,isColor:true}}};
 assert.equal(run(code,{channels:[color],choices:[0,1]}).outputs.length,0);
 const late={id:'Late',steps:[palette.steps[1],palette.steps[0]]};
 const stopped=run(api.buildWorkspaceReplayScript(late,0,1));
 assert.match(stopped.messages[0],/Start the selected range/);assert.ok(!stopped.calls.includes('PM'));
 for(const changes of [{symbols:'x=1'}, {useSingleExpression:true}, {createNewImage:true},
   {generateOutput:false}, {expression:'image("file")'}, {expression:'$T'}, {expression3:'1'}]) {
   const bad={...pm,proc:{...pm.proc,...changes}};
   assert.ok(api.workspaceReplayData([{id:'BadPalette',steps:[...scripts,bad]}])[0].steps[0].reason);
 }
 const masked={...pm,mask:{status:'recorded',name:'HistoricalMask'}};
 assert.ok(api.workspaceReplayData([{id:'MaskedPalette',steps:[...scripts,masked]}])[0].steps[0].reason);
 console.log('Passed: recorded PPP combination, explicit prepared-input mapping, RGB target, following stages, input preservation, dimensions/color/cancel/failure, range-start and unsupported formula checks.');
}

{
 const nb=step('NarrowbandNormalization',
   'P.palette=NarrowbandNormalization.prototype.Palette_SHO; P.lightness=P.Lightness_Preserve; P.blendMode=1; P.SCNR=0.8; P.shadowpoint=0.5; P.highlightReduction=1.2;');
 for(const steps of [[nb,ht],[ht,nb,ct]]) {
   const plan=api.workspaceReplayData([{id:'NBN_test',steps}])[0];
   assert.ok(plan.steps.every(s=>!s.reason));
   assert.equal(plan.steps.find(s=>s.tool==='NarrowbandNormalization').source,nb.source);
   const code=api.buildWorkspaceReplayScript(plan,0,plan.steps.length-1),result=run(code);
   assert.deepEqual(result.calls.slice(4),steps.map(s=>s===nb?'NBN':s===ht?'HT':'CT'));
   assert.equal(result.outputs.length,1,'Continue on the same copy');
   assert.equal(result.nbParameters[0].palette,5);
   assert.equal(result.nbParameters[0].lightness,1);
   assert.equal(result.nbParameters[0].SCNR,0.8);
   assert.equal(result.nbParameters[0].shadowpoint,0.5);
   assert.equal(result.nbParameters[0].highlightReduction,1.2);
   assert.match(result.messages[0],/Replay complete/);
   for(const options of [{nbMissing:true},{nbFail:true}]) {
     const stopped=run(code,options);
     assert.match(stopped.messages[0],/NarrowbandNormalization/);
     assert.equal(stopped.outputs.length,1);
     assert.ok(!stopped.calls.includes('CT'));
     if(steps[0]===nb)assert.ok(!stopped.calls.includes('HT'));
   }
   assert.equal(run(code,{cancel:true}).outputs.length,0);
 }
 for(const extra of [{mask:{status:'unknown'}},{mask:{status:'recorded',name:'NBN_mask'}},
   {references:[{kind:'reference',name:'Old_input'}]},
   {source:'var P=new NarrowbandNormalization; P.executeGlobal();'}]) {
   const blocked=api.workspaceReplayData([{id:'NBN_blocked',steps:[{...nb,...extra}]}])[0].steps[0];
   assert.ok(blocked.reason);assert.equal(blocked.source,'');
 }
 const paletteStep={title:'PerfectPalettePicker',number:1,substep:0,tool:'PerfectPalettePicker',reason:'',
   action:'palette',inputs:['Ha_input'],variable:'P',source:'var P=new PixelMath; P.expression="Ha_input"; P.expression1="Ha_input"; P.expression2="Ha_input";'};
 const continuation=api.workspaceReplayData([{id:'PaletteNBN',steps:[nb,ht]}])[0];
 continuation.steps.unshift(paletteStep);
 const extraChannel={isNull:false,mainView:{id:'Spare',image:{width:2,height:1,isColor:false}}};
 const combined=run(api.buildWorkspaceReplayScript(continuation,0,2),{channels:[extraChannel],choices:[0]});
 assert.deepEqual(combined.calls,['begin','fill','end','show','PM','NBN','HT']);
 assert.equal(combined.outputs.length,1,'NBN continues on the RGB palette output');
 console.log('Passed: NarrowbandNormalization first/middle replay, native parameters/enums, same output target, missing module/failure/cancel and historical blockers.');
}

{
 const paletteStep={title:'PerfectPalettePicker',number:1,substep:0,tool:'PerfectPalettePicker',reason:'',
   action:'palette',inputs:['Ha_old','O_old'],variable:'P',source:'var P=new PixelMath; P.useSingleExpression=false; P.expression="Ha_old"; P.expression1="O_old"; P.expression2="Ha_old+O_old";'};
 const workflow={id:'StretchedPalette',steps:[paletteStep]};
 const code=api.buildWorkspaceReplayScript(workflow,0,0);
 const channel={isNull:false,mainView:{id:'O_ready',image:{width:2,height:1,numberOfChannels:1,bitsPerSample:32,isReal:true,isColor:false,pixels:[0.3,0.4]}}};
 const result=run(code,{channels:[channel],choices:[0,1],states:[2,1]});
 assert.equal(result.calls.filter(c=>c==='stretch').length,2,'Stretch selected linear input in two passes');
 assert.equal(result.outputs.length,2,'One temporary copy and one RGB result');
 assert.equal(result.outputs[0].isNull,true,'Close only the temporary copy');
 assert.equal(result.outputs[1].isNull,false,'Keep RGB result');
 assert.equal(result.paletteParameters[2].expression,'Ha_input_APA_ppp_input');
 assert.equal(result.paletteParameters[2].expression1,'O_ready','Prepared channel remains unstretched');
 assert.deepEqual(channel.mainView.image.pixels,[0.3,0.4]);
 const pixels=result.outputs[0].mainView.image.pixels;
 // Verify the independently generated transfer against the original rational
 // transfer on the two samples after blackpoint normalization.
 const normalized=[0,(0.2-0.1)/(1-0.1)],median=(normalized[0]+normalized[1])/2;
 const expected=normalized.map(x=>((median-1)*0.25*x)/(median*(0.25+x-1)-0.25*x));
 pixels.forEach((x,i)=>assert.ok(Math.abs(x-expected[i])<1e-12));
 assert.match(result.messages[0],/Replay complete/);
 const unset=run(code,{channels:[channel],choices:[0,1],states:[0,1]});
 assert.equal(unset.outputs.length,0);assert.match(unset.messages[0],/Choose the preparation state/);
 const failed=run(code,{channels:[channel],choices:[0,1],states:[2,1],prepFail:true});
 assert.match(failed.messages[0],/PPP input stretch failed/);
 assert.equal(failed.outputs.length,1);assert.equal(failed.outputs[0].isNull,true);
 const reused=run(code,{channels:[channel],choices:[0,0],states:[2,2]});
 assert.equal(reused.calls.filter(c=>c==='stretch').length,2,'Shared linear source is prepared once');
 assert.equal(reused.outputs.length,2);
 const pmFailure=run(code,{channels:[channel],choices:[0,1],states:[2,1],paletteFail:true});
 assert.equal(pmFailure.outputs[0].isNull,true);
 assert.equal(pmFailure.outputs[1].isNull,false);
 assert.match(pmFailure.messages[0],/Partial result retained/);
 console.log('Passed: explicit PPP input state, real blackpoint/median stretch equivalence, prepared bypass, untouched inputs, shared-copy reuse and cleanup on success/failure.');
}
