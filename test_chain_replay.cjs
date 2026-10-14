const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/AstroProcessAtlas.js','utf8').replace(/^#.*$/gm,'').replace(/generateHistoryReport\(\);\s*$/,'');
const api={Console:{writeln(){}}};vm.runInNewContext(source,api);
function process(tool,params='',extra={}){return {title:tool,number:1,tool,action:'process',reason:'',source:'var P = new '+tool+';'+params,variable:'P',inputs:[],mask:null,...extra};}
function pixel(expression){return process('PixelMath','P.expression='+JSON.stringify(expression)+';P.useSingleExpression=true;P.generateOutput=true;P.createNewImage=false;P.clearImageCacheAndExit=false;P.symbols="";',{action:'pixelmath'});}
const ha={id:'Ha',steps:[pixel('$T*2'),pixel('$T*3')]},sii={id:'Sii',steps:[pixel('$T*2')]},oiii={id:'Oiii',steps:[pixel('$T*2')]};
const mask={id:'Ha_clone',clone:{source:'Ha',stage:1},steps:[pixel('$T*2'),process('Convolution','P.sigma=0.5;')]};
const palette=process('PixelMath','P.expression="Ha_final";P.expression1="SII_final";P.expression2="OIII_final";P.useSingleExpression=false;P.generateOutput=true;P.createNewImage=false;P.clearImageCacheAndExit=false;',{action:'palette',inputs:['Ha_final','SII_final','OIII_final']});
const masked=process('CurvesTransformation','P.K=[[0,0],[1,1]];',{mask:{name:'Ha_clone',inverted:false}});
const final={id:'Final_SHO',steps:[palette,masked]};
const data=[ha,sii,oiii,mask,final];const bindings=api.suggestChainBindings(data);for(const key in bindings)bindings[key].preparation=1;
const plan=api.buildWorkspaceChainPlan(data,4,bindings);assert.deepEqual(Array.from(plan.errors),[]);assert.deepEqual(Array.from(plan.roots.map(root=>root.id)),['Ha','Sii','Oiii']);assert.ok(plan.snapshots['$Ha@1']);assert.ok(plan.tasks.find(task=>task.id==='Ha_clone'&&task.kind==='clone'));
const cycle={id:'Loop',steps:[pixel('Loop')]};cycle.steps[0].inputs=['Loop'];const cyclic=api.buildWorkspaceChainPlan([cycle],0,{'Loop#0#input#Loop':{source:'Loop',stage:1}});assert.match(cyclic.errors.join('\n'),/cycle/);
const inputAlias={id:'Sii',steps:[{...pixel('image'),inputs:['image']}]};assert.equal(api.suggestChainBindings([inputAlias])['Sii#0#input#image'].stage,0);
const body=api.buildWorkspaceChainScript(data,plan);new vm.Script(body.replace(/^#.*$/gm,''));
function runtime(code,missing=false,failMask=false,cancelAfterHa=false,renamedInputs=false,freshWrappers=false,options={}){
 const windows=[],messages=[],controls=[],logs=[];
 function Window(w,h,n,bits,real,color,id){this.isNull=false;this.rgbWorkingSpace={gamma:2.2};const properties={};const window=this;this.mainView={id,historyIndex:0,stf:[],setPropertyValue(k,v){properties[k]=v;},propertyValue(k){return properties[k];},beginProcess(){},endProcess(){this.historyIndex++;},image:{width:w,height:h,numberOfChannels:n,bitsPerSample:bits,isReal:real,isColor:color,values:new Array(n).fill(0),assign(img){Object.assign(this,{width:img.width,height:img.height,numberOfChannels:img.numberOfChannels,isColor:img.isColor,values:img.values.slice()});},fill(v){this.values.fill(v);}}};this.mainView.window=this;this.show=()=>{};this.forceClose=()=>{this.isNull=true;};this.removeMask=()=>{this.mask=null;this.maskEnabled=false;};this.setMask=(m,inverted)=>{this.mask=m;this.maskInverted=inverted;};windows.push(this);}
 function find(id){return windows.find(w=>!w.isNull&&w.mainView.id===id);}
 Object.defineProperty(Window,'windows',{get:()=>windows.filter(w=>!w.isNull).map(w=>freshWrappers?new Proxy(w,{}):w)});
 const roots=[new Window(1,1,1,32,true,false,'Ha'),new Window(1,1,1,32,true,false,'Sii'),new Window(1,1,1,32,true,false,'Oiii')];roots.forEach((root,i)=>root.mainView.image.values=[(i+1)/10]);
 if(renamedInputs)roots.forEach((root,i)=>root.mainView.id=["raw_hydrogen","raw_sulfur","raw_oxygen"][i]);
 const snapshots=roots.map(root=>root.mainView.image.values.slice());
 function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
 const ctx={verifyReplayResources(resources,count){for(let i=0;i<count;i++){assert.ok(Object.hasOwn(resources.masks,i),"Missing explicit mask resource "+i);assert.ok(Object.hasOwn(resources.mappings,i),"Missing explicit PixelMath mapping "+i);}},ImageWindow:Window,View:{viewById:id=>find(id)?find(id).mainView:{isNull:true}},Parameters:{isViewTarget:false,set(){},has(){return false;}},UndoFlag_NoSwapFile:0,StdIcon_Information:0,StdIcon_Error:1,StdButton_Ok:0,Console:{writeln:text=>logs.push(text)},processEvents(){},
 Dialog:function(){this.adjustToContents=()=>{};this.ok=()=>{};this.cancel=()=>{};this.execute=()=>{if(this.windowTitle==='AstroProcessAtlas - Chain starting inputs'||options.single)controls.filter(c=>c.kind==='check').forEach(c=>c.checked=true);if(options.single)controls.filter(c=>c.kind==='combo'&&c.items.includes('Sii')).forEach(c=>c.currentItem=1);return true;};},Label:function(){this.setMinWidth=()=>{};},CheckBox:function(){this.kind='check';controls.push(this);},ComboBox:function(){this.kind='combo';this.items=[];this.addItem=x=>this.items.push(x);controls.push(this);},Edit:function(){},PushButton:function(){controls.push(this);},HorizontalSizer:Sizer,VerticalSizer:Sizer,MessageBox:function(text){this.execute=()=>messages.push(text);},
 PixelMath:function(){this.executeOn=view=>{const fields=this.useSingleExpression===false?['expression','expression1','expression2']:['expression'];const scope={target:view.image.values[0]};for(const window of windows)if(!window.isNull)scope[window.mainView.id]=window.mainView.image.values[0];const values=fields.map(key=>vm.runInNewContext(this[key].replace(/\$T/g,'target'),scope));if(this.createNewImage){const output=new Window(1,1,values.length,32,true,values.length===3,this.newImageId);output.mainView.image.values=values;}else view.image.values=values;if(cancelAfterHa&&view.id==="Ha_APA_replay"&&Math.abs(values[0]-0.6)<1e-12)controls.find(c=>c.text==="Stop after current step").onClick();return true;};},
 CurvesTransformation:function(){this.executeOn=view=>{if(failMask)throw Error("Simulated masked process failure");const w=view.window,weight=w.maskEnabled?w.mask.mainView.image.values[0]:1;view.image.values=view.image.values.map(v=>v*(1-weight)+2*v*weight);return true;};}
 };
 if(cancelAfterHa){ctx.Dialog=function(){this.show=()=>{};this.hide=()=>{};this.adjustToContents=()=>{};this.execute=()=>{controls.filter(c=>c.kind==='check').forEach(c=>c.checked=true);return true;};};ctx.TreeBox=function(){this.setHeaderText=()=>{};this.setMinSize=()=>{};};ctx.TreeBoxNode=function(){this.setText=()=>{};};}
 ctx.ProcessContainer=function(){this.children=[];this.add=child=>this.children.push(child);this.executeOn=view=>this.children.every(child=>child.executeOn(view));};
 ctx.GradientCorrection=function(){this.executeOn=view=>{view.image.values=view.image.values.map(value=>value*this.scale);return true;};};
 ctx.StarXTerminator=function(){this.executeOn=view=>{const star=new Window(1,1,1,32,true,false,view.id+'_stars');star.mainView.image.values=view.image.values.map(v=>v*0.3);view.image.values=view.image.values.map(v=>v*0.7);return true;};};
 if(!missing)ctx.Convolution=function(){this.executeOn=view=>{view.image.values=view.image.values.map(v=>v*this.sigma);return true;};};
 if(options.graxpert){const files=new Map();ctx.File={systemTempDirectory:'/temp',exists:path=>path==='/Apps/GraXpert tool.exe'||files.has(path),createDirectory(){},remove:path=>files.delete(path),removeDirectory(){}};Window.prototype.saveAs=function(path){const image=this.mainView.image;files.set(path,{...image,values:image.values.slice()});return true;};Window.open=path=>{const image=files.get(path),output=new Window(image.width,image.height,image.numberOfChannels,32,true,image.isColor,'GraXpert_import');output.mainView.image.values=image.values.slice();return [output];};ctx.ExternalProcess=function(){this.isStarting=false;this.isRunning=false;this.exitCode=0;this.start=(exe,args)=>{assert.equal(exe,'/Apps/GraXpert tool.exe');const image=files.get(args[1]);files.set(args[1].replace('.xisf','_GraXpert.xisf'),{...image,values:image.values.map(value=>value*0.75)});return true;};};options.files=files;}
 vm.runInNewContext(code.replace(/^#.*$/gm,'').replace(/(var resources=prepareReplayResources\([^;\n]*\);)/g,'$1 verifyReplayResources(resources,replaySteps.length);'),ctx);
 roots.forEach((root,i)=>assert.deepEqual(root.mainView.image.values,snapshots[i]));
 return {windows,messages,find};
}
const result=runtime(body);assert.match(result.messages.at(-1),/Chain complete/);assert.ok(result.find('Ha_clone_APA_replay'));assert.ok(Math.abs(result.find('Ha_clone_APA_replay').mainView.image.values[0]-0.2)<1e-12);
const rgb=result.find('Final_SHO_APA_replay').mainView.image.values;assert.ok(Math.abs(rgb[0]-0.72)<1e-12);assert.ok(Math.abs(rgb[1]-0.48)<1e-12);assert.ok(Math.abs(rgb[2]-0.72)<1e-12);assert.equal(result.find('APA_checkpoint_Ha_1'),undefined);assert.ok(result.windows.some(w=>w.mainView.id==='APA_checkpoint_Ha_1'&&w.isNull));
const stopped=runtime(body,true);assert.match(stopped.messages.at(-1),/Convolution/);assert.equal(stopped.windows.length,3);
const cp='var C = new ProcessContainer;var X = new PixelMath;X.expression="$T*2";X.symbols="";X.generateOutput=true;X.clearImageCacheAndExit=false;X.createNewImage=false;X.useSingleExpression=true;C.add(X);';
assert.equal(api.replayContainerSource(cp).variable,'C');assert.equal(api.replayContainerSource(cp+'alert("bad");'),null);assert.equal(api.replayContainerSource(cp.replace('$T*2','Other*2')),null);
assert.equal(api.replayContainerSource(cp.replace('C.add(X);','C.add(X); X.executeGlobal();')),null);
console.log('Passed: chain planning, alias confirmation, exact clone checkpoints, RGB channel composition, automatically rebuilt masks, unchanged inputs, whole-chain preflight, cycle rejection and safe ProcessContainer source validation.');

const starParent={id:'Ha',steps:[process('StarXTerminator','P.stars=true;')]};
const starOutput={id:'Ha_stars',stars:{source:'Ha',stage:1},steps:[]};
const recombined={id:'Combined',steps:[{...pixel('Ha+Ha_stars'),inputs:['Ha','Ha_stars'],createsImage:true,requiresTarget:false,source:pixel('Ha+Ha_stars').source.replace('P.createNewImage=false','P.createNewImage=true')}]};
const starData=[starParent,starOutput,recombined],starBindings=api.suggestChainBindings(starData),starPlan=api.buildWorkspaceChainPlan(starData,2,starBindings);
assert.deepEqual(Array.from(starPlan.errors),[]);const starRun=runtime(api.buildWorkspaceChainScript(starData,starPlan));assert.match(starRun.messages.at(-1),/Chain complete/);assert.ok(Math.abs(starRun.find('Combined_APA_replay').mainView.image.values[0]-0.1)<1e-12);
const loopSource={id:'A',steps:[pixel('$T*2'),{...masked,mask:{name:'A_clone',inverted:false}}]};
const loopMask={id:'A_clone',clone:{source:'A',stage:1},steps:[pixel('$T*0.5')]};
const feedback=[loopSource,loopMask],feedbackPlan=api.buildWorkspaceChainPlan(feedback,0,api.suggestChainBindings(feedback));
assert.deepEqual(Array.from(feedbackPlan.errors),[]);const feedbackRun=runtime(api.buildWorkspaceChainScript(feedback,feedbackPlan));assert.match(feedbackRun.messages.at(-1),/Chain complete/);assert.ok(Math.abs(feedbackRun.find('A_APA_replay').mainView.image.values[0]-0.22)<1e-12);
console.log('Passed: automatic stars side outputs, new-image PixelMath continuation and masks cloned from an earlier checkpoint of their own target branch.');

function element(tag){return {tag,style:{},attrs:{},children:[],value:'',checked:false,disabled:false,scrollTop:0,setAttribute(k,v){this.attrs[k]=v;},appendChild(child){this.children.push(child);},removeChild(child){this.children.splice(this.children.indexOf(child),1);},get firstChild(){return this.children[0];},click(){this.clicked=true;}};}
const dom={chain_target:element('select'),chain_bindings:element('div'),chain_plan:element('div'),chain_confirm:element('input'),chain_export:element('button')};dom.chain_target.value='4';
let download='';const web={...api,workspaceReplayData:data,document:{getElementById:id=>dom[id],createElement:element,createTextNode:text=>({textContent:text}),body:element('body')},Blob:function(parts){download=parts[0];},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:fn=>fn(),window:{}};
vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',web);
assert.equal(dom.chain_export.disabled,true);
for(let i=0;i<3;i++){const prep=dom.chain_bindings.children.flatMap(field=>field.children).find(node=>node.attrs&&node.attrs['aria-label']==='Input preparation'&&node.value==='0');prep.value='1';prep.onchange();}
dom.chain_confirm.checked=true;dom.chain_confirm.onchange();assert.equal(dom.chain_export.disabled,false);dom.chain_export.onclick();assert.match(download,/dependency chain replay/);new vm.Script(download.replace(/^#.*$/gm,''));
assert.ok(dom.chain_plan.children[0].textContent.includes('Starting inputs: Ha, Sii, Oiii'));
console.log('Passed: chain export UI blocks unconfirmed palette states, preserves edits and exports the reviewed checkpoint plan.');

const containerData=[{id:'Ha',steps:[{...process('ProcessContainer'),source:cp,variable:'C'}]}];
const containerPlan=api.buildWorkspaceChainPlan(containerData,0,{});
const containerRun=runtime(api.buildWorkspaceChainScript(containerData,containerPlan));
assert.match(containerRun.messages.at(-1),/Chain complete/);
assert.ok(Math.abs(containerRun.find('Ha_APA_replay').mainView.image.values[0]-0.2)<1e-12);
const blockedData=[{id:'Ha',steps:[{...pixel('$T'),reason:'Unrecorded settings'}]}];
assert.match(api.buildWorkspaceChainPlan(blockedData,0,{}).errors.join(),/Unrecorded settings/);
const unknownClone=[{id:'Ha',steps:[]},{id:'Ha_clone',clone:{source:'Ha',stage:null},steps:[]}];
assert.match(api.buildWorkspaceChainPlan(unknownClone,1,{}).errors.join(),/origin checkpoint/);
const ambiguous=[{id:'Sii',steps:[]},{id:'SII',steps:[]},{id:'RGB',steps:[{...pixel('sii'),inputs:['sii']}]}];
assert.equal(api.suggestChainBindings(ambiguous)['RGB#0#input#sii'].source,'');
console.log('Passed: exported ProcessContainer execution and blockers for unsupported settings, missing clone checkpoints and ambiguous channel names.');

const failedMask=runtime(body,false,true);
assert.match(failedMask.messages.at(-1),/Simulated masked process failure/);
assert.ok(failedMask.windows.filter(w=>w.mainView.id.startsWith('APA_checkpoint_')).every(w=>w.isNull));
assert.ok(failedMask.find('Final_SHO_APA_replay'));
assert.equal(body.includes('keepTemporary:true'),false);
console.log('Passed: checkpoint cleanup after last use and failure, palette temporary ownership released, partial result retained.');

const cancelledChain=runtime(body,false,false,true);
assert.match(cancelledChain.messages.at(-1),/Chain replay cancelled/);
assert.ok(cancelledChain.windows.some(w=>w.mainView.id==='APA_checkpoint_Ha_1'&&w.isNull));
assert.ok(cancelledChain.find('Ha_APA_replay'));
console.log('Passed: explicit stop releases pending checkpoints and retains completed branch images.');

const startingFields=dom.chain_bindings.children[0];
assert.ok(startingFields.children.some(row=>row.children&&row.children.some(child=>child.textContent==='Ha → Ha_APA_replay ')));
const startingHint=startingFields.children.find(row=>row.tag==='label').children.find(child=>child.tag==='input');
startingHint.value='raw_hydrogen';startingHint.oninput();assert.equal(dom.chain_export.disabled,true);
dom.chain_confirm.checked=true;dom.chain_confirm.onchange();dom.chain_export.onclick();assert.match(download,/raw_hydrogen/);
const renamedHa={id:'Hydrogen_processed',steps:[pixel('$T*2'),{...process('ImageIdentifier'),action:'identifier',identifier:'Ha'},pixel('$T*3')]};
const renamedData=[renamedHa,sii,oiii,{...mask,clone:{source:renamedHa.id,stage:1}},final];
const renamedBindings=api.suggestChainBindings(renamedData);for(const key in renamedBindings)renamedBindings[key].preparation=1;
assert.equal(renamedBindings['Final_SHO#0#input#Ha_final'].source,'Hydrogen_processed');
const renamedPlan=api.buildWorkspaceChainPlan(renamedData,4,renamedBindings);assert.deepEqual(Array.from(renamedPlan.errors),[]);
assert.equal(renamedPlan.replayIds.$Hydrogen_processed,'Ha_APA_replay');
renamedPlan.startingInputs={$Hydrogen_processed:'raw_hydrogen',$Sii:'raw_sulfur',$Oiii:'raw_oxygen'};
const renamedRun=runtime(api.buildWorkspaceChainScript(renamedData,renamedPlan),false,false,false,true);
assert.match(renamedRun.messages.at(-1),/Chain complete/);assert.ok(renamedRun.find('Ha_APA_replay'));
const renamedRGB=renamedRun.find('Final_SHO_APA_replay').mainView.image.values;
assert.ok(Math.abs(renamedRGB[0]-0.72)<1e-12);assert.ok(Math.abs(renamedRGB[1]-0.48)<1e-12);assert.ok(Math.abs(renamedRGB[2]-0.72)<1e-12);
console.log('Passed: all three starting inputs appear in HTML, editable native input hints, ImageIdentifier channel aliases and replay-copy bindings with different original names.');

const nativeWrappers=runtime(api.buildWorkspaceChainScript(renamedData,renamedPlan),false,false,false,true,true);
assert.match(nativeWrappers.messages.at(-1),/Chain complete/);
assert.ok(nativeWrappers.find('Final_SHO_APA_replay'));

assert.ok(Math.abs(nativeWrappers.find('Final_SHO_APA_replay').mainView.image.values[0]-0.72)<1e-12);
const wrappedStars=runtime(api.buildWorkspaceChainScript(starData,starPlan),false,false,false,false,true);
assert.match(wrappedStars.messages.at(-1),/Chain complete/);
assert.ok(Math.abs(wrappedStars.find('Combined_APA_replay').mainView.image.values[0]-0.1)<1e-12);
assert.match(failedMask.messages.at(-1),/Diagnostics:/);
assert.match(failedMask.messages.at(-1),/Active task:.*Final_SHO/);
assert.match(failedMask.messages.at(-1),/Tool: CurvesTransformation/);
assert.match(failedMask.messages.at(-1),/Mask Ha_clone.*checkpoint/);
assert.match(failedMask.messages.at(-1),/Error stack:/);
assert.match(failedMask.messages.at(-1),/Open images at completion:/);
assert.match(nativeWrappers.messages.at(-1),/raw_hydrogen/);
console.log('Passed: distinct native ImageWindow wrappers resolve by ID for targets, palette channels and generated stars; diagnostic report includes routing, active tool, formats and error stack.');

const gradient={id:'Ha',steps:[process('GradientCorrection','P.scale=2;')]};
const channelOnly={id:'Sii',steps:[pixel('$T*2')]};
const editData=[gradient,channelOnly,{id:'Oiii',steps:[pixel('$T*2')]},{id:'RGB',steps:[{...palette,inputs:['Ha','Sii','Oiii']}]}];
const editBindings=api.suggestChainBindings(editData);for(const key in editBindings)editBindings[key].preparation=1;
const inserted=api.editReplayWorkflow(editData,editBindings,{type:'copy',image:'Ha',index:0,to:'Sii',at:0});
assert.equal(inserted.data[1].steps[0].source,gradient.steps[0].source);assert.equal(inserted.data[1].steps[0].copiedFrom.image,'Ha');assert.equal(editData[1].steps.length,1);
assert.equal(inserted.bindings['RGB#0#input#Sii'].stage,2);
const appended=api.editReplayWorkflow(editData,editBindings,{type:'copy',image:'Ha',index:0,to:'Oiii',at:1});assert.equal(appended.bindings['RGB#0#input#Oiii'].stage,2);
const removed=api.editReplayWorkflow(inserted.data,inserted.bindings,{type:'remove',image:'Sii',index:1});assert.equal(removed.data[1].steps.length,1);assert.equal(removed.bindings['RGB#0#input#Sii'].stage,1);
const removedProducer=api.editReplayWorkflow(starData,starBindings,{type:'remove',image:'Ha',index:0});assert.equal(removedProducer.data[1].stars.stage,null);assert.match(api.buildWorkspaceChainPlan(removedProducer.data,2,removedProducer.bindings).errors.join(),/origin checkpoint/);
const editedState={version:1,fingerprint:api.workflowFingerprint(editData),operations:[{type:'copy',image:'Ha',index:0,to:'Sii',at:0},{type:'remove',image:'Sii',index:1}],bindings:removed.bindings,startingInputs:{$Ha:'raw_hydrogen'},target:3};
const restoredEdits=api.restoreReplayWorkflow(editData,JSON.parse(api.workflowStateJSON(editedState)));assert.equal(restoredEdits.data[1].steps[0].tool,'GradientCorrection');assert.equal(restoredEdits.bindings['RGB#0#input#Sii'].stage,1);assert.equal(restoredEdits.startingInputs.$Ha,'raw_hydrogen');
assert.throws(()=>api.restoreReplayWorkflow(data,editedState),/does not match/);assert.throws(()=>api.editReplayWorkflow(editData,editBindings,{type:'remove',image:'Ha',index:99}),/valid source step/);
assert.ok(!api.workflowStateJSON({value:'</script><img src=x onerror=alert(1)>'}).includes('<'));assert.equal(JSON.parse(api.workflowStateJSON({value:'</script>'})).value,'</script>');

const editorDOM={};for(const name of ['chain_target','chain_bindings','chain_plan','chain_confirm','chain_export','workflow_image','workflow_steps','workflow_copy_image','workflow_copy_step','workflow_position','workflow_copy','workflow_undo','workflow_save','workflow_status'])editorDOM[name]=element(name.includes('image')||name.includes('position')||name==='workflow_copy_step'?'select':'div');editorDOM.chain_target.value='3';
let editorDownload='',storedState='',savedScript=null;
const savedBody=element('body'),mainScript={textContent:'rebuild();',parentNode:savedBody};savedBody.children.push(mainScript);savedBody.insertBefore=(node,before)=>savedBody.children.splice(savedBody.children.indexOf(before),0,node);const savedRoot={querySelector:selector=>selector==='body'?savedBody:selector==='script'?mainScript:null,get outerHTML(){return '<html><body>'+savedBody.children.map(node=>'<script id="'+(node.id||'main')+'">'+node.textContent+'</script>').join('')+'</body></html>';}};
const editorWeb={...api,workspaceReplayData:editData,document:{documentElement:{lang:'en',cloneNode:()=>savedRoot},getElementById:id=>id==='apa_workflow_state'?savedScript:editorDOM[id],createElement:element,createTextNode:text=>({textContent:text}),body:element('body')},Blob:function(parts){editorDownload=parts.join('');},URL:{createObjectURL:()=> 'blob:edit',revokeObjectURL(){}},setTimeout:fn=>fn(),window:{confirm:()=>true,localStorage:{getItem:()=>null,setItem:(key,value)=>storedState=value},atlasManualAnnotations:()=>({version:1,edges:[]})}};
vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',editorWeb);
editorDOM.workflow_image.value='1';editorDOM.workflow_image.onchange();editorDOM.workflow_position.value='0';editorDOM.workflow_copy.onclick();assert.equal(editorWeb.workspaceReplayData[1].steps[0].tool,'GradientCorrection');
editorDOM.workflow_steps.children[1].children[1].onclick();assert.equal(editorWeb.workspaceReplayData[1].steps.length,1);
assert.equal(storedState,'');editorDOM.workflow_save.onclick();assert.match(editorDownload,/^<!DOCTYPE html>/);assert.match(editorDownload,/apa_workflow_state/);
savedScript={textContent:savedBody.children.find(node=>node.id==='apa_workflow_state').textContent};assert.ok(editorDownload.indexOf('apa_workflow_state')<editorDownload.indexOf('rebuild();'));const savedPayload=JSON.parse(savedScript.textContent);assert.equal(savedPayload.operations.length,2);assert.ok(savedPayload.annotations);
editorDOM.workflow_undo.onclick();assert.equal(editorWeb.workspaceReplayData[1].steps.length,2);
const reopened={...editorWeb,workspaceReplayData:editData,window:{}};vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',reopened);assert.equal(reopened.workspaceReplayData[1].steps.length,1);assert.equal(reopened.workspaceReplayData[1].steps[0].tool,'GradientCorrection');assert.equal(reopened.workspaceReplayData[0].steps.length,1);
console.log('Passed: workflow copy/remove, parameter preservation, checkpoint remapping, removed-producer blocker, undo, explicit one-file HTML restore and JSON script-injection escaping.');

const executionEdits=JSON.parse(JSON.stringify(restoredEdits.data));executionEdits[3].steps[0].source=process('PixelMath','P.expression="Ha";P.expression1="Sii";P.expression2="Oiii";P.useSingleExpression=false;P.generateOutput=true;P.createNewImage=false;P.clearImageCacheAndExit=false;').source;
const executionPlan=api.buildWorkspaceChainPlan(executionEdits,3,restoredEdits.bindings);assert.deepEqual(Array.from(executionPlan.errors),[]);
const executionResult=runtime(api.buildWorkspaceChainScript(executionEdits,executionPlan));assert.match(executionResult.messages.at(-1),/Chain complete/);assert.ok(Math.abs(executionResult.find('RGB_APA_replay').mainView.image.values[1]-0.4)<1e-12);
console.log('Passed: saved workflow state precedes executable HTML scripts, and restored copied GradientCorrection executes in its destination branch.');

const genericBranch=[gradient,{id:'Sii',steps:[{...pixel('image*2'),inputs:['image']}]},{id:'Oiii',steps:[pixel('$T*2')]},executionEdits[3]];
const genericBindings=api.suggestChainBindings(genericBranch);for(const key in genericBindings)genericBindings[key].preparation=1;
const genericEdit=api.editReplayWorkflow(genericBranch,genericBindings,{type:'copy',image:'Ha',index:0,to:'Sii',at:0});
assert.equal(genericEdit.bindings['Sii#1#input#image'].stage,1);
const genericPlan=api.buildWorkspaceChainPlan(genericEdit.data,3,genericEdit.bindings);assert.deepEqual(Array.from(genericPlan.errors),[]);
const genericResult=runtime(api.buildWorkspaceChainScript(genericEdit.data,genericPlan));assert.match(genericResult.messages.at(-1),/Chain complete/);assert.ok(Math.abs(genericResult.find('RGB_APA_replay').mainView.image.values[1]-0.8)<1e-12);
console.log('Passed: an inserted GradientCorrection feeds a following generic image PixelMath alias rather than reusing the untouched original.');

const asset={attrs:{src:'data:image/png;base64,test'},getAttribute(key){return this.attrs[key];},setAttribute(key,value){this.attrs[key]=value;}};savedRoot.querySelectorAll=()=>[asset];reopened.reportEmbeddedAssets={'#apa_asset_1':'data:image/png;base64,test'};reopened.window.recordAtlasChange('connection-add','test');editorDOM.workflow_save.onclick();assert.equal(asset.attrs.src,'#apa_asset_1');
console.log('Passed: saving edited HTML preserves shared thumbnail assets instead of duplicating base64 image data.');

const projectedData=JSON.parse(JSON.stringify(editData));projectedData.forEach((image,i)=>{image.anchor='image_'+i;image.steps.forEach((step,j)=>{step.anchor='image_'+i+'_step_'+j;step.memberAnchors=[step.anchor];});});
const baseGraph={nodes:[],edges:[]};projectedData.forEach((image,i)=>{baseGraph.nodes.push({id:image.anchor,image:image.id,label:image.id,header:true,x:24+i*290,y:30});image.steps.forEach((step,j)=>baseGraph.nodes.push({id:step.anchor,image:image.id,label:step.title,header:false,x:24+i*290,y:160+j*105,tool:step.tool,memberIds:[step.anchor]}));});
const baseBindings=api.suggestChainBindings(projectedData);
const selfExpression=[{id:'Ha',steps:[{...pixel('Ha*2 + Other'),inputs:['Ha','Other'],anchor:'self_step'}]},{id:'Sii',steps:[]}];
const selfCopy=api.editReplayWorkflow(selfExpression,api.suggestChainBindings(selfExpression),{type:'copy',image:'Ha',index:0,to:'Sii',at:0});assert.match(selfCopy.data[1].steps[0].source,/Sii\*2 \+ Other/);assert.deepEqual(Array.from(selfCopy.data[1].steps[0].inputs),['Sii','Other']);
const copiedGraphStep=api.editReplayWorkflow(projectedData,baseBindings,{type:'copy',image:'Ha',index:0,to:'Sii',at:0});
const projected=api.editedWorkspaceGraph(baseGraph,copiedGraphStep.data,projectedData,copiedGraphStep.bindings,[]);assert.ok(projected.nodes.some(node=>node.image==='Sii'&&node.workflowIndex===0&&node.tool==='GradientCorrection'));
const secondCopy=api.editReplayWorkflow(copiedGraphStep.data,copiedGraphStep.bindings,{type:'copy',image:'Ha',index:0,to:'Sii',at:0});assert.notEqual(secondCopy.data[1].steps[0].anchor,secondCopy.data[1].steps[1].anchor);
const deletedGraphStep=api.editReplayWorkflow(projectedData,baseBindings,{type:'remove',image:'Ha',index:0});assert.ok(!api.editedWorkspaceGraph(baseGraph,deletedGraphStep.data,projectedData,deletedGraphStep.bindings,[]).nodes.some(node=>node.id==='image_0_step_0'));

function treeElement(tag){const node=element(tag);node.getAttribute=key=>node.attrs[key]||null;node.removeAttribute=key=>delete node.attrs[key];node.appendChild=child=>{if(child.parentNode)child.parentNode.removeChild(child);node.children.push(child);child.parentNode=node;};node.insertBefore=(child,before)=>{if(child.parentNode)child.parentNode.removeChild(child);node.children.splice(node.children.indexOf(before),0,child);child.parentNode=node;};node.removeChild=child=>{node.children.splice(node.children.indexOf(child),1);child.parentNode=null;};node.querySelector=()=>null;node.querySelectorAll=selector=>selector==='a[data-node]'?node.children.filter(child=>child.tag==='a'):[];return node;}
const treeDOM={};for(const name of Object.keys(editorDOM))treeDOM[name]=treeElement('div');treeDOM.chain_target.value='3';treeDOM.workspace_graph=treeElement('svg');treeDOM.workspace_graph.setAttribute('viewBox','0 0 1200 600');treeDOM.workspace_graph.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return this;}});treeDOM.workspace_graph.getScreenCTM=()=>({inverse:()=>({})});treeDOM.graph_edges=treeElement('g');treeDOM.tree_edit_mode={checked:true};treeDOM.workflow_history=treeElement('ol');
let latestGraph=null;
const treeWeb={...api,workspaceReplayData:projectedData,workspaceGraphData:baseGraph,document:{documentElement:{lang:'en'},getElementById:id=>treeDOM[id],querySelectorAll:()=>[],createElement:treeElement,createElementNS:(ns,tag)=>treeElement(tag),createTextNode:text=>({textContent:text}),body:treeElement('body')},window:{confirm:()=>true,replaceAtlasGraph:graph=>latestGraph=graph,beginComparisonDrag(){},selectGraphNode(){},focusGraphImage(){},clearGraphFocus(){},showConnection(){}}};
vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',treeWeb);
assert.ok(treeWeb.window.previewTreeInsertion({clientX:350,clientY:135},'image_0_step_0'));
assert.ok(treeDOM.workspace_graph.children.some(child=>child.tag==='line'));
treeWeb.window.finishTreeInsertion({clientX:350,clientY:135},'image_0_step_0');assert.equal(treeWeb.workspaceReplayData[1].steps[0].tool,'GradientCorrection');assert.ok(latestGraph.nodes.some(node=>node.image==='Sii'&&node.edited));assert.equal(treeDOM.workflow_history.children.length,1);
treeWeb.window.editAtlasTreeNode('image_0_step_0');assert.equal(treeWeb.workspaceReplayData[0].steps.length,0);assert.ok(!latestGraph.nodes.some(node=>node.id==='image_0_step_0'));assert.equal(treeDOM.workflow_history.children.length,2);
const copiedTree=treeDOM.workspace_graph.children.find(child=>child.attrs['data-node']===treeWeb.workspaceReplayData[1].steps[0].anchor);const deleteButton=copiedTree.children[0].children.find(child=>child.attrs.class==='tree-delete');assert.ok(deleteButton);deleteButton.onclick({preventDefault(){},stopPropagation(){}});assert.equal(treeWeb.workspaceReplayData[1].steps.length,1);assert.equal(treeDOM.workflow_history.children.length,3);
console.log('Passed: real tree projection, deletion controls, drag insertion marker and branch placement, unique copied IDs, self-reference remapping and timestamped change history.');

assert.ok(savedPayload.audit.some(entry=>entry.type==='save'&&entry.time));assert.ok(savedPayload.audit.some(entry=>entry.type==='remove'));
treeWeb.window.recordAtlasChange('connection-add','Ha → Sii');assert.equal(treeDOM.workflow_history.children.length,4);
assert.ok(!api.workspaceChainHTML(projectedData).includes('Export JSON'));
console.log('Passed: saved change history contains timed edits/save events and manual connection changes share the same report history.');

const numbering=treeElement('div');treeDOM.image_0_step_0=treeElement('div');treeDOM.image_0_step_0.id='image_0_step_0';treeDOM.image_0_step_0.querySelector=selector=>selector==='.step-num'?numbering:null;treeDOM.image_0=treeElement('section');treeDOM.report_process_count=treeElement('span');
const numberWeb={...treeWeb,workspaceReplayData:projectedData,workspaceGraphData:baseGraph,window:{...treeWeb.window}};
vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',numberWeb);
assert.equal(numbering.textContent,'Step 1 of 1');assert.ok(treeDOM.report_process_count.children.some(node=>node.textContent==='Total Process Steps:'));
console.log('Passed: an existing detail step number and the aggregate process counter update without function/variable name collisions.');

function editorHarness(options={}){
 const elements={};for(const id of Object.keys(editorDOM))elements[id]=treeElement('div');for(const id of ['external_mode','graxpert_correction','graxpert_smoothing','graxpert_model','graxpert_device','graxpert_executable','external_apply'])elements[id]=treeElement('input');elements.chain_target.value='3';elements.tree_reset=treeElement('button');elements.tree_dirty=treeElement('span');elements.toolbar_save=treeElement('button');
 let stored='',download='',accept=true,prompts=[],manual={version:1,nodes:[],edges:[]};const body=treeElement('body'),main=treeElement('script');main.textContent='boot();';body.appendChild(main);
 const root={querySelector:selector=>selector==='body'?body:selector==='script'?body.children[0]:selector==='#apa_workflow_state'?body.children.find(node=>node.id==='apa_workflow_state'):null,get outerHTML(){return '<html><body>'+body.children.map(node=>'<script id="'+(node.id||'main')+'">'+node.textContent+'</script>').join('')+'</body></html>';}};
 const context={...api,workspaceReplayData:editData,document:{documentElement:{lang:'en',cloneNode:()=>root},getElementById:id=>id==='apa_workflow_state'?options.embedded?{textContent:options.embedded}:null:elements[id],querySelectorAll:selector=>selector==='[data-save-report]'?[elements.workflow_save,elements.toolbar_save]:[],createElement:treeElement,createTextNode:text=>({textContent:text}),body:treeElement('body')},Blob:function(parts){download=parts.join('');},URL:{createObjectURL:()=> 'blob:save',revokeObjectURL(){}},setTimeout:fn=>fn(),window:{confirm:text=>{prompts.push(text);return accept;},atlasManualAnnotations:()=>manual,restoreAtlasAnnotations:value=>manual=JSON.parse(JSON.stringify(value)),localStorage:{getItem:()=>options.cached||null,setItem:(key,value)=>stored=value}}};
 vm.runInNewContext(api.chainBrowserController.toString()+';chainBrowserController();',context);
 return {context,elements,prompts,get stored(){return stored;},get download(){return download;},get saved(){return body.children.find(node=>node.id==='apa_workflow_state')?.textContent;},accept:value=>accept=value,connect(){manual.edges.push({from:'a',to:'b',detail:'test'});context.window.recordAtlasChange('connection-add','a → b');},copy(to){elements.workflow_image.value=String(to);elements.workflow_image.onchange();elements.workflow_copy_image.value='0';elements.workflow_copy_image.onchange();elements.workflow_position.value='0';elements.workflow_copy.onclick();}};
}
const usage=editorHarness();assert.equal(usage.elements.workflow_save.disabled,true);assert.equal(usage.elements.toolbar_save.disabled,true);assert.equal(usage.elements.tree_reset.disabled,true);
usage.context.window.saveAtlasReport();assert.equal(usage.download,'');
usage.elements.workflow_image.value='0';usage.elements.workflow_image.onchange();usage.accept(false);usage.elements.workflow_steps.children[0].children[1].onclick();assert.equal(usage.context.workspaceReplayData[0].steps.length,1);assert.equal(usage.elements.workflow_save.disabled,true);assert.match(usage.prompts.at(-1),/Delete step GradientCorrection/);
usage.accept(true);usage.elements.workflow_steps.children[0].children[1].onclick();assert.equal(usage.context.workspaceReplayData[0].steps.length,0);assert.equal(usage.elements.workflow_save.disabled,false);
usage.accept(false);usage.context.window.resetAtlasChanges();assert.equal(usage.context.workspaceReplayData[0].steps.length,0);usage.accept(true);usage.context.window.resetAtlasChanges();assert.equal(usage.context.workspaceReplayData[0].steps.length,1);assert.equal(usage.elements.workflow_save.disabled,true);
usage.copy(1);assert.equal(usage.elements.toolbar_save.disabled,false);usage.context.window.saveAtlasReport();const lastSaved=usage.saved;assert.equal(usage.elements.workflow_save.disabled,true,usage.elements.workflow_status.textContent);assert.equal(usage.elements.tree_reset.disabled,true);
usage.copy(2);assert.equal(usage.context.workspaceReplayData[2].steps.length,2);usage.context.window.resetAtlasChanges();assert.equal(usage.context.workspaceReplayData[2].steps.length,1);assert.equal(usage.context.workspaceReplayData[1].steps.length,2);assert.equal(usage.elements.workflow_save.disabled,true);
usage.connect();assert.equal(usage.elements.workflow_save.disabled,false);usage.context.window.resetAtlasChanges();assert.equal(usage.elements.workflow_save.disabled,true);
usage.copy(2);const cached=editorHarness({cached:lastSaved});assert.equal(cached.elements.workflow_save.disabled,true);assert.equal(cached.context.workspaceReplayData[1].steps.length,1);assert.equal(cached.context.workspaceReplayData[2].steps.length,1);assert.equal(cached.stored,'');
const reopenedSaved=editorHarness({embedded:lastSaved});assert.equal(reopenedSaved.context.workspaceReplayData[1].steps.length,2);assert.equal(reopenedSaved.elements.workflow_save.disabled,true);
const tiles=api.replayLaunchHTML();assert.match(tiles,/aria-controls="replay_single_panel"/);assert.match(tiles,/aria-controls="chain_workflow"/);assert.equal((tiles.match(/<svg /g)||[]).length,2);
const panels={replay_single_panel:{open:false},chain_workflow:{open:false}},tileButtons=[treeElement('button'),treeElement('button')];tileButtons[0].setAttribute('aria-controls','replay_single_panel');tileButtons[1].setAttribute('aria-controls','chain_workflow');const tileUI={window:{},document:{getElementById:id=>panels[id],querySelectorAll:()=>tileButtons}};
vm.runInNewContext(api.reportBrowserScript().split('\n').find(line=>line.includes('window.toggleAtlasReplay=')),tileUI);tileUI.window.toggleAtlasReplay('chain_workflow',tileButtons[1]);assert.equal(panels.chain_workflow.open,true);assert.equal(tileButtons[1].getAttribute('aria-expanded'),'true');tileUI.window.toggleAtlasReplay('replay_single_panel',tileButtons[0]);assert.equal(panels.chain_workflow.open,false);assert.equal(panels.replay_single_panel.open,true);tileUI.window.toggleAtlasReplay('replay_single_panel',tileButtons[0]);assert.equal(panels.replay_single_panel.open,false);
console.log('Passed: delete confirmation/cancel, clean Save gating, dirty connections/configuration, reset to last exported baseline, ignored stale browser cache vs explicit saved-file restoration and accessible replay tile toggles.');

const sameFlow=JSON.parse(JSON.stringify(projectedData));for(const index of [1,2])Object.assign(sameFlow[index].steps[0],pixel('image*2'),{inputs:['image']});
const sameFlowBindings=api.suggestChainBindings(sameFlow),sameFlowGraph=api.editedWorkspaceGraph(baseGraph,sameFlow,sameFlow,sameFlowBindings,[]);
for(const index of [1,2]){const from=sameFlow[index].anchor,to=sameFlow[index].steps[0].anchor;assert.ok(sameFlowGraph.edges.some(edge=>edge.from===from&&edge.to===to&&edge.kind==='sequence'));assert.ok(!sameFlowGraph.edges.some(edge=>edge.to===to&&edge.kind==='input'));}
assert.ok(sameFlowGraph.edges.some(edge=>edge.kind==='input'&&edge.to==='image_3_step_0'));
sameFlow[1].steps.push({...pixel('Sii'),inputs:['Sii'],mask:{name:'Sii',inverted:false},anchor:'sii_historical_reference',memberAnchors:[]});
const historicalBindings=api.suggestChainBindings(sameFlow);historicalBindings['Sii#1#input#Sii'].stage=0;
const historicalGraph=api.editedWorkspaceGraph(baseGraph,sameFlow,sameFlow,historicalBindings,[]);
assert.ok(historicalGraph.edges.some(edge=>edge.to==='sii_historical_reference'&&edge.kind==='input'));assert.ok(historicalGraph.edges.some(edge=>edge.to==='sii_historical_reference'&&edge.kind==='mask'));
console.log('Passed: Sii/Oiii current-input PixelMath uses only its sequence edge; external inputs, earlier historical checkpoints and mask edges remain visible.');

console.log('Passed: every chain step initializes explicit mask and mapping entries, including unmasked PerfectPalettePicker and native processes.');

const staleWorkflow=JSON.stringify({...editedState,operations:[{type:'remove',image:'Sii',index:0},{type:'copy',image:'Ha',index:0,to:'Sii',at:0}]});
const freshReport=editorHarness({cached:staleWorkflow});assert.equal(freshReport.context.workspaceReplayData[1].steps[0].tool,'PixelMath');assert.equal(freshReport.elements.workflow_save.disabled,true);
const savedReport=editorHarness({embedded:lastSaved,cached:staleWorkflow});assert.equal(savedReport.context.workspaceReplayData[1].steps[0].tool,'GradientCorrection');assert.equal(savedReport.context.workspaceReplayData[1].steps.length,2);
console.log('Passed: a fresh report ignores cached remove-PixelMath/copy-GradientCorrection edits; only explicit saved HTML restores authored workflow changes.');

const opaque={id:'Sii',anchor:'image_1',steps:[{...process('UnsupportedEarlier'),reason:'unsupported earlier step',anchor:'sii_old'},{...pixel('image'),inputs:['image'],anchor:'sii_import'},{...pixel('$T*2'),anchor:'sii_after'}]};
const opaqueBindings=api.suggestChainBindings([opaque]);assert.equal(opaqueBindings['Sii#1#input#image'].source,'');
const preparedOp={type:'external',image:'Sii',index:1,mode:'prepared'};
const preparedBranch=api.editReplayWorkflow([opaque],opaqueBindings,preparedOp);assert.equal(preparedBranch.data[0].steps[1].action,'external');
const preparedPlan=api.buildWorkspaceChainPlan(preparedBranch.data,0,preparedBranch.bindings);assert.deepEqual(Array.from(preparedPlan.errors),[]);assert.deepEqual(Array.from(preparedPlan.tasks.map(task=>task.stage)),[2,3]);assert.equal(preparedPlan.roots[0].id,'Sii@2');preparedPlan.startingInputs={'$Sii@2':'Sii'};
const preparedRun=runtime(api.buildWorkspaceChainScript(preparedBranch.data,preparedPlan));assert.match(preparedRun.messages.at(-1),/Chain complete/);assert.ok(Math.abs(preparedRun.find('Sii_APA_replay').mainView.image.values[0]-0.4)<1e-12);
const singlePrepared=runtime(api.buildWorkspaceReplayScript(preparedBranch.data[0],1,2),false,false,false,false,false,{single:true});assert.match(singlePrepared.messages.at(-1),/Replay complete/);assert.ok(Math.abs(singlePrepared.find('Sii_APA_replay').mainView.image.values[0]-0.4)<1e-12);
const restoredPrepared=api.restoreReplayWorkflow([opaque],{version:1,fingerprint:api.workflowFingerprint([opaque]),operations:[preparedOp],startingInputs:{'$Sii@2':'Prepared_Sii'},target:0});assert.equal(restoredPrepared.startingInputs['$Sii@2'],'Prepared_Sii');
const restoredOriginal=api.editReplayWorkflow(preparedBranch.data,preparedBranch.bindings,{type:'external',image:'Sii',index:1,mode:'original'});assert.equal(restoredOriginal.data[0].steps[1].action,'pixelmath');assert.equal(restoredOriginal.data[0].steps[1].inputs[0],'image');
assert.throws(()=>api.editReplayWorkflow([opaque],opaqueBindings,{type:'external',image:'Sii',index:1,mode:'graxpert',settings:{smoothing:2}}),/Invalid GraXpert/);
console.log('Passed: prepared external checkpoints prune earlier unsupported processing, resume chain/single replay identically, persist source hints and restore original records.');

function graxpertNativeMock(failure=''){
 const files=new Map(),directories=new Set(),windows=[],notes=[],starts=[];let picked=0;
 function Win(w,h,n,bits,real,color,id){this.isNull=false;this.rgbWorkingSpace={gamma:2.2};const window=this;this.mainView={id,window,image:{width:w,height:h,numberOfChannels:n,bitsPerSample:bits,isReal:real,isColor:color,values:[0.4],assign(image){this.values=image.values.slice();}},beginProcess(){},endProcess(){}};this.forceClose=()=>this.isNull=true;this.removeMask=()=>{};this.saveAs=path=>{files.set(path,{...this.mainView.image,values:this.mainView.image.values.slice()});return true;};windows.push(this);}
 Win.open=path=>{const image=files.get(path),result=new Win(failure==='geometry'?2:image.width,image.height,image.numberOfChannels,32,true,image.isColor,'Graxpert_import');result.mainView.image.values=image.values.slice();return [result];};
 const ctx={ImageWindow:Win,View:{viewById:id=>windows.find(window=>window.mainView.id===id&&!window.isNull)?.mainView||{isNull:true}},UndoFlag_NoSwapFile:0,Console:{writeln(){}},processEvents(){},File:{systemTempDirectory:'/temp',exists:path=>path==='/Apps/GraXpert tool.exe'||files.has(path),createDirectory:path=>directories.add(path),remove:path=>files.delete(path),removeDirectory:path=>directories.delete(path)},OpenFileDialog:function(){this.execute=()=>{picked++;this.fileName='/Apps/GraXpert tool.exe';return failure!=='cancel';};},ExternalProcess:function(){this.isStarting=false;this.isRunning=false;this.exitCode=failure==='exit'?5:0;this.start=(exe,args)=>{starts.push({exe,args});if(failure==='start')return false;if(failure==='interrupt'){this.isRunning=true;throw Error('Simulated abort');}const image=files.get(args[1]);if(failure!=='missing'&&failure!=='exit')files.set(args[1].replace('.xisf','_GraXpert.xisf'),{...image,values:image.values.map(value=>value*0.75)});this.stdout='AI model 1.0.1';if(this.onStandardOutputDataAvailable)this.onStandardOutputDataAvailable();return true;};this.terminate=()=>this.isRunning=false;this.waitForFinished=()=>true;},PixelMath:function(){this.executeOn=view=>{const source=windows.find(window=>window.mainView.id===this.expression&&!window.isNull);assert.ok(source);view.image.values=source.mainView.image.values.slice();return true;};}};
 vm.runInNewContext(api.prepareGraxpertReplay.toString()+';'+api.runGraxpertReplay.toString(),ctx);
 const output=new Win(1,1,1,32,true,false,'Replay'),settings={correction:'Division',smoothing:0.25,model:'1.0.1',device:'cpu',executable:''},cache={};
 let error=null;try{ctx.prepareGraxpertReplay(settings,cache);ctx.runGraxpertReplay(settings,output,text=>notes.push(text));}catch(problem){error=problem;}
 assert.equal(files.size,0);assert.equal(directories.size,0);assert.ok(windows.filter(window=>window!==output).every(window=>window.isNull));
 return {output,error,settings,cache,starts,notes,picked,ctx};
}
const graxpertSuccess=graxpertNativeMock();assert.equal(graxpertSuccess.error,null);assert.ok(Math.abs(graxpertSuccess.output.mainView.image.values[0]-0.3)<1e-12);assert.equal(graxpertSuccess.starts[0].exe,'/Apps/GraXpert tool.exe');assert.deepEqual(Array.from(graxpertSuccess.starts[0].args.slice(2)),['-correction','Division','-smoothing','0.25','-ai_version','1.0.1','-gpu','false']);assert.ok(graxpertSuccess.notes.some(note=>note.includes('user-configured new run')));
for(const failure of ['cancel','start','exit','missing','geometry','interrupt']){const failed=graxpertNativeMock(failure);assert.ok(failed.error,failure);assert.equal(failed.output.mainView.image.values[0],0.4);}
const configOp={type:'external',image:'Sii',index:1,mode:'graxpert',settings:{correction:'Subtraction',smoothing:0.1,model:'1.0.1',device:'default',executable:'/Apps/GraXpert tool.exe'}};
const directBranch=api.editReplayWorkflow([opaque],opaqueBindings,configOp);assert.equal(directBranch.data[0].steps[1].action,'graxpert');assert.deepEqual(Array.from(directBranch.data[0].steps[1].inputs),[]);const directScript=api.buildWorkspaceReplayScript(directBranch.data[0],1,2);new vm.Script(directScript.replace(/^#.*$/gm,''));assert.match(directScript,/runGraxpertReplay\(process,output,replayChoice\)/);
const savedGraxpert=api.restoreReplayWorkflow([opaque],{version:1,fingerprint:api.workflowFingerprint([opaque]),operations:[configOp],target:0});assert.equal(savedGraxpert.data[0].steps[1].graxpertSettings.model,'1.0.1');assert.equal(savedGraxpert.data[0].steps[1].originalReplayStep.inputs[0],'image');
console.log('Passed: direct GraXpert CLI argument arrays, declared AI settings, imported pixels, preflight selection, cancel/error/missing/invalid-output handling and complete temporary cleanup.');

const directOnly=[{id:'Sii',steps:[{...pixel('image'),inputs:['image']},pixel('$T*2')]}];
const directOnlyEdited=api.editReplayWorkflow(directOnly,api.suggestChainBindings(directOnly),{...configOp,index:0});const directOnlyPlan=api.buildWorkspaceChainPlan(directOnlyEdited.data,0,directOnlyEdited.bindings);assert.deepEqual(Array.from(directOnlyPlan.errors),[]);
const chainOptions={graxpert:true},directChain=runtime(api.buildWorkspaceChainScript(directOnlyEdited.data,directOnlyPlan),false,false,false,false,false,chainOptions);assert.match(directChain.messages.at(-1),/Chain complete/);assert.ok(Math.abs(directChain.find('Sii_APA_replay').mainView.image.values[0]-0.3)<1e-12);assert.equal(chainOptions.files.size,0);
const singleOptions={graxpert:true,single:true},directSingle=runtime(api.buildWorkspaceReplayScript(directOnlyEdited.data[0],0,1),false,false,false,false,false,singleOptions);assert.match(directSingle.messages.at(-1),/Replay complete/);assert.ok(Math.abs(directSingle.find('Sii_APA_replay').mainView.image.values[0]-0.3)<1e-12);assert.equal(singleOptions.files.size,0);
console.log('Passed: generated chain and standalone engines both invoke the configured GraXpert CLI adapter, continue downstream processing and clean their temporary files.');

const externalUI=editorHarness();externalUI.elements.workflow_image.value='1';externalUI.elements.workflow_image.onchange();externalUI.elements.workflow_steps.children[0].children[2].onclick();externalUI.elements.external_mode.value='graxpert';externalUI.elements.external_mode.onchange();assert.equal(externalUI.elements.graxpert_smoothing.disabled,false);externalUI.elements.graxpert_correction.value='Division';externalUI.elements.graxpert_smoothing.value='0.25';externalUI.elements.graxpert_model.value='1.0.1';externalUI.elements.graxpert_device.value='cpu';externalUI.elements.graxpert_executable.value='/Apps/GraXpert tool.exe';externalUI.elements.external_apply.onclick();assert.equal(externalUI.context.workspaceReplayData[1].steps[0].action,'graxpert');assert.equal(externalUI.context.workspaceReplayData[1].steps[0].graxpertSettings.smoothing,0.25);externalUI.context.window.saveAtlasReport();
const reopenedExternal=editorHarness({embedded:externalUI.saved});assert.equal(reopenedExternal.context.workspaceReplayData[1].steps[0].graxpertSettings.model,'1.0.1');reopenedExternal.elements.workflow_image.value='1';reopenedExternal.elements.workflow_image.onchange();reopenedExternal.elements.workflow_steps.children[0].children[2].onclick();reopenedExternal.elements.external_mode.value='prepared';reopenedExternal.elements.external_mode.onchange();assert.equal(reopenedExternal.elements.graxpert_smoothing.disabled,true);reopenedExternal.elements.external_apply.onclick();assert.equal(reopenedExternal.context.workspaceReplayData[1].steps[0].action,'external');
console.log('Passed: per-step External/GraXpert setup UI, conditional settings fields and saved-HTML restoration of declared AI configuration.');
