import { GovernmentPortalAdapter } from '../GovernmentPortalAdapter.js';

export class MockPortalAdapter extends GovernmentPortalAdapter {
  constructor(baseUrl = 'http://127.0.0.1:8089/mock-portal') {
    super('MOCK_PORTAL', 'Official Citizen Redressal System (MOCK)', baseUrl);
  }

  canHandleComplaint(complaint) {
    return true; // Handles mock and training complaints
  }

  async openPortal(page, context) {
    await page.goto(`${this.baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  async startAuthentication(page, citizenProfile) {
    const mobile = (citizenProfile && citizenProfile.phone) ? citizenProfile.phone.replace(/[^0-9]/g, '').slice(-10) : '9876543210';
    await page.fill('#mobile', mobile);
    await page.click('#btn-request-otp');
    await page.waitForURL('**/mock-portal/otp', { timeout: 10000 });
  }

  async detectAuthenticationRequired(page) {
    const currentUrl = page.url();
    if (currentUrl.includes('/mock-portal/otp')) {
      return {
        otpRequired: true,
        captchaRequired: false,
        prompt: 'Government OTP required. Enter the OTP received on your registered mobile (Test default: 582914).'
      };
    }
    if (currentUrl.includes('/mock-portal/captcha')) {
      return {
        otpRequired: false,
        captchaRequired: true,
        prompt: 'Government CAPTCHA required. Complete the CAPTCHA in the browser (Answer: 19).'
      };
    }
    return { otpRequired: false, captchaRequired: false };
  }

  async submitOtp(page, otpCode) {
    await page.fill('#otp-input', otpCode.trim());
    await page.click('#btn-verify-otp');
    // After OTP, next is CAPTCHA or form
    await page.waitForTimeout(1000);
  }

  async solveCaptcha(page, answer = '19') {
    if (await page.$('#captcha-answer')) {
      await page.fill('#captcha-answer', answer);
      await page.click('#btn-submit-captcha');
      await page.waitForURL('**/mock-portal/complaint-form', { timeout: 10000 });
    }
  }

  mapComplaintCategory(defectClass) {
    const norm = (defectClass || '').toLowerCase();
    if (norm.includes('buraco') || norm.includes('pothole')) {
      return 'Pothole / Road Depression';
    }
    if (norm.includes('trinca_malha') || norm.includes('alligator')) {
      return 'Alligator / Mesh Pavement Distress';
    }
    if (norm.includes('trinca') || norm.includes('crack')) {
      return 'Longitudinal / Pavement Cracking';
    }
    if (norm.includes('tampa') || norm.includes('manhole')) {
      return 'Damaged Manhole / Drain Grate';
    }
    return 'Pothole / Road Depression';
  }

  async fillCitizenDetails(page, citizenProfile) {
    // Form pre-authenticated via session, no extra citizen fields needed
  }

  async fillLocation(page, locationData) {
    if (locationData.roadName && await page.$('#road_name')) {
      await page.fill('#road_name', locationData.roadName);
    }
    if (locationData.latitude && await page.$('#latitude')) {
      await page.fill('#latitude', String(locationData.latitude));
    }
    if (locationData.longitude && await page.$('#longitude')) {
      await page.fill('#longitude', String(locationData.longitude));
    }
    if (locationData.landmark && await page.$('#landmark')) {
      await page.fill('#landmark', locationData.landmark);
    }
  }

  async fillDescription(page, descriptionText) {
    if (await page.$('#description')) {
      await page.fill('#description', descriptionText || 'Hazardous road defect detected and confirmed by vehicular telematics.');
    }
  }

  async uploadEvidence(page, evidenceFilePath) {
    if (evidenceFilePath && await page.$('#photo-file')) {
      try {
        await page.setInputFiles('#photo-file', evidenceFilePath);
      } catch (err) {
        console.warn(`[MockPortalAdapter] Evidence file upload skipped: ${err.message}`);
      }
    }
  }

  async reviewComplaint(page) {
    // Verified form state ready for submission
    await page.waitForSelector('#submit-complaint-btn', { state: 'visible', timeout: 5000 });
  }

  async submitComplaint(page) {
    await page.click('#submit-complaint-btn');
    await page.waitForURL('**/mock-portal/acknowledgment', { timeout: 15000 });
  }

  async detectSubmissionConfirmation(page) {
    const isAck = page.url().includes('/mock-portal/acknowledgment');
    if (!isAck) {
      return { confirmed: false, error: 'Page URL did not navigate to acknowledgment slip.' };
    }
    const slip = await page.$('#acknowledgment-slip');
    if (!slip) {
      return { confirmed: false, error: 'Acknowledgment slip container not found in DOM.' };
    }
    const rawText = await page.innerText('#acknowledgment-slip');
    return { confirmed: true, rawReceiptText: rawText };
  }

  async extractOfficialReferenceNumber(page) {
    const refElem = await page.$('#official-reference-id');
    if (!refElem) {
      throw new Error('Could not find #official-reference-id element on acknowledgment page');
    }
    const text = (await refElem.innerText()).trim();
    if (!text || !text.startsWith('MOCK-NHAI-2026-')) {
      throw new Error(`Invalid mock reference number format extracted: '${text}'`);
    }
    return text;
  }

  async openStatusPage(page, refId) {
    await page.goto(`${this.baseUrl}/status?ref=${encodeURIComponent(refId)}`, { waitUntil: 'domcontentloaded' });
  }

  async getStatusWhenSupported(page, refId) {
    await this.openStatusPage(page, refId);
    const statusElem = await page.$('#status-value');
    if (statusElem) {
      const statusText = (await statusElem.innerText()).trim();
      return { status: statusText, details: 'Verified on mock authority tracking portal' };
    }
    return { status: 'STATUS_UNAVAILABLE' };
  }
}
