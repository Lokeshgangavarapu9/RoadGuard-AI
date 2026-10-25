package com.roadguard.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

/**
 * Production-ready DataSource configuration.
 * Normalizes cloud-provider PostgreSQL URLs (such as Render/Heroku connection strings
 * formatted as postgres://user:pass@host:port/db) into standard JDBC URLs (jdbc:postgresql://...).
 */
@Configuration
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

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
        if (rawUrl != null && (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://"))) {
            try {
                URI uri = new URI(rawUrl);
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath(); // includes leading slash

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path;
                properties.setUrl(jdbcUrl);
                log.info("Converted cloud PostgreSQL connection URL to JDBC format: jdbc:postgresql://{}:{}{}", host, port, path);

                if (uri.getUserInfo() != null) {
                    String[] userParts = uri.getUserInfo().split(":", 2);
                    if (properties.getUsername() == null || properties.getUsername().isEmpty() || "sa".equals(properties.getUsername())) {
                        properties.setUsername(userParts[0]);
                    }
                    if (userParts.length > 1 && (properties.getPassword() == null || properties.getPassword().isEmpty())) {
                        properties.setPassword(userParts[1]);
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse PostgreSQL URI {}, falling back to raw URL: {}", rawUrl, e.getMessage());
            }
        }
        return properties.initializeDataSourceBuilder().build();
    }
}
