"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Script from "next/script";
import { HonchoEditorClass } from "@/lib/HonchoEditorImpl";
import { Config } from "@/lib/HonchoEditor";
import cv from "@techstark/opencv-js";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HonchoEditorClass | null>(null);
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalMat, setOriginalMat] = useState<cv.Mat | null>(null); // Store original cv.Mat
  const [adjustments, setAdjustments] = useState<Config>({
    Exposure: 0,
    Temperature: 0,
    Tint: 0,
    Highlights: 0,
    Shadow: 0,
    Black: 0,
    White: 0,
    Contrast: 0,
    Saturation: 0,
    Vibrance: 0,
  });

  const onOpenCVLoad = useCallback(() => {
    setIsCvLoaded(true);
  }, []);

  const resizeMatToFit = (mat: cv.Mat, targetWidth: number, targetHeight: number): cv.Mat => {
    if (!mat || mat.empty()) {
      console.error("Invalid or empty Mat");
      return new cv.Mat();
    }

    const width = mat.cols;
    const height = mat.rows;

    // Calculate aspect ratio
    const aspectRatio = width / height;
    const targetAspectRatio = targetWidth / targetHeight;

    let newWidth: number, newHeight: number;

    // Fit to width or height while preserving aspect ratio
    if (aspectRatio > targetAspectRatio) {
      // Image is wider than target, fit to width
      newWidth = targetWidth;
      newHeight = Math.round(targetWidth / aspectRatio);
    } else {
      // Image is taller than target, fit to height
      newHeight = targetHeight;
      newWidth = Math.round(targetHeight * aspectRatio);
    }

    // Create destination Mat
    const resizedMat = new cv.Mat();
    const dsize = new cv.Size(newWidth, newHeight);
    cv.resize(mat, resizedMat, dsize, 0, 0, cv.INTER_AREA);

    return resizedMat;
  };

  // Handle file upload
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const img = new Image();
    img.onload = () => {
      if (isCvLoaded) {
        const mat = cv.imread(img);
        const resizedMat = resizeMatToFit(mat, 360, 180);
        setOriginalMat(mat); // Store cv.Mat
        if (!editorRef.current) {
          editorRef.current = new HonchoEditorClass(mat);
          setAdjustments({
            Exposure: editorRef.current.getConfig().Exposure,
            Temperature: editorRef.current.getConfig().Temperature,
            Tint: editorRef.current.getConfig().Tint,
            Highlights: editorRef.current.getConfig().Highlights,
            Shadow: editorRef.current.getConfig().Shadow,
            Black: editorRef.current.getConfig().Black,
            White: editorRef.current.getConfig().White,
            Contrast: editorRef.current.getConfig().Contrast,
            Saturation: editorRef.current.getConfig().Saturation,
            Vibrance: editorRef.current.getConfig().Vibrance,
          });
        }
        setImageLoaded(true);
      }
    };
    img.src = URL.createObjectURL(file);
  }, [isCvLoaded]);

  // Apply adjustments
  useEffect(() => {
    if (editorRef.current && isCvLoaded && imageLoaded && canvasRef.current && originalMat) {
      editorRef.current
        .adjust_image_colors_merge(
          adjustments.Exposure,
          adjustments.Temperature,
          adjustments.Tint,
          adjustments.Highlights,
          adjustments.Shadow,
          adjustments.Black,
          adjustments.White,
          adjustments.Contrast,
          adjustments.Saturation,
          adjustments.Vibrance,
          originalMat
        )
        .then((resultMat) => {
          cv.imshow(canvasRef.current!, resultMat);
          resultMat.delete(); // Clean up
        })
        .catch((err) => console.error("Adjustment error:", err));
    }
  }, [adjustments, isCvLoaded, imageLoaded, originalMat]);

  const saveHistory = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.configHistotrypush();
    }
  }, []);

  const handleReset = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.reset();
      setAdjustments({
        Exposure: editorRef.current.getConfig().Exposure,
        Temperature: editorRef.current.getConfig().Temperature,
        Tint: editorRef.current.getConfig().Tint,
        Highlights: editorRef.current.getConfig().Highlights,
        Shadow: editorRef.current.getConfig().Shadow,
        Black: editorRef.current.getConfig().Black,
        White: editorRef.current.getConfig().White,
        Contrast: editorRef.current.getConfig().Contrast,
        Saturation: editorRef.current.getConfig().Saturation,
        Vibrance: editorRef.current.getConfig().Vibrance,
      });
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.undo().then(() => {
        setAdjustments({
          Exposure: editorRef.current!.getConfig().Exposure,
          Temperature: editorRef.current!.getConfig().Temperature,
          Tint: editorRef.current!.getConfig().Tint,
          Highlights: editorRef.current!.getConfig().Highlights,
          Shadow: editorRef.current!.getConfig().Shadow,
          Black: editorRef.current!.getConfig().Black,
          White: editorRef.current!.getConfig().White,
          Contrast: editorRef.current!.getConfig().Contrast,
          Saturation: editorRef.current!.getConfig().Saturation,
          Vibrance: editorRef.current!.getConfig().Vibrance,
        });
      });
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.redo().then(() => {
        setAdjustments({
          Exposure: editorRef.current!.getConfig().Exposure,
          Temperature: editorRef.current!.getConfig().Temperature,
          Tint: editorRef.current!.getConfig().Tint,
          Highlights: editorRef.current!.getConfig().Highlights,
          Shadow: editorRef.current!.getConfig().Shadow,
          Black: editorRef.current!.getConfig().Black,
          White: editorRef.current!.getConfig().White,
          Contrast: editorRef.current!.getConfig().Contrast,
          Saturation: editorRef.current!.getConfig().Saturation,
          Vibrance: editorRef.current!.getConfig().Vibrance,
        });
      });
    }
  }, []);

  const handleAdjustmentChange = useCallback((key: keyof Config, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div>
      <Script
        src="https://docs.opencv.org/4.10.0/opencv.js"
        strategy="afterInteractive"
        onLoad={onOpenCVLoad}
      />
      <main className="flex min-h-screen flex-col items-center mt-4">
        <h1 className="text-3xl">Honcho</h1>
        {!isCvLoaded && <p>Loading OpenCV.js...</p>}
        {isCvLoaded && (
          <div>
            <div className="flex flex-row items-center">
              <div className="flex flex-col mr-4 items-start">
                <label>
                  Upload Image:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
                <div className="flex gap-2 mt-2">
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleReset}
                  >
                    Reset
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleUndo}
                  >
                    Undo
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleRedo}
                  >
                    Redo
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="ml-4">
                  <label>
                    Exposure: {adjustments.Exposure}
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={adjustments.Exposure}
                      onChange={(e) => handleAdjustmentChange("Exposure", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Temperature: {adjustments.Temperature}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Temperature}
                      onChange={(e) => handleAdjustmentChange("Temperature", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Tint: {adjustments.Tint}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Tint}
                      onChange={(e) => handleAdjustmentChange("Tint", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Highlights: {adjustments.Highlights}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Highlights}
                      onChange={(e) => handleAdjustmentChange("Highlights", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Shadows: {adjustments.Shadow}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Shadow}
                      onChange={(e) => handleAdjustmentChange("Shadow", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Blacks: {adjustments.Black}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Black}
                      onChange={(e) => handleAdjustmentChange("Black", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Whites: {adjustments.White}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.White}
                      onChange={(e) => handleAdjustmentChange("White", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Contrast: {adjustments.Contrast}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Contrast}
                      onChange={(e) => handleAdjustmentChange("Contrast", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Saturation: {adjustments.Saturation}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Saturation}
                      onChange={(e) => handleAdjustmentChange("Saturation", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Vibrance: {adjustments.Vibrance}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Vibrance}
                      onChange={(e) => handleAdjustmentChange("Vibrance", Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <div>
                <h3 className="text-sm">Original</h3>
                {/* Render original image from originalMat */}
                <canvas
                  ref={(el) => {
                    if (el && originalMat) {
                      cv.imshow(el, originalMat);
                    }
                  }}
                  width={360}
                  height={180}
                />
              </div>
              <div>
                <h3 className="text-sm">Processed</h3>
                <canvas ref={canvasRef} width={360} height={180} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}