// Copyright (c) 2026 YoruHikari Astrophotography
// SPDX-License-Identifier: MIT
// https://www.yoruhikari.gr/
#include <pjsr/Sizer.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/UndoFlag.jsh>

function compareReplayPair(original, replay, label) {
   var a = original.mainView.image, b = replay.mainView.image;
   if (original === replay) throw Error(label + ': select two different images.');
   if (a.width !== b.width || a.height !== b.height || a.isColor !== b.isColor)
      throw Error(label + ': image dimensions and color mode must match.');
   var base = 'APA_difference_' + label.toLowerCase(), id = base, suffix = 1;
   while (!View.viewById(id).isNull) id = base + '_' + suffix++;
   var difference = new ImageWindow(a.width, a.height, a.isColor ? 3 : 1, 64, true, a.isColor, id);
   try {
      var p = new PixelMath;
      p.expression = 'abs(' + original.mainView.id + '-' + replay.mainView.id + ')';
      p.useSingleExpression = true;
      p.symbols = '';
      p.generateOutput = true;
      p.clearImageCacheAndExit = false;
      p.cacheGeneratedImages = false;
      p.use64BitWorkingImage = true;
      p.rescale = false;
      p.truncate = false;
      p.createNewImage = false;
      if (p.executeOn(difference.mainView) === false) throw Error(label + ': PixelMath failed.');
      Console.writeln('\n' + label + ': ' + original.mainView.id + ' versus ' + replay.mainView.id);
      Console.writeln('Input formats: ' + a.bitsPerSample + ' bit / ' + b.bitsPerSample + ' bit');
      var image = difference.mainView.image, max = 0;
      for (var c = 0; c < (a.isColor ? 3 : 1); ++c) {
         image.selectedChannel = c;
         var peak = image.maximum(), mean = image.mean();
         if (!isFinite(peak) || !isFinite(mean)) throw Error(label + ': non-finite difference statistics.');
         max = Math.max(max, peak);
         Console.writeln((a.isColor ? ['R', 'G', 'B'][c] : 'Gray') + ': max abs = ' + peak.toExponential(12) + ', mean abs = ' + mean.toExponential(12));
      }
      image.resetSelections();
      difference.show();
      return max;
   } catch (error) {
      difference.forceClose();
      throw error;
   }
}

function diagnoseReplayDifference() {
   var windows = [];
   for (var i = 0; i < ImageWindow.windows.length; ++i)
      if (!ImageWindow.windows[i].isNull) windows.push(ImageWindow.windows[i]);
   if (windows.length < 2) throw Error('Open original/replay checkpoint images before and after the process.');
   var dialog = new Dialog;
   dialog.windowTitle = 'AstroProcessAtlas - Replay difference';
   var note = new Label(dialog);
   note.text = 'Select matching original/replay checkpoints BEFORE and AFTER the first divergent process. Inputs are unchanged. Creates 64-bit absolute differences without rescaling or clipping. Read the Console numbers; auto STF is only a display stretch.';
   note.wordWrapping = true;
   note.setMinWidth(560);
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 12;
   dialog.sizer.spacing = 8;
   dialog.sizer.add(note);
   var labels = ['Original BEFORE', 'Replay BEFORE', 'Original AFTER', 'Replay AFTER'], selectors = [];
   for (var j = 0; j < labels.length; ++j) {
      var label = new Label(dialog);
      label.text = labels[j];
      var combo = new ComboBox(dialog);
      for (var k = 0; k < windows.length; ++k) combo.addItem(windows[k].mainView.id);
      combo.currentItem = j % 2;
      selectors.push(combo);
      dialog.sizer.add(label);
      dialog.sizer.add(combo);
   }
   var run = new PushButton(dialog);
   run.text = 'Compare';
   run.onClick = function() { dialog.ok(); };
   var cancel = new PushButton(dialog);
   cancel.text = 'Cancel';
   cancel.onClick = function() { dialog.cancel(); };
   var buttons = new HorizontalSizer;
   buttons.addStretch();
   buttons.add(run);
   buttons.add(cancel);
   dialog.sizer.add(buttons);
   dialog.adjustToContents();
   if (!dialog.execute()) return;
   Console.show();
   var before = compareReplayPair(windows[selectors[0].currentItem], windows[selectors[1].currentItem], 'Before');
   var after = compareReplayPair(windows[selectors[2].currentItem], windows[selectors[3].currentItem], 'After');
   Console.writeln('\nBefore max abs: ' + before.toExponential(12) + '; After max abs: ' + after.toExponential(12));
   if (before === 0 && after > 0) Console.writeln('Identical input pixels, different process output: inspect process version, settings, internal mask/state and sample format.');
   else if (before > 0) Console.writeln('Inputs already differ. The first visible output difference does not establish where the workflow first diverged.');
   else Console.writeln('Both checkpoint pairs have identical nominal-channel pixels.');
}

try { diagnoseReplayDifference(); }
catch (error) { new MessageBox(error.message, 'AstroProcessAtlas - Difference', StdIcon_Error, StdButton_Ok).execute(); }
