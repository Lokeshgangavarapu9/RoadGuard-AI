package com.roadguard.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Service for strict image quality gating, magic-byte verification,
 * Laplacian variance sharpness scoring, grayscale luminance analysis,
 * and SHA-256 cryptographic provenance hashing.
 */
@Service
public class ImageQualityService {

    private static final Logger log = LoggerFactory.getLogger(ImageQualityService.class);

    public static final long MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
    public static final int MIN_WIDTH = 320;
    public static final int MIN_HEIGHT = 240;
    public static final double MIN_BRIGHTNESS = 35.0;
    public static final double MAX_BRIGHTNESS = 240.0;
    public static final double MIN_SHARPNESS_LAPLACIAN = 85.0;

    public record ImageQualityResult(
        boolean valid,
        String qualityStatus,
        double sharpnessScore,
        double brightnessScore,
        String sha256Hex,
        int width,
        int height,
        String rejectionReason
    ) {}

    public record QualityAssessment(
        String status,
        boolean suitableForInference,
        int width,
        int height,
        double sharpnessLaplacianVar,
        double meanBrightness,
        String sha256Hex,
        String rejectionReason
    ) {
        public static QualityAssessment from(ImageQualityResult result) {
            if (result == null) {
                return new QualityAssessment("EMPTY", false, 0, 0, 0.0, 0.0, "", "Null result");
            }
            return new QualityAssessment(
                result.qualityStatus(),
                result.valid(),
                result.width(),
                result.height(),
                result.sharpnessScore(),
                result.brightnessScore(),
                result.sha256Hex(),
                result.rejectionReason()
            );
        }
    }

    public QualityAssessment assessImage(byte[] imageBytes) {
        return QualityAssessment.from(evaluateQuality(imageBytes));
    }

    /**
     * Inspects image bytes against magic headers, resolution, luminance, and blur.
     */
    public ImageQualityResult evaluateQuality(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            return new ImageQualityResult(false, "EMPTY_PAYLOAD", 0.0, 0.0, "", 0, 0, "Image payload is empty");
        }

        if (imageBytes.length > MAX_FILE_SIZE_BYTES) {
            return new ImageQualityResult(false, "PAYLOAD_TOO_LARGE", 0.0, 0.0, computeSha256(imageBytes), 0, 0,
                "File size exceeds maximum allowable limit of 10 MB");
        }

        String format = detectMagicBytesFormat(imageBytes);
        if (format == null) {
            return new ImageQualityResult(false, "INVALID_FORMAT", 0.0, 0.0, computeSha256(imageBytes), 0, 0,
                "Invalid file magic bytes: expected JPEG, PNG, or WebP");
        }

        String sha256 = computeSha256(imageBytes);

        BufferedImage img;
        try (ByteArrayInputStream bais = new ByteArrayInputStream(imageBytes)) {
            img = ImageIO.read(bais);
        } catch (IOException e) {
            return new ImageQualityResult(false, "CORRUPT_IMAGE", 0.0, 0.0, sha256, 0, 0,
                "Failed to decode image pixels: " + e.getMessage());
        }

        if (img == null) {
            return new ImageQualityResult(false, "DECODE_FAILED", 0.0, 0.0, sha256, 0, 0,
                "Unsupported image format or corrupt headers");
        }

        int width = img.getWidth();
        int height = img.getHeight();

        if (width < MIN_WIDTH || height < MIN_HEIGHT) {
            return new ImageQualityResult(false, "RESOLUTION_TOO_LOW", 0.0, 0.0, sha256, width, height,
                String.format("Resolution %dx%d is below minimum required %dx%d", width, height, MIN_WIDTH, MIN_HEIGHT));
        }

        // Grayscale conversion & luminance measurement
        double brightness = calculateMeanBrightness(img);
        if (brightness < MIN_BRIGHTNESS) {
            return new ImageQualityResult(false, "DARK", 0.0, brightness, sha256, width, height,
                String.format("Image is underexposed/too dark (brightness: %.1f < %.1f)", brightness, MIN_BRIGHTNESS));
        }
        if (brightness > MAX_BRIGHTNESS) {
            return new ImageQualityResult(false, "OVEREXPOSED", 0.0, brightness, sha256, width, height,
                String.format("Image is overexposed/washed out (brightness: %.1f > %.1f)", brightness, MAX_BRIGHTNESS));
        }

        // Laplacian variance sharpness
        double sharpness = calculateLaplacianVariance(img);
        if (sharpness < MIN_SHARPNESS_LAPLACIAN) {
            log.debug("Image rejected for blur: sharpness={}, threshold={}", sharpness, MIN_SHARPNESS_LAPLACIAN);
            return new ImageQualityResult(false, "BLURRY", sharpness, brightness, sha256, width, height,
                String.format("Image is motion blurred or out of focus (sharpness: %.1f < %.1f)", sharpness, MIN_SHARPNESS_LAPLACIAN));
        }

        log.debug("Image passed quality gate: sharpness={}, brightness={}", sharpness, brightness);
        return new ImageQualityResult(true, "CLEAR", sharpness, brightness, sha256, width, height, null);
    }

    /**
     * Verifies JPEG (FF D8 FF), PNG (89 50 4E 47), or WebP (RIFF....WEBP) headers.
     */
    public String detectMagicBytesFormat(byte[] bytes) {
        if (bytes == null || bytes.length < 12) return null;

        // JPEG: FF D8 FF
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "JPEG";
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if ((bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50 &&
            (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47) {
            return "PNG";
        }
        // WebP: RIFF ... WEBP
        if ((bytes[0] & 0xFF) == 'R' && (bytes[1] & 0xFF) == 'I' &&
            (bytes[2] & 0xFF) == 'F' && (bytes[3] & 0xFF) == 'F' &&
            (bytes[8] & 0xFF) == 'W' && (bytes[9] & 0xFF) == 'E' &&
            (bytes[10] & 0xFF) == 'B' && (bytes[11] & 0xFF) == 'P') {
            return "WEBP";
        }

        return null;
    }

    /**
     * Computes the mean grayscale brightness across all pixels [0.0, 255.0].
     */
    public double calculateMeanBrightness(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        double totalLuminance = 0;
        int count = 0;

        // Downsample slightly for speed if image is massive (> 1080p)
        int step = (w * h > 2000000) ? 2 : 1;

        for (int y = 0; y < h; y += step) {
            for (int x = 0; x < w; x += step) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                // Standard Rec. 601 ITU luminance coefficients
                double yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                totalLuminance += yVal;
                count++;
            }
        }

        return count > 0 ? (totalLuminance / count) : 0.0;
    }

    /**
     * Calculates Laplacian variance on grayscale image.
     * Uses standard discrete 3x3 Laplacian operator:
     * [ 0,  1,  0 ]
     * [ 1, -4,  1 ]
     * [ 0,  1,  0 ]
     */
    public double calculateLaplacianVariance(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();

        // Convert to 2D grayscale array
        float[][] gray = new float[h][w];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                gray[y][x] = (float) (0.299 * r + 0.587 * g + 0.114 * b);
            }
        }

        double sum = 0.0;
        double sumSq = 0.0;
        int count = 0;

        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                float lap = gray[y - 1][x] + gray[y + 1][x] + gray[y][x - 1] + gray[y][x + 1] - 4.0f * gray[y][x];
                sum += lap;
                sumSq += (lap * lap);
                count++;
            }
        }

        if (count <= 1) return 0.0;
        double mean = sum / count;
        double variance = (sumSq / count) - (mean * mean);
        return Math.max(0.0, variance);
    }

    /**
     * Deterministic lowercase 64-character SHA-256 hex string.
     */
    public String computeSha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm missing", e);
        }
    }
}
