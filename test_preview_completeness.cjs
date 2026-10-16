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

assert.equal(api.reportSizeProfile('small').stage,480);
assert.equal(api.reportSizeProfile('normal').stage,800);
assert.equal(api.reportSizeProfile('detailed').stage,1200);
assert.equal(api.reportSizeProfile('invalid').id,'normal');
const wide={...dark,width:2400,height:1200,sample(x,y,c){return 0.001+(x%4)*0.001;},render(){return bitmap(this.width,this.height);}};
let reads=0;wide.getSamples=function(row,rect,c){++reads;for(let x=0;x<this.width;++x)row[x]=this.sample(x,0,c);};
const gain=api.previewAppearance(wide);reads=0;
assert.equal(api.createThumbnailFromView({image:wide},'small.png',480,gain),true);
assert.equal(reads,240);assert.equal(previews.at(-1).width,480);assert.equal(previews.at(-1).height,240);
const bulk=previews.at(-1).channels[0].slice(0,480);delete wide.getSamples;
api.createThumbnailFromView({image:wide},'fallback.png',480,gain);
const fallback=previews.at(-1).channels[0].slice(0,480);
for(let x=0;x<bulk.length;++x)assert.ok(Math.abs(bulk[x]-fallback[x])<1e-6);
console.log('Passed: three report sizes and bulk-row stretch matches per-pixel preview sampling with bounded memory.');

const game={...native,proc:{processId:()=> 'Script',filePath:'$PXI_SRCDIR/scripts/GAME.js'},phase:'initial'};
const gameRecord={...record,steps:[game,...record.steps]};
const maskAppearance=api.historyPreviewAppearance(gameRecord,2);
assert.equal(maskAppearance.gameMask,true);assert.equal(maskAppearance.auto,false);
assert.match(api.previewAppearanceHTML(maskAppearance),/GAME mask — stretched/);
assert.ok(!api.previewAppearanceHTML(maskAppearance).includes('linear / dark'));
const liveGame={...game,phase:'live',liveIndex:1};
assert.equal(api.recordedGameMask({steps:[liveGame]},0),false);
assert.equal(api.recordedGameMask({steps:[liveGame]},1),true);
assert.equal(api.recordedGameMask({steps:[],cloneFullSteps:[game]},0),true);
console.log('Passed: GAME masks and clones are treated as stretched, with no automatic mask-value stretch or fabricated linear state.');

// State measurements describe raw samples, not display stretch or replay predictions.
{
 const raw=image([-0.1,0,0.2,0.4,1,1.2]),stats=api.captureAtlasImageStatistics(raw),channel=stats.channels[0];assert.equal(stats.available,true);assert.equal(channel.samples,6);assert.ok(Math.abs(channel.median-0.3)<1e-12);assert.equal(channel.minimum,-0.1);assert.equal(channel.maximum,1.2);assert.equal(channel.blackFraction,2/6);assert.equal(channel.whiteFraction,2/6);assert.ok(Math.abs(channel.mean-0.45)<1e-12);assert.equal(raw.sample(0,0,0),-0.1);
 const rgb=api.captureAtlasImageStatistics(image([0.2,0.4],true));assert.equal(rgb.channels.length,3);assert.ok(Math.abs(rgb.channels[1].median-0.15)<1e-12);assert.equal(rgb.alphaExcluded,true);
 const nonfinite=api.captureAtlasImageStatistics(image([NaN,Infinity,0.25]));assert.equal(nonfinite.channels[0].invalidSamples,2);assert.equal(nonfinite.channels[0].median,0.25);assert.equal(api.captureAtlasImageStatistics(image([NaN])).available,false);assert.equal(api.captureAtlasImageStatistics({}).available,false);
 let count=0;const large=api.captureAtlasImageStatistics({width:10000,height:10000,isColor:true,sample(){count++;return 0.2;}});assert.equal(count,4096*3);assert.equal(large.channels[0].mad,0);
 assert.equal(record.steps[0].statistics.after,record.steps[1].statistics.before,'Shared checkpoints reuse measurements');assert.equal(record.steps[1].statistics.after,record.currentStatistics);assert.equal(position,2);assert.equal(record.steps[0].statistics.before.channels[0].median,api.captureAtlasImageStatistics(stateImages[0]).channels[0].median);assert.match(html,/Recorded image statistics/);assert.match(html,/not predictions/);
 const noThumb=api.createThumbnailFromView,capture=api.captureAtlasImageStatistics;let captures=0;api.createThumbnailFromView=()=>false;api.captureAtlasImageStatistics=img=>{captures++;return capture(img);};api.collectWorkspaceThumbnails([record],'assets','assets');api.createThumbnailFromView=noThumb;api.captureAtlasImageStatistics=capture;assert.equal(position,2);assert.equal(captures,3);assert.equal(record.steps[0].statistics.after.available,true,'A preview export failure does not remove measured pixels');
 const initial={...record,steps:[{...native,phase:'initial',anchor:'initial'}]};api.collectWorkspaceThumbnails([initial],'assets','assets');assert.equal(initial.steps[0].statistics.before,null);assert.equal(initial.steps[0].statistics.after,null);
 const model=api.createAtlasReportData([htmlRecord],graph,{}),decoded=JSON.parse(api.atlasReportDataJSON(model));assert.equal(decoded.history[0].steps[0].statistics.before.available,true);assert.equal(decoded.history[0].statistics.available,true);assert.equal(api.atlasReportWithProject(model,{version:1}).history[0].steps[0].statistics.before.available,true);
 const mismatch={before:stats,after:rgb};assert.match(api.atlasImageStatisticsHTML(mismatch),/incompatible image states/);assert.match(api.atlasImageStatisticsHTML({before:null,after:null}),/unavailable/);
}
console.log('Passed: raw percentile/channel statistics, bounded sampling, invalid samples, cache reuse/history restoration, missing pixels, preview failure and single-file model persistence.');

{
 const values=[-0.2,0,0.00001,0.001,0.5,1,1.2],sampled=api.captureAtlasImageStatistics(image(values)),hist=sampled.channels[0].histogram;
 assert.equal(hist.bins.length,128);assert.equal(hist.logBins.length,128);
 assert.equal(hist.bins.reduce((a,b)=>a+b,0),values.length);assert.equal(hist.logBins.reduce((a,b)=>a+b,0),values.length);
 assert.equal(hist.below,1);assert.equal(hist.above,1);assert.equal(hist.bins[0],4);assert.equal(hist.bins[127],2);
 assert.ok(hist.logBins.filter(n=>n>0).length>hist.bins.filter(n=>n>0).length,'Log intensity separates dark samples');
 const rendered=api.atlasSampleHistogramHTML({before:sampled,after:sampled});assert.match(rendered,/data-hist-scale="linear"/);assert.match(rendered,/data-hist-scale="log"/);assert.equal((rendered.match(/role="img"/g)||[]).length,4);assert.ok(!rendered.includes('NaN'));
 assert.match(api.atlasSampleHistogramHTML({before:null,after:sampled}),/Historical histogram unavailable/);
 const legacy=JSON.parse(JSON.stringify(sampled));delete legacy.channels[0].histogram;assert.match(api.atlasSampleHistogramHTML({before:legacy,after:null}),/Generate a new report/);
 const invalid=JSON.parse(JSON.stringify(sampled));invalid.channels[0].histogram.bins[0]=-1;assert.match(api.atlasSampleHistogramHTML({before:invalid,after:null}),/bins unavailable/);
 const rgb=api.captureAtlasImageStatistics(image([0.01,0.2,0.7],true));const colors=api.atlasSampleHistogramHTML({before:rgb,after:rgb});for(const color of ['#f38ba8','#a6e3a1','#89b4fa'])assert.ok(colors.includes('stroke="'+color+'"'));
 const restored=JSON.parse(JSON.stringify({statistics:{before:sampled,after:rgb}}));assert.equal(restored.statistics.before.channels[0].histogram.bins.reduce((a,b)=>a+b,0),values.length);
}
console.log('Passed: linear/log sampled histogram counts, out-of-range grouping, RGB curves, legacy/missing/invalid bins and serialization.');
