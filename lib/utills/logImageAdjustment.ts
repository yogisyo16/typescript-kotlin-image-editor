import cv from "@techstark/opencv-js";

export function logImage(image: cv.Mat, text: string, score: number) {
  const testRow = 100;
  const testCols = 150;
  const testRow1 = 270;
  const testCols1 = 430;
  const testRow2 = 310;
  const testCols2 = 450;

  console.debug(text);
  const finalPixel = image.ucharPtr(testRow, testCols);
  const finalPixel1 = image.ucharPtr(testRow1, testCols1);
  const finalPixel2 = image.ucharPtr(testRow2, testCols2);
  const [B, G, R, A] = finalPixel;
  const [B1, G1, R1, A1] = finalPixel1;
  const [B2, G2, R2, A2] = finalPixel2;
  console.debug('Channels for ', text, ' with score ', score);
  console.debug(`Pixel Values: B=${B}, G=${G}, R=${R}, A=${A}`);
  // console.debug(`Pixel Values: B=${B1}, G=${G1}, R=${R1}, A=${A1}`);
  // console.debug(`Pixel Values: B=${B2}, G=${G2}, R=${R2}, A=${A2}`);
  console.log("-----------------------------------------------")
}

export function differImage(image:cv.Mat, text: string){
  
}

export function logImageRgba(image: cv.Mat, text: string) {
  const testRow = 300;
  const testCols = 610;
  const testRow1 = 270;
  const testCols1 = 430;
  const testRow2 = 310;
  const testCols2 = 450;

  console.debug(text);

  const finalPixel = image.ucharPtr(testRow, testCols);
  const finalPixel1 = image.ucharPtr(testRow1, testCols1);
  const finalPixel2 = image.ucharPtr(testRow2, testCols2);
  const [R, G, B, A] = finalPixel;
  const [R1, G1, B1, A1] = finalPixel1;
  const [R2, G2, B2, A2] = finalPixel2;
  console.debug('Channels for ', text, ' : ', image.channels());
  console.debug(`Pixel Values: R=${R}, G=${G}, B=${B}, A=${A}`);
  console.debug(`Pixel Values: R=${R1}, G=${G1}, B=${B1}, A=${A1}`);
  console.debug(`Pixel Values: R=${R2}, G=${G2}, B=${B2}, A=${A2}`);
  console.log("-----------------------------------------------")
}

export function logImageWH(image: cv.Mat, text: string) {
  if (!image || image.empty()) {
      console.warn(`Warning: ${text} - Image is null or empty.`);
      return;
  }

  const width = image.cols;
  const height = image.rows;
  console.log(`${text} - Image Width: ${width}, Height: ${height}`);

  // --- Getting the RGBA value of a specific pixel (e.g., at column 100, row 150) ---

  // Define the target pixel coordinates
  const targetCol = 100; // Your desired column (x-coordinate)
  const targetRow = 150; // Your desired row (y-coordinate)

  // Check if the coordinates are within image bounds
  if (targetCol >= width || targetRow >= height || targetCol < 0 || targetRow < 0) {
      console.warn(`Warning: Pixel coordinates (${targetCol}, ${targetRow}) are out of image bounds (${width}x${height}).`);
      return;
  }

  const channels = image.channels(); // Get the number of channels (e.g., 3 for BGR, 4 for BGRA)

  // Calculate the starting index for the target pixel in the image.data array
  // The data is stored row by row, and then channel by channel for each pixel.
  const pixelIndex = (targetRow * width + targetCol) * channels;

  let R, G, B, A;

  // OpenCV.js typically stores in BGR or BGRA order
  if (channels === 4) { // BGRA image
      B = image.data[pixelIndex];
      G = image.data[pixelIndex + 1];
      R = image.data[pixelIndex + 2];
      A = image.data[pixelIndex + 3];
  } else if (channels === 3) { // BGR image (no alpha)
      B = image.data[pixelIndex];
      G = image.data[pixelIndex + 1];
      R = image.data[pixelIndex + 2];
      A = 255; // Default to full opaque if no alpha channel
  } else if (channels === 1) { // Grayscale image
      R = G = B = image.data[pixelIndex];
      A = 255; // Default to full opaque
  } else {
      console.warn(`Warning: Unsupported number of channels (${channels}) for pixel access.`);
      return;
  }

  // Now you have the RGBA values for the pixel at (targetCol, targetRow)
  console.log(`Pixel at (${targetCol}, ${targetRow}):`);
  console.log(`  Red (R):   ${R}`);
  console.log(`  Green (G): ${G}`);
  console.log(`  Blue (B):  ${B}`);
  console.log(`  Alpha (A): ${A}`);

  const finalPixel = [R, G, B, A]; // Storing as an array if needed
  // You can also return this value if the function's purpose changes
  // return finalPixel;
}