const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/AstroProcessAtlas.js','utf8').replace(/^#.*$/gm,'').replace(/generateHistoryReport\(\);\s*$/,'');
const previews=[],saved=[];
function bitmap(width,height){return {width,height,scaledTo(w,h){return {save(path){saved.push({path,w,h});return true;}};}};}
const api={Console:{writeln(){}},Rect:function(x,y,w,h){this.width=w;this.height=h;},Image:function(w,h,n){
 this.width=w;this.height=h;this.channels=[];this.setSamples=(values,rect,c)=>{this.channels[c]=Array.from(values);};
 this.render=()=>bitmap(w,h);this.free=()=>{this.freed=true;};previews.push(this);
}};
vm.runInNewContext(source,api);
function image(values,color=false){return {width:values.length,height:1,colorSpace:color?1:0,isColor:color,
 sample(x,y,c){return values[x]*(color?[1,0.5,0.25][c]:1);},render(){return bitmap(this.width,this.height);}};}
const original=[0.001,0.002,0.003,0.004],dark=image(original),appearance=api.previewAppearance(dark);
assert.equal(appearance.state,'dark');assert.equal(appearance.auto,true);
assert.equal(api.createThumbnailFromView({image:dark},'dark.png',4,appearance),true);
assert.ok(Math.abs(previews[0].channels[0][2]-0.25)<1e-6);
assert.equal(previews[0].freed,true);assert.deepEqual(original,[0.001,0.002,0.003,0.004]);
const rgb=image(original,true),rgbInfo=api.previewAppearance(rgb);
assert.equal(api.createThumbnailFromView({image:rgb},'rgb.png',2,rgbInfo),true);
assert.equal(previews[1].width,2);assert.equal(previews[1].channels.length,3);
for(let c=0;c<3;c++){const x=original[1]*[1,0.5,0.25][c],v=Math.max(0,(x-rgbInfo.black)/(1-rgbInfo.black)),m=rgbInfo.midtones;
 assert.ok(Math.abs(previews[1].channels[c][0]-(m-1)*v/((2*m-1)*v-m))<1e-6);}
const visible=api.previewAppearance(image([0.2,0.3,0.4]));assert.equal(visible.state,'visible');assert.equal(visible.auto,false);
const black=api.previewAppearance(image([0,0,0]));assert.equal(black.auto,false);
assert.equal(api.previewAppearance({}).state,'unknown');
assert.equal(api.previewAppearance({width:2,height:1,sample(){throw Error('Unavailable');}}).state,'unknown');
assert.match(api.previewAppearanceHTML(appearance),/estimated/);assert.match(api.previewAppearanceHTML(appearance),/preview only/);
const native={proc:{processId:()=> 'Invert'},source:'var P = new Invert;',mask:{status:'unrecorded'}};
assert.equal(api.stepCompleteness(native).level,'recorded');
assert.equal(api.stepCompleteness({...native,source:''}).level,'missing');
assert.equal(api.stepCompleteness({...native,mask:{status:'unknown'}}).level,'missing');
assert.equal(api.stepCompleteness({...native,mask:{status:'recorded',name:'Historical_mask'}}).level,'manual');
assert.equal(api.stepCompleteness({...native,references:[{kind:'input',name:'Ha'}]}).level,'manual');
const script={...native,proc:{processId:()=> 'Script',parameters:[]},source:'var P = new Script;'};
assert.equal(api.stepCompleteness(script).level,'missing');
assert.equal(api.stepCompleteness({...script,proc:{processId:()=> 'Script',parameters:[['amount','1']]}}).level,'manual');
assert.equal(api.groupCompleteness({members:[native,script]}).level,'missing');
let position=2;const stateImages=[image([0.001,0.002,0.003]),image([0.004,0.006,0.008]),image([0.2,0.3,0.4])];
const view={get image(){return stateImages[position];},get historyIndex(){return position;},set historyIndex(value){position=value;}};
const record={id:'History',anchor:'image_0',view,window:{mask:{isNull:true}},historyIndex:2,steps:[
 {...native,phase:'live',liveIndex:1,anchor:'step_1'}, {...native,phase:'live',liveIndex:2,anchor:'step_2'}]};
api.collectWorkspaceThumbnails([record],'assets','assets');
assert.equal(position,2);assert.equal(record.appearance.state,'visible');
assert.equal(record.steps[0].beforeAppearance.auto,true);assert.equal(record.steps[0].afterAppearance.auto,true);
assert.equal(record.steps[0].beforeAppearance.midtones,record.steps[0].afterAppearance.midtones);
assert.equal(record.steps[1].afterAppearance.auto,false);
assert.equal(record.steps[1].beforeThumb,record.steps[0].afterThumb);
console.log('Passed: estimated brightness, preview-only linked stretch, RGB/grayscale, bounded preview memory, black/unknown states, history restoration/shared stretch and step/group completeness.');

const stretchStep={...native,proc:{processId:()=> 'HistogramTransformation',H:[[0,0.2,1,0,1]]},phase:'live',liveIndex:2};
assert.equal(api.recordedNonlinearStretch({steps:[stretchStep]},1),false);
assert.equal(api.recordedNonlinearStretch({steps:[stretchStep]},2),true);
assert.match(api.previewAppearanceHTML({...appearance,stretchRecorded:true}),/stretch recorded/);
const constructor=api.Image;api.Image=function(){constructor.apply(this,arguments);this.render=()=>{throw Error('Render failed');};};
assert.equal(api.createThumbnailFromView({image:dark},'failed.png',4,appearance),false);
assert.equal(previews[previews.length-1].freed,true);
api.Image=constructor;

const htmlRecord={...record,isColor:false,historySources:[],currentMaskInfo:'None',steps:record.steps.map((s,i)=>({...s,displayNumber:i+1,title:'Invert',time:'',references:[]}))};
const graph=api.workspaceGraph([htmlRecord]);
const html=api.imageReportHTML(htmlRecord);
assert.match(html,/Step data:/);assert.match(html,/Recorded process settings/);
assert.match(html,/Auto-stretched preview only/);
assert.match(api.workspaceOverviewHTML([htmlRecord],graph),/Step data indicators/);
assert.match(api.workspaceOverviewHTML([htmlRecord],graph),/fill="#a6e3a1"/);
