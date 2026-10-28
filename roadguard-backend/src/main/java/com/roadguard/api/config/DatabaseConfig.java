package com.roadguard.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;

/**
 * Production-ready DataSource configuration.
 * Normalizes cloud-provider PostgreSQL URLs (such as Render/Heroku connection strings
 * formatted as postgres://user:pass@host:port/db) into standard JDBC URLs (jdbc:postgresql://...).
 */
@Configuration
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    public record NormalizedDbConfig(
        String url,
        String driverClassName,
        String username,
        String password
    ) {}

    public static NormalizedDbConfig normalize(String rawUrl, String rawUsername, String rawPassword) {
        // 1. If rawUrl is null or empty, check environment or fallback to local H2
        if (!StringUtils.hasText(rawUrl)) {
            String defaultH2 = "jdbc:h2:mem:roadguarddb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL";
            return new NormalizedDbConfig(
                defaultH2,
                "org.h2.Driver",
                StringUtils.hasText(rawUsername) && !"sa".equals(rawUsername) ? rawUsername : "sa",
                rawPassword != null ? rawPassword : ""
            );
        }

        String trimmed = rawUrl.trim();

        // 2. Explicit H2 database (local development)
        if (trimmed.startsWith("jdbc:h2:")) {
            return new NormalizedDbConfig(
                trimmed,
                "org.h2.Driver",
                StringUtils.hasText(rawUsername) ? rawUsername : "sa",
                rawPassword != null ? rawPassword : ""
            );
        }

        // 3. PostgreSQL database (Cloud / Production)
        String finalUrl;
        String embeddedUser = null;
        String embeddedPass = null;

        if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
            int schemeEnd = trimmed.indexOf("://") + 3;
            String remainder = trimmed.substring(schemeEnd);

            if (!StringUtils.hasText(remainder)) {
                throw new IllegalArgumentException("Invalid PostgreSQL connection URL: missing host and database path");
            }

            int slashIdx = remainder.indexOf('/');
            int queryIdx = remainder.indexOf('?');
            int pathStart = remainder.length();
            if (slashIdx != -1 && queryIdx != -1) {
                pathStart = Math.min(slashIdx, queryIdx);
            } else if (slashIdx != -1) {
                pathStart = slashIdx;
            } else if (queryIdx != -1) {
                pathStart = queryIdx;
            }

            int atIdx = remainder.lastIndexOf('@', pathStart);
            String serverPart;
            if (atIdx != -1) {
                String userInfo = remainder.substring(0, atIdx);
                serverPart = remainder.substring(atIdx + 1);
                int colonIdx = userInfo.indexOf(':');
                if (colonIdx != -1) {
                    embeddedUser = userInfo.substring(0, colonIdx);
                    embeddedPass = userInfo.substring(colonIdx + 1);
                } else {
                    embeddedUser = userInfo;
                }
            } else {
                serverPart = remainder;
            }

            if (!StringUtils.hasText(serverPart)) {
                throw new IllegalArgumentException("Invalid PostgreSQL connection URL: missing host address");
            }

            finalUrl = "jdbc:postgresql://" + serverPart;
        } else if (trimmed.startsWith("jdbc:postgresql://")) {
            String remainder = trimmed.substring("jdbc:postgresql://".length());
            int slashIdx = remainder.indexOf('/');
            int queryIdx = remainder.indexOf('?');
            int pathStart = remainder.length();
            if (slashIdx != -1 && queryIdx != -1) {
                pathStart = Math.min(slashIdx, queryIdx);
            } else if (slashIdx != -1) {
                pathStart = slashIdx;
            } else if (queryIdx != -1) {
                pathStart = queryIdx;
            }

            int atIdx = remainder.lastIndexOf('@', pathStart);
            if (atIdx != -1) {
                String userInfo = remainder.substring(0, atIdx);
                String serverPart = remainder.substring(atIdx + 1);
                int colonIdx = userInfo.indexOf(':');
                if (colonIdx != -1) {
                    embeddedUser = userInfo.substring(0, colonIdx);
                    embeddedPass = userInfo.substring(colonIdx + 1);
                } else {
                    embeddedUser = userInfo;
                }
                finalUrl = "jdbc:postgresql://" + serverPart;
            } else {
                finalUrl = trimmed;
            }
        } else if (trimmed.startsWith("jdbc:postgres://")) {
            // Cloud template alias prefix
            finalUrl = "jdbc:postgresql://" + trimmed.substring("jdbc:postgres://".length());
        } else {
            // NEVER silently fall back to H2 when an invalid or unsupported production URL is supplied
            throw new IllegalArgumentException(
                "Unsupported or invalid database URL: '" + sanitizeUrl(trimmed) +
                "'. Expected 'jdbc:postgresql://', 'postgres://', 'postgresql://', or 'jdbc:h2:'."
            );
        }

        // Determine final username: prefer separate env var if not default 'sa', otherwise embedded URL user
        String finalUser;
        if (StringUtils.hasText(rawUsername) && !"sa".equals(rawUsername)) {
            finalUser = rawUsername;
        } else if (StringUtils.hasText(embeddedUser)) {
            finalUser = embeddedUser;
        } else if (StringUtils.hasText(rawUsername)) {
            finalUser = rawUsername;
        } else {
            finalUser = "";
        }

        // Determine final password: prefer separate env var if provided, otherwise embedded URL password
        String finalPass;
        if (StringUtils.hasText(rawPassword)) {
            finalPass = rawPassword;
        } else if (StringUtils.hasText(embeddedPass)) {
            finalPass = embeddedPass;
        } else {
            finalPass = "";
        }

        return new NormalizedDbConfig(
            finalUrl,
            "org.postgresql.Driver",
            finalUser,
            finalPass
        );
    }

    public static String sanitizeUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("://[^:@/]+:[^@/]+@", "://****:****@");
    }

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        String rawUrl = properties.getUrl();
        if (!StringUtils.hasText(rawUrl)) {
            rawUrl = System.getenv("SPRING_DATASOURCE_URL");
            if (!StringUtils.hasText(rawUrl)) {
                rawUrl = System.getenv("DATABASE_URL");
            }
        }

        String rawUser = properties.getUsername();
        if (!StringUtils.hasText(rawUser) || "sa".equals(rawUser)) {
            String envUser = System.getenv("SPRING_DATASOURCE_USERNAME");
            if (!StringUtils.hasText(envUser)) {
                envUser = System.getenv("DATABASE_USERNAME");
            }
            if (StringUtils.hasText(envUser)) {
                rawUser = envUser;
            }
        }

        String rawPass = properties.getPassword();
        if (!StringUtils.hasText(rawPass)) {
            String envPass = System.getenv("SPRING_DATASOURCE_PASSWORD");
            if (!StringUtils.hasText(envPass)) {
                envPass = System.getenv("DATABASE_PASSWORD");
            }
            if (StringUtils.hasText(envPass)) {
                rawPass = envPass;
            }
        }

        NormalizedDbConfig config = normalize(rawUrl, rawUser, rawPass);

        properties.setUrl(config.url());
        properties.setDriverClassName(config.driverClassName());
        properties.setUsername(config.username());
        properties.setPassword(config.password());

        log.info("Initialized DataSource: driver={}, url={}, user={}",
            config.driverClassName(),
            sanitizeUrl(config.url()),
            StringUtils.hasText(config.username()) ? config.username() : "(none)");

        return properties.initializeDataSourceBuilder().build();
    }

    @Bean
    public FlywayConfigurationCustomizer flywayConfigurationCustomizer(DataSourceProperties properties) {
        return configuration -> {
            String url = properties.getUrl();
            if (url != null && url.startsWith("jdbc:h2:")) {
                configuration.locations("classpath:db/migration-h2");
            }
        };
    }
}
