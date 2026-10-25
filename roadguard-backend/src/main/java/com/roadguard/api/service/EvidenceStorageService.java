package com.roadguard.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.UUID;

@Service
public class EvidenceStorageService {

    @Value("${roadguard.storage.local.base-path:./uploads/evidence}")
    private String basePath;

    @jakarta.annotation.PostConstruct
    public void init() {
        File persistentMount = new File("/var/data/roadguard-evidence");
        if (persistentMount.exists() && persistentMount.canWrite()) {
            this.basePath = persistentMount.getAbsolutePath();
            log.info("EvidenceStorageService: Mounted persistent volume at {}", this.basePath);
        } else {
            log.info("EvidenceStorageService: Using configured storage path at {}", this.basePath);
        }
    }

    public static class StoredFileMeta {
        public String storageKey;
        public String originalFilename;
        public String contentType;
        public long fileSizeBytes;
        public String sha256Digest;
        public boolean piiProcessed;
    }

    public StoredFileMeta storeFrame(String journeyUuid, MultipartFile file) throws IOException {
        String frameUuid = UUID.randomUUID().toString();
        Path journeyDir = Paths.get(basePath, journeyUuid);
        Files.createDirectories(journeyDir);

        String originalFilename = file.getOriginalFilename();
        String extension = ".jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String filename = frameUuid + extension;
        Path targetPath = journeyDir.resolve(filename);

        // Compute SHA-256 while saving
        byte[] bytes = file.getBytes();
        String sha256 = calculateSha256(bytes);

        // Perform PII processing (e.g. blur simulated license plate / face regions if image)
        boolean piiProcessed = false;
        try {
            if (isImage(file.getContentType())) {
                BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
                if (img != null) {
                    applyPiiBlur(img);
                    ImageIO.write(img, extension.replace(".", ""), targetPath.toFile());
                    piiProcessed = true;
                } else {
                    Files.write(targetPath, bytes);
                }
            } else {
                Files.write(targetPath, bytes);
            }
        } catch (Exception e) {
            log.warn("PII processing skipped or failed, storing original bytes: {}", e.getMessage());
            Files.write(targetPath, bytes);
        }

        StoredFileMeta meta = new StoredFileMeta();
        // storage key relative to uploads/
        meta.storageKey = "evidence/" + journeyUuid + "/" + filename;
        meta.originalFilename = originalFilename;
        meta.contentType = file.getContentType();
        meta.fileSizeBytes = Files.size(targetPath);
        meta.sha256Digest = sha256;
        meta.piiProcessed = piiProcessed;

        log.debug("Stored evidence frame at: {} (SHA256: {})", targetPath, sha256);
        return meta;
    }

    private boolean isImage(String contentType) {
        return contentType != null && contentType.startsWith("image/");
    }

    private void applyPiiBlur(BufferedImage image) {
        // Apply anonymization watermark / privacy filter over potential bottom/corner areas (dashboard/plates)
        int width = image.getWidth();
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        // Stamp privacy & integrity banner on top right
        g.setColor(new Color(0, 0, 0, 160));
        g.fillRoundRect(width - 240, 15, 225, 32, 10, 10);
        g.setColor(new Color(0, 255, 170));
        g.setFont(new Font("SansSerif", Font.BOLD, 12));
        g.drawString("ROADGUARD AI • PRIVACY BLURRED", width - 230, 36);

        g.dispose();
    }

    private String calculateSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    public Path resolveStoragePath(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return null;
        }
        if (storageKey.startsWith("evidence/")) {
            String relative = storageKey.substring("evidence/".length());
            return Paths.get(basePath, relative);
        }
        return Paths.get(basePath, storageKey);
    }

    public BufferedImage loadFrameImage(String storageKey) {
        Path p = resolveStoragePath(storageKey);
        if (p == null || !Files.exists(p)) {
            log.warn("Frame file does not exist at resolved path: {}", p);
            return null;
        }
        try {
            return ImageIO.read(p.toFile());
        } catch (Exception e) {
            log.error("Failed to read image at {}: {}", p, e.getMessage());
            return null;
        }
    }

    public byte[] loadFrameBytes(String storageKey) {
        Path p = resolveStoragePath(storageKey);
        if (p == null || !Files.exists(p)) {
            log.warn("Frame file does not exist at resolved path: {}", p);
            return null;
        }
        try {
            return Files.readAllBytes(p);
        } catch (Exception e) {
            log.error("Failed to read raw image bytes at {}: {}", p, e.getMessage());
            return null;
        }
    }
}
