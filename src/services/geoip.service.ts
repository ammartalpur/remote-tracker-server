import axios from "axios";

export class GeoIpService {
  /**
   * Translates a public IP address into a "City, Country" string.
   * If it is a local/development IP (like ::1 or 127.0.0.1), it returns a placeholder.
   */
  public static async getLocationByIp(ip: string): Promise<string> {
    // Handle local development environments
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
      return "Local Development Environment";
    }

    try {
      // Using a free, reliable IP geolocation API for the server-side lookup
      const response = await axios.get(`https://ipapi.co/${ip}/json/`);

      if (response.data && !response.data.error) {
        const { city, country_name } = response.data;
        return `${city}, ${country_name}`;
      }

      return "Unknown Location";
    } catch (error) {
      console.error(
        `[GeoIP Service] Failed to fetch location for IP ${ip}:`,
        error,
      );
      return "Unknown Location (Lookup Failed)";
    }
  }
}
