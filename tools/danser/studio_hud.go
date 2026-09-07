package states

import (
	"bufio"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"github.com/go-gl/gl/v3.3-core/gl"
	"github.com/go-gl/mathgl/mgl32"
	"github.com/wieku/danser-go/app/settings"
	"github.com/wieku/danser-go/framework/graphics/blend"
	"github.com/wieku/danser-go/framework/graphics/buffer"
	"github.com/wieku/danser-go/framework/graphics/texture"
	"github.com/wieku/danser-go/framework/math/color"
	"github.com/wieku/danser-go/framework/math/vector"
	"io"
	"math"
	"os"
)

type studioSprite struct {
	Asset      int
	X, Y, W, H float64
	Color      [4]float32
	Clip       []float64
}
type studioTickPlacement struct {
	X, Y, Scale float64
	After       int
}
type studioFrame struct {
	Sprites, Ticks []studioSprite
	TickPlacement  *studioTickPlacement
}
type studioData struct {
	FPS, Speed float64
	Assets     []string
	Frames     string
}
type studioRenderer struct {
	data    studioData
	file    *os.File
	zip     *gzip.Reader
	decoder *json.Decoder
	frame   studioFrame
	index   int
	eof     bool
	regions []*texture.TextureRegion
	ticks   *buffer.Framebuffer
}

var studioLoaded bool
var studioHUD *studioRenderer

func init() {
	if os.Getenv("STUDIO_NATIVE_PROBE") == "1" {
		fmt.Println("STUDIO_NATIVE_HUD 1")
		fmt.Println("STUDIO_LAYOUT 1")
	}
}

// Read one frame at a time. Long replays do not keep every draw command in memory.
func loadStudioHUD(file string) *studioRenderer {
	r := &studioRenderer{index: -1}
	data, err := os.ReadFile(file)
	if err != nil {
		panic(err)
	}
	if err = json.Unmarshal(data, &r.data); err != nil {
		panic(err)
	}
	if r.data.FPS <= 0 || r.data.Speed <= 0 {
		panic("Invalid native HUD clock")
	}
	r.file, err = os.Open(r.data.Frames)
	if err != nil {
		panic(err)
	}
	r.zip, err = gzip.NewReader(r.file)
	if err != nil {
		panic(err)
	}
	r.decoder = json.NewDecoder(bufio.NewReaderSize(r.zip, 256*1024))
	atlas := texture.NewTextureAtlas(4096, 1)
	for _, asset := range r.data.Assets {
		pix, err := texture.NewPixmapFileString(asset)
		if err != nil {
			panic(err)
		}
		region := atlas.AddTexture(asset, pix.Width, pix.Height, pix.Data)
		pix.Dispose()
		if region == nil {
			panic("Native HUD texture exceeds atlas size")
		}
		r.regions = append(r.regions, region)
	}
	r.ticks = buffer.NewFrame(768, 64, true, false)
	fmt.Printf("STUDIO HUD ready: %d assets\n", len(r.regions))
	return r
}
func (player *Player) drawStudioHUD() {
	if !studioLoaded {
		studioLoaded = true
		if file := os.Getenv("STUDIO_NATIVE_HUD"); file != "" {
			studioHUD = loadStudioHUD(file)
		}
	}
	r := studioHUD
	if r == nil {
		return
	}
	index := int(math.Round(player.progressMsF / r.data.Speed * r.data.FPS / 1000))
	if index < 0 {
		index = 0
	}
	for r.index < index && !r.eof {
		var frame studioFrame
		err := r.decoder.Decode(&frame)
		if err == io.EOF {
			r.eof = true
			r.zip.Close()
			r.file.Close()
			break
		}
		if err != nil {
			panic(err)
		}
		r.frame = frame
		r.index++
	}
	b := player.batch
	draw := func(items []studioSprite, sx, sy, height float64) {
		for _, s := range items {
			if s.Asset < 0 || s.Asset >= len(r.regions) {
				panic("Invalid native HUD asset")
			}
			if s.W <= 0 || s.H <= 0 || s.Color[3] <= 0 {
				continue
			}
			if len(s.Clip) == 4 {
				b.Flush()
				gl.Enable(gl.SCISSOR_TEST)
				gl.Scissor(int32(math.Floor(s.Clip[0]*sx)), int32(math.Floor((height-s.Clip[1]-s.Clip[3])*sy)), int32(math.Ceil(s.Clip[2]*sx)), int32(math.Ceil(s.Clip[3]*sy)))
			}
			region := r.regions[s.Asset]
			b.DrawStObject(vector.NewVec2d(s.X, s.Y), vector.TopLeft, vector.NewVec2d(s.W/float64(region.Width), s.H/float64(region.Height)), false, false, 0, color.NewRGBA(s.Color[0], s.Color[1], s.Color[2], s.Color[3]), false, *region)
			if len(s.Clip) == 4 {
				b.Flush()
				gl.Disable(gl.SCISSOR_TEST)
			}
		}
	}
	b.ResetTransform()
	b.SetColor(1, 1, 1, 1)
	b.SetAdditive(false)
	b.SetCamera(mgl32.Ortho(0, 1920, 1080, 0, 1, -1))
	b.Begin()
	split := len(r.frame.Sprites)
	placement := r.frame.TickPlacement
	if placement != nil {
		split = max(0, min(placement.After, split))
	}
	draw(r.frame.Sprites[:split], settings.Graphics.GetWidthF()/1920, settings.Graphics.GetHeightF()/1080, 1080)
	b.End()
	if len(r.frame.Ticks) > 0 {
		var viewport [4]int32
		gl.GetIntegerv(gl.VIEWPORT, &viewport[0])
		r.ticks.Bind()
		r.ticks.ClearColor(0, 0, 0, 0)
		gl.Viewport(0, 0, 768, 64)
		b.SetCamera(mgl32.Ortho(0, 384, 32, 0, 1, -1))
		b.Begin()
		blend.SetFunction(blend.One, blend.One)
		draw(r.frame.Ticks, 2, 2, 32)
		b.End()
		r.ticks.Unbind()
		gl.Viewport(viewport[0], viewport[1], viewport[2], viewport[3])
		b.SetCamera(mgl32.Ortho(0, 1920, 1080, 0, 1, -1))
		b.Begin()
		b.SetPremultiplied(true)
		x, y, scale := 768.0, 1028.0, .5
		if placement != nil {
			x, y, scale = placement.X, placement.Y, placement.Scale*.5
		}
		b.DrawStObject(vector.NewVec2d(x, y), vector.TopLeft, vector.NewVec2d(scale, scale), false, true, 0, color.NewRGBA(1, 1, 1, 1), false, r.ticks.Texture().GetRegion())
		b.SetPremultiplied(false)
		b.End()
	}
	if split < len(r.frame.Sprites) {
		b.Begin()
		draw(r.frame.Sprites[split:], settings.Graphics.GetWidthF()/1920, settings.Graphics.GetHeightF()/1080, 1080)
		b.End()
	}
	b.ResetTransform()
	b.SetColor(1, 1, 1, 1)
}

// Studio controls the video fades. Keep the gameplay background at its selected dim.
func studioBackgroundAlpha(value float64) float64 {
	if os.Getenv("STUDIO_NATIVE_FRAME_LIMIT") != "" {
		return 1 - settings.Playfield.Background.Dim.Normal
	}
	return value
}
