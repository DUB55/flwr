# AI Photo Editor - Comprehensive Blueprint

## Project Overview

**Current State:**
- Expo Web PWA with React Native Web
- MediaPipe Selfie Segmentation for initial segmentation
- Custom brush system with add/remove/eraser
- Mask refinement with color propagation
- Blur engine (Gaussian, radial, diffusion)
- Dutch language default
- Dark theme with Apple Glassmorphism design
- Manual/AI mode toggle (manual default)

**Target State:**
- ONNX Runtime Web for local segmentation
- Probability mask system (not binary)
- Brush strokes as guidance signals (not direct edits)
- Edge-aware refinement (Sobel/Canny)
- Scribble-guided refinement
- Dual image upload mode (background reference)
- Image difference analysis
- shadcn/ui component library
- High-quality local processing (no cloud APIs)

---

## Phase 1: shadcn/ui Integration

### Tasks

#### 1.1 Install shadcn/ui Dependencies
- [ ] Install shadcn/ui CLI
- [ ] Install required dependencies (class-variance-authority, clsx, tailwind-merge, lucide-react)
- [ ] Configure tailwind.config.js for shadcn/ui
- [ ] Update app.json for Expo Web compatibility

#### 1.2 Configure shadcn/ui Components
- [ ] Set up components.json configuration
- [ ] Configure paths for components
- [ ] Configure Tailwind CSS for shadcn/ui
- [ ] Test basic component import

#### 1.3 Migrate Existing Components to shadcn/ui
- [ ] Replace AppleGlassCard with shadcn/ui Card
- [ ] Replace custom buttons with shadcn/ui Button
- [ ] Replace SettingsPanel with shadcn/ui components (Slider, Switch, Select)
- [ ] Update styling to use Tailwind CSS classes
- [ ] Test all migrated components

---

## Phase 2: ONNX Runtime Web Integration

### Tasks

#### 2.1 Install ONNX Runtime Web
- [ ] Install onnxruntime-web package
- [ ] Download/prepare ONNX segmentation model (e.g., DeepLabV3, U-Net)
- [ ] Store model in public/assets directory
- [ ] Configure model loading and caching

#### 2.2 Implement ONNX Segmentation Engine
- [ ] Create ONNXSegmentationEngine class
- [ ] Implement model loading with caching
- [ ] Implement preprocessing (resize, normalize)
- [ ] Implement inference execution
- [ ] Implement postprocessing (probability mask extraction)
- [ ] Replace MediaPipe with ONNX in App.tsx

#### 2.3 Probability Mask System
- [ ] Update MaskData type to support probability values (0-1 float)
- [ ] Update CanvasEditor to render probability masks
- [ ] Update blur engine to work with probability masks
- [ ] Update export to handle probability masks
- [ ] Test probability mask visualization

---

## Phase 3: Brush System Overhaul

### Tasks

#### 3.1 Separate Scribble Storage
- [ ] Create ScribbleData type separate from mask
- [ ] Store scribbles as guidance signals (not direct edits)
- [ ] Update ScribblePoint to include confidence/strength
- [ ] Update CanvasEditor to render scribbles separately from mask

#### 3.2 Implement Scribble-Guided Refinement
- [ ] Create ScribbleGuidedRefinement class
- [ ] Implement foreground hint processing
- [ ] Implement background hint processing
- [ ] Implement color-based expansion from scribbles
- [ ] Implement texture-based expansion
- [ ] Implement connectivity analysis

#### 3.3 Edge-Aware Refinement
- [ ] Implement Sobel edge detection
- [ ] Implement Canny edge detection (optional, higher quality)
- [ ] Create edge map from image
- [ ] Integrate edge stopping in refinement
- [ ] Prevent mask growth across strong edges
- [ ] Test edge preservation on flower petals and vase boundaries

#### 3.4 Update Apply Logic
- [ ] Remove direct mask editing from applyScribbles
- [ ] Implement guidance signal processing
- [ ] Combine probability mask + scribble hints + image features
- [ ] Generate refined probability mask
- [ ] Update handleApplyScribbles to use new pipeline

---

## Phase 4: Dual Image Upload Mode

### Tasks

#### 4.1 Update Image Upload Component
- [ ] Add mode selection (single image vs dual image)
- [ ] Add second image upload for background reference
- [ ] Add UI for dual image mode
- [ ] Add validation for dual image mode

#### 4.2 Implement Image Difference Analysis
- [ ] Create ImageDifferenceAnalyzer class
- [ ] Implement pixel-wise difference calculation
- [ ] Implement color difference analysis
- [ ] Implement texture difference analysis
- [ ] Generate difference mask
- [ ] Integrate difference mask into segmentation

#### 4.3 Update Segmentation Pipeline
- [ ] Add dual image mode to SegmentationEngine
- [ ] Use difference analysis when both images provided
- [ ] Combine difference mask with ONNX segmentation
- [ ] Test dual image mode quality improvement

---

## Phase 5: UI/UX Improvements

### Tasks

#### 5.1 Update UI with shadcn/ui
- [ ] Replace all custom components with shadcn/ui equivalents
- [ ] Implement shadcn/ui Dialog for settings
- [ ] Implement shadcn/ui Tooltip for button hints
- [ ] Implement shadcn/ui Progress for processing indicator
- [ ] Implement shadcn/ui Badge for mode indicators

#### 5.2 Add Processing Feedback
- [ ] Show probability mask visualization option
- [ ] Show edge map visualization option
- [ ] Show scribble overlay option
- [ ] Add processing stage indicators
- [ ] Add estimated time remaining

#### 5.3 Update Translations
- [ ] Add new UI elements to nl.csv
- [ ] Add new UI elements to en.csv
- [ ] Update i18n system for new features
- [ ] Test all translations

---

## Phase 6: Performance Optimization

### Tasks

#### 6.1 Optimize ONNX Inference
- [ ] Implement model quantization (INT8) for faster inference
- [ ] Implement Web Workers for non-blocking inference
- [ ] Implement progressive refinement (low-res to high-res)
- [ ] Cache intermediate results
- [ ] Test performance on various devices

#### 6.2 Optimize Canvas Rendering
- [ ] Implement offscreen canvas for processing
- [ ] Implement requestAnimationFrame for smooth rendering
- [ ] Optimize probability mask rendering
- [ ] Optimize edge map rendering
- [ ] Test rendering performance

---

## Phase 7: Testing & Quality Assurance

### Tasks

#### 7.1 Unit Tests
- [ ] Test ONNXSegmentationEngine
- [ ] Test ScribbleGuidedRefinement
- [ ] Test ImageDifferenceAnalyzer
- [ ] Test EdgeDetection
- [ ] Test all utility functions

#### 7.2 Integration Tests
- [ ] Test complete segmentation pipeline
- [ ] Test dual image mode
- [ ] Test manual vs AI mode
- [ ] Test edge preservation
- [ ] Test probability mask accuracy

#### 7.3 Manual Testing
- [ ] Test brush behavior (green expands intelligently)
- [ ] Test brush behavior (red removes intelligently)
- [ ] Test edge preservation (flower petals)
- [ ] Test edge preservation (vase boundaries)
- [ ] Test dual image mode quality
- [ ] Test performance on mobile devices
- [ ] Test PWA on iOS Safari
- [ ] Test export functionality

---

## Phase 8: Deployment

### Tasks

#### 8.1 Prepare for Production
- [ ] Optimize bundle size
- [ ] Configure Vercel deployment
- [ ] Test production build
- [ ] Verify PWA manifest
- [ ] Verify service worker

#### 8.2 Deploy
- [ ] Deploy to Vercel
- [ ] Test live deployment
- [ ] Monitor performance
- [ ] Fix any production issues

---

## Task Priority Matrix

### High Priority (Must Have)
1. shadcn/ui integration (Phase 1)
2. ONNX Runtime Web integration (Phase 2)
3. Probability mask system (Phase 2.3)
4. Brush system overhaul (Phase 3)
5. Edge-aware refinement (Phase 3.3)

### Medium Priority (Should Have)
1. Dual image upload mode (Phase 4)
2. Image difference analysis (Phase 4.2)
3. UI/UX improvements (Phase 5)
4. Performance optimization (Phase 6)

### Low Priority (Nice to Have)
1. Comprehensive testing (Phase 7)
2. Production deployment (Phase 8)

---

## Dependencies

### Phase Dependencies
- Phase 2 (ONNX) must complete before Phase 3 (Brush Overhaul)
- Phase 3 must complete before Phase 4 (Dual Image)
- Phase 1 (shadcn/ui) can be done in parallel with Phase 2
- Phase 5 (UI) depends on Phase 1 and Phase 2-4
- Phase 6 (Performance) depends on Phase 2-4
- Phase 7 (Testing) depends on all previous phases
- Phase 8 (Deployment) depends on all previous phases

---

## Estimated Timeline

- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 4-5 days
- Phase 4: 2-3 days
- Phase 5: 2-3 days
- Phase 6: 2-3 days
- Phase 7: 2-3 days
- Phase 8: 1-2 days

**Total Estimated Time: 18-26 days**

---

## Success Criteria

The project is considered successful when:

1. **ONNX Integration**: Segmentation runs locally using ONNX Runtime Web with no cloud APIs
2. **Probability Masks**: System uses probability values (0-1) instead of binary masks
3. **Brush Behavior**: 
   - Green brush intelligently expands to related structures
   - Red brush intelligently removes connected regions
   - Brush strokes act as guidance signals, not direct edits
4. **Edge Preservation**: Flower petals and vase edges are preserved without background leakage
5. **Dual Image Mode**: Background reference mode improves segmentation quality
6. **shadcn/ui**: All UI components use shadcn/ui library
7. **Performance**: Processing runs smoothly on mobile devices
8. **PWA**: Works as standalone PWA on iOS Safari
