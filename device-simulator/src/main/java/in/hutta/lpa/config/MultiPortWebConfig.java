package in.hutta.lpa.config;

import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultiPortWebConfig {

  @Value("${ipa.port:8097}")
  private int ipaPort;

  @Bean
  public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
    return factory -> {
      Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
      connector.setPort(ipaPort);
      factory.addAdditionalConnectors(connector);
    };
  }
}
