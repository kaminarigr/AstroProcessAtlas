const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/AstroProcessAtlas.js', 'utf8')
  .replace(/^#.*$/gm, '').replace(/generateHistoryReport\(\);\s*$/, '');
const crypto = require('node:crypto');
const selectiveFixture='function main(){if(!Parameters.isViewTarget)throw Error("Unexpected interactive entry");runSCCFixture(Parameters,template);} main();';
const darkFixture='/* GNU General Public License */\nvar window = ImageWindow.activeWindow;\nfunction DarkMaskLayersData(){this.targetView = window.currentView;}\nvar data=new DarkMaskLayersData;\nfunction DarkMaskLayersDialog(){this.execute=function(){return runDSESettingsFixture(data,target);};}\nfunction doDark(data){runDSEFixture(data,target);}\nfunction main(){}\nmain();';
const api = {Console:{writeln(){}},coreSrcDirPath:'/fixture/src',File:{readFile:()=>Buffer.from(selectiveFixture),readTextFile:()=>darkFixture},
  CryptographicHash_SHA256:256,CryptographicHash:function(){this.hash=bytes=>({toHex:()=>crypto.createHash('sha256').update(bytes).digest('hex')});}};
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
  [{mask:{status:'recorded',name:''}}, /mask state is unknown/],
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
  starMissing=false,starFail=false,paletteMissing=false,paletteFail=false,nbMissing=false,nbFail=false,sccMissing=false,sccFail=false,sourceChanged=false,scriptRecords=[],initialScripts=false,channels=[],choices=[],states=[],prepFail=false,
  dseCancel=false,dseOtherTarget=false,dseFail=false,mltMissing=false,maskCancel=false,maskBlend=false,unsharpMissing=false,maskChoices=[],maskInvertChoices=[],orientations=[1],inputId='Ha_input',existingIds=['Ha_input_APA_replay']}={}) {
  const calls=[], messages=[], outputs=[], gradientParameters=[], starParameters=[],paletteParameters=[],nbParameters=[],sccParameters=[],combos=[],maskApplications=[],unsharpParameters=[];let checkbox,maskPrompts=0;
  const input={isNull:false,rgbWorkingSpace:{gamma:2.2},mainView:{id:inputId,stf:[[1,2]],
    image:{width:2,height:1,numberOfChannels:1,bitsPerSample:32,isReal:true,isColor:false,pixels:[0.1,0.2]}}};
  function ImageWindow(w,h,channelCount,bits,real,color,id){
    this.isNull=false;this.mainView={id,beginProcess(){calls.push('begin');},endProcess(){calls.push('end');},
      image:{width:w,height:h,isColor:color,assign(image){this.width=image.width;this.height=image.height;this.pixels=image.pixels.slice();calls.push('copy');},fill(value){this.pixels=[value,value];calls.push('fill');}}};
    this.show=()=>calls.push('show');outputs.push(this);
    this.mainView.window=this;
    this.removeMask=()=>{this.mask=null;this.maskEnabled=false;};this.setMask=window=>{this.mask=window;};
    this.forceClose=()=>{this.isNull=true;};
    assert.ok(w===1||w===2);assert.equal(h,1);assert.ok(bits===32||bits===64);assert.equal(real,true);
    if(channels.length&&color)assert.equal(channelCount,3);
  }
  ImageWindow.windows=noImages?[]:[input,...channels];
  function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
  function Process(){this.executeOn=view=>{assert.notEqual(view,input.mainView);
    assert.equal(view,outputs[outputs.length-1].mainView,'Continue on the replay copy even if diagnostic output becomes active');
    calls.push(this.H?'HT':'CT');if(maskBlend&&this.K){const output=outputs[outputs.length-1];view.image.pixels=view.image.pixels.map((value,i)=>{const m=output.mask&&output.maskEnabled?output.mask.mainView.image.pixels[i]:1;const weight=output.mask&&output.maskEnabled&&output.maskInverted?1-m:m;return value*(1-weight)+value*value*weight;});}else view.image.pixels[0]+=1;return !fail;};}
  const context={ImageWindow,View:{viewById:id=>({isNull:!existingIds.includes(id)})},
    Dialog:function(){this.ok=()=>{};this.cancel=()=>{};this.adjustToContents=()=>{};
      this.execute=()=>{if(this.windowTitle==='AstroProcessAtlas - Mask orientation'){combos[combos.length-1].currentItem=orientations.shift()||0;return !maskCancel;}if(this.windowTitle==='AstroProcessAtlas - Select mask'){const choice=maskChoices[maskPrompts];if(maskInvertChoices[maskPrompts]!==undefined)checkbox.checked=maskInvertChoices[maskPrompts];++maskPrompts;if(choice!==undefined)combos[combos.length-1].currentItem=choice;return !maskCancel;}checkbox.checked=confirm;const inputs=combos.filter(c=>c.items[0]!=='Choose input state');const stateBoxes=combos.filter(c=>c.items[0]==='Choose input state');for(let i=0;i<choices.length;i++)inputs[i+1].currentItem=choices[i];stateBoxes.forEach((c,i)=>c.currentItem=states[i]===undefined?1:states[i]);return !cancel;};},
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
  if(!mltMissing)context.MultiscaleLinearTransform=function(){this.executeOn=view=>{assert.equal(view,outputs[outputs.length-1].mainView);calls.push('MLT');assert.equal(this.layers[0][4],0.75);view.image.pixels[0]+=0.2;return !fail;};};
  context.runDSESettingsFixture=(data,target)=>{calls.push('DSE settings');assert.equal(data.targetView,target);if(dseOtherTarget)data.targetView=input.mainView;return !dseCancel;};
  context.runDSEFixture=(data,target)=>{assert.equal(data.targetView,target);calls.push('DSE');if(dseFail)throw Error('DSE failed');target.image.pixels[0]+=0.1;};
  if(!unsharpMissing)context.UnsharpMask=function(){this.executeOn=view=>{calls.push('USM');unsharpParameters.push({...this});const output=outputs[outputs.length-1];maskApplications.push({name:output.mask&&output.mask.mainView.id,inverted:output.maskInverted,enabled:output.maskEnabled});view.image.pixels[0]+=0.1;return !fail;};};
  context.Script=function(){throw Error('Native Script properties are read-only; construction is not a replay mechanism.');};
  context.Parameters={isViewTarget:false,targetView:input.mainView};
  context.File={readFile(){if(sccMissing)throw Error('SelectiveColorCorrection installed source is missing.');return Buffer.from(selectiveFixture+(sourceChanged?'changed':''));}};
  context.CryptographicHash_SHA256=api.CryptographicHash_SHA256;
  context.CryptographicHash=api.CryptographicHash;
  context.runSCCFixture=function(parameters,template){
    assert.equal(parameters.isViewTarget,true);assert.equal(parameters.targetView,outputs[outputs.length-1].mainView);
    assert.equal(context.Parameters.isViewTarget,false,'Global parameters remain untouched');
    assert.equal(context.Parameters.targetView,input.mainView);
    assert.equal(parameters.getReal('yellow'),20);assert.equal(parameters.getString('filterMethod'),'Green');
    assert.equal(parameters.getBoolean('useStarMask'),template.parameters.some(([k,v])=>k==='useStarMask'&&v==='true'));
    calls.push('SCC');sccParameters.push(template);parameters.targetView.image.pixels[0]+=0.2;
    ImageWindow.activeWindow={mainView:{id:'SCC_generated_mask'},isNull:false};
    if(sccFail)throw Error('Process failed: SelectiveColorCorrection');
  };
  const storedScripts=sccMissing?[]:scriptRecords.map(record=>{
    const instance={processId:()=> 'Script',executeOn(view){
    throw Error('Attempt to execute a Script instance recursively (view context).');
    }};
    for(const key of ['filePath','md5sum','parameters','information'])Object.defineProperty(instance,key,{value:record[key],writable:false,enumerable:true});
    return instance;
  });
  const history={length:storedScripts.length,at:i=>storedScripts[i]};
  input.mainView[initialScripts?'initialProcessing':'processing']=history;
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
  const expanded=script.replace(/^#include "\/fixture\/src\/scripts\/Toolbox\/SelectiveColorCorrection.js"$/gm,selectiveFixture);
  vm.runInNewContext(expanded.replace(/^#.*$/gm,''),context);
  assert.deepEqual(input.mainView.image.pixels,[0.1,0.2],'Input pixels never change');
  assert.equal(input.mainView.id,inputId,'Input ID never changes');
  return {calls,messages,outputs,input,gradientParameters,starParameters,paletteParameters,nbParameters,sccParameters,windows:ImageWindow.windows,maskPrompts,maskApplications,unsharpParameters};
}
const complete=api.buildWorkspaceReplayScript(plan,0,1);
{
 const mlt=step('MultiscaleLinearTransform','P.layers=[[true,true,0.1,false,0.75,3,1]]; P.linear=true; P.toLuminance=true;');
 const native=api.workspaceReplayData([{id:'MLT',steps:[mlt,ht]}])[0];
 assert.equal(native.steps[0].reason,'');
 let result=run(api.buildWorkspaceReplayScript(native,0,1));assert.deepEqual(result.calls.filter(c=>c==='MLT'||c==='HT'),['MLT','HT']);
 assert.match(run(api.buildWorkspaceReplayScript(native,0,1),{mltMissing:true}).messages[0],/MultiscaleLinearTransform/);
 assert.ok(!run(api.buildWorkspaceReplayScript(native,0,1),{fail:true}).calls.includes('HT'));
 const ds=step('Script','P.filePath="$PXI_SRCDIR/scripts/misc/DarkStructureEnhance.js"; P.parameters=[];',
   {proc:{processId:()=> 'Script',filePath:'$PXI_SRCDIR/scripts/misc/DarkStructureEnhance.js',parameters:[]},title:'DarkStructureEnhance'});
 const data=api.workspaceReplayData([{id:'DSE',steps:[ht,ds,mlt]}])[0];
 assert.equal(data.steps[1].action,'dark');assert.equal(data.steps[1].reason,'');assert.match(data.steps[1].warning,/not recorded/);
 const code=api.buildWorkspaceReplayScript(data,0,2);
 assert.match(code,/GPL-3.0-only/);assert.match(code,/END OF TERMS AND CONDITIONS/);
 assert.ok(!code.includes('new Script'));new vm.Script(code.replace(/^#.*$/gm,''));
 result=run(code);assert.deepEqual(result.calls.filter(c=>['HT','DSE settings','DSE','MLT'].includes(c)),['HT','DSE settings','DSE','MLT']);
 for(const options of [{dseCancel:true},{dseOtherTarget:true},{dseFail:true},{sourceChanged:true}]){
   result=run(code,options);assert.ok(!result.calls.includes('MLT'));assert.match(result.messages[0],/Partial result retained/);
 }
 assert.ok(api.workspaceReplayData([{id:'MaskedDSE',steps:[{...ds,mask:{status:'recorded',name:'Mask',inverted:false}}]}])[0].steps[0].reason);
 assert.ok(api.workspaceReplayData([{id:'DifferentDSE',steps:[{...ds,proc:{...ds.proc,parameters:[['unknown','1']]}}]}])[0].steps[0].reason);
 console.log('Passed: MultiscaleLinearTransform native replay and DarkStructureEnhance manual settings, target enforcement, GPL notice, source verification and stop/failure handling.');
}
{
 const data=api.workspaceReplayData([{id:'Final',steps:[ht]},{id:'Sii',isOriginalInput:true,steps:[]}])[0];
 assert.deepEqual(Array.from(data.originalInputs),['Sii']);
 const code=api.buildWorkspaceReplayScript(data,0,0);
 const helper=code.slice(code.indexOf('var replayOriginalInputs'),code.indexOf('function applyReplayMask'));
 const context={HistogramTransformation:function(){}};vm.runInNewContext(helper,context);
 const candidates=['SII_final','Sii','Ha','OiiI','Sii_clone'].map(id=>({mainView:{id,image:{isColor:false}}}));
 assert.equal(context.suggestPaletteInput('SII_final',candidates),1,'Prefer original Sii over the processed exact match');
 assert.equal(context.suggestPaletteInput('Ha_final',candidates),2);
 assert.equal(context.suggestPaletteInput('OIII_final',candidates),3,'Match channel names without case sensitivity');
 assert.equal(context.suggestPaletteInput('Other',candidates),0,'Retain default when no useful match exists');
 candidates[1].mainView.image.isColor=true;assert.equal(context.suggestPaletteInput('SII_final',candidates),0,'Never suggest an RGB image as an original channel');
 console.log('Passed: palette original-input suggestions, suffix/case matching, grayscale requirement and fallback.');
}
{
 const usm=step('UnsharpMask','P.sigma=2.5; P.amount=0.65; P.useLuminance=true;');
 const masked=inverted=>({...usm,mask:{status:'recorded',name:'Mask_history',inverted},references:[{kind:'mask',name:'Mask_history'}]});
 const maskWindow={isNull:false,mainView:{id:'Mask_history',image:{width:2,height:1,isColor:false,pixels:[0.2,0.8]}}};
 const image=api.workspaceReplayData([{id:'Masked',steps:[masked(false),masked(true),usm,masked(false)]}])[0];
 assert.ok(image.steps.every(s=>!s.reason),'Known native masks are supplied interactively');
 const code=api.buildWorkspaceReplayScript(image,0,3);
 let result=run(code,{channels:[maskWindow]});
 assert.equal(result.maskPrompts,3);
 assert.deepEqual(result.maskApplications.map(m=>[m.name,m.inverted,m.enabled]),[['Mask_history',false,true],['Mask_history',true,true],[null,true,false],['Mask_history',false,true]]);
 assert.equal(result.outputs[0].mask,null,'Mask removed after the last process');
 assert.equal(result.unsharpParameters[0].sigma,2.5);assert.equal(result.unsharpParameters[0].amount,0.65);
 assert.deepEqual(maskWindow.mainView.image.pixels,[0.2,0.8],'Never invert mask pixels');
 const reversed=api.workspaceReplayData([{id:'InvertFirst',steps:[masked(true),masked(false)]}])[0];
 result=run(api.buildWorkspaceReplayScript(reversed,0,1),{channels:[maskWindow]});
 assert.equal(result.maskPrompts,2);assert.deepEqual(result.maskApplications.map(m=>m.inverted),[true,false],'First inverted use sets the native mask inversion flag on the normal mask image');
 const unknown=api.workspaceReplayData([{id:'UnknownInversion',steps:[masked(null),masked(null)]}])[0];
 assert.ok(unknown.steps.every(s=>!s.reason),'A known mask name with unknown inversion is a prompt, not a blocker');
 const unknownCode=api.buildWorkspaceReplayScript(unknown,0,1);
 result=run(unknownCode,{channels:[maskWindow]});
 assert.equal(result.maskPrompts,2);assert.deepEqual(result.maskApplications.map(m=>m.inverted),[false,false]);
 result=run(unknownCode,{channels:[maskWindow],maskInvertChoices:[true]});
 assert.equal(result.maskPrompts,2);assert.deepEqual(result.maskApplications.map(m=>m.inverted),[true,true],'Remember the user-selected Color invert setting');
 result=run(code,{channels:[maskWindow],maskInvertChoices:[true]});
 assert.equal(result.maskPrompts,3);assert.deepEqual(result.maskApplications.filter(m=>m.enabled).map(m=>m.inverted),[true,false,true],'Apply later historical inversion changes relative to the first user choice');
 assert.ok(!unknownCode.includes('Mask orientation'),'No separate inversion-selection dialog');
 const alternative={isNull:false,mainView:{id:'Mask_before_blur',image:{width:2,height:1,isColor:false,pixels:[0.3,0.7]}}};
 result=run(code,{channels:[maskWindow,alternative],maskChoices:[1,2],maskInvertChoices:[false,true,false]});
 assert.equal(result.maskPrompts,3,'Every masked step allows version and Color invert changes');
 assert.deepEqual(result.maskApplications.filter(m=>m.enabled).map(m=>[m.name,m.inverted]),[['Mask_history',false],['Mask_before_blur',true],['Mask_before_blur',false]],'Reuse the last selected image but allow per-step inversion overrides');
 const timed=api.workspaceReplayData([{id:'Timed',steps:[{...masked(false),time:'2026-10-11T10:00:00Z'}]}])[0];
 assert.equal(timed.steps[0].time,'2026-10-11T10:00:00Z');
 assert.match(api.buildWorkspaceReplayScript(timed,0,0),/2026-10-11T10:00:00Z/);
 result=run(code,{channels:[maskWindow],maskCancel:true});assert.equal(result.calls.filter(c=>c==='USM').length,0);assert.match(result.messages[0],/Mask selection cancelled.*Partial result/s);
 result=run(code,{channels:[maskWindow],fail:true});assert.equal(result.outputs[0].mask,null);assert.equal(result.calls.filter(c=>c==='USM').length,1);
 result=run(api.buildWorkspaceReplayScript(api.workspaceReplayData([{id:'USM',steps:[usm]}])[0],0,0),{unsharpMissing:true});assert.match(result.messages[0],/UnsharpMask/);
 const two=api.workspaceReplayData([{id:'Two',steps:[masked(false),{...masked(false),references:[{kind:'mask',name:'OtherMask'}],mask:{status:'recorded',name:'OtherMask',inverted:false}}]}])[0];
 assert.equal(run(api.buildWorkspaceReplayScript(two,0,1),{channels:[maskWindow]}).maskPrompts,2);
 console.log('Passed: UnsharpMask settings, prompted masks, cached orientation and automatic inversion, unmasked steps, cancellation/failure cleanup and missing module.');
}
{
 const normalMask={isNull:false,mainView:{id:'CurveMask',image:{width:2,height:1,isColor:false,pixels:[0.2,0.6]}}};
 for(const inverted of [false,true]){
   const maskedCurve={...ct,mask:{status:'recorded',name:'CurveMask',inverted},references:[{kind:'mask',name:'CurveMask'}]};
   const image=api.workspaceReplayData([{id:'Curved',steps:[maskedCurve]}])[0];
   const result=run(api.buildWorkspaceReplayScript(image,0,0),{channels:[normalMask],maskBlend:true});
   assert.equal(result.maskPrompts,1);
   const expected=[0.1,0.2].map((x,i)=>{const weight=inverted?1-normalMask.mainView.image.pixels[i]:normalMask.mainView.image.pixels[i];return x*(1-weight)+x*x*weight;});
   result.outputs[0].mainView.image.pixels.forEach((x,i)=>assert.ok(Math.abs(x-expected[i])<1e-12,'Curves uses the original per-pixel mask weight, or 1-mask for inverted usage'));
   assert.deepEqual(normalMask.mainView.image.pixels,[0.2,0.6],'Mask colors and geometry remain unchanged');
 }
 console.log('Passed: CurvesTransformation mask blending with normal pixels and native 1-mask inversion, including first inverted usage.');
}
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
  {mask:{status:'unknown'}},
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
    {mask:{status:'unknown'}},
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
 for(const extra of [{mask:{status:'unknown'}},
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

{
 const values={maskShadows:'0',maskBalance:'0.5',maskHighlights:'1',previewMode:'0',useStarMask:'false',showMask:'false',filterMethod:'Green',
 cyan:'0',magenta:'0',yellow:'20',red:'0',green:'-20',blue:'0',luminance:'0',starMaskIntensity:'1.8',saturation:'0',contrast:'0',maskSmoothness:'10',invertMask:'false',maskIntensity:'1'};
 const parameters=Object.entries(values),checksum='a48bf2b4ee6f54c284db49149cad221b';
 const proc={processId:()=> 'Script',filePath:'$PXI_SRCDIR/scripts/Toolbox/SelectiveColorCorrection.js',md5sum:checksum,parameters};
 const scc=step('Script','P.filePath='+JSON.stringify(proc.filePath)+'; P.md5sum='+JSON.stringify(checksum)+'; P.parameters='+JSON.stringify(parameters)+'; P.information="";',
 {proc,title:'SelectiveColorCorrection'});
 const ws=step('RGBWorkingSpace','P.channels=[[1,0.648431,0.330856],[1,0.321152,0.597871],[1,0.155886,0.066044]]; P.gamma=2.2; P.sRGBGamma=true; P.applyGlobalRGBWS=false;');
 for(const steps of [[ws,ws,scc,ht],[ht,ws,ws,scc,ct],[scc,ht]]) {
   const plan=api.workspaceReplayData([{id:'SCC_test',steps}])[0];
   assert.ok(plan.steps.every(s=>!s.reason));
   const entry=plan.steps.find(s=>s.action==='selective');
   assert.equal(entry.tool,'SelectiveColorCorrection');
   assert.equal(plan.steps.filter(s=>s.action==='selective').length,1);
   assert.ok(!plan.steps.some(s=>s.tool==='RGBWorkingSpace'));
   const code=api.buildWorkspaceReplayScript(plan,0,plan.steps.length-1),result=run(code,{scriptRecords:[proc]});
   assert.equal(result.calls.filter(c=>c==='SCC').length,1);
   assert.ok(result.calls.includes(steps[steps.length-1]===ct?'CT':'HT'));
   assert.equal(result.sccParameters[0].md5sum,checksum);
   assert.equal(JSON.stringify(result.sccParameters[0].parameters),JSON.stringify(parameters));
   assert.match(result.messages[0],/Replay complete/);
   for(const options of [{sccMissing:true},{sccFail:true}]) {
     const stopped=run(code,{scriptRecords:[proc],...options});assert.match(stopped.messages[0],/Script|SelectiveColorCorrection/);
     assert.match(stopped.messages[0],/Partial result retained/);
     assert.ok(!stopped.calls.includes('CT'));
     if(steps[0]===ws||steps[0]===scc)assert.ok(!stopped.calls.includes('HT'));
   }
 }
 for(const extra of [
   {proc:{...proc,parameters:parameters.filter(([k])=>k!=='maskBalance')}},
   {proc:{...proc,parameters:parameters.map(([k,v])=>[k,k==='filterMethod'?'Imported Mask':v])}},
   {proc:{...proc,parameters:[...parameters,['unknownSetting','1']]}},
   {proc:{...proc,md5sum:''}}, {proc:{...proc,filePath:'UnrelatedScript.js'}},
   {mask:{status:'recorded',name:'Old_mask'}},{mask:{status:'unknown'}},
   {references:[{kind:'reference',name:'Old_input'}]},
   {source:'var P = new Script; P.executeGlobal();'}
 ]) assert.ok(api.workspaceReplayData([{id:'BlockedSCC',steps:[ws,ws,{...scc,...extra}]}])[0].steps.some(s=>s.reason));
 const starScc={...scc,proc:{...proc,parameters:parameters.map(([k,v])=>[k,k==='useStarMask'?'true':v])}};
 const starPlan=api.workspaceReplayData([{id:'StarMaskSCC',steps:[starScc,ht]}])[0];
 const absent=run(api.buildWorkspaceReplayScript(starPlan,0,1),{starMissing:true});
 assert.match(absent.messages[0],/requires StarXTerminator/);assert.ok(!absent.calls.includes('SCC'));
 assert.ok(run(api.buildWorkspaceReplayScript(starPlan,0,1),{scriptRecords:[starScc.proc]}).calls.includes('SCC'));
 const code=api.buildWorkspaceReplayScript(starPlan,0,1);
 assert.ok(!code.includes('new Script'));
 assert.ok(run(code,{scriptRecords:[starScc.proc],initialScripts:true}).calls.includes('SCC'));
 assert.ok(run(code,{scriptRecords:[{...starScc.proc,parameters:starScc.proc.parameters.slice().reverse()}]}).calls.includes('SCC'));
 for(const record of [{...starScc.proc,md5sum:'00000000000000000000000000000000'},
   {...starScc.proc,filePath:'Other.js'},
   {...starScc.proc,parameters:starScc.proc.parameters.map(([k,v])=>[k,k==='green'?'12':v])}]) {
   const independent=run(code,{scriptRecords:[record]});
   assert.ok(independent.calls.includes('SCC'),'No dependence on workspace Script instances');
 }
 const changed=run(code,{sourceChanged:true});assert.ok(!changed.calls.includes('SCC'));assert.match(changed.messages[0],/source changed/);
 assert.ok(run(code).calls.includes('SCC'),'Original history is no longer required');
 console.log('Passed: native SelectiveColorCorrection grouped/standalone/first/middle, saved settings/checksum, one parent call, continued target, missing/failing script, imported/historical masks and star-mask dependency.');
}
