import { GovernmentPortalAdapter } from '../GovernmentPortalAdapter.js';

/**
 * RajmargYatraAdapter
 * Playwright automation adapter for the official National Highways Authority of India (NHAI)
 * Rajmargyatra portal (https://rajmargyatra.nhai.gov.in/).
 * Strictly enforces human-in-the-loop OTP/CAPTCHA handoffs and truthful receipt capture.
 */
export class RajmargYatraAdapter extends GovernmentPortalAdapter {
  constructor(baseUrl = 'https://rajmargyatra.nhai.gov.in/') {
    super('RAJMARGYATRA_NHAI', 'NHAI Rajmargyatra Official Portal', baseUrl);
  }

  canHandleComplaint(complaint) {
    if (!complaint) return false;
    const road = (complaint.roadName || '').toUpperCase();
    const dept = (complaint.targetAuthorityCode || '').toUpperCase();
    return dept === 'NHAI' || road.startsWith('NH-') || road.startsWith('NH ');
  }

  async openPortal(page, context) {
    try {
      await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (err) {
      throw new Error(`Failed to reach official NHAI portal at ${this.baseUrl}: ${err.message}`);
    }
  }

  async startAuthentication(page, citizenProfile) {
    // Official Rajmargyatra mobile login interface
    const mobileInput = await page.$('input[type="tel"], input[placeholder*="mobile" i], input[name*="mobile" i], #mobileNumber');
    if (mobileInput && citizenProfile && citizenProfile.phone) {
      const cleanPhone = citizenProfile.phone.replace(/[^0-9]/g, '').slice(-10);
      await mobileInput.fill(cleanPhone);
      const submitBtn = await page.$('button[type="submit"], button:has-text("Send OTP"), button:has-text("Get OTP")');
      if (submitBtn) {
        await submitBtn.click();
      }
    }
  }

  async detectAuthenticationRequired(page) {
    // Detect OTP input presence
    const otpInput = await page.$('input[placeholder*="otp" i], input[name*="otp" i], input[id*="otp" i], .otp-input');
    if (otpInput) {
      return {
        otpRequired: true,
        captchaRequired: false,
        prompt: 'Government OTP required. Enter the OTP received on your registered mobile from NHAI Rajmargyatra.'
      };
    }

    // Detect CAPTCHA challenge
    const captchaElem = await page.$('iframe[src*="recaptcha"], iframe[src*="turnstile"], img[src*="captcha" i], #captcha, .captcha-image');
    if (captchaElem) {
      return {
        otpRequired: false,
        captchaRequired: true,
        prompt: 'Government CAPTCHA required. Complete the CAPTCHA in the browser window to continue.'
      };
    }

    return { otpRequired: false, captchaRequired: false };
  }

  async submitOtp(page, otpCode) {
    const otpInput = await page.$('input[placeholder*="otp" i], input[name*="otp" i], input[id*="otp" i], .otp-input');
    if (otpInput) {
      await otpInput.fill(otpCode.trim());
      const verifyBtn = await page.$('button:has-text("Verify"), button:has-text("Submit"), button[type="submit"]');
      if (verifyBtn) {
        await verifyBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      throw new Error('OTP input element not found on NHAI Rajmargyatra portal page.');
    }
  }

  mapComplaintCategory(defectClass) {
    const norm = (defectClass || '').toLowerCase();
    if (norm.includes('buraco') || norm.includes('pothole')) {
      return 'Potholes / Road Surface Damage';
    }
    if (norm.includes('trinca') || norm.includes('crack')) {
      return 'Cracks / Pavement Distress';
    }
    if (norm.includes('tampa') || norm.includes('manhole')) {
      return 'Drainage / Open Utility Cover';
    }
    return 'Road Maintenance / Hazard';
  }

  async fillCitizenDetails(page, citizenProfile) {
    const nameInput = await page.$('input[name*="name" i], input[placeholder*="name" i], #citizenName');
    if (nameInput && citizenProfile && citizenProfile.name) {
      await nameInput.fill(citizenProfile.name);
    }
  }

  async fillLocation(page, locationData) {
    // Locate GPS and road inputs
    const roadInput = await page.$('input[name*="road" i], input[placeholder*="highway" i], #highwayName');
    if (roadInput && locationData.roadName) {
      await roadInput.fill(locationData.roadName);
    }

    const latInput = await page.$('input[name*="lat" i], #latitude');
    if (latInput && locationData.latitude) {
      await latInput.fill(String(locationData.latitude));
    }

    const lonInput = await page.$('input[name*="long" i], #longitude');
    if (lonInput && locationData.longitude) {
      await lonInput.fill(String(locationData.longitude));
    }
  }

  async fillDescription(page, descriptionText) {
    const descArea = await page.$('textarea[name*="desc" i], textarea[placeholder*="complaint" i], #complaintDescription');
    if (descArea) {
      await descArea.fill(descriptionText);
    }
  }

  async uploadEvidence(page, evidenceFilePath) {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput && evidenceFilePath) {
      try {
        await fileInput.setInputFiles(evidenceFilePath);
      } catch (err) {
        console.warn(`[RajmargYatraAdapter] File upload skipped: ${err.message}`);
      }
    }
  }

  async reviewComplaint(page) {
    // Check if submit button is active
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit Grievance"), #submitGrievance');
    if (!submitBtn) {
      throw new Error('Government portal interface changed. Submit button not located.');
    }
  }

  async submitComplaint(page) {
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit Grievance"), #submitGrievance');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    } else {
      throw new Error('Submit button not found on NHAI Rajmargyatra form.');
    }
  }

  async detectSubmissionConfirmation(page) {
    // Search for official confirmation elements or modals
    const confElem = await page.$('.confirmation-modal, .alert-success, :has-text("Complaint Registered"), :has-text("Reference Number")');
    if (confElem) {
      const text = await confElem.innerText();
      return { confirmed: true, rawReceiptText: text };
    }
    return { confirmed: false, error: 'Official confirmation not yet detected. Outcome unverified.' };
  }

  async extractOfficialReferenceNumber(page) {
    // Extract genuine NHAI reference e.g. NHAI-2026-XXXX or numeric tracking ID
    const content = await page.content();
    const match = content.match(/NHAI[-\s]?[A-Z0-9]{4,15}/i) || content.match(/(?:Reference|Registration|Grievance)\s*(?:No|Number|ID)[:\s]*([A-Z0-9\/-]{5,20})/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (match && match[0]) {
      return match[0].trim();
    }
    throw new Error('Could not parse official NHAI reference number from page DOM.');
  }

  async openStatusPage(page, refId) {
    await page.goto(`https://rajmargyatra.nhai.gov.in/complaints?ref=${encodeURIComponent(refId)}`, { waitUntil: 'domcontentloaded' });
  }

  async getStatusWhenSupported(page, refId) {
    await this.openStatusPage(page, refId);
    return { status: 'STATUS_CHECK_REQUIRED', details: 'Check official status on Rajmargyatra tracking screen' };
  }
}
