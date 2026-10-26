import { GovernmentPortalAdapter } from '../GovernmentPortalAdapter.js';

/**
 * AP_PuramithraAdapter
 * Playwright automation adapter for Andhra Pradesh Urban Local Bodies (CDMA / Puramithra)
 * and State Public Grievance Redressal System (Mee Kosam PGRS).
 */
export class AP_PuramithraAdapter extends GovernmentPortalAdapter {
  constructor(baseUrl = 'https://cdma.ap.gov.in/services/grievances/') {
    super('AP_CDMA', 'Andhra Pradesh CDMA / Puramithra Grievance Portal', baseUrl);
  }

  canHandleComplaint(complaint) {
    if (!complaint) return false;
    const dept = (complaint.targetAuthorityCode || '').toUpperCase();
    return dept === 'CDMA_ULB' || dept === 'AP_RNB' || dept === 'AP_CDMA';
  }

  async openPortal(page, context) {
    try {
      await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (err) {
      throw new Error(`Failed to connect to AP CDMA / Puramithra portal at ${this.baseUrl}: ${err.message}`);
    }
  }

  async startAuthentication(page, citizenProfile) {
    const mobileInput = await page.$('input[name*="mobile" i], input[id*="mobile" i], #citizenMobile');
    if (mobileInput && citizenProfile && citizenProfile.phone) {
      const cleanPhone = citizenProfile.phone.replace(/[^0-9]/g, '').slice(-10);
      await mobileInput.fill(cleanPhone);
      const otpBtn = await page.$('button:has-text("Generate OTP"), button:has-text("Send OTP"), #sendOtpBtn');
      if (otpBtn) {
        await otpBtn.click();
      }
    }
  }

  async detectAuthenticationRequired(page) {
    const otpInput = await page.$('input[placeholder*="otp" i], input[name*="otp" i], #otpCode');
    if (otpInput) {
      return {
        otpRequired: true,
        captchaRequired: false,
        prompt: 'Government OTP required. Enter the SMS OTP received from AP PGRS / Puramithra.'
      };
    }

    const captchaElem = await page.$('img[src*="captcha" i], #captchaImg, iframe[src*="captcha"]');
    if (captchaElem) {
      return {
        otpRequired: false,
        captchaRequired: true,
        prompt: 'Government CAPTCHA required. Please complete the security CAPTCHA in the browser.'
      };
    }

    return { otpRequired: false, captchaRequired: false };
  }

  async submitOtp(page, otpCode) {
    const otpInput = await page.$('input[placeholder*="otp" i], input[name*="otp" i], #otpCode');
    if (otpInput) {
      await otpInput.fill(otpCode.trim());
      const verifyBtn = await page.$('button:has-text("Verify OTP"), button:has-text("Login"), #verifyOtpBtn');
      if (verifyBtn) {
        await verifyBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      throw new Error('OTP input field not found on AP Puramithra portal.');
    }
  }

  mapComplaintCategory(defectClass) {
    const norm = (defectClass || '').toLowerCase();
    if (norm.includes('buraco') || norm.includes('pothole')) {
      return 'Roads & Drains - Potholes / Damaged Road Surface';
    }
    if (norm.includes('tampa') || norm.includes('manhole')) {
      return 'Sanitation - Damaged / Missing Manhole Cover';
    }
    return 'Roads & Pavements Maintenance';
  }

  async fillCitizenDetails(page, citizenProfile) {
    const nameInput = await page.$('input[name*="name" i], #citizenName');
    if (nameInput && citizenProfile && citizenProfile.name) {
      await nameInput.fill(citizenProfile.name);
    }
  }

  async fillLocation(page, locationData) {
    const roadInput = await page.$('input[name*="street" i], input[name*="location" i], #streetLocation');
    if (roadInput && locationData.roadName) {
      await roadInput.fill(locationData.roadName);
    }

    const landmarkInput = await page.$('input[name*="landmark" i], #landmark');
    if (landmarkInput && locationData.landmark) {
      await landmarkInput.fill(locationData.landmark);
    }
  }

  async fillDescription(page, descriptionText) {
    const descArea = await page.$('textarea[name*="grievance" i], textarea[name*="desc" i], #grievanceDetails');
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
        console.warn(`[AP_PuramithraAdapter] Evidence upload skipped: ${err.message}`);
      }
    }
  }

  async reviewComplaint(page) {
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit Grievance"), #btnSubmitGrievance');
    if (!submitBtn) {
      throw new Error('Government portal interface changed. Submit button not found on AP Puramithra page.');
    }
  }

  async submitComplaint(page) {
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit Grievance"), #btnSubmitGrievance');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    } else {
      throw new Error('Submit button not located on AP Puramithra form.');
    }
  }

  async detectSubmissionConfirmation(page) {
    const confElem = await page.$('.receipt-container, .alert-success, :has-text("Grievance Registered Successfully"), :has-text("Grievance ID")');
    if (confElem) {
      const text = await confElem.innerText();
      return { confirmed: true, rawReceiptText: text };
    }
    return { confirmed: false, error: 'Confirmation receipt not detected on AP portal response.' };
  }

  async extractOfficialReferenceNumber(page) {
    const content = await page.content();
    const match = content.match(/PGRS[-\s]?[A-Z0-9\/-]{5,20}/i) || content.match(/(?:Grievance|Registration|Reference)\s*(?:ID|No|Number)[:\s]*([A-Z0-9\/-]{6,25})/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (match && match[0]) {
      return match[0].trim();
    }
    throw new Error('Could not extract official AP PGRS / Puramithra reference number from page DOM.');
  }

  async openStatusPage(page, refId) {
    await page.goto(`https://cdma.ap.gov.in/services/grievances/?ref=${encodeURIComponent(refId)}`, { waitUntil: 'domcontentloaded' });
  }

  async getStatusWhenSupported(page, refId) {
    await this.openStatusPage(page, refId);
    return { status: 'STATUS_CHECK_REQUIRED', details: 'Check official status on AP CDMA / Puramithra portal' };
  }
}
