import crypto from "crypto";

interface PendingPairing {
  otp: string;
  socketId: string;
  hostname: string;
  os: string;
  macAddress: string;
  ip: string;
  location: string;
  expiresAt: number;
}

export class OtpService {
  // In-memory store: Key is MAC address, Value is pairing data
  private static pendingPairings = new Map<string, PendingPairing>();

  /**
   * Generates a 5-digit OTP, saves it in memory, and sets an expiration time.
   */
  public static generateOtp(deviceData: {
    socketId: string;
    hostname: string;
    os: string;
    macAddress: string;
    ip: string;
    location: string;
  }): string {
    const otp = Math.floor(10000 + crypto.randomInt(90000)).toString(); // Generates 5-digit string
    const TTL = 5 * 60 * 1000; // 5 minutes validity

    this.pendingPairings.set(deviceData.macAddress, {
      ...deviceData,
      otp,
      expiresAt: Date.now() + TTL,
    });

    return otp;
  }

  /**
   * Validates an OTP submitted by an employee.
   */
  public static verifyOtp(
    macAddress: string,
    inputOtp: string,
  ): PendingPairing | null {
    const data = this.pendingPairings.get(macAddress);

    if (!data) return null;

    // Check if expired
    if (Date.now() > data.expiresAt) {
      this.pendingPairings.delete(macAddress);
      return null;
    }

    // Verify code match
    if (data.otp === inputOtp) {
      this.pendingPairings.delete(macAddress); // Remove once successfully consumed
      return data;
    }

    return null;
  }
}
