/**
 * GovernmentPortalAdapter
 * Standardized interface for Government Grievance Portal automation adapters.
 * Implements strict security, human-in-the-loop handoff, and truthful confirmation extraction.
 */
export class GovernmentPortalAdapter {
  constructor(portalId, portalName, baseUrl) {
    this.portalId = portalId;
    this.portalName = portalName;
    this.baseUrl = baseUrl;
  }

  /**
   * Evaluates if this adapter can handle the given complaint based on authority and jurisdiction.
   * @param {Object} complaint
   * @returns {boolean}
   */
  canHandleComplaint(complaint) {
    throw new Error('canHandleComplaint() must be implemented by subclass');
  }

  /**
   * Opens the portal starting URL in the provided Playwright page.
   * @param {import('playwright').Page} page
   * @param {import('playwright').BrowserContext} context
   */
  async openPortal(page, context) {
    throw new Error('openPortal() must be implemented by subclass');
  }

  /**
   * Starts citizen authentication flow (e.g. entering mobile number).
   * @param {import('playwright').Page} page
   * @param {Object} citizenProfile
   */
  async startAuthentication(page, citizenProfile) {
    throw new Error('startAuthentication() must be implemented by subclass');
  }

  /**
   * Detects if human authentication (OTP or CAPTCHA) is required on the page.
   * @param {import('playwright').Page} page
   * @returns {Promise<{ otpRequired: boolean, captchaRequired: boolean, prompt?: string }>}
   */
  async detectAuthenticationRequired(page) {
    throw new Error('detectAuthenticationRequired() must be implemented by subclass');
  }

  /**
   * Enters the citizen-supplied OTP into the portal.
   * @param {import('playwright').Page} page
   * @param {string} otpCode
   */
  async submitOtp(page, otpCode) {
    throw new Error('submitOtp() must be implemented by subclass');
  }

  /**
   * Maps RoadGuard AI defect class to official portal category label.
   * @param {string} defectClass
   * @returns {string}
   */
  mapComplaintCategory(defectClass) {
    throw new Error('mapComplaintCategory() must be implemented by subclass');
  }

  /**
   * Fills citizen details if required by portal form.
   * @param {import('playwright').Page} page
   * @param {Object} citizenProfile
   */
  async fillCitizenDetails(page, citizenProfile) {
    throw new Error('fillCitizenDetails() must be implemented by subclass');
  }

  /**
   * Fills road, coordinates, and landmark into portal fields.
   * @param {import('playwright').Page} page
   * @param {Object} locationData
   */
  async fillLocation(page, locationData) {
    throw new Error('fillLocation() must be implemented by subclass');
  }

  /**
   * Fills factual complaint description dossier into portal textarea.
   * @param {import('playwright').Page} page
   * @param {string} descriptionText
   */
  async fillDescription(page, descriptionText) {
    throw new Error('fillDescription() must be implemented by subclass');
  }

  /**
   * Uploads verified photographic evidence file if present.
   * @param {import('playwright').Page} page
   * @param {string} evidenceFilePath
   */
  async uploadEvidence(page, evidenceFilePath) {
    throw new Error('uploadEvidence() must be implemented by subclass');
  }

  /**
   * Reviews the complaint form in the browser before final submit.
   * @param {import('playwright').Page} page
   */
  async reviewComplaint(page) {
    throw new Error('reviewComplaint() must be implemented by subclass');
  }

  /**
   * Performs the final click on the portal submission button.
   * @param {import('playwright').Page} page
   */
  async submitComplaint(page) {
    throw new Error('submitComplaint() must be implemented by subclass');
  }

  /**
   * Detects if the portal returned an official confirmation, failure, or timeout.
   * @param {import('playwright').Page} page
   * @returns {Promise<{ confirmed: boolean, error?: string, rawReceiptText?: string }>}
   */
  async detectSubmissionConfirmation(page) {
    throw new Error('detectSubmissionConfirmation() must be implemented by subclass');
  }

  /**
   * Extracts the official government acknowledgment / reference number from page DOM.
   * @param {import('playwright').Page} page
   * @returns {Promise<string>}
   */
  async extractOfficialReferenceNumber(page) {
    throw new Error('extractOfficialReferenceNumber() must be implemented by subclass');
  }

  /**
   * Opens official status page for a given reference ID.
   * @param {import('playwright').Page} page
   * @param {string} refId
   */
  async openStatusPage(page, refId) {
    throw new Error('openStatusPage() must be implemented by subclass');
  }

  /**
   * Extracts live grievance status when supported.
   * @param {import('playwright').Page} page
   * @param {string} refId
   * @returns {Promise<{ status: string, details?: string }>}
   */
  async getStatusWhenSupported(page, refId) {
    throw new Error('getStatusWhenSupported() must be implemented by subclass');
  }
}
