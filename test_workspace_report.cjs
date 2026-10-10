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
assert.equal((output.match(/class="image-report"/g)||[]).length,5);
assert.equal((output.match(/class="step-card"/g)||[]).length,7);
assert.equal((output.match(/<script>/g)||[]).length,2);
for(const match of output.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
for(let i=0;i<windows.length;++i) assert.equal(windows[i].mainView.historyIndex,i===4?2:windows[i].mainView.processing.length);
const fullOutput=output;
// Run the browser controls against a small DOM substitute; no browser/file access needed.
function element(value='') {const classes=new Set();return {value,textContent:'',children:[],firstChild:null,files:[],
  classList:{toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);},remove(name){classes.delete(name);},contains:name=>classes.has(name)},
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
assert.equal(ordered.map(r=>r.id).join(','),'Ha,Sii,OiiI,Ha_stars');
assert.equal(rootGraph.nodes.find(n=>n.id===derived.anchor).x,24+3*290);
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
