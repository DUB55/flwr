# AI Photo Editor - Local PWA for iOS

A client-side AI photo editor that runs entirely in the browser as a Progressive Web App (PWA) on iOS. Features portrait segmentation, scribble-guided mask refinement, and background blur processing - all without APIs or server-side processing.

## Features

- **Local AI Segmentation**: Uses MediaPipe Selfie Segmentation for subject detection
- **Scribble Guidance**: Draw green/red strokes to refine the mask
- **Smart Refinement**: Color propagation, edge detection, and morphological smoothing
- **Background Blur**: Gaussian, radial (portrait-style), and diffusion blur options
- **Subject Enhancement**: Sharpening, contrast, and exposure adjustments
- **100% Offline**: No APIs, no data leaves your device
- **PWA Support**: Installable on iOS Safari

## Tech Stack

- **Frontend**: React Native (Expo) with Web support
- **AI**: MediaPipe Selfie Segmentation (browser-based)
- **Processing**: Canvas API for image manipulation
- **Deployment**: Vercel (free tier, static build)

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run web

# Build for production
npm run build:web
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Set build command: `npm run build:web`
4. Set output directory: `dist`
5. Deploy

The app will be built as a static site and deployed to Vercel's CDN.

## iOS Installation

1. Open Safari on your iPhone
2. Navigate to your deployed Vercel URL
3. Tap the Share button
4. Select "Add to Home Screen"
5. The app will install as a PWA

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│  (Image Upload → Canvas Editor → Settings Panel)       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              MediaPipe Segmentation Engine              │
│         (Detects foreground/background)                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Mask Refinement Engine                      │
│  (Scribble guidance → Color propagation → Smoothing)   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 Blur Processing Engine                   │
│  (Gaussian/Radial/Diffusion + Subject enhancement)      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Export System                         │
│           (HD JPEG/PNG output)                          │
└─────────────────────────────────────────────────────────┘
```

## Performance Notes

- Images are resized to max 1024x1024 for AI processing
- Segmentation takes 1-3 seconds on iOS devices
- Canvas operations are optimized for mobile performance
- Memory usage is managed by processing at reduced resolution

## Limitations

- Not Photoshop-perfect cutouts (requires user guidance)
- No real depth sensor data (simulated portrait effect)
- Best results with clear subject-background separation
- Performance varies by device capability

## License

MIT
