package in.hutta.hsm.provider;

public class HsmConnectionContext {
  private static String url;
  private static String pin;

  public static void init(String hsmUrl, String hsmPin) {
    url = hsmUrl;
    pin = hsmPin;
  }

  public static String getUrl() {
    return url;
  }

  public static String getPin() {
    return pin;
  }
}
