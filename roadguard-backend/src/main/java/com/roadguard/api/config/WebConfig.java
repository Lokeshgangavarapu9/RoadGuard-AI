package com.roadguard.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * Web MVC configuration.
 *
 * <p>Serves uploaded evidence files from the local filesystem
 * via the /uploads/** URL prefix. In Stage B, this will be
 * replaced by MinIO pre-signed URL generation.</p>
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${roadguard.storage.local.base-path:./uploads/evidence}")
    private String localStoragePath;

    @Value("${roadguard.cors.allowed-origins:http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(@org.springframework.lang.NonNull org.springframework.web.servlet.config.annotation.CorsRegistry registry) {
        String[] origins = (allowedOrigins != null) ? allowedOrigins : new String[0];
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedOriginPatterns("https://*.vercel.app")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers")
                .exposedHeaders("Content-Disposition", "X-Request-Id")
                .allowCredentials(true)
                .maxAge(3600);

        registry.addMapping("/uploads/**")
                .allowedOrigins(origins)
                .allowedOriginPatterns("https://*.vercel.app")
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type", "Accept", "Origin")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(@org.springframework.lang.NonNull ResourceHandlerRegistry registry) {
        // Serve evidence files from local filesystem
        File uploadDir = new File(localStoragePath);
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }
        File parentDir = uploadDir.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }

        String parentPath = (parentDir != null ? parentDir : uploadDir).getAbsolutePath().replace("\\", "/");
        if (!parentPath.endsWith("/")) {
            parentPath += "/";
        }
        String uploadPath = uploadDir.getAbsolutePath().replace("\\", "/");
        if (!uploadPath.endsWith("/")) {
            uploadPath += "/";
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:///" + parentPath, "file:///" + uploadPath)
                .setCachePeriod(3600);

        // Serve static frontend (if embedded in JAR — optional)
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/")
                .setCachePeriod(86400);
    }
}
