const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/AstroProcessAtlas.js', 'utf8').replace(/^#.*$/gm, '');
const helper = {Console:{writeln(){}}, View:{viewById:()=>({isNull:true})}};
vm.runInNewContext(source.replace(/generateHistoryReport\(\);\s*$/, ''), helper);
const saved = [], changes = [];

function makeProcess(name, parameters = {}, time = '') {
  return {...parameters, processId:()=>name, toSource(language) {
    if (language === 'XPSM 1.0') return '<instance class="'+name+'">'+(time ? '<time start="'+time+'"/>' : '')+'</instance>';
    return 'var P = new '+name+';\n'+Object.entries(parameters).map(([key,value]) => 'P.'+key+' = '+JSON.stringify(value)+';').join('\n');
  }};
}
function container(items, masks = []) {
  return {length:items.length, at:i=>items[i], toSource:()=> 'var HistoryReportContainer = new ProcessContainer;\n'+
    masks.map(([index,name,inverted])=>'HistoryReportContainer.setMask('+index+','+JSON.stringify(name)+','+inverted+');').join('\n')};
}
function image(id, live = [], initial = [], index = live.length, masks = []) {
  let position = index;
  const view = {id, isNull:false, initialProcessing:container(initial), processing:container(live,masks),
    get historyIndex(){return position;}, set historyIndex(value){changes.push([id,value]);position=value;},
    image:{isColor:id === 'SHO', render:()=>({width:100,height:100,scaledTo:()=>({save:path=>saved.push(path)})})}};
  return {mainView:view, filePath:'D:/data/'+id+'.xisf', mask:{isNull:true}, maskInverted:false, isNull:false};
}
const h = [0.02,0.25,1,0,1];
const ht = makeProcess('HistogramTransformation',{H:[[0,0.5,1,0,1],[0,0.5,1,0,1],[0,0.5,1,0,1],h,[0,0.5,1,0,1]]},'2026-10-09T18:00:00Z');
const blend = makeProcess('PixelMath',{expression:'SII',expression1:'Ha',expression2:'OIII',useSingleExpression:false,createNewImage:false},'2026-10-09T18:05:00Z');
const script = makeProcess('Script',{filePath:'$PXI_SRCDIR/scripts/Toolbox/SelectiveColorCorrection.js'});
const windows = [image('SII',[ht]), image('Ha',[ht]), image('OIII',[ht]),
  image('StarMask'), image('SHO',[blend,script,ht], [makeProcess('ChannelCombination',{channels:[[true,'SII'],[true,'Ha'],[true,'OIII']]})],2,[[1,'StarMask',true]])];
helper.View = {viewById:name=>{const window=windows.find(w=>w.mainView.id===name);return window?window.mainView:{isNull:true};}};
const records = windows.map((w,i)=>helper.collectWorkspaceRecord(w,i));
assert.equal(records[4].steps.length,4, 'Include inherited history plus live history');
assert.equal(records[4].steps[0].phase,'initial');
assert.equal(records[4].steps[0].liveIndex,null);
assert.equal(records[4].steps[3].redo,true);
assert.equal(records[4].steps[2].title,'SelectiveColorCorrection');
const graph = helper.workspaceGraph(records);
const inputEdges = graph.edges.filter(e=>e.kind==='input');
assert.equal(inputEdges.length,6,'Three channel-combination inputs and three PixelMath inputs');
assert.equal(graph.edges.filter(e=>e.kind==='mask').length,1);
assert.ok(graph.edges.filter(e=>e.kind!=='sequence').every(e=>e.uncertain),'Do not imply a known historical source version');
helper.collectWorkspaceThumbnails(records,'/preview','report_thumbs');
for(let i=0;i<windows.length;++i) assert.equal(windows[i].mainView.historyIndex,i===4?2:windows[i].mainView.processing.length);
assert.equal(new Set(saved).size,saved.length,'No collisions in filenames across images');
assert.ok(saved.includes('/preview/image_0_step_0.png'));
assert.ok(saved.includes('/preview/image_4_step_1.png'));
assert.ok(!saved.includes('/preview/image_4_step_0.png'),'Do not navigate inherited states');
assert.ok(saved.includes('/preview/image_0_state_0.png'),'Capture actual pre-process pixels');
assert.ok(records[0].steps[0].beforeThumb.endsWith('image_0_state_0.png'));
assert.equal(records[4].steps[2].beforeThumb,records[4].steps[1].afterThumb,'Reuse the exact previous state');
assert.equal(records[4].steps[0].beforeThumb,'','Inherited steps have no fabricated comparison');
assert.ok(helper.comparisonHTML(records[0].steps[0]).includes('type="range"'));
assert.ok(helper.comparisonHTML(records[4].steps[0]).includes('historical pixels are missing'));
assert.ok(graph.edges.filter(e=>e.kind==='sequence'||e.kind==='mask').every(e=>e.provenance==='recorded'));
assert.ok(graph.edges.filter(e=>e.kind==='input').every(e=>e.provenance==='parameter'));
const resized=image('Resized',[ht]);
Object.defineProperty(resized.mainView.image,'width',{get:()=>resized.mainView.historyIndex===0?100:50});
Object.defineProperty(resized.mainView.image,'height',{get:()=>100});
const resizedRecord=helper.collectWorkspaceRecord(resized,7);
helper.collectWorkspaceThumbnails([resizedRecord],'/preview','report_thumbs');
assert.equal(resized.mainView.historyIndex,1);
assert.equal(resizedRecord.steps[0].beforeThumb,'');
assert.ok(helper.comparisonHTML(resizedRecord.steps[0]).includes('image dimensions changed'));
const noBefore=image('NoBefore',[ht]);let storedIndex=1;
Object.defineProperty(noBefore.mainView,'historyIndex',{get:()=>storedIndex,set:value=>{if(value===0)throw Error('No initial pixels');storedIndex=value;}});
const noBeforeRecord=helper.collectWorkspaceRecord(noBefore,8);
helper.collectWorkspaceThumbnails([noBeforeRecord],'/preview','report_thumbs');
assert.equal(noBeforeRecord.steps[0].beforeThumb,'');
assert.ok(noBeforeRecord.steps[0].afterThumb);
assert.equal(noBefore.mainView.historyIndex,1);
assert.ok(records[4].steps[0].thumbNote.includes('no pixels are available'));
assert.ok(records[4].steps[2].maskThumb.src.endsWith('mask_1.png'));
const overview = helper.workspaceOverviewHTML(records,graph);
assert.ok(overview.includes('manual_from'));
assert.ok(overview.includes('8 without timestamps') || overview.includes('without timestamps'));
assert.ok(overview.includes('2026-10-09T18:05:00Z'));
const shadow = {proc:makeProcess('PixelMath',{expression:'Ha + Ha2 + sin(0.1) + "OIII" /* Ha */',symbols:'Ha=0.5',useSingleExpression:true}),mask:{status:'unrecorded'}};
assert.equal(helper.imageReferences(shadow,records).length,0,'Exclude symbols, string literals, unrelated identifiers and function names');
const missing = helper.collectWorkspaceRecord(image('Missing',[makeProcess('ChannelCombination',{channels:[[true,'ClosedHa'],[false,'OIII'],[true,'Ha']]})]),5);
const unresolvedGraph = helper.workspaceGraph([...records,missing]);
assert.ok(unresolvedGraph.unresolved.some(e=>e.name==='ClosedHa'));
assert.ok(!unresolvedGraph.edges.some(e=>e.detail==='Channel 2'&&e.to===missing.steps[0].anchor));
const extraction = helper.collectWorkspaceRecord(image('OSC',[makeProcess('ChannelExtraction',{channels:[[true,'Ha'],[false,'OIII']]})]),6);
assert.equal(helper.workspaceGraph([...records,extraction]).edges.filter(e=>e.kind==='output').length,1);

// Exercise the real top-level orchestration and native selection dialog with API mocks.
let output='', dialogCancelled=false, uncheckIndex=-1, lastTree;
function TreeBox(){lastTree=this;this.children=[];this.setMinSize=()=>{};this.child=i=>this.children[i];Object.defineProperty(this,'numberOfChildren',{get:()=>this.children.length});}
function TreeBoxNode(tree){tree.children.push(this);this.setText=()=>{};}
function Sizer(){this.add=()=>{};this.addStretch=()=>{};}
function File(){}
File.extractDrive=()=>'';File.extractDirectory=()=>'/preview';File.extractName=()=> 'workspace';File.createDirectory=()=>{};
File.readFile=()=>({toBase64:()=>Buffer.from('PNG').toString('base64')});
File.remove=()=>{};File.removeDirectory=()=>{};
File.prototype.createForWriting=()=>{};File.prototype.write=bytes=>{output+=bytes.toString('utf8');};File.prototype.close=()=>{};
const context={...helper,File,ImageWindow:{windows,activeWindow:{isNull:true}},
  ByteArray:{stringToUTF8:text=>Buffer.from(text,'utf8')},
  Dialog:function(){this.scaledResource=x=>x;this.adjustToContents=()=>{};this.execute=()=>{if(uncheckIndex>=0)lastTree.children[uncheckIndex].checked=false;return !dialogCancelled;};},
  TreeBox,TreeBoxNode,HorizontalSizer:Sizer,VerticalSizer:Sizer,Label:function(){},PushButton:function(){},ToolButton:function(){},CheckBox:function(){},
  SaveFileDialog:function(){this.fileName='/preview/workspace.html';this.execute=()=>true;},
  MessageBox:function(){this.execute=()=>{};}};
vm.runInNewContext(source,context);
assert.ok(output.includes('<b>Images:</b> 5'));
assert.ok(output.includes('<html lang="en">'));
assert.ok(output.includes('id="report_language"'));
assert.ok(output.includes('<h2>Image and process tree</h2>'));
assert.ok(output.includes('<h2>Processing summary</h2>'));
assert.ok(output.indexOf('<h2>Processing summary</h2>')<output.indexOf('class="report-filters"'));
assert.ok(output.includes('data:image/png;base64,'));
assert.ok(!/\b(?:src|data-before|data-after)="workspace_thumbs\//.test(output));
assert.ok(output.includes('id="final_image"'));
assert.ok(output.includes('Copy step for replay'));
assert.ok(output.includes('id="replay_image"'));
assert.ok(output.includes('Download PixInsight replay script'));
assert.ok(output.includes('var workspaceReplayData='));
assert.equal((output.match(/class="image-report"/g)||[]).length,5);
assert.equal((output.match(/class="step-card"/g)||[]).length,7);
assert.equal((output.match(/<script>/g)||[]).length,2);
for(const match of output.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
for(let i=0;i<windows.length;++i) assert.equal(windows[i].mainView.historyIndex,i===4?2:windows[i].mainView.processing.length);
const fullOutput=output;
// Run the browser controls against a small DOM substitute; no browser/file access needed.
function element(value='') {const classes=new Set();return {value,textContent:'',children:[],firstChild:null,files:[],
  classList:{add(name){classes.add(name);},toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);},remove(name){classes.delete(name);},contains:name=>classes.has(name)},
  getAttribute(key){return this[key] || null;},
  appendChild(child){this.children.push(child);this.firstChild=this.children[0]||null;},
  removeChild(child){this.children.splice(this.children.indexOf(child),1);this.firstChild=this.children[0]||null;},
  setAttribute(key,value){this[key]=value;}, click(){this.clicked=true;}};}
const elements={manual_edges:element(),manual_status:element(),manual_from:element('image_0'),
  manual_to:element('image_4_step_1'),manual_note:element('SII → SHO'),image_filter:element('all'),back_to_top:element()};
const sections=[{getAttribute:()=> 'image_0'},{getAttribute:()=> 'image_4'}];
const graphGroups=graph.nodes.map(n=>{const group=element();group.setAttribute('data-node',n.id);return group;});
const graphPaths=graph.edges.map(e=>{const path=element();path.setAttribute('data-from',e.from);path.setAttribute('data-to',e.to);return path;});
const assetImage=element();assetImage.setAttribute('src','#apa_asset_1');
const assetComparison=element();assetComparison.setAttribute('data-before','#apa_asset_1');assetComparison.setAttribute('data-after','#apa_asset_2');
const assetLink=element();assetLink.setAttribute('href','#apa_asset_2');
function querySelectorAll(selector){
  if(selector==='[src],[href],[data-before],[data-after]')return [assetImage,assetComparison,assetLink];
  if(selector==='.image-report')return sections;
  if(selector==='#workspace_graph .graph-node')return graphGroups;
  if(selector==='#workspace_graph path[data-from]')return [...graphPaths,...elements.manual_edges.children];
  if(selector.includes('.is-dimmed'))return [...graphGroups,...graphPaths,...elements.manual_edges.children].filter(e=>e.classList.contains('is-dimmed')||e.classList.contains('is-focused'));
  return [];
}
let exportedBlob, scrollOptions, reducedMotion=false;
const listeners={};
const browser={reportEmbeddedAssets:{'#apa_asset_1':'data:image/png;base64,UE5H','#apa_asset_2':'data:image/png;base64,QUJD'},workspaceGraphData:graph,window:{scrollY:0,
  addEventListener:(name,listener)=>{listeners[name]=listener;},scrollTo:options=>{scrollOptions=options;},
  matchMedia:()=>({matches:reducedMotion})},navigator:{},setTimeout:()=>{},
  document:{getElementById:id=>elements[id],querySelectorAll,createElementNS:()=>element(),createElement:()=>element()},
  Blob:function(parts){exportedBlob=parts.join('');},URL:{createObjectURL:()=> 'blob:demo',revokeObjectURL(){}},
  FileReader:function(){this.readAsText=file=>{this.result=file.contents;this.onload();};}};
vm.runInNewContext(helper.reportBrowserScript(),browser);
assert.equal(assetImage.getAttribute('src'),'data:image/png;base64,UE5H');
assert.equal(assetComparison.getAttribute('data-before'),assetImage.getAttribute('src'));
assert.equal(assetComparison.getAttribute('data-after'),assetLink.getAttribute('href'));
assert.equal((overview.match(/class="legend-item"/g)||[]).length,6);
assert.ok(overview.includes('onmouseenter="focusGraphImage'));
browser.window.focusGraphImage('image_0');
for(let i=0;i<graph.nodes.length;++i){
  assert.equal(graphGroups[i].classList.contains('is-dimmed'),!['SII','SHO'].includes(graph.nodes[i].image));
  assert.equal(graphGroups[i].classList.contains('is-focused'),graph.nodes[i].image==='SII');
}
browser.window.clearGraphFocus();assert.ok(graphGroups.every(g=>!g.classList.contains('is-dimmed')&&!g.classList.contains('is-focused')));
// Step hover uses its owning image, and annotations take part in direct relationships.
elements.manual_to.value='image_1';browser.window.addManualEdge();browser.window.focusGraphImage('image_0_step_0');
assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_1').classList.contains('is-dimmed'));
assert.ok(!elements.manual_edges.children[0].classList.contains('is-dimmed'));
browser.window.clearManualEdges();
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_1').classList.contains('is-dimmed'));
browser.window.clearGraphFocus();elements.manual_to.value='image_4_step_1';
browser.window.showImage('image_4');assert.equal(sections[0].hidden,true);assert.equal(sections[1].hidden,false);
browser.window.showImage('all');assert.equal(sections[0].hidden,false);
assert.equal(elements.image_filter.value,'all');
let stopped=false;
browser.window.selectGraphNode('image_0_step_0',{stopPropagation(){stopped=true;}});
assert.equal(stopped,true);
assert.equal(elements.image_filter.value,'image_0','A step selects its owning image in the dropdown');
assert.equal(sections[0].hidden,false);assert.equal(sections[1].hidden,true);
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_0_step_0').classList.contains('is-selected'));
browser.window.clearGraphFocus();
browser.window.focusGraphImage('image_1');
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_0').classList.contains('is-focused'), 'Selection survives mouseleave and other hover');
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_1').classList.contains('is-dimmed'));
browser.window.graphBackgroundClick({target:{closest:()=>graphGroups[0]}});
assert.equal(elements.image_filter.value,'image_0','Node clicks must not reset the filter');
browser.window.graphBackgroundClick({target:{closest:()=>null}});
assert.equal(elements.image_filter.value,'all');assert.equal(sections[1].hidden,false);
assert.ok(graphGroups.every(g=>!g.classList.contains('is-dimmed')&&!g.classList.contains('is-selected')));
browser.window.showImage('image_4');
assert.equal(elements.image_filter.value,'image_4');
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_4').classList.contains('is-selected'));
browser.window.showImage('all');
assert.ok(graphGroups.every(g=>!g.classList.contains('is-focused')));
assert.equal(elements.back_to_top.hidden,true);
browser.window.scrollY=800;listeners.scroll();assert.equal(elements.back_to_top.hidden,false);
browser.window.scrollToReportTop();assert.equal(scrollOptions.top,0);assert.equal(scrollOptions.behavior,'smooth');
reducedMotion=true;browser.window.scrollToReportTop();assert.equal(scrollOptions.behavior,'auto');
browser.window.scrollY=0;listeners.scroll();assert.equal(elements.back_to_top.hidden,true);
browser.window.addManualEdge();assert.equal(elements.manual_edges.children.length,1);
browser.window.exportManualEdges();const exported=JSON.parse(exportedBlob);assert.equal(exported.edges[0].detail,'SII → SHO');
browser.window.clearManualEdges();assert.equal(elements.manual_edges.children.length,0);
browser.window.importManualEdges({files:[{contents:exportedBlob}]});assert.equal(elements.manual_edges.children.length,1);
const wrongReport={...exported,nodes:[]};browser.window.importManualEdges({files:[{contents:JSON.stringify(wrongReport)}]});
assert.ok(elements.manual_status.textContent.includes('different report'));
assert.equal(elements.manual_edges.children.length,1,'Failed imports must preserve current annotations');
uncheckIndex=3; vm.runInNewContext(source,context);
assert.ok(output.includes('<b>Images:</b> 4'));
assert.ok(output.includes('References to missing'));
dialogCancelled=true;output='';vm.runInNewContext(source,context);assert.equal(output,'','Cancel must not write a report');
if(process.argv.includes('--preview')) {
  // Demo assets are intentionally absent: preview validates the graph and layout, not actual image pixels.
  fs.writeFileSync(__dirname+'/workspace_history_demo.html',fullOutput,'utf8');
}
console.log('Passed: multi-image selection/cancel, inherited histories, SHO links, masks, missing references, timestamps, redo, unique assets, symbol filtering, output links, state restoration and complete HTML.');
console.log('Passed: browser image filtering, manual edges, annotation export/import and rejection of notes for a different report.');
console.log('Passed: visual line legend, hover relationships, step/image focus, annotation-aware highlights and reset.');
console.log('Passed: tree/dropdown synchronization, persistent selection, blank-tree reset and scroll-to-top visibility/motion preference.');

// Language switches preserve data and control state.
const uiParent={closest:()=>null},protectedParent={closest:()=>({})};
const textNodes=['Show image history','Step 2 of 7','Total Process Steps: 7',
  'No history steps were found for this image.','Details — remaining 5 entries']
  .map(nodeValue=>({nodeValue,parentElement:uiParent}));
const raw={nodeValue:'Image Mask Copy; P.expression="All";',parentElement:protectedParent};textNodes.push(raw);
browser.document.documentElement={lang:'en'};browser.document.body={};
browser.document.createTreeWalker=()=>{let i=0;return {nextNode:()=>textNodes[i++]||null};};
const attr=element();attr.setAttribute('aria-label','Back to top');
attr.hasAttribute=key=>attr[key]!==undefined;attr.closest=()=>null;
const oldQuery=browser.document.querySelectorAll;
browser.document.querySelectorAll=selector=>selector==='[title],[alt],[placeholder],[aria-label]'?[attr]:oldQuery(selector);
elements.report_language=element('en');browser.window.showImage('image_4');
browser.window.setReportLanguage('el');
assert.equal(browser.document.documentElement.lang,'el');
assert.equal(textNodes[0].nodeValue,'Προβολή ιστορικού εικόνας');
assert.equal(textNodes[1].nodeValue,'Βήμα 2 από 7');
assert.equal(textNodes[2].nodeValue,'Σύνολο βημάτων: 7');
assert.equal(textNodes[3].nodeValue,'Δεν βρέθηκαν βήματα ιστορικού για αυτή την εικόνα.');
assert.equal(textNodes[4].nodeValue,'Λεπτομέρειες — υπόλοιπα 5 στοιχεία');
assert.equal(attr.getAttribute('aria-label'),'Επιστροφή στην κορυφή');
assert.equal(raw.nodeValue,'Image Mask Copy; P.expression="All";');
assert.equal(elements.image_filter.value,'image_4');assert.equal(sections[0].hidden,true);
browser.window.setReportLanguage('en');
assert.equal(textNodes[0].nodeValue,'Show image history');
assert.equal(textNodes[3].nodeValue,'No history steps were found for this image.');
assert.equal(attr.getAttribute('aria-label'),'Back to top');
assert.equal(elements.image_filter.value,'image_4');
browser.window.setReportLanguage('el');elements.manual_to.value=elements.manual_from.value;
browser.window.addManualEdge();
assert.equal(elements.manual_status.textContent,'Επίλεξε δύο διαφορετικούς κόμβους.');
console.log('Passed: English default, language round trip, attributes, protected data, preserved filter and dynamic status.');

// About is available even for a single image; website action uses the PJSR browser API.
const controls=[],dialogs=[];let openedURL;
helper.Dialog=function(){dialogs.push(this);this.scaledResource=x=>x;this.ok=()=>{};
  this.adjustToContents=()=>{};this.execute=()=>true;};
helper.Dialog.openBrowser=url=>{openedURL=url;};
helper.Label=function(){controls.push(this);};helper.PushButton=function(){controls.push(this);};
helper.ToolButton=function(){controls.push(this);};helper.TreeBox=TreeBox;helper.TreeBoxNode=TreeBoxNode;
helper.CheckBox=function(){controls.push(this);};
helper.HorizontalSizer=Sizer;helper.VerticalSizer=Sizer;
assert.equal(helper.chooseWorkspaceWindows([windows[0]]).length,1);
const about=controls.find(c=>c.toolTip==='About');assert.ok(about.icon.includes('info.png'));
assert.equal(dialogs[0].windowTitle,'AstroProcessAtlas — Select images');
about.onClick();
assert.equal(dialogs[1].windowTitle,'About AstroProcessAtlas');
assert.ok(controls.some(c=>c.text&&c.text.includes('Author: YoruHikari')&&c.text.includes('https://www.yoruhikari.gr/')));
controls.find(c=>c.text==='Visit website').onClick();assert.equal(openedURL,'https://www.yoruhikari.gr/');
console.log('Passed: single-image English dialog, About icon, author/site and website action.');

const cards=graph.nodes.filter(n=>!n.header).map(n=>({id:n.id,hidden:false}));
const languageQuery=browser.document.querySelectorAll;
browser.document.querySelectorAll=selector=>selector==='.step-card'?cards:languageQuery(selector);
elements.report_search=element('');elements.tool_filter=element('all');
elements.mask_filter=element();elements.applied_filter=element();elements.filter_status=element();
browser.window.resetReportFilters();
assert.ok(cards.every(c=>!c.hidden));
elements.tool_filter.value='PixelMath';browser.window.applyReportFilters();
assert.equal(cards.filter(c=>!c.hidden).map(c=>c.id).join(','),'image_4_step_1');
assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_0').classList.contains('is-filtered'),'Keep referenced source header visible');
assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_0_step_0').classList.contains('is-filtered'));
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_4_step_1').classList.contains('is-tool-match'));
assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_0_step_0').classList.contains('is-tool-match'));
browser.window.showImage('image_0');
assert.ok(graphGroups.every(g=>!g.classList.contains('is-tool-match')),'Image filter limits orange matches');
browser.window.showImage('all');
elements.tool_filter.value='all';elements.mask_filter.checked=true;browser.window.applyReportFilters();
assert.equal(cards.filter(c=>!c.hidden).map(c=>c.id).join(','),'image_4_step_2');
elements.mask_filter.checked=false;elements.report_search.value='StarMask SelectiveColorCorrection';browser.window.applyReportFilters();
assert.equal(cards.filter(c=>!c.hidden).map(c=>c.id).join(','),'image_4_step_2');
elements.report_search.value='';elements.applied_filter.checked=true;browser.window.applyReportFilters();
assert.equal(cards.find(c=>c.id==='image_4_step_3').hidden,true);
browser.window.showImage('image_4');assert.equal(elements.image_filter.value,'image_4');
assert.equal(sections[0].hidden,true);assert.equal(cards.find(c=>c.id==='image_4_step_3').hidden,true);
elements.report_search.value='no such parameter';browser.window.applyReportFilters();
assert.ok(cards.every(c=>c.hidden));assert.ok(elements.filter_status.textContent.startsWith('0 '));
browser.window.resetReportFilters();assert.ok(cards.every(c=>!c.hidden));assert.equal(elements.image_filter.value,'all');
const overlay={style:{}},divider={style:{}};browser.window.moveComparison({value:25,closest:()=>({querySelector:selector=>selector==='.compare-before'?overlay:divider})});
assert.equal(overlay.style.clipPath,'inset(0 75% 0 0)');
assert.equal(divider.style.left,'25%');
elements.comparison_content={style:{}};browser.window.zoomComparison(200);
assert.equal(elements.comparison_content.style.width,'200%');
assert.ok(elements.manual_edges.children.every(p=>p.getAttribute('data-provenance')==='manual'));
// Enlarging a Greek comparison recovers English source strings before localization.
browser.window.setReportLanguage('en');
const originalText={nodeType:3,nodeValue:'Πριν',_englishText:'Before',childNodes:[]};
const clonedText={nodeType:3,nodeValue:'Πριν',childNodes:[]};
const clonedComparison={childNodes:[clonedText]};
const originalComparison={childNodes:[originalText],cloneNode:()=>clonedComparison};
elements.comparison_content=element();elements.comparison_content.style={};
elements.comparison_zoom=element(200);elements.comparison_viewport={scrollTop:50,scrollLeft:20};
elements.comparison_dialog=element();elements.comparison_dialog.hidden=true;
browser.window.openComparison({closest:()=>originalComparison});
assert.equal(elements.comparison_dialog.hidden,false);assert.equal(clonedText.nodeValue,'Before');
assert.equal(elements.comparison_zoom.value,100);assert.equal(elements.comparison_viewport.scrollLeft,0);
listeners.keydown({key:'Escape'});assert.equal(elements.comparison_dialog.hidden,true);
assert.ok(!fullOutput.includes('>Apply filters</button>'));
assert.equal((fullOutput.match(/class="zoom-control"/g)||[]).length,2);
assert.ok(fullOutput.includes('class="compare-slider"'));
assert.ok(fullOutput.includes('.graph-node.is-tool-match rect'));
console.log('Passed: before/after state reuse, missing history, connection provenance, search/tool/mask/applied filters, synchronized tree, empty results, reset and shared zoom/slider.');

browser.window.resetReportFilters();
elements.report_search.value='  hA  ';browser.window.applyReportFilters();
assert.equal(elements.image_filter.value,'image_1');
assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_1').classList.contains('is-selected'));
assert.equal(sections[0].hidden,true);assert.equal(sections[1].hidden,true);
elements.tool_filter.value='HistogramTransformation';browser.window.applyReportFilters();
assert.equal(graphGroups.filter(g=>g.classList.contains('is-tool-match')).map(g=>g.getAttribute('data-node')).join(','),'image_1_step_0');
browser.window.showImage('image_4');assert.equal(elements.report_search.value,'SHO');
assert.equal(elements.image_filter.value,'image_4');
elements.report_search.value='';browser.window.applyReportFilters();assert.equal(elements.image_filter.value,'all');
assert.ok(sections.every(s=>!s.hidden));
elements.report_search.value='SII';browser.window.applyReportFilters();
browser.window.showImage('all');assert.equal(elements.report_search.value,'');
elements.report_search.value='no such image';browser.window.applyReportFilters();assert.equal(elements.image_filter.value,'all');
assert.ok(cards.every(c=>c.hidden));
console.log('Passed: exact case-insensitive image search, synchronized dropdown/tree/tool highlight, name updates and clearing/reset.');

const summary=helper.processingSummaryHTML(records);
assert.ok(summary.includes('HistogramTransformation × 3'),'Exclude redo from applied process counts');
assert.ok(summary.includes('SHO — ChannelCombination'));assert.ok(summary.includes('StarMask'));
const replay=helper.replayStepHTML(records[4],records[4].steps[2]);
assert.ok(replay.includes('Enable mask StarMask; inversion: ON'));
assert.ok(replay.includes('SelectiveColorCorrection.js'));
assert.ok(helper.replayStepHTML(records[4],records[4].steps[3]).includes('Redo step: not applied'));
const reads=[],removed=[];
helper.File={readFile:path=>{reads.push(path);return {toBase64:()=> 'UE5H'};},remove:path=>removed.push(path),removeDirectory:path=>removed.push(path)};
const sharedMask={src:'assets/mask.png'};
const embedRecords=[{currentThumb:'assets/current.png',currentMaskThumbnail:sharedMask,steps:[
  {thumb:'assets/step.png',beforeThumb:'assets/current.png',afterThumb:'assets/step.png',maskThumb:sharedMask},
  {thumb:'',beforeThumb:'',afterThumb:'',maskThumb:null}]}];
helper.embedReportThumbnails(embedRecords,'/scratch');
assert.equal(reads.length,3,'Read each unique PNG once');
assert.equal(embedRecords[0].steps[0].beforeThumb,'data:image/png;base64,UE5H');
assert.equal(sharedMask.src,'data:image/png;base64,UE5H');assert.equal(removed.length,4);
reads.length=0;
const compactRecords=[{currentThumb:'assets/shared.png',steps:[{thumb:'assets/shared.png',beforeThumb:'assets/shared.png',afterThumb:'assets/after.png'}]}];
const uniqueAssets=[];
helper.embedReportThumbnails(compactRecords,'/scratch',null,(key,data)=>uniqueAssets.push({key,data}));
assert.equal(uniqueAssets.length,2);
assert.equal(reads.length,2);
assert.equal(compactRecords[0].currentThumb,compactRecords[0].steps[0].beforeThumb);
assert.ok(!JSON.stringify(compactRecords).includes('base64'),'Records retain compact references, not image data');
let finalStored='';browser.window.location={href:'file:///report.html'};
browser.window.localStorage={setItem:(key,value)=>{finalStored=value;}};
elements.final_image=element('');elements.final_preview=element();
elements.image_4={querySelector:()=>({cloneNode:()=>({src:'data:image/png;base64,UE5H'})})};
browser.window.selectFinalImage('image_4');assert.equal(elements.final_image.value,'image_4');
assert.equal(elements.final_preview.children.length,1);assert.equal(finalStored,'image_4');
browser.window.selectFinalImage('');assert.equal(elements.final_preview.children.length,0);assert.equal(finalStored,'');
console.log('Passed: self-contained HTML, summary applied counts, replay prerequisites/source, unique asset embedding/cleanup and explicit final preview.');

const roots=[helper.collectWorkspaceRecord(image('Ha'),20),helper.collectWorkspaceRecord(image('Sii'),21),helper.collectWorkspaceRecord(image('OiiI'),22)];
roots.forEach(r=>{r.isOriginalInput=true;});
const derived=helper.collectWorkspaceRecord(image('Ha_stars',[makeProcess('PixelMath',{expression:'Ha',useSingleExpression:true})]),23);
const shuffled=[derived,...roots];const rootGraph=helper.workspaceGraph(shuffled);
const ordered=helper.orderWorkspaceGraph(shuffled,rootGraph);
assert.equal(ordered.map(r=>r.id).join(','),'Ha,Ha_stars,Sii,OiiI');
assert.equal(rootGraph.nodes.find(n=>n.id===derived.anchor).x,24+290);
assert.ok(rootGraph.nodes.filter(n=>n.header&&n.originalInput).length===3);
const rootSummary=helper.processingSummaryHTML(ordered);
assert.ok(rootSummary.includes('Ha, Sii, OiiI'),'Original inputs included even without explicit process references');
assert.ok(rootSummary.includes('File-backed images (origin unconfirmed)'));
assert.ok(helper.workspaceOverviewHTML(ordered,rootGraph).includes('Original input (selected)'));
console.log('Passed: imported original inputs without references, explicit source summary, dependency ordering and stable anchors.');

const picker=helper.collectWorkspaceRecord(image('Palette',[makeProcess('Script',{filePath:'$PXI_SRCDIR/scripts/PerfectPalettePicker.js'})]),24);
const probableGraph=helper.workspaceGraph([...roots,picker]);
const possible=probableGraph.edges.filter(e=>e.kind==='possible');assert.equal(possible.length,3);
assert.ok(possible.every(e=>e.provenance==='possible'&&e.uncertain&&e.to===picker.steps[0].anchor));
assert.equal(picker.steps[0].references.length,0,'Hypotheses do not become confirmed parameter references');
assert.ok(helper.imageReportHTML(picker).includes('unconfirmed'));
assert.ok(helper.workspaceOverviewHTML([...roots,picker],probableGraph).includes('edge-possible'));
assert.equal(helper.workspaceGraph([picker]).edges.filter(e=>e.kind==='possible').length,0);
picker.steps[0].redo=true;
assert.equal(helper.workspaceGraph([...roots,picker]).edges.filter(e=>e.kind==='possible').length,0);
picker.steps[0].redo=false;picker.steps[0].proc.referenceViewId='Ha';
assert.equal(helper.workspaceGraph([...roots,picker]).edges.filter(e=>e.kind==='possible').length,0,'Known inputs suppress speculative fallback');
console.log('Passed: possible original-input links for PerfectPalettePicker, explicit uncertainty, no fabricated references, no originals/redo and known-input suppression.');

const pppProcess=()=>makeProcess('Script',{filePath:'$PXI_SRCDIR/scripts/PerfectPalettePicker.js'});
const photoshop=helper.collectWorkspaceRecord(image('PhotoshopExport'),30);photoshop.isOriginalInput=false;
const combined=helper.collectWorkspaceRecord(image('Combined',[pppProcess(),pppProcess(),makeProcess('PixelMath',{expression:'Ha_final',useSingleExpression:true})]),31);
const combinedGraph=helper.workspaceGraph([...roots,photoshop,combined]);
const groupedNode=combinedGraph.nodes.find(n=>n.image==='Combined'&&!n.header);
assert.equal(combinedGraph.nodes.filter(n=>n.image==='Combined'&&!n.header).length,1);
assert.equal(groupedNode.memberIds.length,3);assert.equal(groupedNode.tool,'PerfectPalettePicker');
assert.equal(combined.steps.length,3,'Preserve all original history records');
assert.equal(combinedGraph.edges.filter(e=>e.kind==='possible').length,3,'One edge per explicit original per group');
assert.ok(!combinedGraph.edges.some(e=>e.kind==='possible'&&e.from===photoshop.anchor));
assert.ok(helper.imageReportHTML(combined).includes('Show recorded component steps (3)'));
assert.ok(helper.imageReportHTML(combined).includes('id="'+groupedNode.id+'"'));
const separate=helper.collectWorkspaceRecord(image('Separate',[pppProcess(),makeProcess('HistogramTransformation'),makeProcess('PixelMath')]),32);
assert.equal(helper.workspaceStepGroups(separate).length,3,'Do not absorb unrelated intervening processes');
assert.equal(helper.chooseWorkspaceWindows([windows[0]]).originalInputIds.length,0,'File-backed images never become originals automatically');
console.log('Passed: strict explicit originals, no Photoshop fallback, grouped PPP/PPP/PixelMath, deduplicated speculative edges and preserved component records.');

const numbered=helper.collectWorkspaceRecord(image('Numbered',[makeProcess('BeforeProcess'),pppProcess(),pppProcess(),makeProcess('PixelMath',{expression:'Ha_final',useSingleExpression:true}),makeProcess('AfterProcess')]),33);
const numberedGraph=helper.workspaceGraph([numbered]);const numberedHTML=helper.imageReportHTML(numbered);
assert.equal(numberedGraph.nodes.filter(n=>!n.header).length,3);
assert.ok(numberedHTML.includes('<b>Total Process Steps:</b> 3'));
assert.ok(numberedHTML.includes('<b>Original history entries:</b> 5'));
assert.ok(numberedHTML.includes('Step 1 of 3'));assert.ok(numberedHTML.includes('Step 2 of 3'));assert.ok(numberedHTML.includes('Step 3 of 3'));
assert.ok(!numberedHTML.includes('Step 5 of 5'));
for(const n of ['2.1','2.2','2.3'])assert.ok(numberedHTML.includes('Substep '+n));
assert.ok(numberedHTML.includes('<details open><summary>Show recorded component steps (3)'));
assert.equal(numbered.steps.length,5);
console.log('Passed: shared graph/detail group numbering, open PPP substeps, continued numbering and separate original entry count.');

const streamedParts=[];
assert.equal(helper.imageReportHTML(numbered,part=>streamedParts.push(part)),'');
assert.equal(streamedParts.join(''),numberedHTML,'Streaming preserves grouped markup exactly');
assert.ok(streamedParts.length>numbered.steps.length,'Flush each step rather than accumulating one image');
helper.ByteArray={stringToUTF8:text=>Buffer.from(text,'utf8')};
const unicodeText='x'.repeat(65535)+'🌌'+'Ελληνικά'.repeat(20000);
const byteChunks=[];
helper.writeReportText({write:bytes=>byteChunks.push(bytes)},unicodeText);
assert.equal(Buffer.concat(byteChunks).toString('utf8'),unicodeText);
assert.ok(byteChunks.length>2);
assert.ok(byteChunks.every(bytes=>bytes.length<=65536*3),'Bound UTF-8 write allocations');
assert.ok(byteChunks.every(bytes=>!bytes.toString('utf8').includes('\uFFFD')),'No split Unicode surrogate pairs');
console.log('Passed: streamed grouped report equivalence, bounded UTF-8 writes and Unicode chunk boundaries.');

helper.CryptographicHash_SHA256=256;
helper.CryptographicHash=function(){this.hash=bytes=>({toHex:()=>require('node:crypto').createHash('sha256').update(bytes).digest('hex')});};
let base64Conversions=0;
helper.File.readFile=path=>{const bytes=Buffer.from(path.includes('different')?'different PNG':'same PNG');bytes.toBase64=()=>{++base64Conversions;return bytes.toString('base64');};return bytes;};
const duplicateRecords=[{currentThumb:'assets/one.png',steps:[{thumb:'assets/two.png',beforeThumb:'assets/one.png',afterThumb:'assets/different.png'}]}];
const deduplicatedAssets=[];
helper.embedReportThumbnails(duplicateRecords,'/scratch',null,(key,data)=>deduplicatedAssets.push({key,data}));
assert.equal(deduplicatedAssets.length,2,'Different filenames with identical bytes share one asset');
assert.equal(base64Conversions,2,'Skip base64 conversion for duplicate PNG bytes');
assert.equal(duplicateRecords[0].currentThumb,duplicateRecords[0].steps[0].thumb);

let progressLabel,progressBar,progressClosed=false,eventCount=0;
helper.Dialog=function(){this.adjustToContents=()=>{};this.show=()=>{};this.hide=()=>{progressClosed=true;};};
helper.Label=function(){progressLabel=this;};
helper.Control=function(){progressBar=this;this.setFixedSize=(w,h)=>{this.width=w;this.height=h;};this.update=()=>this.onPaint();};
helper.Graphics=function(){this.fillRect=()=>{};this.end=()=>{};};helper.Brush=function(){};
helper.VerticalSizer=function(){this.add=()=>{};};helper.processEvents=()=>{++eventCount;};
const exportProgress=helper.createReportProgress();
exportProgress.update(45,'History previews');exportProgress.update(20,'Embedding previews');
assert.ok(progressLabel.text.startsWith('45%'),'Progress never moves backwards');
exportProgress.update(100,'Report complete');exportProgress.close();
assert.equal(progressLabel.text,'100% — Report complete');
assert.ok(progressClosed);assert.equal(eventCount,3);assert.equal(progressBar.height,18);
console.log('Passed: lossless content deduplication and native progress drawing, monotonic updates, event processing and cleanup.');

{
// One mask object can be shared across images and multiple history steps.
const sharedMask={src:'assets/shared_mask.png'};
const sharedMaskRecords=[
 {currentThumb:'',currentMaskThumbnail:sharedMask,steps:[{thumb:'',maskThumb:sharedMask}]},
 {currentThumb:'',steps:[{thumb:'',maskThumb:sharedMask},{thumb:'',maskThumb:sharedMask}]},
];
const maskReads=[],maskAssets=[];
helper.File.readFile=path=>{maskReads.push(path);if(path.includes('#apa_asset_'))throw Error('Embedded asset used as a file');const bytes=Buffer.from('mask PNG');bytes.toBase64=()=>bytes.toString('base64');return bytes;};
helper.embedReportThumbnails(sharedMaskRecords,'/scratch',null,(key,data)=>maskAssets.push({key,data}));
assert.equal(maskReads.length,1,'Read a shared mask only once');
assert.equal(maskAssets.length,1,'Emit a shared mask only once');
assert.equal(sharedMask.src,maskAssets[0].key);
assert.equal(sharedMaskRecords[1].steps[1].maskThumb.src,maskAssets[0].key);
const firstMaskMarkup=helper.imageReportHTML({...records[4],currentMaskThumbnail:sharedMask});
assert.ok(firstMaskMarkup.includes(maskAssets[0].key));
assert.ok(firstMaskMarkup.includes('class="step-card"'),'Continue emitting details after shared-mask embedding');
console.log('Passed: shared current/historical masks across images embed once without opening asset references as files, and report details remain available.');

}

assert.equal(graph.nodes.find(n=>n.id==='image_0').isColor,false);
assert.equal(graph.nodes.find(n=>n.id==='image_4').isColor,true);
assert.equal((overview.match(/class="image-color-badge"/g)||[]).length,5);
assert.ok(overview.includes('aria-label="Color image (current state)"'));
assert.ok(overview.includes('aria-label="Grayscale image (current state)"'));
assert.equal(helper.imageColorBadge({header:false,isColor:true}), '');
assert.equal(helper.imageColorBadge({header:true}), '', 'Do not guess an unknown color mode');
console.log('Passed: grayscale/color SVG badges on image headers only, current-state labels and unknown-mode handling.');

{
 const sxt=makeProcess('StarXTerminator',{stars:true});
 const sourceRecord=helper.collectWorkspaceRecord(image('Ha',[sxt]),0);
 const starsRecord=helper.collectWorkspaceRecord(image('Ha_stars',[sxt]),1);
 const starGraph=helper.workspaceGraph([starsRecord,sourceRecord]);
 const output=starGraph.edges.find(e=>e.kind==='output');
 assert.ok(output);
 assert.equal(output.from,sourceRecord.steps[0].groupAnchor);
 assert.equal(output.to,starsRecord.anchor);
 assert.equal(output.provenance,'parameter');assert.equal(output.uncertain,true);
 assert.equal(sourceRecord.steps[0].references[0].name,'Ha_stars');
 const noStars=helper.collectWorkspaceRecord(image('Ha',[makeProcess('StarXTerminator',{stars:false})]),0);
 assert.ok(!helper.workspaceGraph([noStars,starsRecord]).edges.some(e=>e.kind==='output'));
 const unrelated=helper.collectWorkspaceRecord(image('Ha_stars',[ht]),1);
 assert.ok(!helper.workspaceGraph([sourceRecord,unrelated]).edges.some(e=>e.kind==='output'));
 const redoSource=helper.collectWorkspaceRecord(image('Ha',[sxt],[],0),0);
 assert.ok(!helper.workspaceGraph([redoSource,starsRecord]).edges.some(e=>e.kind==='output'));
 assert.ok(!helper.workspaceGraph([sourceRecord]).edges.some(e=>e.kind==='output'));
 assert.ok(!helper.workspaceGraph([starsRecord]).edges.some(e=>e.kind==='output'));
 console.log('Passed: StarXTerminator stars output links with exact name and output history, disabled stars, unrelated history, redo and missing output rejection.');
}

{
 const isolatedA=helper.collectWorkspaceRecord(image('Unused_A',[ht]),30);
 const isolatedB=helper.collectWorkspaceRecord(image('Unused_B'),31);
 const input=helper.collectWorkspaceRecord(image('Input'),32);
 const output=helper.collectWorkspaceRecord(image('Result',[makeProcess('PixelMath',{expression:'Input',useSingleExpression:true})]),33);
 const recordsToOrder=[isolatedA,input,isolatedB,output];
 const g=helper.workspaceGraph(recordsToOrder);
 assert.equal(helper.orderWorkspaceGraph(recordsToOrder,g).map(r=>r.id).join(','),'Input,Result,Unused_A,Unused_B');
 assert.equal(g.nodes.find(n=>n.id===isolatedA.anchor).x,24+2*290);
 const onlyIsolated=[isolatedB,isolatedA];
 assert.equal(helper.orderWorkspaceGraph(onlyIsolated,helper.workspaceGraph(onlyIsolated)).map(r=>r.id).join(','),'Unused_B,Unused_A');
 const possibleGraph=helper.workspaceGraph(recordsToOrder);
 possibleGraph.edges.push({from:isolatedB.anchor,to:output.steps[0].anchor,kind:'possible'});
 assert.equal(helper.orderWorkspaceGraph(recordsToOrder,possibleGraph).map(r=>r.id).join(','),'Input,Unused_B,Result,Unused_A');
 console.log('Passed: disconnected images move last, sequence-only histories stay isolated, stable group order, graph positions and possible connections.');
}

{
// Arbitrary stage comparison and report-specific annotation persistence.
const storedLinks=new Map();
browser.window.localStorage={getItem:key=>storedLinks.get(key)||null,setItem:(key,value)=>storedLinks.set(key,value)};
const stageSource=element();stageSource.setAttribute('src','data:image/png;base64,CURRENT');
const stagePair=element();stagePair.setAttribute('data-before','data:image/png;base64,BEFORE');stagePair.setAttribute('data-after','data:image/png;base64,AFTER');
for(const node of graph.nodes)elements[node.id]={querySelector:()=>null};
elements.image_0={querySelector:selector=>selector==='.comparison'?stagePair:stageSource};
elements.image_0_step_0={querySelector:selector=>selector==='.comparison'?stagePair:null};
elements.stage_compare_a=element();elements.stage_compare_b=element();elements.stage_compare_status=element();
const normalCreate=browser.document.createElement;
let lastWrapper;
browser.document.createElement=tag=>{
  const el=element();el.childNodes=[];el.cloneNode=()=>el;el.focus=()=>{};
  if(tag==='div'){
    const after=element(),before=element();
    el.querySelector=selector=>selector==='img'?after:before;
    el.cloneNode=()=>el;
    lastWrapper=el;
  }return el;
};
browser.document.querySelector=()=>null;vm.runInNewContext(helper.reportBrowserScript(),browser);
assert.deepEqual(elements.stage_compare_a.children.map(o=>o.value),['image_0:current','image_0_step_0:before','image_0_step_0:after']);
assert.equal(elements.stage_compare_b.value,'image_0_step_0:before');
elements.stage_compare_a.value='image_0:current';elements.stage_compare_b.value='image_0_step_0:after';
browser.window.compareSelectedStages({focus(){}});
assert.equal(lastWrapper.querySelector('img').src,'data:image/png;base64,AFTER');
assert.equal(lastWrapper.querySelector('.compare-before').src,'data:image/png;base64,CURRENT');
assert.ok(lastWrapper.children[0].textContent.includes('Current image'));
assert.equal(elements.comparison_dialog.hidden,false);
browser.window.closeComparison();
elements.stage_compare_b.value=elements.stage_compare_a.value;
browser.window.compareSelectedStages({focus(){}});
assert.ok(elements.stage_compare_status.textContent.includes('different'));
assert.equal(elements.comparison_dialog.hidden,true);
elements.manual_to.value="image_4_step_1";browser.window.clearManualEdges();
browser.window.addManualEdge();browser.window.addManualEdge();
assert.equal(elements.manual_edges.children.length,1,'Do not duplicate a manual connection');
assert.equal(storedLinks.size,1);
browser.document.querySelector=()=>null;vm.runInNewContext(helper.reportBrowserScript(),browser);
assert.equal(elements.manual_edges.children.length,1,'Restore annotations after reopening');
const savedPayload=[...storedLinks.values()][0];
const badPayload=JSON.parse(savedPayload);badPayload.edges[0].to='missing_node';
browser.window.importManualEdges({files:[{contents:JSON.stringify(badPayload)}]});
assert.equal(elements.manual_edges.children.length,1,'Invalid imports preserve current annotations');
browser.window.importManualEdges({files:[{size:5000001,contents:savedPayload}]});
assert.ok(elements.manual_status.textContent.includes('too large'));
browser.window.clearManualEdges();
browser.document.querySelector=()=>null;vm.runInNewContext(helper.reportBrowserScript(),browser);
assert.equal(elements.manual_edges.children.length,0,'Clearing persists and cannot resurrect old links');
browser.window.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
browser.window.addManualEdge();
assert.ok(elements.manual_status.textContent.includes('storage unavailable'));
browser.window.exportManualEdges();assert.equal(JSON.parse(exportedBlob).edges.length,1);

// Drag a process into a slot, then directly onto another node. Dropdowns stay in sync.
elements.stage_compare_button={focus(){}};
elements.stage_comparison_controls={open:false};
elements.stage_name_a=element();elements.stage_name_b=element();
let dragged='';const transfer={types:['application/x-astroprocessatlas-node'],setData:(type,value)=>{dragged=value;},getData:()=>dragged};
browser.window.dragComparisonStage({dataTransfer:transfer,stopPropagation(){}},'image_0_step_0');
assert.equal(elements.stage_comparison_controls.open,true);
assert.equal(dragged,'image_0_step_0');
let prevented=false;const dropEvent={dataTransfer:transfer,currentTarget:element(),preventDefault(){prevented=true;},stopPropagation(){}};
browser.window.stageDragOver(dropEvent);assert.ok(prevented);
browser.window.dropComparisonStage(dropEvent,'b');
assert.equal(elements.stage_compare_b.value,'image_0_step_0:after');
assert.ok(elements.stage_name_b.textContent.includes('After'));
browser.window.closeComparison();
browser.window.dropComparedNodes(dropEvent,'image_0');
assert.equal(elements.stage_compare_a.value,'image_0_step_0:after');
assert.equal(elements.stage_compare_b.value,'image_0:current');
assert.equal(elements.comparison_dialog.hidden,false);
browser.window.closeComparison();
elements.stage_compare_a.value='image_0_step_0:before';browser.window.syncComparisonStages();
assert.ok(elements.stage_name_a.textContent.includes('Before'),'Dropdown updates selected stage labels');
dragged='image_4_step_0';browser.window.dropComparisonStage(dropEvent,'a');
assert.ok(elements.stage_compare_status.textContent.includes('No preview'));
assert.equal(elements.stage_compare_a.value,'image_0_step_0:before','Unavailable drop leaves selection intact');
dragged='not_a_node';browser.window.dropComparedNodes(dropEvent,'image_0');
assert.equal(elements.comparison_dialog.hidden,true);
console.log('Passed: node drag to A/B and node-to-node comparison, synchronized selectors/labels, dropdown changes and unavailable/foreign-node rejection.');

const pointerTarget=element();pointerTarget.setAttribute('data-node','image_0');
browser.document.elementFromPoint=()=>({closest:selector=>selector==='.stage-drop'?null:pointerTarget});

const ghostSource=element();ghostSource.getBoundingClientRect=()=>({left:0,top:0,width:250,height:72});
ghostSource.cloneNode=()=>({removeAttribute(){}});
browser.document.querySelector=()=>ghostSource;
const ghostBody=element();ghostBody.appendChild=function(child){this.children.push(child);child.parentNode=this;};
browser.document.body=ghostBody;
const originalNS=browser.document.createElementNS;
browser.document.createElementNS=()=>{const el=element();el.style={};return el;};
browser.window.beginComparisonDrag({button:0,pointerId:7,clientX:10,clientY:10},'image_0_step_0');
listeners.pointermove({pointerId:7,clientX:40,clientY:10,preventDefault(){}});
assert.equal(ghostBody.children.length,1);
assert.equal(ghostBody.children[0].style.left,'30px');
assert.ok(ghostSource.classList.contains('is-drag-origin'));
listeners.pointerup({pointerId:7,clientX:100,clientY:10,preventDefault(){}});
assert.equal(elements.stage_compare_a.value,'image_0_step_0:after');
assert.equal(elements.stage_compare_b.value,'image_0:current');
assert.equal(elements.comparison_dialog.hidden,false);
assert.equal(ghostBody.children.length,0);assert.ok(!ghostSource.classList.contains('is-drag-origin'));
browser.document.querySelector=()=>null;browser.document.createElementNS=originalNS;
browser.window.closeComparison();
let clickSuppressed=false;listeners.click({target:{closest:()=>true},preventDefault(){clickSuppressed=true;},stopPropagation(){}});
assert.ok(clickSuppressed,'Dragging must not also activate the normal graph click');
browser.window.beginComparisonDrag({button:0,pointerId:8,clientX:10,clientY:10},'image_0');
listeners.pointerup({pointerId:8,clientX:12,clientY:10,preventDefault(){throw Error('Normal click was treated as drag');}});
assert.equal(elements.comparison_dialog.hidden,true);
browser.window.beginComparisonDrag({button:0,pointerId:9,clientX:10,clientY:10},'image_0');listeners.pointercancel();
listeners.pointerup({pointerId:9,clientX:100,clientY:10,preventDefault(){throw Error('Cancelled drag was handled');}});
console.log('Passed: real pointer drag handling, click suppression after drag, ordinary clicks and pointer cancellation.');
browser.document.createElement=normalCreate;
console.log('Passed: arbitrary current/before/after selection, shared comparison dialog, same-stage rejection, annotation restore/clear, duplicates, invalid/oversized import and storage-denied export fallback.');

}

{
 elements.connection_info=element();elements.connection_info.hidden=true;elements.connection_description=element();
 let edgeStopped=false;
 browser.window.showConnection({preventDefault(){},stopPropagation(){edgeStopped=true;}},'history',0);
 assert.ok(edgeStopped);assert.equal(elements.connection_info.hidden,false);
 assert.ok(elements.connection_description.textContent.includes('Recorded in history'));
 const inputIndex=graph.edges.findIndex(e=>e.provenance==='parameter');
 browser.window.showConnection(null,'history',inputIndex);
 assert.ok(elements.connection_description.textContent.includes('Detected from parameters'));
 assert.ok(elements.connection_description.textContent.includes('historical source pixels'));
 browser.window.showConnection(null,'manual',0);
 assert.ok(elements.connection_description.textContent.includes('User annotation'));
 assert.ok(fullOutput.includes('onclick="showConnection(event'));
 elements.tree_image=element('image_4');elements.tree_path_only={checked:false};elements.tree_organization_status=element();
 elements.tree_node_search=element('Histogram');elements.tree_node_results=element();
 browser.window.findTreeNodes();assert.ok(elements.tree_node_results.children.length>1);
 assert.ok(elements.tree_node_results.children.slice(1).every(option=>option.textContent.includes('Histogram')));
 const collapseEdgeIndex=graph.edges.findIndex(e=>e.kind==='input');
 const collapseEdge=graphPaths[collapseEdgeIndex];collapseEdge._treeOriginalD=helper.graphEdgePath(graph.edges[collapseEdgeIndex],graph.nodes);collapseEdge.setAttribute('d',collapseEdge._treeOriginalD);
 const expandedEdgeD=collapseEdge.getAttribute('d');
 browser.window.toggleTreeBranch();
 assert.ok(graphGroups.find(g=>g.getAttribute('data-node')==='image_4_step_1').classList.contains('is-tree-hidden'));
 assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_4').classList.contains('is-tree-hidden'));
 assert.ok(!collapseEdge.classList.contains('is-tree-hidden'),'Preserve connections to collapsed image');assert.notEqual(collapseEdge.getAttribute('d'),expandedEdgeD);
 browser.window.toggleTreeBranch();
 assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_4_step_1').classList.contains('is-tree-hidden'));
 assert.equal(collapseEdge.getAttribute('d'),expandedEdgeD,'Restore original line geometry on expansion');
 const isolatedNode={id:'isolated_for_test',image:'Unused',header:true};graph.nodes.push(isolatedNode);
 const isolatedGroup=element();isolatedGroup.setAttribute('data-node',isolatedNode.id);graphGroups.push(isolatedGroup);
 elements.tree_path_only.checked=true;browser.window.organizeTree();
 assert.ok(isolatedGroup.classList.contains('is-tree-hidden'));
 assert.ok(!graphGroups.find(g=>g.getAttribute('data-node')==='image_0').classList.contains('is-tree-hidden'),'Keep the source feeding the destination');
 browser.window.resetTreeOrganization();assert.ok(!isolatedGroup.classList.contains('is-tree-hidden'));
 assert.equal(elements.tree_path_only.checked,false);
 graph.nodes.pop();graphGroups.pop();
 console.log('Passed: clickable recorded/parameter/manual provenance, uncertainty, node search, branch collapse/expand, ancestors-only view and reset.');
}

// Export controls execute the same generator used by the native replay tests.
{
 const readyStep={title:'HistogramTransformation',number:1,substep:0,tool:'HistogramTransformation',reason:'',source:'var P = new HistogramTransformation; P.H=[[0,0.5,1,0,1]];',variable:'P'};
 browser.workspaceReplayData=[{id:'Ha',anchor:'image_0',steps:[readyStep,{...readyStep,number:2,title:'Script',reason:'Unsupported Script',source:'',variable:''}, {...readyStep,number:3}]}, {id:'Empty',steps:[]}];
 browser.buildWorkspaceReplayScript=helper.buildWorkspaceReplayScript;
 elements.replay_image=element('0');elements.replay_start=element();elements.replay_end=element();
 elements.replay_readiness=element();elements.replay_status=element();elements.replay_export=element();
 browser.document.body=element();
 browser.window.updateReplayRange(true);
 assert.equal(elements.replay_start.children.length,3);
 assert.equal(elements.replay_end.value,'2');
 assert.match(elements.replay_status.textContent,/1 consecutive/);
 assert.equal(elements.replay_export.disabled,false);
 assert.match(elements.replay_readiness.children[1].textContent,/STOP/);
 assert.match(elements.replay_readiness.children[2].textContent,/Not reached/);
 browser.window.exportReplayScript();
 assert.match(exportedBlob,/function runAtlasReplay/);
 new vm.Script(exportedBlob.replace(/^#.*$/gm,''));
 assert.equal(browser.document.body.children.length,0,'Remove the temporary download link');
 elements.replay_start.value='2';elements.replay_end.value='0';browser.window.updateReplayRange(false);
 assert.equal(elements.replay_end.value,'2');
 assert.match(elements.replay_status.textContent,/1 consecutive/,'Allow a new input state after an unsupported step');
 elements.replay_start.value='1';browser.window.updateReplayRange(false);
 assert.equal(elements.replay_export.disabled,true,'Cannot start by silently skipping a blocker');
 elements.replay_image.value='1';browser.window.updateReplayRange(true);
 assert.equal(elements.replay_start.children.length,0);assert.equal(elements.replay_export.disabled,true);
 assert.match(elements.replay_status.textContent,/No applied processes/);
 console.log('Passed: workflow image/range controls, readiness and blockers, empty histories, generated script download and cleanup.');
}

// A clone branches at its common prefix; retained live indices still address real pixels.
{
 const scnr=makeProcess('SCNR',{amount:0.5});
 const curve=makeProcess('CurvesTransformation',{K:[[0,0],[1,1]]});
 const parent=helper.collectWorkspaceRecord(image('CloneSource',[ht,curve]),80);
 const clone=helper.collectWorkspaceRecord(image('CloneSource_clone',[ht,curve,scnr]),81);
 const branched=helper.workspaceGraph([clone,parent]);
 assert.equal(clone.steps.length,1);assert.equal(clone.cloneShared.count,2);
 assert.equal(clone.steps[0].title,'SCNR');assert.equal(clone.steps[0].liveIndex,3);
 assert.equal(clone.steps[0].historyEntryIndex,2);assert.equal(clone.steps[0].displayNumber,1);
 assert.equal(branched.nodes.filter(n=>n.image===clone.id&&!n.header).length,1);
 const relation=branched.edges.find(e=>e.to===clone.anchor&&e.kind==='input');
 assert.equal(relation.from,parent.steps[1].anchor);assert.equal(relation.uncertain,true);
 assert.match(relation.detail,/matching image name/);
 helper.collectWorkspaceThumbnails([parent,clone],'/preview','report_thumbs');
 assert.ok(clone.steps[0].beforeThumb.endsWith('_state_2.png'));
 assert.equal(clone.view.historyIndex,3);
 const detail=helper.imageReportHTML(clone);
 assert.equal((detail.match(/class="step-card"/g)||[]).length,1);
 assert.ok(!detail.includes('Full history code'),'Do not duplicate the shared raw container in clone details');
 assert.match(detail,/Only subsequent clone steps/);
 assert.match(detail,/onclick="selectGraphNode/,'Source link selects and reveals its image history');
 assert.match(detail,/Original history entries:<\/b> 3/);
 assert.equal(helper.workspaceReplayData([clone])[0].steps.length,1);
 assert.match(helper.processingSummaryHTML([parent,clone]),/HistogramTransformation × 1/);
 const again=helper.workspaceGraph([parent,clone]);assert.equal(clone.steps.length,1);
 assert.equal(again.edges.filter(e=>e.to===clone.anchor&&e.kind==='input').length,1);
 helper.workspaceGraph([clone]);assert.equal(clone.steps.length,3,'Missing parent restores full history');
 assert.equal(clone.cloneShared,null);
 const changed=helper.collectWorkspaceRecord(image('CloneSource_clone',[makeProcess('HistogramTransformation',{H:[[0,0.7,1,0,1]]}),curve,scnr]),82);
 helper.workspaceGraph([parent,changed]);assert.equal(changed.steps.length,3);
 const laterMatch=helper.collectWorkspaceRecord(image('CloneSource_clone',[ht,scnr,curve]),83);
 helper.workspaceGraph([parent,laterMatch]);assert.equal(laterMatch.steps.length,2);
 assert.equal(laterMatch.steps[1].title,'CurvesTransformation','Only remove the consecutive initial prefix');
 const otherName=helper.collectWorkspaceRecord(image('OtherClone',[ht,curve,scnr]),84);
 helper.workspaceGraph([parent,otherName]);assert.equal(otherName.steps.length,3);
 const numbered=helper.collectWorkspaceRecord(image('CloneSource_clone2',[ht,curve,scnr]),89);
 helper.workspaceGraph([parent,numbered]);assert.equal(numbered.steps.length,1);
 const masks=helper.collectWorkspaceRecord(image('CloneSource_clone',[ht,curve],[],2,[[0,'DifferentMask',true]]),85);
 helper.workspaceGraph([parent,masks]);assert.equal(masks.steps.length,2,'Different masks preserve history');
 const identical=helper.collectWorkspaceRecord(image('CloneSource_clone',[ht,curve]),86);
 const identicalGraph=helper.workspaceGraph([parent,identical]);assert.equal(identical.steps.length,0);
 assert.ok(identicalGraph.edges.some(e=>e.to===identical.anchor&&e.kind==='input'));
 assert.match(helper.imageReportHTML(identical),/No additional history steps/);
 const redo=helper.collectWorkspaceRecord(image('CloneSource_clone',[ht,curve],[],1),87);
 helper.workspaceGraph([parent,redo]);assert.equal(redo.steps.length,1);assert.equal(redo.steps[0].redo,true);
 assert.equal(helper.historyParameterKey('var X = new SCNR; X.amount = 0.5; /* date */'),
   helper.historyParameterKey('var P=new SCNR;\nP.amount=0.5;'));
 assert.equal(helper.historyParameterKey('var X=new SCNR;X.amount=1.000;'),helper.historyParameterKey('var P=new SCNR;P.amount=1;'));
 assert.notEqual(helper.historyParameterKey('var P=new PixelMath;P.expression="Ha + SII";'),
   helper.historyParameterKey('var P=new PixelMath;P.expression="Ha+SII";'),'Keep literal parameter text intact');
 assert.equal(helper.historyParameterKey('Could not retrieve parameters'), '');
 const derived=helper.collectWorkspaceRecord(image('CloneSource_clone_clone',[ht,curve,scnr,makeProcess('NoiseXTerminator',{amount:0.3})]),88);
 const chain=helper.workspaceGraph([derived,clone,parent]);assert.equal(clone.steps.length,1);assert.equal(derived.steps.length,1);
 assert.ok(chain.edges.some(e=>e.from===clone.steps[0].anchor&&e.to===derived.anchor));
 console.log('Passed: common clone prefix removal across tree/details/summary/replay, source branch links, numbering, real live indices, idempotence, missing parent, different parameters/masks, redo and clone chains.');
}

// Collapse only the corroborating stars-output origin after the output link is established.
{
 const sxt=makeProcess('StarXTerminator',{stars:true});
 const scnr=makeProcess('SCNR',{amount:0.6});
 const sourceRecord=helper.collectWorkspaceRecord(image('StarsSource',[sxt]),90);
 const outputRecord=helper.collectWorkspaceRecord(image('StarsSource_stars',[sxt,scnr]),91);
 const starGraph=helper.workspaceGraph([outputRecord,sourceRecord]);
 const link=starGraph.edges.find(e=>e.kind==='output'&&e.to===outputRecord.anchor);
 assert.equal(link.from,sourceRecord.steps[0].anchor);
 assert.equal(sourceRecord.steps.length,1,'Preserve the source process and parameters');
 assert.equal(outputRecord.starsOrigin.image,sourceRecord.id);
 assert.equal(outputRecord.steps.length,1);assert.equal(outputRecord.steps[0].title,'SCNR');
 assert.equal(outputRecord.steps[0].displayNumber,1);assert.equal(outputRecord.steps[0].liveIndex,2);
 assert.equal(outputRecord.steps[0].historyEntryIndex,1);
 assert.equal(starGraph.nodes.filter(n=>n.image===outputRecord.id&&!n.header).length,1);
 assert.ok(!starGraph.nodes.some(n=>n.id===outputRecord.starsOrigin.removedStep));
 const detail=helper.imageReportHTML(outputRecord);
 assert.equal((detail.match(/class="step-card"/g)||[]).length,1);
 assert.ok(!detail.includes('Full history code'));
 assert.match(detail,/StarXTerminator origin is shown on the source image/);
 assert.match(detail,/Original history entries:<\/b> 2/);
 const replay=helper.workspaceReplayData([outputRecord])[0];
 assert.equal(replay.steps.length,1);assert.equal(replay.steps[0].reason,'');
 assert.match(helper.processingSummaryHTML([sourceRecord,outputRecord]),/StarXTerminator × 1/);
 helper.collectWorkspaceThumbnails([sourceRecord,outputRecord],'/preview','report_thumbs');
 assert.ok(outputRecord.steps[0].beforeThumb.endsWith('_state_1.png'));
 assert.equal(outputRecord.view.historyIndex,2);
 assert.ok(helper.workspaceGraph([sourceRecord,outputRecord]).edges.some(e=>e.kind==='output'));
 assert.equal(outputRecord.steps.length,1,'Repeated generation retains the origin proof without removing more steps');
 helper.workspaceGraph([outputRecord]);assert.equal(outputRecord.steps.length,2);
 assert.equal(outputRecord.starsOrigin,null,'No selected source means no removal');
 const disabled=helper.collectWorkspaceRecord(image('StarsSource',[makeProcess('StarXTerminator',{stars:false})]),92);
 assert.ok(!helper.workspaceGraph([disabled,outputRecord]).edges.some(e=>e.kind==='output'));
 assert.equal(outputRecord.steps.length,2,'Disabled stars does not authorize removal');
 const redoSource=helper.collectWorkspaceRecord(image('StarsSource',[sxt],[],0),93);
 helper.workspaceGraph([redoSource,outputRecord]);assert.equal(outputRecord.steps.length,2);
 const redoOutput=helper.collectWorkspaceRecord(image('StarsSource_stars',[sxt],[],0),94);
 helper.workspaceGraph([sourceRecord,redoOutput]);assert.equal(redoOutput.steps.length,1);
 assert.equal(redoOutput.starsOrigin,undefined,'Redo cannot corroborate a stars origin');
 const missingProof=helper.collectWorkspaceRecord(image('StarsSource_stars',[scnr]),95);
 const unlinked=helper.workspaceGraph([sourceRecord,missingProof]);
 assert.ok(!unlinked.edges.some(e=>e.kind==='output'));assert.equal(missingProof.steps.length,1);
 const later=helper.collectWorkspaceRecord(image('StarsSource_stars',[sxt,scnr,makeProcess('StarXTerminator',{stars:false})]),96);
 helper.workspaceGraph([sourceRecord,later]);assert.equal(later.steps.length,2);
 assert.equal(later.steps[1].title,'StarXTerminator','Preserve an actual later StarXTerminator operation');
 const unchanged=helper.collectWorkspaceRecord(image('StarsSource_stars',[sxt]),97);
 const originOnly=helper.workspaceGraph([sourceRecord,unchanged]);assert.equal(unchanged.steps.length,0);
 assert.ok(originOnly.edges.some(e=>e.kind==='output'&&e.to===unchanged.anchor));
 assert.match(helper.imageReportHTML(unchanged),/No additional history steps.*stars output/);
 assert.equal(helper.workspaceReplayData([unchanged])[0].steps.length,0);
 const outputClone=helper.collectWorkspaceRecord(image('StarsSource_stars_clone',[sxt,scnr,ht]),98);
 const combined=helper.workspaceGraph([sourceRecord,outputRecord,outputClone]);
 assert.equal(outputRecord.steps.length,1);assert.equal(outputClone.steps.length,1);
 assert.ok(combined.edges.some(e=>e.kind==='output'&&e.to===outputRecord.anchor));
 assert.ok(combined.edges.some(e=>e.kind==='input'&&e.to===outputClone.anchor));
 assert.equal(outputClone.steps[0].liveIndex,3,'Clone normalization and stars origin removal preserve native indices');
 console.log('Passed: linked stars origin collapse, retained output relationship, details/summary/replay numbering, real thumbnails, missing/disabled/redo proof, later operations, repeat generation and stars-output clones.');
}

{
 const rename=makeProcess('ImageIdentifier',{id:'Ha_named'});
 const renamed=helper.collectWorkspaceRecord(image('Ha_named',[ht,rename]),99);
 helper.workspaceGraph([renamed]);
 browser.workspaceReplayData=helper.workspaceReplayData([renamed]);
 elements.replay_image.value='0';browser.window.updateReplayRange(true);
 assert.equal(elements.replay_export.disabled,false);
 assert.match(elements.replay_status.textContent,/2 consecutive/);
 assert.match(elements.replay_readiness.children[1].textContent,/Naming handled at creation: Ha_named_APA_replay/);
 browser.window.exportReplayScript();
 assert.match(exportedBlob,/var replayIdentifier = "Ha_named"/);
 assert.match(exportedBlob,/action==="identifier"/);
 assert.ok(!exportedBlob.includes('new ImageIdentifier'),'Handle rename metadata without a native constructor');
 new vm.Script(exportedBlob.replace(/^#.*$/gm,''));
 console.log('Passed: ImageIdentifier report readiness and downloadable naming metadata script.');
}

{
 const ws=makeProcess('RGBWorkingSpace',{channels:[[1,0.648431,0.330856],[1,0.321152,0.597871],[1,0.155886,0.066044]],gamma:2.2,sRGBGamma:true,applyGlobalRGBWS:false});
 const scc=makeProcess('Script',{filePath:'$PXI_SRCDIR/scripts/Toolbox/SelectiveColorCorrection.js'});
 const rec=helper.collectWorkspaceRecord(image('SCC',[ws,ws,scc,ht]),110);
 const graph=helper.workspaceGraph([rec]);
 const group=graph.nodes.find(n=>n.tool==='SelectiveColorCorrection');
 assert.equal(group.memberIds.length,3);
 assert.equal(rec.displayGroups.length,2);
 assert.equal(rec.steps[3].displayNumber,2);
 const plan=helper.workspaceReplayData([rec])[0];
 assert.equal(plan.steps.length,2);
 assert.equal(plan.steps[0].tool,'SelectiveColorCorrection');
 assert.ok(plan.steps[0].reason,'The parent script remains a replay blocker');
 assert.equal(plan.steps[1].tool,'HistogramTransformation');
 assert.ok(!helper.replayStepHTML(rec,rec.steps[0]).includes('Copy step for replay'));
 assert.match(helper.replayStepHTML(rec,rec.steps[0]),/Grouped component/);
 helper.workspaceGraph([rec]);
 assert.equal(rec.displayGroups.length,2,'Repeated grouping is stable');
 for(const processes of [
   [ws,scc], [ws,ws,ht,scc],
   [ws,makeProcess('RGBWorkingSpace',{channels:ws.channels,gamma:1.8,sRGBGamma:true,applyGlobalRGBWS:false}),scc],
   [ws,ws,makeProcess('Script',{filePath:'Other.js'})]
 ]) {
   const separate=helper.collectWorkspaceRecord(image('Independent',processes),111);
   assert.equal(helper.workspaceStepGroups(separate).length,processes.length);
   assert.ok(helper.workspaceReplayData([separate])[0].steps.some(s=>s.tool==='RGBWorkingSpace'));
 }
 const partial=helper.collectWorkspaceRecord(image('Partial',[ws,ws,scc],[],2),112);
 assert.equal(helper.workspaceStepGroups(partial).length,3,'Do not merge applied and redo entries');
 const boundary=helper.collectWorkspaceRecord(image('Boundary',[ws,scc],[ws]),113);
 assert.equal(helper.workspaceStepGroups(boundary).length,3,'Do not merge initial and recent history');
 const html=helper.imageReportHTML(rec);
 assert.match(html,/<h3 data-no-i18n>SelectiveColorCorrection<\/h3>/);
 assert.ok(html.includes('Show recorded component steps (3)'));
 assert.ok(html.includes('Substep 1.1') && html.includes('Substep 1.2') && html.includes('Substep 1.3'));
 console.log('Passed: SelectiveColorCorrection matching helpers group once, consistent numbering, replay exclusion with parent blocker, and unrelated/changed/redo/phase rejection.');
}

{
 const rec=helper.collectWorkspaceRecord(image('GroupedReplay',[ht,pppProcess(),pppProcess(),makeProcess('PixelMath',{expression:'Ha'}),ht]),114);
 helper.workspaceGraph([rec]);
 const plan=helper.workspaceReplayData([rec])[0];
 assert.equal(plan.steps.length,3,'One replay entry per top-level group');
 assert.equal(plan.steps[1].tool,'PerfectPalettePicker');
 assert.equal(plan.steps[1].number,2);
 assert.equal(plan.steps[1].substep,0);
 assert.equal(plan.steps[1].source,'');
 assert.match(plan.steps[1].reason,/PerfectPalettePicker/);
 assert.equal(plan.steps[2].number,3);
 assert.ok(!plan.steps.some(s=>s.tool==='PixelMath'));
 for(const component of rec.displayGroups[1].members) {
   assert.equal(component.componentOf,'PerfectPalettePicker');
   assert.ok(!helper.replayStepHTML(rec,component).includes('Copy step for replay'));
 }
 const exported=helper.buildWorkspaceReplayScript(plan,0,2);
 assert.ok(!exported.includes('new PixelMath'));
 const stop=JSON.parse(exported.match(/var replaySteps = (.*);/)[1]);
 assert.equal(stop.length,3);
 assert.ok(stop[1].reason);
 const separate=helper.collectWorkspaceRecord(image('UngroupedReplay',[pppProcess(),ht]),115);
 helper.workspaceReplayData([separate]);
 assert.equal(separate.steps[0].componentOf,'','Ungrouped steps retain their copy control');
 console.log('Passed: grouped replay emits only parent blockers, omits every component including PixelMath, preserves top-level numbering and individual steps.');
}
