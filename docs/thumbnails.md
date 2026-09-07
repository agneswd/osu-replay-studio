# Thumbnail editor

Choose **Thumbnail** in the top bar. Before import, the preview shows a gray frame and an **Open replay** button.
The sidebar and toolbar stay visible with replay controls disabled. The editor uses the replay's player, beatmap, score, mods, and background.
Choose the CPOL or Clean template. All controls use HeroUI.

![Thumbnail editor](images/thumbnail-editor.png)

Drag elements and resize them with corner handles, as in the video layout editor.
Double-click text to edit it directly in the preview. Changes appear as you type. Press Enter to accept or Escape to cancel.
Use arrow keys to move one design pixel. Hold Shift for ten pixels.
Right-click for reset, visibility, and layer order. Alt-click cycles through overlapping elements.
The context menu can select hidden or off-canvas elements.

The editing controls sit below the preview. Use **Add text** for a custom caption. Change its color and font size in the selected-element controls.
For bottom text, select words in the text field and choose **Accent selection**.
Undo and redo keep one drag or resize as one action. Ctrl+Z undoes; Ctrl+Shift+Z redoes.
Scroll the mouse wheel to zoom. Drag with the middle mouse button to pan. **Fit** restores the canvas view.

Edits save locally for each replay path. Switching tabs keeps both editors' state.
Saved styles keep appearance and placement, but omit replay text and status overrides.
Applying a style replaces the current thumbnail edits. Undo restores them.

Choose a PNG resolution from 720p through 4K, then select **Export PNG** at the bottom right.
The preview and export use the same thumbnail component and document.
Export saves to the configured output folder. Fonts and flag artwork are bundled locally.

## Replay status

The analyzer separates slider breaks from ordinary misses and dropped slider tails.
For stable plays, a completely missed slider counts as a miss rather than an additional slider break.
Failed heads, ticks, and repeats on partially hit sliders count as slider breaks.

Automatic FC requires a complete play, matching reconstructed hit counts, no misses, and no slider breaks.
Dropped tails can reduce maximum combo without preventing this community definition of FC.
The analyzer also retains whether the play achieved the map's maximum combo.
An incomplete play or an analysis mismatch does not automatically receive FC.
Use the status controls to override the thumbnail label without changing the replay analysis.

The editor and template code are adapted from [osu! Thumbnailer](https://github.com/purnac501/osu-thumbnailer).
The port uses Replay Studio's desktop export and replay analysis instead of Thumbnailer's web API and image export service.
