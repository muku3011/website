package in.hutta.lpa.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PortFilteringFilter implements Filter {

  @Value("${server.port:8093}")
  private int lpaPort;

  @Value("${ipa.port:8097}")
  private int ipaPort;

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    HttpServletRequest httpRequest = (HttpServletRequest) request;
    HttpServletResponse httpResponse = (HttpServletResponse) response;
    int localPort = request.getLocalPort();
    String uri = httpRequest.getRequestURI();

    // Actuator / health-check endpoints are permitted on both ports
    if (uri.startsWith("/actuator")) {
      chain.doFilter(request, response);
      return;
    }

    if (uri.startsWith("/ipa/") && localPort != ipaPort) {
      httpResponse.sendError(
          HttpServletResponse.SC_FORBIDDEN, "IPA endpoints are only accessible on port " + ipaPort);
      return;
    }
    if (uri.startsWith("/lpa/") && localPort != lpaPort) {
      httpResponse.sendError(
          HttpServletResponse.SC_FORBIDDEN, "LPA endpoints are only accessible on port " + lpaPort);
      return;
    }

    chain.doFilter(request, response);
  }
}
