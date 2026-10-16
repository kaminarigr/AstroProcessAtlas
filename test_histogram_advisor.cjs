const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/AstroProcessAtlas.js','utf8').replace(/^#.*$/gm,'').replace(/generateHistoryReport\(\);\s*$/,'');
const api={Console:{writeln(){}}};vm.runInNewContext(source,api);const learner=api.atlasHistogramLearning();
const identity=()=>Array.from({length:5},()=>[0,0.5,1,0,1]);
const originalH=identity();originalH[3][1]=0.3;
function stats(pixels,color=false){return api.captureAtlasImageStatistics({width:pixels.length,height:1,isColor:color,sample(x,y,c){return pixels[x]*(color?[1,0.8,0.6][c]:1);}});}
function example(H,before=stats([0.01,0.03,0.08]),origin='history'){return {id:origin+':'+JSON.stringify(H),origin,before,after:stats([0.04,0.12,0.3]),H};}
const prior=example(originalH),library=learner.merge(learner.empty(),[prior],[]),model=learner.train(library);
assert.equal(model.algorithm,'weighted-nearest-neighbours');assert.equal(model.examples.length,1);
assert.ok(learner.predict(model,prior.before,identity()).learned);
assert.equal(learner.predict(model,stats([0.1,0.2],true),originalH).learned,false);
assert.equal(learner.predict(model,stats([0.7,0.8,0.9]),originalH).learned,false);
assert.deepEqual(JSON.parse(JSON.stringify(learner.predict(learner.train(learner.empty()),prior.before,originalH).H)),originalH);
const preferred=identity();preferred[3][1]=0.15;
const review={format:'AstroProcessAtlasHistogramFeedback',version:1,id:'trial_123',context:{image:'Ha',anchor:'step_1',sourceHash:learner.hash(originalH)},before:prior.before,accepted:['user'],reason:'Retains faint detail',candidates:[{name:'recorded',H:originalH,after:prior.after},{name:'suggested',H:originalH,after:prior.after},{name:'user',H:preferred,after:prior.after}]};
const learned=learner.merge(library,[],[review]),prediction=learner.predict(learner.train(learned),prior.before,originalH);assert.ok(prediction.H[3][1]<0.17,'Explicit preference must outweigh a historical seed');assert.equal(learner.merge(learned,[],[review]).examples.length,2,'Duplicate feedback is not counted twice');
const rejected=learner.merge(library,[],[{...review,id:'rejected',accepted:[]}]);assert.equal(rejected.examples.length,1);assert.equal(rejected.evaluations.length,1);
const tied=learner.merge(learner.empty(),[],[{...review,id:'tied',accepted:['recorded','user']}]);assert.equal(tied.examples[0].weight,2.5);assert.equal(learner.validate(tied).examples[0].weight,2.5);
assert.throws(()=>learner.feedback({...review,accepted:['bad']}));assert.throws(()=>learner.feedback({...review,accepted:['user','user']}));
assert.throws(()=>learner.matrix([[0,0,1,0,1]]));assert.throws(()=>learner.matrix(identity().map((row,i)=>i===0?[1,0.5,0,0,1]:row)));
assert.throws(()=>learner.features({...prior.before,rawPixels:false}));assert.throws(()=>learner.validate({...library,version:99}));
const baselineH=JSON.stringify(originalH);const report={format:'AstroProcessAtlasReport',schemaVersion:1,history:[{id:'Ha',steps:[{tool:'HistogramTransformation',source:'h',mask:{status:'unrecorded'},statistics:{before:prior.before,after:prior.after}},{tool:'HistogramTransformation',source:'h',mask:{status:'recorded'},statistics:{before:prior.before,after:prior.after}},{tool:'HistogramTransformation',source:'h',mask:{status:'unrecorded'},statistics:null}]}]};
const imported=learner.history(report,()=> 'var P=new HistogramTransformation;P.H='+baselineH+';');assert.equal(imported.examples.length,1);assert.equal(imported.skipped,2);
assert.equal(learner.readMatrix('var P=new HistogramTransformation;P.H='+baselineH+';')[3][1],0.3);
assert.equal(learner.validate(JSON.parse(JSON.stringify(learned))).examples.length,2);
console.log('Passed: actual local model fitting, learned preference weighting, distribution fallback, ties/rejections, validation, historical seeds and deduplicated persistence.');

function runtime(){
 const windows=[],settings={},messages=[],writes={},controls=[],pending=[];let phase=0,cancelInput=false,saveCancelled=false,failApply=false;const nullView={isNull:true};
 function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
 function image(values,channels=1){return {width:values.length,height:1,isColor:channels===3,numberOfChannels:channels,bitsPerSample:32,isReal:true,colorSpace:channels===3?1:0,values:values.slice(),sample(x,y,c){return this.values[x];},assign(other){this.values=other.values.slice();this.width=other.width;this.height=other.height;}};}
 function Window(w,h,n,b,f,color,id){this.isNull=false;this.mask={isNull:true};this.maskEnabled=true;this.rgbWorkingSpace={gamma:2.2};const props={},attributes={},history=[];const win=this;this.mainView={id,fullId:id,window:win,image:image(Array(w).fill(0),n),historyIndex:0,stf:[[0.2,0,0.9,0,1]],beginProcess(){},endProcess(){},setPropertyValue(k,v,type,flags){props[k]=v;attributes[k]=flags||0;},propertyValue(k){return props[k];},hasProperty(k){return Object.hasOwn(props,k);},deleteProperty(k){delete props[k];delete attributes[k];},invalidateProperties(){for(const k of Object.keys(props))if(!(attributes[k]&32))delete props[k];},processing:{at:i=>history[i],toSource(){return 'var C=new ProcessContainer;'+history.map((p,i)=>'C.add(new HistogramTransformation);'+(p.mask?'C.setMask('+i+','+JSON.stringify(p.mask.id)+','+p.mask.inverted+');':'')).join('');}},history};this.setMask=mask=>{this.mask=mask;};this.removeMask=()=>{this.mask={isNull:true};};this.forceClose=()=>this.isNull=true;this.show=()=>{};windows.push(this);}
 Object.defineProperty(Window,'windows',{get:()=>windows.filter(w=>!w.isNull)});
 function Histogram(){this.H=identity();this.executeOn=view=>{view.invalidateProperties();if(failApply)throw Error('Native failure');const H=JSON.parse(JSON.stringify(this.H));const active=view.window.mask&&!view.window.mask.isNull&&view.window.maskEnabled?view.window.mask:null;view.image.values=view.image.values.map((x,index)=>{const original=x;const row=H[3];x=Math.max(0,Math.min(1,(x-row[0])/(row[2]-row[0])));const transformed=x===0?0:x===1?1:(row[1]-1)*x/((2*row[1]-1)*x-row[1]);const weight=active?(view.window.maskInverted?1-active.mainView.image.values[index]:active.mainView.image.values[index]):1;return original*(1-weight)+transformed*weight;});view.history.splice(view.historyIndex);view.history.push({mask:active?{id:active.mainView.id,inverted:!!view.window.maskInverted}:null,toSource:()=> 'var P=new HistogramTransformation;P.H='+JSON.stringify(H)+';'});view.historyIndex++;return true;};this.launch=()=>{pending.push(this);return true;};}
 const ctx={...api,ImageWindow:Window,View:{viewById:id=>windows.find(w=>!w.isNull&&w.mainView.id===id)?.mainView||nullView},HistogramTransformation:Histogram,UndoFlag_NoSwapFile:0,DataType_String:1,StdIcon_Information:1,StdIcon_Error:2,StdButton_Ok:1,PropertyType_IsoString:47,PropertyAttribute_Permanent:32,PropertyAttribute_Storable:128,VerticalSizer:Sizer,HorizontalSizer:Sizer,
 Settings:{read:k=>settings[k]||null,write:(k,t,v)=>settings[k]=v,remove:k=>delete settings[k]},
 Label:function(){this.setMinWidth=()=>{};},Edit:function(){this.text='Preserves detail';},ComboBox:function(){this.items=[];this.currentItem=0;this.addItem=x=>this.items.push(x);controls.push(this);},CheckBox:function(){this.checked=true;},PushButton:function(){},
 Dialog:function(){this.adjustToContents=()=>{};this.ok=()=>{};this.cancel=()=>{};this.execute=()=>{if(this.windowTitle.includes('trial input')){controls.at(-1).currentItem=0;return !cancelInput;}if(this.windowTitle.includes('trial mask'))return true;controls.at(-1).currentItem=3;return true;};},
 MessageBox:function(text){this.execute=()=>messages.push(text);},SaveFileDialog:function(){this.fileName='evaluation.json';this.execute=()=>!saveCancelled;},
 File:function(){this.createForWriting=path=>this.path=path;this.write=text=>writes[this.path]=text;this.close=()=>{};},ByteArray:{stringToUTF8:x=>x}
 };
 const input=new Window(3,1,1,32,true,false,'New_Ha');input.mainView.image.values=[0.01,0.03,0.08];
 return {ctx,input,windows,settings,messages,writes,pending,fail:()=>failApply=true,cancelSave:value=>saveCancelled=value};
}
const config={id:'test_trial',image:'New_Ha',isColor:false,context:review.context,recordedH:originalH,userH:originalH,model,modelId:'model_1'},script=api.buildAtlasHistogramExperiment(config);
new vm.Script(script.replace(/^#.*$/gm,''));assert.ok(!script.includes('ExternalProcess'));assert.ok(script.includes('SPDX-License-Identifier: MIT'));
const run=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),run.ctx);assert.equal(run.windows.length,4);assert.equal(run.input.mainView.image.values[0],0.01);assert.equal(run.input.mainView.stf[0][0],0.2,'Source STF unchanged');
const user=run.windows.find(w=>w.mainView.id.includes('_User_'));assert.equal(user.mainView.historyIndex,0);assert.equal(Object.keys(run.settings).length,1);assert.ok(Object.values(run.settings)[0].startsWith('APA-HIST-HEX1:'));assert.ok(run.messages.at(-1).includes('script now ends'));assert.deepEqual(JSON.parse(JSON.stringify(user.mainView.stf[0])),[0.5,0,1,0,1]);
const manual=new run.ctx.HistogramTransformation;manual.H=preferred;manual.executeOn(user.mainView);run.cancelSave(true);vm.runInNewContext(script.replace(/^#.*$/gm,''),run.ctx);assert.equal(Object.keys(run.settings).length,1,'Cancelling save retains the pending trial');run.cancelSave(false);vm.runInNewContext(script.replace(/^#.*$/gm,''),run.ctx);assert.equal(Object.keys(run.settings).length,0);const feedback=JSON.parse(run.writes['evaluation.json']);assert.equal(feedback.accepted[0],'user');assert.equal(feedback.context.anchor,'step_1');assert.equal(feedback.candidates[2].H[3][1],0.15);assert.ok(learner.merge(library,[],[feedback]).examples.length===2);assert.equal(run.windows.filter(w=>!w.isNull).length,4,'Results remain available');
const failure=runtime();failure.fail();vm.runInNewContext(script.replace(/^#.*$/gm,''),failure.ctx);assert.equal(failure.windows.filter(w=>!w.isNull).length,1);assert.equal(Object.keys(failure.settings).length,0);assert.ok(failure.messages.at(-1).includes('Native failure'));
const altered=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),altered.ctx);const recorded=altered.windows.find(w=>w.mainView.id.includes('_Recorded_'));const extra=new altered.ctx.HistogramTransformation;extra.executeOn(recorded.mainView);vm.runInNewContext(script.replace(/^#.*$/gm,''),altered.ctx);assert.ok(altered.messages.at(-1).includes('were edited'));assert.equal(Object.keys(altered.writes).length,0);
const multiple=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),multiple.ctx);const own=multiple.windows.find(w=>w.mainView.id.includes('_User_'));const two=new multiple.ctx.HistogramTransformation;two.executeOn(own.mainView);two.executeOn(own.mainView);vm.runInNewContext(script.replace(/^#.*$/gm,''),multiple.ctx);assert.ok(multiple.messages.at(-1).includes('one HistogramTransformation only'));
const replaced=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),replaced.ctx);replaced.windows.find(w=>w.mainView.id.includes('_User_')).mainView.setPropertyValue('AstroProcessAtlas:HistogramTrial','different');vm.runInNewContext(script.replace(/^#.*$/gm,''),replaced.ctx);assert.ok(replaced.messages.at(-1).includes('replaced'));
console.log('Passed: three independent results, raw equal STF, real script finish/resume, user parameter capture, feedback save/cancel, source preservation, failure cleanup and tamper/multi-process guards.');
const firstId=feedback.id;vm.runInNewContext(script.replace(/^#.*$/gm,''),run.ctx);const repeatUser=run.windows.filter(w=>w.mainView.id.includes('_User_')).at(-1);const repeat=new run.ctx.HistogramTransformation;repeat.H=preferred;repeat.executeOn(repeatUser.mainView);vm.runInNewContext(script.replace(/^#.*$/gm,''),run.ctx);const repeatFeedback=JSON.parse(run.writes['evaluation.json']);assert.notEqual(repeatFeedback.id,firstId,'Reusing a downloaded script creates a distinct learning trial');assert.equal(learner.merge(library,[],[feedback,repeatFeedback]).evaluations.length,2);
const masked=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),masked.ctx);const maskedUser=masked.windows.find(w=>w.mainView.id.includes('_User_'));const single=new masked.ctx.HistogramTransformation;single.executeOn(maskedUser.mainView);maskedUser.mainView.processing.toSource=()=> 'var C=new ProcessContainer;C.add(new HistogramTransformation);C.setMask(0,"Historical_mask");';vm.runInNewContext(script.replace(/^#.*$/gm,''),masked.ctx);assert.ok(masked.messages.at(-1).includes('known unmasked history'));assert.equal(Object.keys(masked.writes).length,0);
assert.throws(()=>learner.merge(learned,[],[{...review,reason:'Conflicting review'}]),/Conflicting/);
const preprocessed=script.replace(/^#.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'');new vm.Script(preprocessed);
console.log('Passed: unique repeated trials, historical mask refusal, conflicting feedback and preprocessing-safe generated scripts.');
function decodeTrial(text){return JSON.parse(Buffer.from(text.slice(14).match(/.{4}/g).map(hex=>String.fromCharCode(parseInt(hex,16))).join(''),'utf8').toString());}
function encodeTrial(value){return 'APA-HIST-HEX1:'+JSON.stringify(value).split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');}
const legacy=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),legacy.ctx);const oldUser=legacy.windows.find(w=>w.mainView.id.includes('_User_'));const oldManual=new legacy.ctx.HistogramTransformation;oldManual.H=preferred;oldManual.executeOn(oldUser.mainView);for(const w of legacy.windows.slice(1))w.mainView.deleteProperty('AstroProcessAtlas:HistogramTrial');const legacyKey=Object.keys(legacy.settings)[0],legacyState=decodeTrial(legacy.settings[legacyKey]);delete legacyState.ownershipVersion;legacy.settings[legacyKey]=encodeTrial(legacyState);legacy.cancelSave(true);vm.runInNewContext(script.replace(/^#.*$/gm,''),legacy.ctx);assert.equal(decodeTrial(legacy.settings[legacyKey]).ownershipVersion,2);for(const w of legacy.windows.slice(1)){assert.equal(w.mainView.propertyValue('AstroProcessAtlas:HistogramTrial'),config.id);w.mainView.invalidateProperties();assert.equal(w.mainView.propertyValue('AstroProcessAtlas:HistogramTrial'),config.id,'Permanent ownership survives subsequent history transitions');}legacy.cancelSave(false);vm.runInNewContext(script.replace(/^#.*$/gm,''),legacy.ctx);assert.ok(legacy.writes['evaluation.json']);
const absent=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),absent.ctx);absent.windows[1].mainView.deleteProperty('AstroProcessAtlas:HistogramTrial');vm.runInNewContext(script.replace(/^#.*$/gm,''),absent.ctx);assert.ok(absent.messages.at(-1).includes('ownership marker is missing'));assert.equal(Object.keys(absent.writes).length,0);
const invalidLegacy=runtime();vm.runInNewContext(script.replace(/^#.*$/gm,''),invalidLegacy.ctx);const badKey=Object.keys(invalidLegacy.settings)[0],badState=decodeTrial(invalidLegacy.settings[badKey]);delete badState.ownershipVersion;invalidLegacy.settings[badKey]=encodeTrial(badState);invalidLegacy.windows[1].mainView.deleteProperty('AstroProcessAtlas:HistogramTrial');new invalidLegacy.ctx.HistogramTransformation().executeOn(invalidLegacy.windows[1].mainView);invalidLegacy.windows[1].mainView.deleteProperty('AstroProcessAtlas:HistogramTrial');vm.runInNewContext(script.replace(/^#.*$/gm,''),invalidLegacy.ctx);assert.ok(invalidLegacy.messages.at(-1).includes('were edited'));assert.equal(invalidLegacy.windows[1].mainView.hasProperty('AstroProcessAtlas:HistogramTrial'),false,'Failed validation must not reattach ownership');
console.log('Passed: permanent view metadata, automatic validated legacy recovery and refusal to relabel altered/current trials.');
const nativeRuntime={};vm.runInNewContext(api.atlasHistogramRuntimeSource(),nativeRuntime);assert.equal(typeof nativeRuntime.atlasHistogramRuntimeAPI.predict,'function');assert.equal(nativeRuntime.atlasHistogramRuntimeAPI.train,undefined);assert.ok(script.includes('function atlasHistogramLearning()'),'Native trials refresh the model from the shared library');assert.deepEqual(JSON.parse(JSON.stringify(nativeRuntime.atlasHistogramRuntimeAPI.predict(model,prior.before,originalH))),JSON.parse(JSON.stringify(learner.predict(model,prior.before,originalH))));assert.deepEqual(JSON.parse(JSON.stringify(nativeRuntime.atlasHistogramRuntimeAPI.feedback(review))),JSON.parse(JSON.stringify(learner.feedback(review))));new vm.Script('"use strict";\n'+script.replace(/^#.*$/gm,''));
console.log('Passed: flat inference-only native runtime matches browser prediction/evaluation and compiles in strict mode.');

// Native helper declarations must not retain generic named function expressions.
const declarationSource=api.atlasHistogramRuntimeSource();
for(const name of ['hash','matrix','stats','features','predict','feedback','readMatrix']){
 assert.ok(declarationSource.includes('function atlasHistogram_'+name+'('));
 assert.ok(!declarationSource.includes('=function '+name+'('));
}
// Exercise the actual downloaded configuration as well as the small gray fixture.
const rgbBefore=stats([0.01,0.03,0.08],true);
assert.deepEqual(JSON.parse(JSON.stringify(nativeRuntime.atlasHistogramRuntimeAPI.stats(rgbBefore))),JSON.parse(JSON.stringify(learner.stats(rgbBefore))));
assert.throws(()=>nativeRuntime.atlasHistogramRuntimeAPI.stats({...rgbBefore,channels:[]}),/raw image statistics/);
console.log('Passed: unique top-level native helper declarations and RGB statistics validation.');

// PJSR preprocessing rejects mixed line endings even when ordinary JS parsing succeeds.
assert.ok(!script.includes('\r'),'Complete native trial must use uniform LF');
assert.ok(!api.atlasHistogramRuntimeSource().includes('\r'),'Standalone native helpers must use uniform LF');
for(const eol of ['\n','\r\n']){
 const variant={Console:{writeln(){}}};
 vm.runInNewContext(source.replace(/\r\n?/g,'\n').replace(/\n/g,eol),variant);
 const generated=variant.buildAtlasHistogramExperiment(config);
 assert.ok(!generated.includes('\r'),'Normalize serialized functions from '+JSON.stringify(eol));
 new vm.Script(generated.replace(/^#.*$/gm,''));
 assert.deepEqual(JSON.parse(/^var atlasHistogramConfig=(.*);$/m.exec(generated)[1]),JSON.parse(JSON.stringify(config)));
}
console.log('Passed: LF-only exports from both LF and CRLF source files; trial configuration preserved.');

// Regional signatures distinguish spatial distributions without extra pixel reads.
function spatialImage(blocked){let calls=0;return {width:64,height:64,isColor:false,get calls(){return calls;},sample(x,y){calls++;return blocked?(x<32?0.1:0.7):((x+y)%2?0.1:0.7);}};}
const imageA=spatialImage(false),imageB=spatialImage(true),localA=api.captureAtlasImageStatistics(imageA),localB=api.captureAtlasImageStatistics(imageB);
assert.equal(imageA.calls,4096);assert.equal(imageB.calls,4096);
assert.equal(localA.channels[0].regions.length,16);
assert.deepEqual(learner.features(localA),learner.features(localB),'Global distributions are identical');
assert.notDeepEqual(learner.features(localA,true),learner.features(localB,true));
const rotated=api.captureAtlasImageStatistics({width:64,height:64,isColor:false,sample(x,y){return y<32?0.1:0.7;}});
assert.deepEqual(learner.features(localB,true),learner.features(rotated,true),'Regional distribution signatures ignore tile positions');
const regionalLibrary=learner.merge(learner.empty(),[{...example(originalH,localA),after:localA},{...example(preferred,localB),after:localB}],[]),regionalModel=learner.train(regionalLibrary);
assert.ok(regionalModel.groups.graySpatial);assert.ok(regionalModel.groups.gray);
const regionPrediction=learner.predict(regionalModel,localB,originalH);
assert.ok(regionPrediction.reason.includes('4x4'));assert.ok(Math.abs(regionPrediction.H[3][1]-preferred[3][1])<Math.abs(regionPrediction.H[3][1]-originalH[3][1]));
assert.ok(!learner.predict(regionalModel,prior.before,originalH).reason.includes('4x4'),'Old captures fall back to global features');
const broken=JSON.parse(JSON.stringify(localA));broken.channels[0].regions[0].samples++;assert.throws(()=>learner.stats(broken),/sample counts/);
console.log('Passed: 4x4 regional signatures, rotation invariance, identical global distributions distinguished, old captures supported and no extra samples.');

function storeRuntime(){const data={},settings={};let failMove=false;function File(){this.createForWriting=p=>this.path=p;this.write=t=>data[this.path]=t;this.close=()=>{};}File.exists=p=>Object.hasOwn(data,p);File.readTextFile=p=>{if(!File.exists(p))throw Error('Missing file');return data[p];};File.remove=p=>delete data[p];File.move=(from,to)=>{if(failMove&&from.includes('.tmp_')){failMove=false;throw Error('Simulated replace failure');}if(!File.exists(from)||File.exists(to))throw Error('Invalid move');data[to]=data[from];delete data[from];};const ctx={File,Settings:{read:k=>settings[k]||null,write:(k,t,v)=>settings[k]=v,remove:k=>delete settings[k]},DataType_String:13,ByteArray:{stringToUTF8:x=>x}};vm.runInNewContext(api.atlasHistogramStore.toString(),ctx);const store=ctx.atlasHistogramStore(learner);settings[store.setting]='D:/training';return {store,data,settings,ctx,fail:()=>failMove=true};}
const shared=storeRuntime(),libraryPath='D:/training/AstroProcessAtlas_histogram_library.json';
shared.store.save(library);assert.equal(shared.store.read().examples.length,1);
const other=storeRuntime();Object.assign(other.data,shared.data);other.store.save(learned);assert.equal(other.store.read().evaluations.length,1);
Object.assign(shared.data,other.data);shared.store.save(library);assert.equal(shared.store.read().evaluations.length,1,'Stale report cannot erase newer evaluations');
const intact=shared.data[libraryPath];shared.fail();assert.throws(()=>shared.store.save(library),/replace failure/);assert.equal(shared.data[libraryPath],intact);assert.ok(!Object.keys(shared.data).some(p=>p.includes('.tmp_')));
shared.data[libraryPath]='corrupt';assert.throws(()=>shared.store.save(library));assert.equal(shared.data[libraryPath],'corrupt','Never replace a corrupt library silently');
console.log('Passed: shared folder merge, deduplication, stale snapshot preservation, atomic replacement rollback and corrupt-file refusal.');

// New trials load the latest shared data and save the preference without another transfer dialog.
const connected=runtime(),disk=storeRuntime();connected.ctx.File=disk.ctx.File;
connected.settings[disk.store.setting]='D:/training';disk.data[libraryPath]=JSON.stringify(learned);
const connectedConfig={...config,library};const connectedScript=api.buildAtlasHistogramExperiment(connectedConfig).replace(/^#.*$/gm,'');
vm.runInNewContext(connectedScript,connected.ctx);
const connectedSuggested=connected.windows.find(w=>w.mainView.id.includes('_Suggested_'));
assert.ok(connectedSuggested.mainView.history[0].toSource().includes('HistogramTransformation'));
const selectedUser=connected.windows.find(w=>w.mainView.id.includes('_User_'));new connected.ctx.HistogramTransformation().executeOn(selectedUser.mainView);
vm.runInNewContext(connectedScript,connected.ctx);
const updated=learner.validate(JSON.parse(disk.data[libraryPath]));assert.equal(updated.evaluations.length,2);
assert.equal(Object.keys(connected.settings).length,1,'Only the shared folder preference remains');
assert.ok(connected.messages.at(-1).includes('shared training folder'));
console.log('Passed: native trial refreshes the shared learner, saves evaluation automatically and retains the shared setting.');

const configured=storeRuntime();configured.ctx.atlasHistogramLearning=()=>learner;configured.ctx.GetDirectoryDialog=function(){this.directory='D:/new-training';this.execute=()=>true;};vm.runInNewContext(api.chooseAtlasLearningFolder.toString(),configured.ctx);assert.equal(configured.ctx.chooseAtlasLearningFolder(),true);assert.equal(configured.store.folder(),'D:/new-training');assert.ok(configured.data['D:/new-training/AstroProcessAtlas_histogram_library.json']);
configured.data['D:/broken-training/AstroProcessAtlas_histogram_library.json']='invalid';configured.ctx.GetDirectoryDialog=function(){this.directory='D:/broken-training';this.execute=()=>true;};assert.throws(()=>configured.ctx.chooseAtlasLearningFolder());assert.equal(configured.store.folder(),'D:/new-training','Restore the prior folder after invalid library selection');
const recover=storeRuntime();recover.data[libraryPath+'.bak']=JSON.stringify(learned);assert.equal(recover.store.read().evaluations.length,1);recover.store.save(library);assert.equal(recover.store.read().evaluations.length,1);
console.log('Passed: remembered folder selection, empty-library initialization, invalid-folder rollback and backup recovery.');

const types=api.atlasAcquisitionTools();
function originSource(filters){return 'var P=new ImageIntegration;\nP.images = [\n'+filters.map((f,i)=>'[true,"D:/frames/FILTER-'+f+'_mono/Target_ATR585M_LIGHT_Angle0_'+f+'_2026-10-10_c_r.xisf","",""],').join('\n')+'\n[false,"D:/frames/FILTER-OIII/Other.xisf","",""]\n];';}
const haIdentity=types.infer([],[originSource(['Ha','Ha'])],false,'Renamed01');assert.equal(haIdentity.filters[0],'Ha');assert.equal(haIdentity.frames,2);assert.equal(haIdentity.matchedFrames,2);assert.equal(haIdentity.confidence,'consensus');assert.equal(haIdentity.cameras[0],'ATR585M');assert.equal(types.key(haIdentity),'mono:Ha');
const oIdentity=types.infer([{kind:'filter',value:"'OIII'"},{kind:'camera',value:'ATR585M'}],[],false,'Ha');assert.equal(types.key(oIdentity),'mono:OIII');assert.equal(oIdentity.source,'metadata');
assert.equal(types.infer([],[originSource(['Ha','OIII'])],false,'Ha').confidence,'conflict');
assert.equal(types.infer([{kind:'filter',value:'OIII'}],[originSource(['Ha'])],false,'Anything').confidence,'conflict');
assert.equal(types.key(types.infer([],[],false,'Ha')),'','Name hints must not constrain training');
assert.equal(types.infer([],[],true,'RGB').family,'unknown','RGB alone does not prove broadband');
assert.equal(types.infer([],['var P=new ImageIntegration;\nP.images=[\n[true,"D:/target_c_r.xisf","",""]\n];'],false,'Image').filters.length,0,'Registered suffix is not a red filter');
const partial=types.infer([],[originSource(['Ha','missing'])],false,'Image');assert.equal(partial.confidence,'partial');assert.equal(types.key(partial),'');
const metadataWindow={keywords:[{name:'FILTER',value:"'Ha'"},{name:'INSTRUME',value:"'ATR585M'"}],mainView:{id:'Renamed',image:{isColor:false},historyIndex:0,hasProperty:()=>false}};assert.equal(types.key(types.fromWindow(metadataWindow)),'mono:Ha');
const xisfWindow={keywords:[],mainView:{id:'Renamed',image:{isColor:false},historyIndex:0,hasProperty:k=>k==='Instrument:Filter:Name',propertyValue:()=> 'SII'}};assert.equal(types.key(types.fromWindow(xisfWindow)),'mono:SII');
const composition={history:['R','G','B'].map(id=>({id,isColor:false,acquisitionEvidence:[{kind:'filter',value:id}],steps:[]})).concat([{id:'Result',isColor:true,acquisitionEvidence:[{kind:'filter',value:'Ha'}],steps:[{title:'ChannelCombination',source:'combine',origin:true}]}]),sources:{combine:'var P=new ChannelCombination;'},workspace:{graph:{nodes:[...['R','G','B'].map(id=>({id,image:id,header:true})),{id:'result',image:'Result',header:true},{id:'combine',image:'Result',label:'ChannelCombination'}],edges:['R','G','B'].map(id=>({from:id,to:'combine',kind:'input',provenance:'parameter'}))}}};
assert.equal(types.key(types.report(composition,(m,k)=>m.sources[k]).Result),'rgb:B+G+R','Resolve combination rather than inherited FILTER');
const possible=JSON.parse(JSON.stringify(composition));possible.workspace.graph.edges.forEach(e=>e.kind='possible');assert.equal(types.key(types.report(possible,(m,k)=>m.sources[k]).Result),'');
const incomplete=JSON.parse(JSON.stringify(composition));incomplete.history[1].acquisitionEvidence=[];assert.equal(types.key(types.report(incomplete,(m,k)=>m.sources[k]).Result),'','Do not infer a complete composition from a subset of inputs');
console.log('Passed: typed Origin consensus, metadata/XISF, renamed inputs, conflicts/partial hints, RGB uncertainty and conservative graph composition.');
const typedLibrary=learner.merge(learner.empty(),[{...prior,id:'typed-ha',acquisition:haIdentity},{...example(preferred),id:'typed-oiii',acquisition:oIdentity}],[]),typedModel=learner.train(typedLibrary);
assert.ok(Math.abs(learner.predict(typedModel,prior.before,originalH,oIdentity).H[3][1]-preferred[3][1])<1e-12);
const onlyHa=learner.train(learner.merge(learner.empty(),[{...prior,acquisition:haIdentity}],[]));assert.equal(learner.predict(onlyHa,prior.before,originalH,oIdentity).learned,false,'Never use another known filter as an OIII example');
const legacyFallback=learner.predict(model,prior.before,originalH,oIdentity);assert.equal(legacyFallback.learned,true);assert.ok(legacyFallback.reason.includes('legacy fallback'));
const typedReview={...review,id:'typed-review',acquisition:oIdentity};assert.equal(learner.merge(library,[],[typedReview]).examples.at(-1).acquisition.filters[0],'OIII');assert.equal(learner.feedback(typedReview).acquisition.source,'metadata');
const actualInput=runtime();actualInput.input.keywords=[{name:'FILTER',value:"'OIII'"}];const typedScript=api.buildAtlasHistogramExperiment({...config,model:typedModel,library:typedLibrary}).replace(/^#.*$/gm,'');vm.runInNewContext(typedScript,actualInput.ctx);const pendingInput=decodeTrial(Object.values(actualInput.settings)[0]);assert.equal(pendingInput.acquisition.filters[0],'OIII','Actual selected metadata must beat template/name');assert.ok(Math.abs(pendingInput.suggestedH[3][1]-preferred[3][1])<1e-12);
new actualInput.ctx.HistogramTransformation().executeOn(actualInput.windows.find(w=>w.mainView.id.includes('_User_')).mainView);vm.runInNewContext(typedScript,actualInput.ctx);assert.equal(JSON.parse(actualInput.writes['evaluation.json']).acquisition.filters[0],'OIII');
console.log('Passed: filter-aware model selection, legacy fallback, mismatch exclusion and actual-input identity in native trial feedback.');

const cameraOther=types.validate({...haIdentity,cameras:['QHY600M']});const cameraLibrary=learner.merge(learner.empty(),[{...prior,id:'camera-same',acquisition:haIdentity},{...example(preferred),id:'camera-other',acquisition:cameraOther}],[]),cameraModel=learner.train(cameraLibrary);assert.ok(learner.predict(cameraModel,prior.before,originalH,haIdentity).H[3][1]>learner.predict(cameraModel,prior.before,originalH).H[3][1],'Camera is a small preference, not a hard gate');
assert.equal(types.key(types.infer([{kind:'filter',value:'Custom dual-band'}],[originSource(['Ha'])],false,'Anything')),'');
const beforeCombination=types.report(composition,(m,k)=>m.sources[k],{id:'Result',before:0}).Result;assert.notEqual(types.key(beforeCombination),'rgb:B+G+R','No composition from a future combination');
const cameraReview=learner.feedback({...review,id:'camera-feedback',acquisition:haIdentity});const combinedOldNew=learner.merge(learned,[],[cameraReview]);assert.equal(combinedOldNew.evaluations.length,2);assert.equal(learner.validate(combinedOldNew).evaluations[1].acquisition.cameras[0],'ATR585M');
console.log('Passed: conservative unknown filters, stage-limited combination evidence, camera preference and old/new evaluation interoperability.');

const overrideInput=runtime(),overrideBoxes=[];overrideInput.input.keywords=[{name:'FILTER',value:"'Ha'"}];const OriginalCombo=overrideInput.ctx.ComboBox,OriginalDialog=overrideInput.ctx.Dialog;overrideInput.ctx.ComboBox=function(){OriginalCombo.call(this);overrideBoxes.push(this);};overrideInput.ctx.Dialog=function(){OriginalDialog.call(this);const execute=this.execute;this.execute=()=>{const ok=execute();if(this.windowTitle.includes('trial input'))overrideBoxes[0].currentItem=4;return ok;};};vm.runInNewContext(typedScript,overrideInput.ctx);const corrected=decodeTrial(Object.values(overrideInput.settings)[0]);assert.equal(corrected.acquisition.source,'user');assert.equal(corrected.acquisition.confidence,'confirmed');assert.equal(corrected.acquisition.filters[0],'OIII');
console.log('Passed: explicit user filter correction is recorded separately from detected metadata.');

assert.equal(types.infer([{kind:'camera',value:'Unknown'}],[],false,'Image').cameras.length,0,'Unknown placeholders are not camera identities');

// Purpose inference uses recorded topology and stage context, not mono/RGB alone.
const purposeTools=api.atlasHistogramPurposeTools();
function purposeFixture(beforeValues,afterValues,color=false){
 const step={anchor:'source_ht',tool:'HistogramTransformation',source:'H',mask:{status:'unrecorded'},statistics:{before:stats(beforeValues,color),after:stats(afterValues,color)}};
 return {format:'AstroProcessAtlasReport',schemaVersion:1,history:[{id:'Source',isColor:color,steps:[step]}],sources:{H:'var P=new HistogramTransformation;P.H='+JSON.stringify(identity())+';'},workspace:{graph:{nodes:[{id:'source',image:'Source',header:true},{id:'source_ht',image:'Source'},{id:'target',image:'Target',label:'CurvesTransformation'}],edges:[]}}};
}
const resolver=(m,k)=>m.sources[k];
const stretchPurpose=purposeTools.infer(purposeFixture([0.001,0.003,0.01],[0.1,0.2,0.3]),'Source',0,resolver);
assert.equal(stretchPurpose.purpose,'initial-stretch');
const toneFixture=purposeFixture([0.1,0.2,0.3],[0.12,0.22,0.32]);
assert.equal(purposeTools.infer(toneFixture,'Source',0,resolver).purpose,'tone-adjustment');
toneFixture.workspace.graph.edges.push({from:'source',to:'target',kind:'mask',provenance:'recorded'});
const maskPurpose=purposeTools.infer(toneFixture,'Source',0,resolver);assert.equal(maskPurpose.purpose,'mask-preparation');assert.equal(maskPurpose.role,'mask');
const stretchMask=purposeFixture([0.001,0.003,0.01],[0.1,0.2,0.3]);stretchMask.workspace.graph.edges.push({from:'source',to:'target',kind:'mask'});
assert.equal(purposeTools.infer(stretchMask,'Source',0,resolver).purpose,'unknown','Do not label every earlier stretch as mask preparation');
toneFixture.workspace.graph.edges[0].provenance='possible';assert.equal(purposeTools.infer(toneFixture,'Source',0,resolver).purpose,'tone-adjustment');
toneFixture.workspace.graph.edges[0].provenance='manual';assert.equal(purposeTools.infer(toneFixture,'Source',0,resolver).purpose,'mask-preparation','User-provided connections count as evidence');
const earlierMask=purposeFixture([0.1,0.2,0.3],[0.12,0.22,0.32]);earlierMask.history[0].steps.unshift({anchor:'earlier',tool:'Invert'});earlierMask.workspace.graph.nodes.push({id:'earlier',image:'Source'});earlierMask.workspace.graph.edges.push({from:'earlier',to:'target',kind:'mask'});assert.equal(purposeTools.infer(earlierMask,'Source',1,resolver).purpose,'tone-adjustment','An earlier mask checkpoint cannot identify later transforms');
const maskedTone=purposeFixture([0.1,0.2,0.3],[0.12,0.22,0.32]);maskedTone.history[0].steps[0].mask={status:'recorded',name:'Mask'};assert.equal(purposeTools.infer(maskedTone,'Source',0,resolver).scope,'masked');assert.equal(purposeTools.infer(maskedTone,'Source',0,resolver).role,'image','Using a mask is distinct from constructing one');
const balance=purposeFixture([0.1,0.2,0.3],[0.12,0.22,0.32],true),balanceH=identity();balanceH[0][1]=0.4;balance.sources.H='P.H='+JSON.stringify(balanceH)+';';assert.equal(purposeTools.infer(balance,'Source',0,resolver).purpose,'color-balance');
const convergence=purposeFixture([0.1,0.2,0.3],[0.2,0.3,0.4]);convergence.workspace.graph.nodes[2].label='ChannelCombination';convergence.workspace.graph.nodes.push({id:'sibling',image:'Sibling',header:true});convergence.history.push({id:'Sibling',isColor:false,steps:[{tool:'HistogramTransformation',anchor:'sibling_ht',mask:{status:'unrecorded'},statistics:{before:stats([0.3,0.4,0.5]),after:stats([0.2,0.31,0.4])}}]});convergence.workspace.graph.edges.push({from:'source',to:'target',kind:'input'},{from:'sibling',to:'target',kind:'input'});assert.equal(purposeTools.infer(convergence,'Source',0,resolver).purpose,'channel-match');
const purposeExamples=[{...prior,id:'purpose-mask',purpose:maskPurpose},{...prior,id:'purpose-stretch',purpose:stretchPurpose,H:preferred}];
const purposeModel=learner.train(learner.merge(learner.empty(),purposeExamples,[]));
assert.equal(learner.predict(purposeModel,prior.before,identity(),null,stretchPurpose).neighbours[0].id,'purpose-stretch');
assert.equal(learner.predict(purposeModel,prior.before,identity(),null,{...stretchPurpose,purpose:'unknown'}).learned,false);
assert.equal(learner.predict(learner.train(library),prior.before,identity(),null,stretchPurpose).learned,false,'Known purpose never falls back to unclassified legacy examples');
const purposeReview=learner.feedback({...review,id:'purpose-review',purpose:stretchPurpose});assert.equal(learner.merge(learner.empty(),[],[purposeReview]).examples[0].purpose.purpose,'initial-stretch');
const purposeHistory=learner.history(convergence,resolver);assert.equal(purposeHistory.examples[0].purpose.purpose,'channel-match');
const nativePurpose=runtime();const purposeScript=api.buildAtlasHistogramExperiment({...config,purpose:stretchPurpose});vm.runInNewContext(purposeScript.replace(/^#.*$/gm,''),nativePurpose.ctx);const savedPurpose=decodeTrial(Object.values(nativePurpose.settings)[0]);assert.equal(savedPurpose.purpose.purpose,'initial-stretch');
console.log('Passed: purpose/context inference, mask ambiguity, historical checkpoints, manual vs possible links, channel convergence, purpose-separated prediction and native trial persistence.');

function maskedTrial(id='masked_trial',invert=false){
 const rt=runtime(),mask=new rt.ctx.ImageWindow(3,1,1,32,true,false,'Final_SHO_gm');mask.mainView.image.values=[0,0.5,1];
 const code=api.buildAtlasHistogramExperiment({...config,id,mask:{name:'Final_SHO_gm',inverted:invert},purpose:{...stretchPurpose,scope:'masked'}}).replace(/^#.*$/gm,'');
 const Checkbox=rt.ctx.CheckBox;rt.ctx.CheckBox=function(){Checkbox.call(this);}; // Explicitly accept the recorded inversion below.
 const Dialog=rt.ctx.Dialog;rt.ctx.Dialog=function(){Dialog.call(this);};
 vm.runInNewContext(code,rt.ctx);return {...rt,code,mask};
}
const maskRun=maskedTrial();let maskPending=decodeTrial(Object.values(maskRun.settings)[0]);assert.ok(maskPending.mask);assert.equal(maskPending.maskContext.statistics.channels[0].median,0.5);
const maskCopies=maskPending.ids.map(id=>maskRun.windows.find(w=>w.mainView.id===id));assert.ok(maskCopies.every(w=>w.mask.mainView.id===maskPending.mask.id));assert.ok(maskCopies.every(w=>w.maskInverted===false),'Recorded inversion is suggested explicitly');
assert.equal(maskCopies[0].mainView.image.values[0],maskRun.input.mainView.image.values[0],'Black mask protects the pixel');
const privateMask=maskCopies[0].mask;maskRun.mask.mainView.image.values=[1,1,1];assert.deepEqual(privateMask.mainView.image.values,[0,0.5,1],'Original mask edits cannot alter the private snapshot');
maskRun.pending.at(-1).executeOn(maskCopies[2].mainView);vm.runInNewContext(maskRun.code,maskRun.ctx);assert.ok(maskRun.writes['evaluation.json']);const maskedFeedback=JSON.parse(maskRun.writes['evaluation.json']);assert.equal(maskedFeedback.maskContext.inverted,false);assert.equal(maskedFeedback.purpose.scope,'masked');assert.ok(privateMask.isNull,'Release the private mask after successful evaluation');assert.ok(maskCopies.every(w=>w.mask.isNull));assert.equal(maskRun.mask.isNull,false,'Never close the original mask');
const changedMask=maskedTrial('changed_mask');const changedPending=decodeTrial(Object.values(changedMask.settings)[0]);changedMask.windows.find(w=>w.mainView.id===changedPending.mask.id).mainView.image.values=[1,1,1];vm.runInNewContext(changedMask.code,changedMask.ctx);assert.match(changedMask.messages.at(-1),/private trial mask is missing or changed/);assert.equal(Object.keys(changedMask.writes).length,0);
const invertRun=maskedTrial('inverted_mask',true),invertPending=decodeTrial(Object.values(invertRun.settings)[0]);assert.equal(invertPending.mask.inverted,true);const invertCopies=invertPending.ids.map(id=>invertRun.windows.find(w=>w.mainView.id===id));assert.equal(invertCopies[0].mainView.image.values[2],invertRun.input.mainView.image.values[2],'Color invert protects originally white pixels');invertCopies[2].maskInverted=false;vm.runInNewContext(invertRun.code,invertRun.ctx);assert.match(invertRun.messages.at(-1),/same trial mask and Color invert/);
const maskExample=learner.merge(learner.empty(),[],[maskedFeedback]).examples[0];assert.equal(maskExample.maskContext.statistics.channels[0].median,0.5);const maskModel=learner.train(learner.merge(learner.empty(),[maskExample,prior],[]));assert.equal(learner.predict(maskModel,prior.before,identity(),null,null,maskedFeedback.maskContext).neighbours[0].id,maskExample.id);assert.ok(learner.predict(maskModel,prior.before,identity()).neighbours.every(n=>n.id!==maskExample.id),'Unmasked trials exclude masked examples');
console.log('Passed: masked trials, frozen shared mask, value inversion, history validation, snapshot tamper rejection, feedback mask context and cleanup.');

const noMask=runtime();const noMaskCode=api.buildAtlasHistogramExperiment({...config,id:'missing_mask',mask:{name:'Unavailable',inverted:null}}).replace(/^#.*$/gm,'');vm.runInNewContext(noMaskCode,noMask.ctx);assert.match(noMask.messages.at(-1),/Open a matching mask/);assert.equal(noMask.windows.filter(w=>!w.isNull).length,1);assert.equal(Object.keys(noMask.settings).length,0);
const cancelMask=runtime();const cancelledMaskWindow=new cancelMask.ctx.ImageWindow(3,1,1,32,true,false,'Mask');const MaskDialog=cancelMask.ctx.Dialog;cancelMask.ctx.Dialog=function(){MaskDialog.call(this);const originalExecute=this.execute;this.execute=()=>this.windowTitle.includes('trial mask')?false:originalExecute();};vm.runInNewContext(noMaskCode,cancelMask.ctx);assert.equal(Object.keys(cancelMask.settings).length,0);assert.equal(cancelMask.windows.filter(w=>!w.isNull).length,2,'Cancel before copies leaves only user-owned images');
assert.throws(()=>learner.maskContext({version:1,inverted:false,statistics:stats([0.1,0.2])},prior.before),/incompatible/);
const mismatchHistory=maskedTrial('mismatch_history'),mismatchState=decodeTrial(Object.values(mismatchHistory.settings)[0]),mismatchUser=mismatchHistory.windows.find(w=>w.mainView.id===mismatchState.ids[2]);mismatchHistory.pending.at(-1).executeOn(mismatchUser.mainView);mismatchUser.mainView.history.at(-1).mask.inverted=true;vm.runInNewContext(mismatchHistory.code,mismatchHistory.ctx);assert.match(mismatchHistory.messages.at(-1),/User Histogram must use the same trial mask/);
const discardMask=maskedTrial('discard_mask'),discardState=decodeTrial(Object.values(discardMask.settings)[0]);const buttons=[];discardMask.ctx.PushButton=function(){buttons.push(this);};const DiscardDialog=discardMask.ctx.Dialog;discardMask.ctx.Dialog=function(){DiscardDialog.call(this);this.execute=()=>{buttons.find(b=>b.text==='Discard trial session').onClick();return false;};};vm.runInNewContext(discardMask.code,discardMask.ctx);assert.equal(Object.keys(discardMask.settings).length,0);assert.ok(discardMask.windows.find(w=>w.mainView.id===discardState.mask.id).isNull);assert.equal(discardMask.mask.isNull,false);
console.log('Passed: missing-mask refusal, mask-dialog cancellation, geometry validation, historical inversion mismatch and explicit discard cleanup.');
